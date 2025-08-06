import os
import time
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime # --- NOVO --- Importa a biblioteca de data e hora
import pytz # --- NOVO --- Importa a biblioteca para fuso horário

# --- Importações para a API do Google ---
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv

load_dotenv()

# --- Configuração Global ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
PLAYER_ID_RANGE = 'Platoon!C2:C' 
STATS_DIR = "stats_battlefield"

# --- NOVO --- Define a célula onde a data de atualização será escrita
UPDATE_TIMESTAMP_CELL = 'Platoon!A1'

def authenticate_google_sheets():
    """
    Autentica o usuário para a API do Google Sheets.
    Cria ou atualiza o 'token.json' com as novas permissões de escrita.
    """
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None
        
        if not creds:
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
        
        stats = {}
        stat_map = {
            'stat-kd': 'K/D', 'stat-spm': 'SPM', 'stat-kpm': 'KPM',
            'stat-kills': 'Kills', 'stat-score': 'Score', 'stat-time-played': 'Time'
        }
        
        for html_id, stat_name in stat_map.items():
            element = soup.find('strong', id=html_id)
            stats[stat_name] = element.get_text(strip=True) if element else "N/A"
                
        return stats
        
    except FileNotFoundError:
        print(f"⚠️  Arquivo não encontrado: {file_path}")
        return None
    except Exception as e:
        print(f"❌ Erro ao processar o arquivo {file_path}: {e}")
        return None

def update_timestamp(sheet):
    """ --- NOVA FUNÇÃO ---
    Escreve a data e hora atuais na célula especificada.
    """
    try:
        # Define o fuso horário de São Paulo
        tz = pytz.timezone('America/Sao_Paulo')
        now = datetime.now(tz)
        # Formata a data e hora para um formato legível
        timestamp_str = f"Última atualização: {now.strftime('%d/%m/%Y às %H:%M:%S')}"
        
        print(f"\n🕒 Registrando data e hora: '{timestamp_str}'")
        
        values_to_write = [[timestamp_str]]
        body = {'values': values_to_write}
        
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=UPDATE_TIMESTAMP_CELL,
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        print("✅ Data e hora de atualização registradas com sucesso na planilha.")
    except HttpError as err:
        print(f"❌ Erro ao registrar a data de atualização: {err}")
    except Exception as e:
        print(f"❌ Um erro inesperado ocorreu ao registrar a data: {e}")


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

    print("📊 Lendo a lista de jogadores da planilha...")
    try:
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=PLAYER_ID_RANGE).execute()
        player_ids_in_sheet = result.get('values', [])
        player_row_map = {row[0]: index + 2 for index, row in enumerate(player_ids_in_sheet) if row}
        print(f"👍 Encontrados {len(player_row_map)} jogadores na planilha.")
    except HttpError as err:
        print(f"❌ Erro ao ler a planilha: {err}")
        return

    if not os.path.exists(STATS_DIR):
        print(f"❌ O diretório '{STATS_DIR}' não foi encontrado. Execute o script de extração primeiro.")
        return

    files_to_process = [f for f in os.listdir(STATS_DIR) if f.endswith('.txt')]
    print(f"📂 Encontrados {len(files_to_process)} arquivos de estatísticas para processar.")

    for filename in files_to_process:
        player_id = filename.replace('_stats.txt', '')
        print(f"\n--- Processando: {player_id} ---")

        if player_id in player_row_map:
            row_to_update = player_row_map[player_id]
            file_path = os.path.join(STATS_DIR, filename)
            
            stats = parse_stats_from_file(file_path)
            
            if stats:
                print(f"🔍 Estatísticas extraídas: {stats}")
                
                values_to_write = [[
                    stats.get('K/D', 'N/A'), stats.get('SPM', 'N/A'),
                    stats.get('KPM', 'N/A'), stats.get('Kills', 'N/A'),
                    stats.get('Score', 'N/A'), stats.get('Time', 'N/A')
                ]]
                
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
    
    # --- NOVO --- Chama a função para registrar a data/hora no final de tudo
    update_timestamp(sheet)
            
    print("\n🎉 Processo de atualização concluído!")


if __name__ == "__main__":
    main()