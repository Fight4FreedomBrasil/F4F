import os
import json
import time
import random
from dotenv import load_dotenv

# --- Imports do Selenium ---
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.common.exceptions import WebDriverException, NoSuchElementException

# --- Imports do Google Sheets ---
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
BASE_URL = "https://api.tracker.gg/api/v2/bf6/standard/profile/origin/"
HEADERS_ORDER = ['KD', 'Kills', 'Assists', 'Revives', 'Partidas', 'Time Played']
FAILED_PLAYERS_FILE = 'jogadores_falharam.json'


PROXY_LIST = [
    
    # "188.45.12.10:8080",  # Exemplo de proxy
    # "usuario123:senhaXYZ@192.160.3.45:3128", # Exemplo com autenticação
]


def authenticate_google_sheets():
    # ... (função sem alterações)
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

def setup_driver(proxy=None): # <--- MODIFICADO para aceitar um proxy
    """Configura e retorna um driver do Edge, opcionalmente com um proxy."""
    edge_options = EdgeOptions()
    edge_options.add_argument('--disable-blink-features=AutomationControlled')
    edge_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    edge_options.add_experimental_option('useAutomationExtension', False)
    edge_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    edge_options.add_argument('--headless=new')
    edge_options.add_argument('--disable-gpu')
    edge_options.add_argument('--no-sandbox')
    
    # Adiciona o proxy se ele for fornecido
    if proxy:
        edge_options.add_argument(f'--proxy-server={proxy}')
        print(f"   -> Usando Proxy: {proxy.split('@')[-1]}") # Mostra IP:PORTA sem revelar user/pass
    
    driver_path = os.path.join(os.getcwd(), 'msedgedriver.exe')
    if not os.path.exists(driver_path):
        print(f"❌ ERRO: 'msedgedriver.exe' não encontrado na pasta: {os.getcwd()}")
        return None
        
    service = EdgeService(executable_path=driver_path)
    driver = webdriver.Edge(service=service, options=edge_options)
    
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


def parse_stats_from_json_data(api_data):
    # ... (função sem alterações)
    try:
        stats = api_data.get('data', {}).get('segments', [{}])[0].get('stats', {})
        if not stats: return None
        return {
            'KD': str(stats.get('kdRatio', {}).get('value', '0')),
            'Kills': str(stats.get('kills', {}).get('value', '0')),
            'Assists': str(stats.get('assists', {}).get('value', '0')),
            'Revives': str(stats.get('revives', {}).get('value', '0')),
            'Partidas': str(stats.get('matchesPlayed', {}).get('value', '0')),
            'Time Played': stats.get('timePlayed', {}).get('displayValue', '0h')
        }
    except (KeyError, TypeError, IndexError): return None


# ############################################################### #
# ##          LÓGICA DE ARQUIVO PARA JOGADORES QUE FALHARAM      ## #
# ############################################################### #

def load_failed_players():
    """Carrega a lista de jogadores do arquivo JSON de falhas."""
    if os.path.exists(FAILED_PLAYERS_FILE):
        with open(FAILED_PLAYERS_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_failed_players(failed_list):
    """Salva a lista atualizada de jogadores no arquivo JSON de falhas."""
    with open(FAILED_PLAYERS_FILE, 'w') as f:
        json.dump(list(set(failed_list)), f, indent=4) # Usa set para garantir que não haja duplicados
    print(f"\n📝 Arquivo de falhas '{FAILED_PLAYERS_FILE}' atualizado com {len(failed_list)} jogadores.")


def main():
    service = authenticate_google_sheets()
    if not service: return

    # --- LÓGICA DE DECISÃO: Tentar os que falharam ou todos? ---
    failed_players_list = load_failed_players()
    
    if failed_players_list:
        print(f"🔄 MODO DE RETENTATIVA: Processando {len(failed_players_list)} jogadores que falharam anteriormente.")
        players_to_process = failed_players_list
    else:
        print("✅ MODO NORMAL: Processando todos os jogadores da planilha.")
        try:
            result = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=RANGE_PLAYERS).execute()
            player_rows = result.get('values', [])
            players_to_process = [row[0] for row in player_rows if row and row[0]]
            print(f"   -> {len(players_to_process)} jogadores encontrados na planilha.")
        except HttpError as e:
            print(f"❌ Erro ao ler a planilha: {e}")
            return

    all_player_stats = {}
    successful_players_this_run = []
    failed_players_this_run = []
    total_players = len(players_to_process)
    
    print("\n🚀 INICIANDO EXTRAÇÃO COM ROTAÇÃO DE IP 🔄")
    
    driver = None # Inicia o driver como None

    try:
        for i, player_id in enumerate(players_to_process, 1):
            if driver: # Fecha o driver anterior se existir
                driver.quit()

            # Escolhe um proxy aleatório da lista, se houver
            proxy = random.choice(PROXY_LIST) if PROXY_LIST else None
            
            print(f"\n{'─'*60}")
            print(f"📋 [{i}/{total_players}] Jogador: {player_id}")
            print(f"{'─'*60}")
            print("⏳ Configurando navegador...")
            driver = setup_driver(proxy) # Cria um novo driver com um novo proxy
            if not driver:
                print("   -> ❌ Falha ao iniciar o navegador. Pulando jogador.")
                failed_players_this_run.append(player_id)
                continue
            
            stats = None
            try:
                url = f"{BASE_URL}{player_id}"
                print(f"🔗 Acessando: {url}")
                driver.get(url)
                body_text = driver.find_element(By.TAG_NAME, 'body').text

                if "error" in body_text.lower() or "not found" in body_text.lower():
                    print(f"   -> ⚠️  Jogador '{player_id}' não encontrado (API retornou um erro).")
                    successful_players_this_run.append(player_id) # Consideramos sucesso para remover da lista de falhas
                elif "rate limited" in body_text.lower() or "error 1015" in body_text:
                    print(f"   -> 🚫 BLOQUEADO (RATE LIMIT) para o jogador '{player_id}'.")
                    failed_players_this_run.append(player_id)
                else:
                    api_data = json.loads(body_text)
                    stats = parse_stats_from_json_data(api_data)
                    
            except Exception as e:
                print(f"   -> ❌ Erro inesperado durante a extração para '{player_id}': {e}")
                failed_players_this_run.append(player_id)
            
            if stats:
                all_player_stats[player_id] = stats
                successful_players_this_run.append(player_id)
                print(f"   -> 📊 Estatísticas extraídas com sucesso!")
            elif player_id not in successful_players_this_run:
                failed_players_this_run.append(player_id)
                all_player_stats[player_id] = {header: "0" for header in HEADERS_ORDER}
            
            if i < total_players:
                wait_time = random.uniform(5.0, 15.0) # Pausa menor, pois já trocamos de IP
                print(f"   -> ⏳ Aguardando {wait_time:.1f}s...")
                time.sleep(wait_time)
                
    finally:
        if driver:
            print("\n🔒 Fechando último navegador...")
            driver.quit()
        
        # --- ATUALIZA O ARQUIVO DE FALHAS ---
        current_failures = set(load_failed_players())
        successes = set(successful_players_this_run)
        new_failures = set(failed_players_this_run)
        
        # Remove os que tiveram sucesso e adiciona as novas falhas
        updated_failures = list((current_failures - successes) | new_failures)
        save_failed_players(updated_failures)



    
    if all_player_stats:
        batch_update_data = []
        for player_id, stats in all_player_stats.items():
            row_num = player_map.get(player_id)
            if row_num:
                row_values = [stats.get(header, '0') for header in HEADERS_ORDER]
                batch_update_data.append({
                    'range': f'{TARGET_SHEET}!K{row_num}:P{row_num}',
                    'values': [row_values]
                })

        if batch_update_data:
            print(f"\n{'='*60}")
            print(f"⚙️  ATUALIZANDO PLANILHA")
            print(f"{'='*60}")
            print(f"📝 Atualizando dados de {len(batch_update_data)} linhas...")
            try:
                # ETAPA 1: Escrever os valores
                body = {'valueInputOption': 'USER_ENTERED', 'data': batch_update_data}
                service.spreadsheets().values().batchUpdate(spreadsheetId=SPREADSHEET_ID, body=body).execute()
                print("✅ Dados atualizados com sucesso!")

                # ETAPA 2: Aplicar formatação
                print("🎨 Aplicando formatação (Centro e Texto Simples)...")
                
                sheet_metadata = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
                target_sheet_id = None
                for sheet in sheet_metadata.get('sheets', ''):
                    if sheet.get('properties', {}).get('title', '') == TARGET_SHEET:
                        target_sheet_id = sheet.get('properties', {}).get('sheetId', '')
                        break
                
                if target_sheet_id is not None:
                    formatting_requests = [{'repeatCell': {
                        'range': {
                            'sheetId': target_sheet_id,
                            'startRowIndex': 1,
                            'startColumnIndex': 10,
                            'endColumnIndex': 16
                        },
                        'cell': { 'userEnteredFormat': {
                            'horizontalAlignment': 'CENTER',
                            'numberFormat': { 'type': 'TEXT' }
                        }},
                        'fields': 'userEnteredFormat(horizontalAlignment, numberFormat)'
                    }}]
                    service.spreadsheets().batchUpdate(
                        spreadsheetId=SPREADSHEET_ID,
                        body={'requests': formatting_requests}
                    ).execute()
                    print("✅ Formatação aplicada com sucesso!")
                else:
                    print(f"⚠️ Não foi possível encontrar o ID da aba '{TARGET_SHEET}' para aplicar a formatação.")
                
                print("\n" + "="*60)
                print("🎉 PROCESSO CONCLUÍDO COM SUCESSO!")
                print("="*60)
                
            except HttpError as e:
                print(f"❌ Erro durante a atualização ou formatação: {e}")
    else:
        print("\n🤷 Nenhuma estatística foi extraída para atualizar a planilha.")

if __name__ == "__main__":
    main()