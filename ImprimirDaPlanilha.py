import os
import sys
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# --- CONFIGURAÇÕES ---
load_dotenv()
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
TARGET_SHEET = 'Platoon'
RANGE_TO_READ = f'{TARGET_SHEET}!A2:C150' # Lendo colunas A, B e C

def authenticate_google_sheets():
    """Função para autenticar e criar o serviço do Google Sheets."""
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

def print_names_from_sheet(service):
    """
    Busca os dados da planilha e imprime o Nome e ID de cada linha para diagnóstico.
    """
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_TO_READ
        ).execute()
        
        values = result.get('values', [])

        if not values:
            print("Nenhum dado encontrado na planilha.")
            return

        print("--- INICIANDO INSPEÇÃO DOS NOMES NA PLANILHA ---")
        print("Formato: 'Texto Exato' | Comprimento do Texto\n")

        for i, row in enumerate(values):
            row_num = i + 2 # A leitura começa na linha 2

            # Pega o conteúdo bruto (raw) das colunas A e C
            raw_name = row[0] if len(row) > 0 else ""
            raw_id = row[2] if len(row) > 2 else ""

            # Ignora linhas completamente vazias
            if not raw_name and not raw_id:
                continue

            # Imprime os detalhes para diagnóstico
            print(f"Linha {row_num}:")
            print(f"  - Coluna A (Nome): '{raw_name}' | Comprimento: {len(raw_name)}")
            print(f"  - Coluna C (ID):   '{raw_id}' | Comprimento: {len(raw_id)}")
            print("-" * 40)

    except Exception as e:
        print(f"Ocorreu um erro ao ler a planilha: {e}")

if __name__ == "__main__":
    service = authenticate_google_sheets()
    print_names_from_sheet(service)