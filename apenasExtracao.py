import os
import json
import time
import random
import requests # Usaremos a biblioteca requests

# --- Configuração ---
BASE_URL = "https://api.tracker.gg/api/v2/bf6/standard/profile/origin/"
INPUT_FILE = 'lista_ID.txt'
OUTPUT_FILE = 'dados_extraidos.json'

# Cabeçalhos para simular uma requisição feita por um navegador comum
# Isso é importante para evitar ser bloqueado por sistemas anti-bot simples.
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
    'Referer': 'https://tracker.gg/',
}

def parse_stats_from_json_data(api_data):
    """Extrai as estatísticas desejadas do JSON retornado pela API."""
    try:
        # Navega pela estrutura do JSON para encontrar as estatísticas
        stats = api_data.get('data', {}).get('segments', [{}])[0].get('stats', {})
        if not stats:
            return None
        
        # Extrai cada campo, com um valor padrão '0' ou '0h' caso não seja encontrado
        return {
            'KD': str(stats.get('kdRatio', {}).get('value', '0')),
            'Kills': str(stats.get('kills', {}).get('value', '0')),
            'Assists': str(stats.get('assists', {}).get('value', '0')),
            'Revives': str(stats.get('revives', {}).get('value', '0')),
            'Partidas': str(stats.get('matchesPlayed', {}).get('value', '0')),
            'Time Played': stats.get('timePlayed', {}).get('displayValue', '0h')
        }
    except (KeyError, TypeError, IndexError):
        # Retorna None se houver qualquer erro ao acessar as chaves do dicionário
        return None

def main():
    """Função principal que orquestra a leitura, extração e gravação dos dados."""
    
    # 1. Ler os IDs do arquivo de texto
    if not os.path.exists(INPUT_FILE):
        print(f"❌ ERRO: O arquivo '{INPUT_FILE}' não foi encontrado.")
        with open(INPUT_FILE, 'w') as f:
            f.write("samuelbettiol\n")
            f.write("PlayerID2\n")
        print(f"📄 Um arquivo de exemplo '{INPUT_FILE}' foi criado. Adicione os IDs nele e rode o script novamente.")
        return

    with open(INPUT_FILE, 'r') as f:
        player_ids = [line.strip() for line in f if line.strip()]

    if not player_ids:
        print(f"🤷 O arquivo '{INPUT_FILE}' está vazio. Nenhum ID para processar.")
        return

    print(f"✅ Encontrados {len(player_ids)} IDs para processar.")
    
    all_player_stats = {}
    total_players = len(player_ids)

    # 2. Iterar sobre cada ID e extrair os dados
    for i, player_id in enumerate(player_ids, 1):
        print(f"\n{'─'*50}")
        print(f"🔍 Processando [{i}/{total_players}]: {player_id}")
        
        url = f"{BASE_URL}{player_id}"
        
        try:
            # Faz a requisição HTTP GET para a URL da API
            response = requests.get(url, headers=HEADERS, timeout=15)
            
            # Lança um erro para status de falha (4xx ou 5xx)
            response.raise_for_status() 

            # A resposta da API já é o JSON, então podemos decodificá-la diretamente
            api_data = response.json()
            
            stats = parse_stats_from_json_data(api_data)
            
            if stats:
                all_player_stats[player_id] = stats
                print(f"   -> ✅ Estatísticas extraídas com sucesso!")
            else:
                # Isso pode acontecer se o jogador não tiver dados de BF2042
                print(f"   -> ⚠️  Jogador encontrado, mas sem estatísticas no formato esperado.")

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"   -> ⚠️  Jogador '{player_id}' não encontrado na API (Erro 404).")
            elif e.response.status_code == 429 or e.response.status_code == 403:
                print(f"   -> 🚫 Bloqueado pela API (Rate Limit / Proibido). Tente novamente mais tarde.")
                break # Interrompe o loop se for bloqueado
            else:
                print(f"   -> ❌ Erro HTTP para '{player_id}': {e}")

        except requests.exceptions.RequestException as e:
            # Captura outros erros de rede (falha de conexão, timeout, etc.)
            print(f"   -> ❌ Erro de conexão para '{player_id}': {e}")
        
        except json.JSONDecodeError:
            print(f"   -> ❌ Erro: A resposta da API para '{player_id}' não é um JSON válido.")

        # Pausa para não sobrecarregar o servidor e evitar bloqueios
        if i < total_players:
            wait_time = random.uniform(1.5, 3.5)
            print(f"   -> ⏳ Aguardando {wait_time:.1f} segundos...")
            time.sleep(wait_time)

    # 3. Salvar os dados extraídos em um arquivo JSON
    if all_player_stats:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_player_stats, f, indent=4, ensure_ascii=False)
        print(f"\n{'─'*50}")
        print(f"🎉 Processo concluído! Os dados de {len(all_player_stats)} jogadores foram salvos em '{OUTPUT_FILE}'.")
    else:
        print("\n🤷 Nenhuma estatística foi extraída com sucesso.")


if __name__ == "__main__":
    main()