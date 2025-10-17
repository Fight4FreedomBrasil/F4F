import os.path
import requests
import json
import time # Importa a biblioteca para adicionar pausas
from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# -- CONFIGURAÇÕES --
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SPREADSHEET_ID = "1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs"

# Aba de onde vamos LER a lista de armas (a partir da segunda linha para pular o cabeçalho)
RANGE_ARMAS_LEITURA = "Armas!A2:A" 
# Aba onde vamos ESCREVER todos os loadouts encontrados
RANGE_LOADOUTS_ESCRITA = "Loadouts!A1"

# URL base para montar o link de cada arma
URL_BASE = "https://codmunity.gg/weapon/BF6/"

HEADERS = ['Arma', 'Muzzle', 'Barrel', 'Underbarrel', 'Magazine', 'Ammunition', 'Scope', 'Ergonomics', 'Optic', 'Top', 'Right', 'Playstyle', 'Imagem']

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

def scrape_loadouts_from_url(url, weapon_name_from_sheet):
    """Extrai os dados de loadouts de uma URL específica."""
    print(f"🔎 Acessando a URL: {url}")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
    except requests.exceptions.RequestException as e:
        print(f"❌ AVISO: Falha ao acessar a URL {url}. Motivo: {e}")
        return []

    loadouts_data = []
    loadout_cards = soup.select('div[id="loadouts"] app-meta-loadout div.container')

    if not loadout_cards:
        print(f"⚠️ Nenhum card de loadout encontrado para a arma {weapon_name_from_sheet}.")
        return []

    print(f"✅ Encontrados {len(loadout_cards)} loadouts para a arma {weapon_name_from_sheet}.")
    fallback_image_url = None

    for card in loadout_cards:
        loadout = {'Arma': weapon_name_from_sheet} # Usa o nome da planilha para consistência
        
        playstyle_tag = card.find('h3', class_='title')
        if playstyle_tag:
            loadout['Playstyle'] = playstyle_tag.text.strip().title()

        image_tag = card.find('img', class_='loadout-image')
        if image_tag and image_tag.get('src'):
            current_image_url = image_tag['src']
            loadout['Imagem'] = current_image_url
            if not fallback_image_url:
                fallback_image_url = current_image_url
        elif fallback_image_url:
            loadout['Imagem'] = fallback_image_url

        attachments_container = card.find('div', class_='container-attachments')
        if not attachments_container:
            continue
            
        attachments = attachments_container.find_all('div', class_='container-attachment')
        
        for attachment in attachments:
            slot_tag = attachment.find('div', class_='attachment-slot')
            name_tag = attachment.find('div', class_='attachment-name')
            if slot_tag and name_tag:
                slot = slot_tag.text.strip()
                name = name_tag.text.strip()
                if slot in HEADERS:
                    loadout[slot] = name
        
        loadouts_data.append(loadout)
    return loadouts_data

def update_spreadsheet(service, data_to_write, range_name):
    """Limpa a aba e escreve os novos dados na planilha."""
    if not data_to_write or len(data_to_write) <= 1:
        print("🟡 Nenhum dado para enviar à planilha.")
        return

    try:
        body = {"values": data_to_write}
        
        print(f"\n🔄 Limpando dados antigos da aba '{range_name.split('!')[0]}'...")
        
        # --- ALTERAÇÃO AQUI ---
        # Em vez de limpar de A até Z, limpamos de A até M, preservando a coluna N e as seguintes.
        range_to_clear = range_name.split('!')[0] + '!A:M' 
        
        service.spreadsheets().values().clear(
            spreadsheetId=SPREADSHEET_ID,
            range=range_to_clear
        ).execute()

        print("✍️ Escrevendo novos dados na planilha...")
        result = service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name,
            valueInputOption="RAW",
            body=body,
        ).execute()
        print(f"✅ {result.get('updatedCells')} células atualizadas com sucesso!")
    except HttpError as err:
        print(f"❌ Ocorreu um erro ao atualizar a planilha: {err}")

def main():
    """Função principal que lê as armas, busca os loadouts e atualiza a planilha."""
    sheets_service = get_sheets_service()
    if not sheets_service:
        return

    # 1. LER a lista de armas da aba "Armas"
    try:
        print(f"📖 Lendo a lista de armas da aba '{RANGE_ARMAS_LEITURA.split('!')[0]}'...")
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_ARMAS_LEITURA
        ).execute()
        weapon_rows = result.get('values', [])
        
        if not weapon_rows:
            print("❌ Nenhuma arma encontrada na aba 'Armas'. Certifique-se de que a coluna A está preenchida e execute o 'extrairArmas.py' primeiro.")
            return
        
        weapon_names = [row[0] for row in weapon_rows if row] # Extrai apenas o nome da coluna A
        print(f"Found {len(weapon_names)} armas para processar.")

    except HttpError as err:
        print(f"❌ Ocorreu um erro ao ler a lista de armas: {err}")
        return

    # 2. ITERAR sobre cada arma, montar a URL e extrair os loadouts
    all_loadouts = []
    for weapon_name in weapon_names:
        # Formata o nome da arma para a URL (ex: "M2010 ESR" -> "m2010-esr")
        weapon_slug = weapon_name.lower().replace(" ", "-").replace(".", "")
        weapon_url = f"{URL_BASE}{weapon_slug}"
        
        loadouts_for_weapon = scrape_loadouts_from_url(weapon_url, weapon_name)
        if loadouts_for_weapon:
            all_loadouts.extend(loadouts_for_weapon)
        
        # Pausa de 1 segundo entre as requisições para não sobrecarregar o servidor
        print("⏳ Pausa de 1 segundo...")
        time.sleep(1)

    # 3. PREPARAR e ESCREVER todos os dados consolidados na aba "Loadouts"
    if not all_loadouts:
        print("Nenhum loadout foi extraído no total. Encerrando o script.")
        return

    data_for_sheet = [HEADERS]
    for loadout in all_loadouts:
        row = [loadout.get(header, "") for header in HEADERS]
        data_for_sheet.append(row)
    
    print("\n📋 Total de dados extraídos a serem enviados:")
    print(f"Encontrados {len(all_loadouts)} loadouts de {len(weapon_names)} armas.")
        
    update_spreadsheet(sheets_service, data_for_sheet, RANGE_LOADOUTS_ESCRITA)

if __name__ == "__main__":
    main()