import os
import psycopg2
import pandas as pd
from dotenv import load_dotenv
from google.oauth2 import service_account  # Alterado
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import time

# ==============================================================
# CONFIGURAÇÕES
# ==============================================================
load_dotenv()

# Arquivo da conta de serviço (coloque o nome do seu arquivo JSON aqui)
SERVICE_ACCOUNT_FILE = 'bf6online-1d0103d91880.json' 

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
TARGET_SHEET = 'Platoon'
RANGE_PLAYERS = f'{TARGET_SHEET}!A2:C350'

DB_URL = os.getenv("DATABASE_URL")

# Colunas destino
HEADERS_ORDER = ['k_d', 'kills', 'assists', 'revives', 'matches', 'played_hours', 'level']
TARGET_COLUMNS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q']

def normalize(name):
    if not isinstance(name, str):
        return ''
    return name.strip().lower().replace(' ', '')


# ==============================================================
# AUTENTICAÇÃO GOOGLE SHEETS (MODIFICADA)
# ==============================================================
def authenticate_google_sheets():
    """Autentica com a API do Google Sheets usando um arquivo de conta de serviço."""
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        print("🔑 Autenticação com Google Sheets via Service Account bem-sucedida.")
        return service
    except FileNotFoundError:
        print(f"❌ ERRO CRÍTICO: Arquivo da conta de serviço '{SERVICE_ACCOUNT_FILE}' não encontrado.")
        print("Certifique-se de que o arquivo está no mesmo diretório ou forneça o caminho completo.")
        exit()
    except Exception as e:
        print(f"❌ ERRO CRÍTICO: Falha na autenticação. Detalhes: {e}")
        exit()


# ==============================================================
# LEITURA DOS JOGADORES NA PLANILHA
# ==============================================================
def get_players_from_sheet(service):
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=RANGE_PLAYERS
    ).execute()
    values = result.get('values', [])

    player_list = []
    for i, row in enumerate(values):
        if not row: continue
        name = row[0].strip().lower() if len(row) > 0 and row[0] else ''
        player_id = row[2].strip().lower() if len(row) > 2 and row[2] else ''

        if name or player_id:
            player_list.append({
                'name': name,
                'id': player_id,
                'row_num': i + 2
            })

    print(f"📋 {len(player_list)} jogadores carregados da planilha (Nome e ID).")
    return player_list

# ==============================================================
# EXTRAÇÃO DO BANCO DE DADOS
# ==============================================================
def fetch_stats_from_db():
    with psycopg2.connect(DB_URL) as conn:
        conn.set_session(autocommit=True)
        query = "SELECT player_name, k_d, kills, assists, revives, matches, played_hours, level FROM players_stats;"
        df = pd.read_sql_query(query, conn)

    df.dropna(subset=['player_name'], inplace=True)
    df = df[df['player_name'].str.strip() != '']

    valid_record_count = len(df)

    df['original_player_name'] = df['player_name']
    df['player_name'] = df['player_name'].str.strip().str.lower()

    print(f"🗃️  {valid_record_count} registros válidos carregados do banco de dados.")
    return df

# ==============================================================
# LIMPEZA DE VALORES
# ==============================================================
def clean_value(val):
    if isinstance(val, (int, float)):
        if float(val).is_integer():
            return str(int(val))
        return str(val)
    if isinstance(val, str):
        if val.endswith('.0'):
            return val[:-2]
    return val

# ==============================================================
# ATUALIZAÇÃO DA PLANILHA 
# ==============================================================
def update_google_sheet(service, player_list, df):
    updated_player_db_names = set()
    not_found_in_db = []
    update_errors = []

    # Loop principal para todos os jogadores
    for player in player_list:
        player_name_sheet = player['name']
        player_id_sheet = player['id']
        row_num = player['row_num']

        match = df[
            (df['player_name'].apply(normalize) == normalize(player_name_sheet)) |
            (df['player_name'].apply(normalize) == normalize(player_id_sheet))
        ]


        if match.empty:
            not_found_in_db.append(f"{player_name_sheet} / {player_id_sheet}")
            continue

        stats = match.iloc[0]
        row_values = [
            clean_value(stats[col].item() if hasattr(stats[col], "item") else stats[col]) if pd.notnull(stats[col]) else ''
            for col in HEADERS_ORDER
        ]
        range_to_update = f"{TARGET_SHEET}!K{row_num}:Q{row_num}"

        body = {'values': [row_values]}
        try:
            service.spreadsheets().values().update(spreadsheetId=SPREADSHEET_ID, range=range_to_update, valueInputOption='USER_ENTERED', body=body).execute()
            time.sleep(1.1) 
            print(f"✅ Atualizado: {player['name']} / {player['id']} (linha {row_num}) → {row_values}")
            updated_player_db_names.add(stats['player_name'])
        except HttpError as e:
            error_msg = f"{player['name']} / {player['id']}"
            print(f"❌ Erro ao atualizar '{error_msg}': {e}")
            update_errors.append(error_msg)

    # --- LÓGICA DO RESUMO FINAL ---
    all_db_players = set(df['player_name'])
    not_updated_from_db = all_db_players - updated_player_db_names

    print("\n📊 RESUMO:")
    print(f"  -> {len(updated_player_db_names)} jogadores atualizados com sucesso.")

    if not_found_in_db:
        print(f"  -> {len(not_found_in_db)} jogadores da planilha NÃO encontrados no banco:")
        for p in not_found_in_db:
            print(f"     - {p}")

    if not_updated_from_db:
        print(f"  -> {len(not_updated_from_db)} jogadores do banco NÃO foram atualizados (não encontrados na planilha):")
        for p in sorted(list(not_updated_from_db)):
            original_name_row = df[df['player_name'] == p]
            display_name = original_name_row['original_player_name'].iloc[0] if not original_name_row.empty else p
            print(f"     - {display_name}")

    if update_errors:
        print(f"  -> {len(update_errors)} jogadores geraram erro durante a atualização:")
        for p in update_errors:
            print(f"     - {p}")

    


# ==============================================================
# EXECUÇÃO PRINCIPAL
# ==============================================================
def main():
    service = authenticate_google_sheets()
    player_list = get_players_from_sheet(service)
    if not player_list:
        print("Nenhum jogador para processar. Encerrando.")
        return

    df = fetch_stats_from_db()
    update_google_sheet(service, player_list, df)

if __name__ == "__main__":
    main()