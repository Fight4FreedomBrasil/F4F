import psycopg2
import pandas as pd
import sys

# --- CONFIGURAÇÕES ---
# URL de conexão com o banco de dados (usando o pooler, conforme solicitado).
DB_URL = "postgresql://postgres.nmxiqmwmgrcwrilswofb:dfj2zENbfh5O31JK@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

def fetch_specific_stats():
    """
    Busca colunas específicas da tabela players_stats e as exibe de forma organizada.
    """
    print("Iniciando busca de dados no banco...")
    
    try:
        # A conexão é gerenciada e fechada automaticamente pelo 'with'.
        with psycopg2.connect(DB_URL) as conn:
            print("Conexao estabelecida com sucesso.\n")

            # Query SQL para selecionar apenas as colunas desejadas.
            # 'player_name' foi incluído para dar contexto aos dados.
            query = """
                SELECT 
                    id, 
                    player_name,
                    k_d, 
                    kills, 
                    assists, 
                    revives, 
                    played_hours, 
                    matches, 
                    level
                FROM players_stats 
                ORDER BY player_name;
            """
            
            # O pandas lê os dados do SQL e os formata em uma tabela (DataFrame).
            df = pd.read_sql_query(query, conn)

            if df.empty:
                print("Nenhum dado encontrado na tabela 'players_stats'.")
            else:
                print("Dados encontrados na tabela:")
                # Configura o pandas para exibir a tabela sem cortar colunas.
                pd.set_option('display.max_columns', None)
                pd.set_option('display.width', 120)
                print(df)

    except psycopg2.OperationalError as e:
        print("ERRO DE CONEXAO: Nao foi possivel conectar ao banco de dados.", file=sys.stderr)
        print(f"   Verifique a DB_URL. Detalhes do erro: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Ocorreu um erro inesperado: {e}", file=sys.stderr)

    finally:
        print("\nBusca concluida.")

# --- Execucao Principal ---
if __name__ == "__main__":
    fetch_specific_stats()