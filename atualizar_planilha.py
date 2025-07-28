import os
import time
from bs4 import BeautifulSoup
import pandas as pd

# --- Importações para a API do Google ---
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
from dotenv import load_dotenv

load_dotenv()

# --- Configuração Global ---

# ATENÇÃO: O escopo mudou para permitir a ESCRITA na planilha
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
# Define a aba e a coluna onde estão os IDs dos jogadores
PLAYER_ID_RANGE = 'Platoon!C2:C' 
# Define o diretório onde os arquivos HTML foram salvos
STATS_DIR = "stats_battlefield"

def authenticate_google_sheets():
    """
    Autentica o usuário para a API do Google Sheets.
    Cria ou atualiza o 'token.json' com as novas permissões de escrita.
    """
    creds = None
    # Apague o token.json antigo se ele existir, para forçar a nova autenticação
    # com permissão de escrita. O script também tentará lidar com isso.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        # Se as credenciais antigas não tiverem o escopo correto, elas serão inválidas
        if creds and creds.expired and creds.refresh_token:
            # Tenta renovar. Se o escopo mudou, isso pode falhar e ir para o 'else'.
            try:
                creds.refresh(Request())
            except Exception:
                creds = None # Força a recriação
        
        if not creds:
            # Apaga o token antigo para garantir que a tela de consentimento apareça
            if os.path.exists('token.json'):
                os.remove('token.json')
                print("🗑️ Token de permissão antigo removido. Uma nova autorização será necessária.")
            
            if not os.path.exists('credentials.json'):
                print("❌ ERRO: O arquivo 'credentials.json' não foi encontrado.")
                return None
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    try:
        service = build('sheets', 'v4', credentials=creds)
        return service
    except HttpError as err:
        print(f"❌ Um erro da API do Google ocorreu: {err}")
        return None

def parse_stats_from_file(file_path):
    """
    Lê um arquivo HTML e extrai as estatísticas do jogador.
    Retorna um dicionário com os dados.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        # Dicionário para guardar as estatísticas encontradas
        stats = {}
        
        # Mapeia o ID do elemento no HTML para o nome da nossa estatística
        stat_map = {
            'stat-kd': 'K/D',
            'stat-spm': 'SPM',
            'stat-kpm': 'KPM',
            'stat-kills': 'Kills',
            'stat-score': 'Score',
            'stat-time-played': 'Time'
        }
        
        for html_id, stat_name in stat_map.items():
            element = soup.find('strong', id=html_id)
            if element:
                stats[stat_name] = element.get_text(strip=True)
            else:
                stats[stat_name] = "N/A" # Caso não encontre a estatística
                
        return stats
        
    except FileNotFoundError:
        print(f"⚠️  Arquivo não encontrado: {file_path}")
        return None
    except Exception as e:
        print(f"❌ Erro ao processar o arquivo {file_path}: {e}")
        return None

def main():
    """
    Função principal que orquestra a leitura dos arquivos,
    extração dos dados e atualização da planilha.
    """
    print("Iniciando o processo de atualização da planilha...")
    service = authenticate_google_sheets()
    if not service:
        return
    
    sheet = service.spreadsheets()

    # 1. Obter a lista de jogadores da planilha para saber em qual linha escrever
    print("📊 Lendo a lista de jogadores da planilha...")
    try:
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=PLAYER_ID_RANGE).execute()
        player_ids_in_sheet = result.get('values', [])
        # Criar um mapa de 'player_id' para 'número_da_linha'
        # Adicionamos 2 porque o range começa na linha 2
        player_row_map = {row[0]: index + 2 for index, row in enumerate(player_ids_in_sheet) if row}
        print(f"👍 Encontrados {len(player_row_map)} jogadores na planilha.")
    except HttpError as err:
        print(f"❌ Erro ao ler a planilha: {err}")
        return

    # 2. Iterar sobre os arquivos de estatísticas salvos
    if not os.path.exists(STATS_DIR):
        print(f"❌ O diretório '{STATS_DIR}' não foi encontrado. Execute o script de extração primeiro.")
        return

    files_to_process = [f for f in os.listdir(STATS_DIR) if f.endswith('.txt')]
    print(f"📂 Encontrados {len(files_to_process)} arquivos de estatísticas para processar.")

    for filename in files_to_process:
        # Extrai o player_id do nome do arquivo (ex: 'chrisley_chrys_stats.txt' -> 'chrisley_chrys')
        player_id = filename.replace('_stats.txt', '')
        print(f"\n--- Processando: {player_id} ---")

        if player_id in player_row_map:
            row_to_update = player_row_map[player_id]
            file_path = os.path.join(STATS_DIR, filename)
            
            # 3. Extrair os dados do arquivo
            stats = parse_stats_from_file(file_path)
            
            if stats:
                print(f"🔍 Estatísticas extraídas: {stats}")
                
                # 4. Preparar e enviar os dados para a planilha
                # A ordem DEVE corresponder à ordem das colunas na sua planilha
                # K/D (D), SPM (E), KPM (F), Kills (G), Score (H), Time (I)
                values_to_write = [[
                    stats.get('K/D', 'N/A'),
                    stats.get('SPM', 'N/A'),
                    stats.get('KPM', 'N/A'),
                    stats.get('Kills', 'N/A'),
                    stats.get('Score', 'N/A'),
                    stats.get('Time', 'N/A')
                ]]
                
                # O range para escrita começa na coluna D da linha correta
                range_to_write = f'Platoon!E{row_to_update}'
                
                try:
                    print(f"✍️  Escrevendo dados na linha {row_to_update}...")
                    body = {'values': values_to_write}
                    sheet.values().update(
                        spreadsheetId=SPREADSHEET_ID,
                        range=range_to_write,
                        valueInputOption='USER_ENTERED',
                        body=body
                    ).execute()
                    print("✅ Dados atualizados com sucesso!")
                except HttpError as err:
                    print(f"❌ Erro ao escrever na planilha para {player_id}: {err}")
        else:
            print(f"⚠️  O jogador '{player_id}' foi encontrado no arquivo, mas não na lista da planilha. Pulando.")
            
    print("\n🎉 Processo de atualização concluído!")


if __name__ == "__main__":
    main()