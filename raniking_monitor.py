import gspread
import requests
import time
import os
import json
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# --- Configuração ---
# O ID da sua planilha (já deve estar no seu .env)
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
# A URL do Webhook do Discord (adicione ao seu .env)
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

# Nome do arquivo que guardará o ID do último líder para evitar spam
STATE_FILE = "last_kd_leader.txt"

# Nome da aba da sua planilha
SHEET_NAME = "Platoon"

# URL da imagem para o K/D
URL_KD_IMAGE = "https://drop-assets.ea.com/images/1wDgAz9SyJzhBM0nMmxKGN/ee548a4abd7ca47439cb45da7d7153e8/KDRATIO.svg"


def authenticate_gspread():
    """Autentica com a API do Google usando a conta de serviço."""
    try:
        gc = gspread.service_account(filename='credentials.json')
        print("✅ Autenticação com Google Sheets bem-sucedida.")
        return gc
    except Exception as e:
        print(f"❌ Erro ao autenticar com Google Sheets: {e}")
        return None

def get_sheet_data(gc):
    """Busca e retorna os dados da planilha."""
    try:
        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(SHEET_NAME)
        # Pega todos os dados como uma lista de dicionários
        return worksheet.get_all_records()
    except Exception as e:
        print(f"❌ Erro ao buscar dados da planilha: {e}")
        return []

def find_top_kd_player(players_data):
    """Encontra o jogador com o maior K/D na lista de dados."""
    top_player = None
    max_kd = -1.0

    for player in players_data:
        try:
            # Pega o valor de K/D e converte para número, tratando vírgula como ponto
            kd_str = str(player.get('K/D', '0')).replace(',', '.')
            kd_value = float(kd_str)
            
            if kd_value > max_kd:
                max_kd = kd_value
                top_player = player
        except (ValueError, TypeError):
            # Ignora linhas onde o K/D não é um número válido
            continue
            
    return top_player

def read_last_leader():
    """Lê o ID do último líder do arquivo de estado."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return f.read().strip()
    return None

def write_last_leader(player_id):
    """Escreve o ID do novo líder no arquivo de estado."""
    with open(STATE_FILE, 'w') as f:
        f.write(str(player_id))

def post_to_discord(player):
    """Posta a mensagem formatada no Discord."""
    player_rank = player.get('Ranking', 'Soldado')
    player_name = player.get('Nome', 'N/D')
    player_id = player.get('ID', 'N/D')
    player_kd = player.get('K/D', 'N/A')

    message = f"O {player_rank} **{player_name} | {player_id}** tem agora o maior K/D!"

    # Usamos "embeds" para uma aparência mais profissional
    payload = {
        "embeds": [{
            "author": {
                "name": "👑 NOVO REI DO K/D! 👑",
                "icon_url": URL_KD_IMAGE
            },
            "description": message,
            "color": 16766720, # Cor dourada
            "fields": [
                {
                    "name": "Novo K/D",
                    "value": f"**{player_kd}**",
                    "inline": True
                }
            ],
            "footer": {
                "text": "BF6.online | Ranking Monitor"
            }
        }]
    }

    try:
        response = requests.post(DISCORD_WEBHOOK_URL, data=json.dumps(payload), headers={'Content-Type': 'application/json'})
        response.raise_for_status() # Lança um erro para status HTTP ruins (4xx ou 5xx)
        print("✅ Mensagem enviada ao Discord com sucesso!")
    except requests.exceptions.RequestException as e:
        print(f"❌ Erro ao enviar mensagem para o Discord: {e}")

def main():
    gc = authenticate_gspread()
    if not gc:
        return

    while True:
        print("\n--- Iniciando verificação de ranking ---")
        
        # 1. Busca os dados atuais da planilha
        players = get_sheet_data(gc)
        if not players:
            print("Nenhum dado de jogador encontrado. Tentando novamente em 30 minutos.")
            time.sleep(1800)
            continue
        
        # 2. Encontra o jogador com maior K/D
        current_leader = find_top_kd_player(players)
        if not current_leader:
            print("Não foi possível determinar um líder de K/D. Verifique os dados na planilha.")
            time.sleep(1800)
            continue

        print(f"🏆 Líder atual de K/D na planilha: {current_leader.get('Nome')} ({current_leader.get('K/D')})")

        # 3. Compara com o último líder registrado
        last_leader_id = read_last_leader()
        current_leader_id = current_leader.get('ID')

        if current_leader_id != last_leader_id:
            print(f"🎉 MUDANÇA DE LÍDER! O novo rei é {current_leader.get('Nome')}.")
            post_to_discord(current_leader)
            write_last_leader(current_leader_id)
        else:
            print("👍 O líder de K/D permanece o mesmo. Nenhuma notificação necessária.")

        # 4. Aguarda 30 minutos para a próxima verificação
        print("Aguardando 30 minutos para a próxima verificação...")
        time.sleep(1800) # 30 minutos * 60 segundos

if __name__ == "__main__":
    main()