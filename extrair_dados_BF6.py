import os
import time
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# --- Importações para a API do Google ---
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Importações para o Selenium ---
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException # Importações para tratar erros

load_dotenv()

# --- Configuração ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
TARGET_SHEET = 'Platoon'
RANGE_PLAYERS = f'{TARGET_SHEET}!C2:C100'
BASE_URL = "https://www.ea.com/games/battlefield/battlefield-6/player-stats"

STATS_MAP = {
    'Kill/Death Ratio': 'KD', 'Total kills': 'Kills', 'Total assists': 'Assists',
    'Total revives': 'Revives', 'Total matches played': 'Partidas', 'Total XP': 'XP'
}
HEADERS_ORDER = ['KD', 'Kills', 'Assists', 'Revives', 'Partidas', 'XP']

def authenticate_google_sheets():
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

def parse_stats_from_html(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    stats_data = {}
    stat_items = soup.select('li.StatsSection_rowItems__KWyDB')
    if not stat_items: return None
    for item in stat_items:
        name_tag = item.select_one('div.generated_headline4__ZHsWB')
        value_tag = item.select_one('div.generated_display1___EyXQ')
        if name_tag and value_tag:
            stat_name = name_tag.text.strip()
            if stat_name in STATS_MAP:
                stats_data[STATS_MAP[stat_name]] = value_tag.text.strip()
    return stats_data

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

    print("⚙️  Configurando o navegador...")
    service_edge = EdgeService(executable_path='msedgedriver.exe')
    options = webdriver.EdgeOptions()
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--headless") # Roda o navegador em segundo plano, sem abrir janela
    options.add_argument("--log-level=3") # Suprime a maioria dos logs do console
    driver = None
    
    all_player_stats = {}

    try:
        driver = webdriver.Edge(service=service_edge, options=options)
        
        for player_id in player_map.keys():
            print(f"\n--- Processando jogador: {player_id} ---")
            stats = None
            try:
                stats_url = f"{BASE_URL}/{player_id}"
                driver.get(stats_url)

                print("⏳ Aguardando o carregamento dinâmico das estatísticas (até 15s)...")
                wait = WebDriverWait(driver, 15)
                wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "li.StatsSection_rowItems__KWyDB")))
                
                print("✅ Conteúdo carregado. Extraindo HTML...")
                html_content = driver.page_source
                stats = parse_stats_from_html(html_content)
                
                if stats:
                    all_player_stats[player_id] = stats
                    print(f"📊 Estatísticas extraídas com sucesso para {player_id}.")
                else:
                    print(f"⚠️ Nenhuma estatística encontrada na página para {player_id} (bloco de stats vazio).")

            except TimeoutException:
                print(f"❌ Erro de Timeout para '{player_id}': A seção de estatísticas não carregou em 15 segundos. O jogador pode não existir ou a página está com problemas.")
            except WebDriverException as e:
                # Captura o erro do WebDriver (Stacktrace) e exibe uma mensagem limpa.
                print(f"❌ Erro no navegador ao processar '{player_id}'. O driver pode ter travado. Pulando para o próximo.")
            except Exception as e:
                print(f"❌ Um erro inesperado ocorreu para '{player_id}': {e}")
            
    finally:
        if driver:
            print("\n🔌 Fechando o navegador...")
            driver.quit()

    if all_player_stats:
        batch_update_data = []
        for player_id, stats in all_player_stats.items():
            row_num = player_map.get(player_id)
            if row_num:
                row_values = [stats.get(header, 'N/A') for header in HEADERS_ORDER]
                batch_update_data.append({'range': f'{TARGET_SHEET}!K{row_num}:P{row_num}', 'values': [row_values]})

        if batch_update_data:
            print(f"\n⚙️  Atualizando {len(batch_update_data)} linhas na planilha...")
            try:
                body = {'valueInputOption': 'USER_ENTERED', 'data': batch_update_data}
                service.spreadsheets().values().batchUpdate(spreadsheetId=SPREADSHEET_ID, body=body).execute()
                print("✅ Planilha atualizada com sucesso!")
            except HttpError as e:
                print(f"❌ Erro durante a atualização em massa: {e}")
    else:
        print("\n🤷 Nenhuma estatística foi extraída para atualizar a planilha.")

if __name__ == "__main__":
    main()