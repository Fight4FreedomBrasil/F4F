import os
import json
import time
from dotenv import load_dotenv

# --- Imports do Selenium ---
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.common.exceptions import WebDriverException

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

def authenticate_google_sheets():
    """Autentica com a API do Google Sheets e retorna um objeto de serviço."""
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

def setup_driver():
    """Configura e retorna um driver do Edge."""
    edge_options = EdgeOptions()
    edge_options.add_argument('--disable-blink-features=AutomationControlled')
    edge_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    edge_options.add_experimental_option('useAutomationExtension', False)
    edge_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    edge_options.add_argument('--headless=new')
    edge_options.add_argument('--disable-gpu')
    edge_options.add_argument('--no-sandbox')
    
    driver_path = os.path.join(os.getcwd(), 'msedgedriver.exe')
    if not os.path.exists(driver_path):
        print(f"❌ ERRO: 'msedgedriver.exe' não encontrado na pasta: {os.getcwd()}")
        return None
        
    service = EdgeService(executable_path=driver_path)
    try:
        driver = webdriver.Edge(service=service, options=edge_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except WebDriverException as e:
        print(f"   -> ❌ Erro ao iniciar o WebDriver: {e}")
        return None

def parse_stats_from_json_data(api_data):
    """Extrai as estatísticas de interesse dos dados JSON da API."""
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
    unique_failures = sorted(list(set(failed_list)))
    with open(FAILED_PLAYERS_FILE, 'w') as f:
        json.dump(unique_failures, f, indent=4)
    if unique_failures:
        print(f"\n📝 Arquivo de falhas '{FAILED_PLAYERS_FILE}' atualizado com {len(unique_failures)} jogadores.")
    else:
        print(f"\n✅ Todos os jogadores foram processados. O arquivo '{FAILED_PLAYERS_FILE}' está limpo.")

def update_sheet_for_player(service, player_id, stats, player_map):
    """Atualiza a planilha com as estatísticas de um único jogador."""
    row_num = player_map.get(player_id)
    if not row_num:
        print(f"   -> ⚠️  Aviso: Jogador '{player_id}' não encontrado no mapa da planilha. Não foi possível atualizar.")
        return False

    try:
        range_to_update = f'{TARGET_SHEET}!K{row_num}:P{row_num}'
        row_values = [stats.get(header, '0') for header in HEADERS_ORDER]
        body = {'values': [row_values]}
        
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_to_update,
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        print(f"   -> ✅ Planilha atualizada para '{player_id}' na linha {row_num}.")
        return True
    except HttpError as e:
        print(f"   -> ❌ Erro ao atualizar a planilha para '{player_id}': {e}")
        return False

def main():
    service = authenticate_google_sheets()
    if not service: return

    try:
        result = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=RANGE_PLAYERS).execute()
        player_rows = result.get('values', [])
        player_map = {row[0]: i + 2 for i, row in enumerate(player_rows) if row and row[0]}
    except HttpError as e:
        print(f"❌ Erro fatal ao ler a planilha para mapear jogadores: {e}")
        return
        
    failed_players_list = load_failed_players()
    
    if failed_players_list:
        print(f"🔄 MODO DE RETENTATIVA: Processando {len(failed_players_list)} jogadores que falharam anteriormente.")
        players_to_process = failed_players_list
    else:
        print("✅ MODO NORMAL: Processando todos os jogadores da planilha.")
        players_to_process = list(player_map.keys())
        print(f"   -> {len(players_to_process)} jogadores encontrados para processar.")

    current_failures = set(failed_players_list)
    total_players = len(players_to_process)
    
    print("\n🚀 INICIANDO EXTRAÇÃO DE DADOS 🚀")
    
    driver = None

    try:
        for i, player_id in enumerate(players_to_process, 1):
            print(f"\n{'─'*60}")
            print(f"📋 Processando [{i}/{total_players}]: {player_id}")
            print(f"{'─'*60}")
            
            if driver:
                driver.quit()
            
            driver = setup_driver()
            if not driver:
                print("   -> ❌ Falha crítica ao iniciar o navegador. Adicionando à lista de falhas.")
                current_failures.add(player_id)
                continue
            
            try:
                url = f"{BASE_URL}{player_id}"
                print(f"🔗 Acessando: {url}")
                driver.get(url)
                body_text = driver.find_element(By.TAG_NAME, 'body').text

                # <--- INÍCIO DA LÓGICA ALTERADA --->
                if "rate limited" in body_text.lower() or "error 1015" in body_text:
                    print(f"   -> 🚫 BLOQUEADO (RATE LIMIT) para '{player_id}'. Adicionando à lista de falhas.")
                    current_failures.add(player_id)
                elif "error" in body_text.lower() or "not found" in body_text.lower():
                    print(f"   -> ⚠️  Jogador '{player_id}' não encontrado na API. Adicionando à lista de falhas para nova tentativa.")
                    current_failures.add(player_id)
                # <--- FIM DA LÓGICA ALTERADA --->
                else:
                    api_data = json.loads(body_text)
                    stats = parse_stats_from_json_data(api_data)
                    
                    if stats:
                        # Se obteve stats, tenta atualizar a planilha
                        if update_sheet_for_player(service, player_id, stats, player_map):
                            # Sucesso: remove da lista de falhas
                            current_failures.discard(player_id)
                        else:
                            # Falha ao atualizar a planilha: mantém na lista de falhas
                            current_failures.add(player_id)
                    else:
                        # Se o JSON veio sem stats, é uma falha
                        print(f"   -> ❓ JSON recebido para '{player_id}', mas sem estatísticas. Adicionando à lista de falhas.")
                        current_failures.add(player_id)
                        
            except Exception as e:
                print(f"   -> ❌ Erro inesperado durante a extração para '{player_id}': {e}")
                current_failures.add(player_id)

            if i < total_players:
                wait_time = 30
                print(f"   -> ⏳ Aguardando {wait_time} segundos antes do próximo jogador...")
                time.sleep(wait_time)
                
    finally:
        if driver:
            print("\n🔒 Fechando o navegador...")
            driver.quit()
        
        save_failed_players(list(current_failures))
        print("\n" + "="*60)
        print("🎉 PROCESSO CONCLUÍDO!")
        print("="*60)

if __name__ == "__main__":
    main()