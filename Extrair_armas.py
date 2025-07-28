import requests
import gspread
from bs4 import BeautifulSoup
import time # Importamos a biblioteca 'time' para fazer pausas

# --- CONFIGURAÇÃO ---
# URL da página com os dados das armas
URL = 'https://valeyard6282.fandom.com/wiki/Battlefield_6_Weapons_and_Classes'

# ID da sua planilha Google
SHEET_ID = '1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs'

# Nome do arquivo JSON de credenciais
SERVICE_ACCOUNT_FILE = 'credentials.json'
# --------------------


def scrape_weapon_data(url):
    """Busca e extrai os dados de armas da página Fandom."""
    print("Buscando dados da página...")
    try:
        page = requests.get(url)
        page.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Erro ao acessar a URL: {e}")
        return None

    soup = BeautifulSoup(page.content, 'html.parser')
    weapons_by_category = {}
    headlines = soup.find_all('span', class_='mw-headline')

    for headline in headlines:
        category_name = headline.text.strip()
        parent_header = headline.find_parent(['h2', 'h3', 'h4'])
        if parent_header:
            weapon_list_ul = parent_header.find_next_sibling('ul')
            if weapon_list_ul:
                weapons = [li.text.strip() for li in weapon_list_ul.find_all('li')]
                if weapons:
                    weapons_by_category[category_name] = weapons
                    print(f"Encontrada categoria '{category_name}' com {len(weapons)} armas.")
    return weapons_by_category


def update_google_sheet(sheet_id, service_account_file, data):
    """Atualiza a planilha de forma inteligente, sem sobrescrever dados existentes."""
    print("\nConectando com a Planilha Google...")
    try:
        gc = gspread.service_account(filename=service_account_file)
        spreadsheet = gc.open_by_key(sheet_id)
        print("Conexão bem-sucedida!")
    except Exception as e:
        print(f"Erro ao conectar com o Google Sheets: {e}")
        return

    abas_para_ignorar = [
        'Armas', 'Loadout', 'Classes', 'Infantry Weapons', 'Assault Weapons', 
        'Medic Weapons', 'Engineer Weapons', 'Recon Weapons'
    ]
    
    # Lista completa de cabeçalhos na ordem correta
    cabecalho_final_desejado = [
        'Armas', 'Classe', 'Tier', 'Cano', 'Freio de Boca', 
        'Acoplamento Inferior', 'Carregador', 'Empunhadura Traseira', 
        'Coronha', 'Modos de Tiro'
    ]

    existing_sheets = [sheet.title for sheet in spreadsheet.worksheets()]

    for category, weapons in data.items():
        if category in abas_para_ignorar:
            print(f"Ignorando a aba: '{category}' (consta na lista de exclusão).")
            continue

        print(f"Processando aba: '{category}'...")
        try:
            if category in existing_sheets:
                worksheet = spreadsheet.worksheet(category)
            else:
                worksheet = spreadsheet.add_worksheet(title=category, rows=100, cols=20)
            
            # --- 1. Atualiza o cabeçalho de uma só vez (otimizado) ---
            # Para evitar apagar dados, pegamos o que já existe e adicionamos o que falta
            cabecalho_existente = worksheet.row_values(1)
            # Se não houver cabeçalho, a lista estará vazia
            if not cabecalho_existente:
                 cabecalho_existente = [''] * len(cabecalho_final_desejado)

            # Garante que as colunas A e B não sejam sobrescritas se já existirem
            if len(cabecalho_existente) >= 1 and cabecalho_existente[0]:
                cabecalho_final_desejado[0] = cabecalho_existente[0]
            if len(cabecalho_existente) >= 2 and cabecalho_existente[1]:
                cabecalho_final_desejado[1] = cabecalho_existente[1]
            
            # Atualiza a primeira linha inteira com a lista completa de cabeçalhos
            worksheet.update('A1', [cabecalho_final_desejado])
            print("  -> Cabeçalho verificado e atualizado em uma única requisição.")

            # --- 2. Adiciona apenas armas que não existem na planilha ---
            armas_existentes = set(worksheet.col_values(1)[1:])
            novas_armas = [weapon for weapon in weapons if weapon not in armas_existentes]

            if novas_armas:
                linhas_para_adicionar = [[weapon] for weapon in novas_armas]
                worksheet.append_rows(linhas_para_adicionar, value_input_option='USER_ENTERED')
                print(f"  -> Adicionadas {len(novas_armas)} novas armas.")
            else:
                print("  -> Nenhuma arma nova para adicionar.")

            # --- 3. Aplica a formatação em todas as colunas com cabeçalho ---
            ultima_coluna_letra = "J" # Corresponde à lista de cabeçalhos
            worksheet.format(f'A:{ultima_coluna_letra}', {
                "horizontalAlignment": "CENTER",
                "verticalAlignment": "MIDDLE",
                "wrapStrategy": "WRAP"
            })
            print(f"  -> Formatação aplicada nas colunas A até {ultima_coluna_letra}.")

            print(f"Aba '{category}' atualizada com sucesso.")
            
            # --- 4. Adiciona uma pausa para evitar o limite da API ---
            print("Aguardando 1.5 segundos...")
            time.sleep(1.5)

        except Exception as e:
            print(f"Não foi possível atualizar a aba '{category}'. Erro: {e}")


# --- EXECUÇÃO PRINCIPAL ---
if __name__ == '__main__':
    scraped_data = scrape_weapon_data(URL)
    
    if scraped_data:
        update_google_sheet(SHEET_ID, SERVICE_ACCOUNT_FILE, scraped_data)
        print("\nProcesso concluído!")
    else:
        print("\nNenhum dado foi extraído. O script foi encerrado.")