import os
import psycopg2
import pandas as pd
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import time

# ==============================================================
# CONFIGURAÇÕES
# ==============================================================
load_dotenv()

SERVICE_ACCOUNT_FILE = 'bf6online-1d0103d91880.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
TARGET_SHEET = 'Platoon'
RANGE_PLAYERS = f'{TARGET_SHEET}!A2:C350'
DB_URL = os.getenv("DATABASE_URL")

HEADERS_ORDER = ['k_d', 'kills', 'assists', 'revives', 'matches', 'played_hours', 'level']

# ==============================================================
# FUNÇÕES AUXILIARES
# ==============================================================
def normalize(name):
    if not isinstance(name, str):
        return ''
    return name.strip().lower().replace(' ', '')

def clean_value(val):
    if isinstance(val, (int, float)):
        if float(val).is_integer():
            return str(int(val))
        return str(val)
    if isinstance(val, str) and val.endswith('.0'):
        return val[:-2]
    return val

# ==============================================================
# AUTENTICAÇÃO
# ==============================================================
def authenticate_google_sheets():
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        print("🔑 Autenticação com Google Sheets concluída.")
        return service
    except Exception as e:
        print(f"❌ Erro na autenticação: {e}")
        exit()

# ==============================================================
# BUSCA NA PLANILHA
# ==============================================================
def get_player_from_sheet(service, player_name):
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=RANGE_PLAYERS
    ).execute()
    values = result.get('values', [])

    for i, row in enumerate(values):
        if not row: 
            continue
        name_col_a = row[0].strip().lower() if len(row) > 0 and row[0] else ''
        id_col_c = row[2].strip().lower() if len(row) > 2 and row[2] else ''
        if normalize(player_name) in [normalize(name_col_a), normalize(id_col_c)]:
            return {'name': name_col_a, 'id': id_col_c, 'row_num': i + 2}

    return None

# ==============================================================
# BANCO DE DADOS
# ==============================================================
def fetch_stats_from_db():
    with psycopg2.connect(DB_URL) as conn:
        conn.set_session(autocommit=True)
        query = "SELECT player_name, k_d, kills, assists, revives, matches, played_hours, level FROM players_stats;"
        df = pd.read_sql_query(query, conn)

    df.dropna(subset=['player_name'], inplace=True)
    df = df[df['player_name'].str.strip() != '']
    df['original_player_name'] = df['player_name']
    df['player_name'] = df['player_name'].str.strip().str.lower()
    print(f"🗃️ {len(df)} registros carregados do banco de dados.")
    return df

# ==============================================================
# ATUALIZAÇÃO
# ==============================================================
def update_single_player(service, player, df):
    match = df[
        (df['player_name'].apply(normalize) == normalize(player['name'])) |
        (df['player_name'].apply(normalize) == normalize(player['id']))
    ]

    if match.empty:
        print(f"⚠️ Jogador '{player['name']}' não encontrado no banco.")
        return

    stats = match.iloc[0]
    row_values = [
        clean_value(stats[col].item() if hasattr(stats[col], "item") else stats[col]) if pd.notnull(stats[col]) else ''
        for col in HEADERS_ORDER
    ]

    range_to_update = f"{TARGET_SHEET}!K{player['row_num']}:Q{player['row_num']}"
    body = {'values': [row_values]}

    try:
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_to_update,
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        print(f"✅ {player['name']} atualizado com sucesso → {row_values}")
    except HttpError as e:
        print(f"❌ Erro ao atualizar '{player['name']}': {e}")
    time.sleep(1)

# ==============================================================
# MAIN
# ==============================================================
def main():
    player_name = input("Digite o nome do jogador: ").strip()
    if not player_name:
        print("❌ Nome inválido.")
        return

    service = authenticate_google_sheets()
    player = get_player_from_sheet(service, player_name)
    if not player:
        print(f"❌ Jogador '{player_name}' não encontrado na planilha.")
        return

    df = fetch_stats_from_db()
    update_single_player(service, player, df)

if __name__ == "__main__":
    main()
