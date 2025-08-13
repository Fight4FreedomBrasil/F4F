import os
import json
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# --- Importações para a API do Google ---
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

load_dotenv()

# --- Configuração ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
TARGET_SHEET = 'Platoon'
RANGE_PLAYERS = f'{TARGET_SHEET}!C2:C100'
BASE_URL = "https://www.ea.com/games/battlefield/battlefield-6/player-stats"

# Ordem final das colunas para escrita na planilha (K até P)
HEADERS_ORDER = ['KD', 'Kills', 'Assists', 'Revives', 'Partidas', 'XP']

def authenticate_google_sheets():
    """Autentica com a API do Google e retorna o objeto de serviço."""
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('sheets', 'v4', credentials=creds)

def extract_stats_from_json(data):
    """Extrai os dados de estatísticas do objeto JSON da página."""
    try:
        stats = data['props']['pageProps']['statsSummary']['playerStatsSummary']['stats']
        player_stats = {
            'KD': stats.get('kill_death_ratio', {}).get('value', 'N/A'),
            'Kills': stats.get('total_kills', {}).get('value', 'N/A'),
            'Assists': stats.get('total_assists', {}).get('value', 'N/A'),
            'Revives': stats.get('total_revives', {}).get('value', 'N/A'),
            'Partidas': stats.get('total_matches_played', {}).get('value', 'N/A'),
            'XP': stats.get('total_xp', {}).get('value', 'N/A')
        }
        return player_stats
    except (KeyError, TypeError):
        return None

def main():
    service = authenticate_google_sheets()
    if not service: return

    try:
        result = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=RANGE_PLAYERS).execute()
        player_rows = result.get('values', [])
        player_map = {row[0]: i + 2 for i, row in enumerate(player_rows) if row and row[0]}
        print(f"✅ {len(player_map)} jogadores encontrados na planilha para processar.")
    except HttpError as e:
        print(f"❌ Erro ao ler a planilha: {e}")
        return

    all_player_stats = {}
    
    for player_id in player_map.keys():
        print(f"\n--- Processando jogador: {player_id} ---")
        try:
            stats_url = f"{BASE_URL}/{player_id}"
            print(f"🔗 Acessando URL: {stats_url}")
            
            response = requests.get(stats_url, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            json_script_tag = soup.find('script', id='__NEXT_DATA__')
            
            if not json_script_tag:
                print(f"⚠️ Tag de dados não encontrada para '{player_id}'.")
                continue

            page_data = json.loads(json_script_tag.string)
            stats = extract_stats_from_json(page_data)

            if stats:
                all_player_stats[player_id] = stats
                print(f"📊 Estatísticas extraídas com sucesso para {player_id}.")
            else:
                print(f"⚠️ Jogador '{player_id}' encontrado, mas sem dados de estatísticas.")

        except requests.exceptions.HTTPError as e:
            print(f"❌ Erro HTTP para '{player_id}': Página não encontrada ou retornou erro {e.response.status_code}.")
        except Exception as e:
            print(f"❌ Um erro inesperado ocorreu para '{player_id}': {e}")
    
    if all_player_stats:
        batch_update_data = []
        for player_id, stats in all_player_stats.items():
            row_num = player_map.get(player_id)
            if row_num:
                row_values = [stats.get(header, 'N/A') for header in HEADERS_ORDER]
                batch_update_data.append({'range': f'{TARGET_SHEET}!K{row_num}:P{row_num}', 'values': [row_values]})

        if batch_update_data:
            print(f"\n⚙️  Atualizando dados de {len(batch_update_data)} linhas na planilha...")
            try:
                # ETAPA 1: Escrever os valores
                body = {'valueInputOption': 'USER_ENTERED', 'data': batch_update_data}
                service.spreadsheets().values().batchUpdate(spreadsheetId=SPREADSHEET_ID, body=body).execute()
                print("✅ Dados atualizados com sucesso!")

                # ############################################################### #
                # ##               NOVO BLOCO PARA FORMATAÇÃO                  ## #
                # ############################################################### #
                print("🎨 Aplicando formatação (Centro e Texto Simples)...")
                
                # Encontra o ID numérico da aba (necessário para a API de formatação)
                sheet_metadata = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
                target_sheet_id = None
                for sheet in sheet_metadata.get('sheets', ''):
                    if sheet.get('properties', {}).get('title', '') == TARGET_SHEET:
                        target_sheet_id = sheet.get('properties', {}).get('sheetId', '')
                        break
                
                if target_sheet_id is not None:
                    # Monta a requisição de formatação
                    formatting_requests = [{
                        'repeatCell': {
                            'range': {
                                'sheetId': target_sheet_id,
                                'startRowIndex': 1, # Linha 2 (índice 1) até o final
                                'startColumnIndex': 10, # Coluna K (A=0 ... K=10)
                                'endColumnIndex': 16   # Até a coluna P (índice 15)
                            },
                            'cell': {
                                'userEnteredFormat': {
                                    'horizontalAlignment': 'CENTER',
                                    'numberFormat': { 'type': 'TEXT' }
                                }
                            },
                            # Especifica quais campos de formatação estamos alterando
                            'fields': 'userEnteredFormat(horizontalAlignment, numberFormat)'
                        }
                    }]

                    # Envia a requisição de formatação
                    service.spreadsheets().batchUpdate(
                        spreadsheetId=SPREADSHEET_ID,
                        body={'requests': formatting_requests}
                    ).execute()
                    print("✅ Formatação aplicada com sucesso!")
                else:
                    print(f"⚠️ Não foi possível encontrar o ID da aba '{TARGET_SHEET}' para aplicar a formatação.")
                
            except HttpError as e:
                print(f"❌ Erro durante a atualização ou formatação: {e}")
    else:
        print("\n🤷 Nenhuma estatística foi extraída para atualizar a planilha.")

if __name__ == "__main__":
    main()