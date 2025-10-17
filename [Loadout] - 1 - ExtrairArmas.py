import os.path
import requests
import json
from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# -- CONFIGURAÇÕES --
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SPREADSHEET_ID = "1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs"
RANGE_NAME = "Armas!A1" 
META_PAGE_URL = "https://codmunity.gg/battlefield"
HEADERS = ['Arma', 'Tipo']

def get_sheets_service():
    """Autentica com a API do Google Sheets e retorna o objeto de serviço."""
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    
    try:
        service = build("sheets", "v4", credentials=creds)
        return service
    except HttpError as err:
        print(f"Erro ao conectar com a API do Google Sheets: {err}")
        return None

# ===== NOVA FUNÇÃO AUXILIAR =====
def find_key_recursively(data, target_key):
    """
    Busca uma chave em uma estrutura aninhada de dicionários e listas.
    """
    if isinstance(data, dict):
        for key, value in data.items():
            if key == target_key:
                return value
            result = find_key_recursively(value, target_key)
            if result is not None:
                return result
    elif isinstance(data, list):
        for item in data:
            result = find_key_recursively(item, target_key)
            if result is not None:
                return result
    return None
# ================================

def scrape_weapon_list_from_json(url):
    """
    Extrai a lista de armas e seus tipos do JSON embutido na página de forma robusta.
    """
    print(f"🔎 Acessando a URL para extrair o JSON: {url}")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

    except requests.exceptions.RequestException as e:
        print(f"❌ ERRO: Falha ao acessar a URL. Motivo: {e}")
        return []

    script_tag = soup.find('script', id='serverApp-state')
    
    if not script_tag:
        print("❌ ERRO: Não foi possível encontrar a tag <script> com os dados JSON na página.")
        return []

    try:
        app_data = json.loads(script_tag.string)
        
        # ===== LÓGICA DE EXTRAÇÃO ATUALIZADA E ROBUSTA =====
        # Usa a função de busca para encontrar a lista 'topWeapons' em qualquer lugar do JSON
        weapons_list = find_key_recursively(app_data, 'topWeapons')
        # =======================================================

        if not weapons_list or not isinstance(weapons_list, list):
            print("⚠️ A lista 'topWeapons' não foi encontrada ou está vazia no JSON.")
            return []
        
        weapons_data = []
        for weapon_info in weapons_list:
            # Garante que estamos lidando com um dicionário antes de extrair os dados
            if isinstance(weapon_info, dict):
                weapon = {
                    'Arma': weapon_info.get('weapon'),
                    'Tipo': weapon_info.get('category')
                }
                weapons_data.append(weapon)
        
        print(f"✅ Encontradas {len(weapons_data)} armas no JSON.")
        return weapons_data

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"❌ ERRO ao processar o JSON: {e}")
        return []

def update_spreadsheet(service, data_to_write):
    """Limpa a aba "Armas" e escreve os novos dados."""
    if not data_to_write or len(data_to_write) <= 1:
        print("🟡 Nenhum dado para enviar à planilha.")
        return

    try:
        body = {"values": data_to_write}
        
        print("\n🔄 Limpando dados antigos da aba 'Armas'...")
        range_to_clear = RANGE_NAME.split('!')[0] + '!A:Z' 
        service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range=range_to_clear
        ).execute()

        print("✍️ Escrevendo nova lista de armas na planilha...")
        result = (
            service.spreadsheets()
            .values()
            .update(
                spreadsheetId=SPREADSHEET_ID,
                range=RANGE_NAME,
                valueInputOption="RAW",
                body=body,
            )
            .execute()
        )
        print(f"✅ {result.get('updatedCells')} células atualizadas com sucesso na aba 'Armas'!")

    except HttpError as err:
        print(f"❌ Ocorreu um erro ao atualizar a planilha: {err}")

def main():
    weapons = scrape_weapon_list_from_json(META_PAGE_URL)
    
    if not weapons:
        print("Nenhuma arma foi extraída. Encerrando o script.")
        return

    data_for_sheet = [HEADERS]
    for weapon in weapons:
        row = [weapon.get(header, "") for header in HEADERS]
        data_for_sheet.append(row)
    
    print("\n📋 Lista de armas a ser enviada:")
    for row in data_for_sheet:
        print(row)
        
    sheets_service = get_sheets_service()
    if sheets_service:
        update_spreadsheet(sheets_service, data_for_sheet)

if __name__ == "__main__":
    main()