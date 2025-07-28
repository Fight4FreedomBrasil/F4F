import os
import time
import requests
import pyperclip
from bs4 import BeautifulSoup

# --- Importações para a API do Google ---
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Importações para o Selenium ---
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
# Novas importações para simular teclado
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By # LINHA CORRIGIDA/ADICIONADA
import os
from dotenv import load_dotenv

load_dotenv()

# --- Configuração Global ---
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
RANGE_NAME = 'Platoon!C2:C'
BASE_URL = "https://battlelog.battlefield.com"
OUTPUT_DIR = "stats_battlefield"

import atualizar_planilha


def authenticate_and_get_sheet_data():
    # Esta função permanece a mesma
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("❌ ERRO: O arquivo 'credentials.json' não foi encontrado.")
                return None
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    try:
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME).execute()
        values = result.get('values', [])
        if not values:
            print("❌ Nenhum dado encontrado na planilha.")
            return []
        player_ids = [row[0] for row in values if row and row[0].strip()]
        return player_ids
    except HttpError as err:
        print(f"❌ Um erro da API do Google ocorreu: {err}")
        return None

def main():
    print("Iniciando o processo de extração...")
    player_ids = authenticate_and_get_sheet_data()
    if player_ids is None:
        return
    print(f"👍 {len(player_ids)} IDs de jogadores encontrados na planilha.")

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"✅ Diretório '{OUTPUT_DIR}' criado.")

    print("⚙️  Configurando o navegador (Selenium para Microsoft Edge)...")
    service = EdgeService(executable_path='msedgedriver.exe')
    options = webdriver.EdgeOptions()
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = None 

    try:
        driver = webdriver.Edge(service=service, options=options)
        
        for player_id in player_ids:
            print(f"\n--- Processando jogador: {player_id} ---")
            
            try:
                # Parte 1 - Encontrar o link continua igual
                user_page_url = f"{BASE_URL}/bf4/user/{player_id}/"
                print(f"🔎 Buscando link de estatísticas em: {user_page_url}")
                response_initial = requests.get(user_page_url, timeout=15)
                response_initial.raise_for_status()
                soup = BeautifulSoup(response_initial.text, 'html.parser')
                link_tag = soup.select_one('article.soldier > a')

                if not link_tag or not link_tag.get('href'):
                    print(f"⚠️ Não foi possível encontrar o link de estatísticas para '{player_id}'. Pulando.")
                    continue
                
                stats_full_url = f"{BASE_URL}{link_tag['href']}"
                print(f"🔗 Link encontrado: {stats_full_url}")

                # --- IMPLEMENTAÇÃO DA SUA IDEIA (CTRL+A, CTRL+C) ---
                print("🤖 Abrindo a página no navegador...")
                driver.get(stats_full_url)
                
                # Damos um tempo fixo para a página (tentar) carregar
                print("...aguardando 5 segundos para a página carregar...")
                time.sleep(5) 
                
                print("📋 Simulando 'Selecionar Tudo' (Ctrl+A) e 'Copiar' (Ctrl+C)...")
                # Encontra o corpo da página e envia os comandos de teclado
                body = driver.find_element(By.TAG_NAME, 'body')
                ActionChains(driver).key_down(Keys.CONTROL).send_keys('a').send_keys('c').key_up(Keys.CONTROL).perform()
                
                # Pequena pausa para garantir que o clipboard foi preenchido
                time.sleep(1)

                # Pega o conteúdo do clipboard usando pyperclip
                copied_html = pyperclip.paste()
                print("📋 Conteúdo copiado do clipboard!")
                
                if not copied_html or "html" not in copied_html.lower():
                     print("⚠️ O clipboard está vazio ou não contém HTML. Usando 'driver.page_source' como alternativa.")
                     copied_html = driver.page_source

                # Salva o conteúdo em um arquivo de texto
                output_filename = os.path.join(OUTPUT_DIR, f"{player_id}_stats.txt")
                with open(output_filename, 'w', encoding='utf-8') as file:
                    file.write(copied_html)
                print(f"💾 Conteúdo salvo em: {output_filename}")
                print("--- Verifique o arquivo .txt para ver se as estatísticas foram capturadas ---")

            except Exception as e:
                print(f"❌ Um erro inesperado ocorreu para '{player_id}': {e}")
            
            time.sleep(2)

    finally:
        if driver:
            print("\n fechando o navegador...")
            driver.quit()

    print("\n🎉 Processo concluído!")


if __name__ == "__main__":
    main()
    atualizar_planilha.main()  # Chama a função do arquivo atualizar_planilha.py
    print("✅ Planilha atualizada com sucesso!")