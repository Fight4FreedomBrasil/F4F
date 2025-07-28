import gspread
import time
import json # Biblioteca para trabalhar com o formato JSON

# --- CONFIGURAÇÃO ---
SHEET_ID = '1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs'
SERVICE_ACCOUNT_FILE = 'credentials.json'
ABA_ALVO = 'Loadout'
ABAS_PARA_IGNORAR = [
    'Loadout', 'Armas', 'Classes', 'Infantry Weapons', 'Assault Weapons', 
    'Medic Weapons', 'Engineer Weapons', 'Recon Weapons'
]
# --------------------

def consolidar_armas(spreadsheet):
    """
    Lê todas as abas, consolida os dados, preserva colunas manuais,
    ordena por Tier e escreve o resultado na aba 'Loadout'.
    """
    print("--- ETAPA 1: Consolidando e Ordenando Armas ---")
    
    # ... (O resto desta função continua exatamente como antes) ...
    dados_antigos_map = {}
    try:
        aba_loadout = spreadsheet.worksheet(ABA_ALVO)
        dados_existentes = aba_loadout.get_all_records()
        for linha in dados_existentes:
            if linha.get('Arma'):
                dados_antigos_map[linha['Arma']] = {
                    'Loadouts': linha.get('Loadouts', ''),
                    'ImagemURL': linha.get('ImagemURL', '')
                }
        print(f"Encontrados {len(dados_antigos_map)} registros existentes na aba '{ABA_ALVO}' para preservação.")
    except gspread.WorksheetNotFound:
        print(f"Aba '{ABA_ALVO}' não encontrada. Ela será criada.")
        aba_loadout = spreadsheet.add_worksheet(title=ABA_ALVO, rows=1000, cols=10)

    dados_novos = []
    lista_de_abas = spreadsheet.worksheets()
    
    print("Lendo dados atualizados das abas de categorias...")
    for worksheet in lista_de_abas:
        if worksheet.title in ABAS_PARA_IGNORAR:
            continue
        print(f" -> Lendo a aba: '{worksheet.title}'")
        dados_da_aba = worksheet.get_all_records()
        dados_novos.extend(dados_da_aba)
    
    print(f"\nTotal de {len(dados_novos)} armas encontradas nas fontes de dados.")

    dados_consolidados = []
    for arma_nova in dados_novos:
        nome_arma = arma_nova.get('Armas')
        if not nome_arma: continue
        dados_preservados = dados_antigos_map.get(nome_arma, {'Loadouts': '', 'ImagemURL': ''})
        arma_final = {
            'Arma': nome_arma,
            'Classe': arma_nova.get('Classe', ''),
            'Tier': arma_nova.get('Tier', ''),
            'Loadouts': dados_preservados['Loadouts'],
            'ImagemURL': dados_preservados['ImagemURL']
        }
        dados_consolidados.append(arma_final)

    ordem_tier = {'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5}
    armas_ordenadas = sorted(
        dados_consolidados,
        key=lambda arma: ordem_tier.get(str(arma.get('Tier', '')).upper(), 99)
    )
    print("Armas ordenadas por Tier com sucesso.")

    print(f"Limpando e reescrevendo a aba '{ABA_ALVO}'...")
    aba_loadout.clear()
    cabecalho = ['Arma', 'Classe', 'Tier', 'Loadouts', 'ImagemURL']
    dados_para_escrever = [cabecalho]
    for arma in armas_ordenadas:
        linha = [arma['Arma'], arma['Classe'], arma['Tier'], arma['Loadouts'], arma['ImagemURL']]
        dados_para_escrever.append(linha)
    
    aba_loadout.update(range_name='A1', values=dados_para_escrever)
    print("Etapa 1 concluída com sucesso!")


# ############################################################### #
# ##                     NOVA FUNÇÃO ABAIXO                    ## #
# ############################################################### #

def montar_melhor_loadout(spreadsheet):
    """
    Lê os acessórios das abas de categoria, formata em JSON e
    atualiza a coluna 'Loadouts' na aba principal.
    """
    print("\n--- ETAPA 2: Montando e Salvando os Melhores Loadouts ---")
    
    loadouts_map = {}
    lista_de_abas = spreadsheet.worksheets()

    print("Coletando dados de acessórios das abas de categorias...")
    for worksheet in lista_de_abas:
        if worksheet.title in ABAS_PARA_IGNORAR:
            continue
        
        # Usamos get_all_values() para pegar todas as células como uma lista de listas
        todos_valores = worksheet.get_all_values()
        if len(todos_valores) < 2: # Pula se a aba estiver vazia ou só tiver cabeçalho
            continue

        headers = todos_valores[0]
        # Pega os cabeçalhos das colunas D até J
        attachment_headers = headers[3:10] 

        for row in todos_valores[1:]: # Começa da segunda linha (dados)
            nome_arma = row[0]
            if not nome_arma:
                continue
            
            # Pega os valores das colunas D até J
            attachment_values = row[3:10]
            acessorios = []
            
            # Cria a lista de acessórios, ignorando células vazias
            for i, valor in enumerate(attachment_values):
                if valor and i < len(attachment_headers): # Se a célula não estiver vazia
                    acessorios.append({"tipo": attachment_headers[i], "nome": valor})
            
            # Se encontrou algum acessório, formata e salva
            if acessorios:
                # Formato JSON final, compatível com o site
                json_final = json.dumps([{"titulo": "Melhor Loadout", "acessorios": acessorios}])
                loadouts_map[nome_arma] = json_final
    
    print(f"Loadouts montados para {len(loadouts_map)} armas.")

    # Atualiza a coluna D (Loadouts) na aba principal
    print(f"Atualizando a coluna 'Loadouts' na aba '{ABA_ALVO}'...")
    try:
        aba_loadout = spreadsheet.worksheet(ABA_ALVO)
        # Pega a lista de armas na ordem em que estão na aba 'Loadout'
        armas_na_aba_final = aba_loadout.col_values(1)[1:] # Ignora o cabeçalho
        
        # Prepara a lista de valores para a coluna D
        coluna_loadouts_final = []
        for arma in armas_na_aba_final:
            # Adiciona o JSON do loadout ou uma string vazia se não houver
            coluna_loadouts_final.append([loadouts_map.get(arma, '')])
            
        if coluna_loadouts_final:
            # Atualiza toda a coluna D de uma vez para economizar API
            aba_loadout.update(range_name=f'D2:D{len(coluna_loadouts_final) + 1}', values=coluna_loadouts_final)
            print("Coluna 'Loadouts' atualizada com sucesso!")
            
    except Exception as e:
        print(f"Ocorreu um erro ao atualizar a aba '{ABA_ALVO}': {e}")


# --- EXECUÇÃO PRINCIPAL ---
def main():
    """Função principal que orquestra as etapas do script."""
    try:
        gc = gspread.service_account(filename=SERVICE_ACCOUNT_FILE)
        spreadsheet = gc.open_by_key(SHEET_ID)

        # Etapa 1: Consolida as armas na aba principal
        consolidar_armas(spreadsheet)
        
        # Pausa para garantir que a primeira etapa foi processada pela API do Google
        time.sleep(2)

        # Etapa 2: Monta os loadouts e preenche a coluna D
        montar_melhor_loadout(spreadsheet)

        print("\nProcesso completo finalizado com sucesso!")
    except Exception as e:
        print(f"Ocorreu um erro geral na execução: {e}")

if __name__ == '__main__':
    main()