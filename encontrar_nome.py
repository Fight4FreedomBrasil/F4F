import os
import sys
import psycopg2
from dotenv import load_dotenv

def find_player_name():
    """
    Conecta ao banco e procura por um nome de jogador usando um padrao flexivel (ILIKE).
    """
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")

    # Termo de busca flexivel
    search_term = '%diablopk%'

    if not db_url:
        print("ERRO: Variavel DATABASE_URL nao encontrada no arquivo .env.")
        sys.exit(1)

    conn = None
    try:
        conn = psycopg2.connect(db_url)
        print("Conectado ao banco de dados com sucesso.")
        
        with conn.cursor() as cur:
            # ILIKE faz uma busca de texto que ignora maiusculas/minusculas.
            # O '%' é um coringa que significa "qualquer caractere".
            query = "SELECT player_name FROM players_stats WHERE player_name ILIKE %s;"
            
            cur.execute(query, (search_term,))
            
            results = cur.fetchall()

            if results:
                print(f"\nJogadores encontrados que contem '{search_term}':")
                for row in results:
                    print(f"  -> Nome exato no banco: {row[0]}")
            else:
                print(f"\nNenhum jogador encontrado no banco que contenha '{search_term}'.")

    except psycopg2.Error as e:
        print(f"ERRO ao consultar o banco de dados: {e}")

    finally:
        if conn:
            conn.close()
            print("\nConexao com o banco de dados fechada.")

if __name__ == "__main__":
    find_player_name()