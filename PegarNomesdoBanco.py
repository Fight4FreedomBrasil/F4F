import psycopg2
import sys

DB_URL = "postgresql://postgres.nmxiqmwmgrcwrilswofb:dfj2zENbfh5O31JK@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

def fetch_player_names_from_db():
    """
    Retorna uma lista com todos os nomes de jogadores, ignorando valores nulos.
    """
    try:
        conn = psycopg2.connect(DB_URL)
        print("✅ Conectado ao banco de dados com sucesso!")

        with conn.cursor() as cur:
            query = "SELECT player_name FROM players_stats ORDER BY player_name;"
            cur.execute(query)
            results = cur.fetchall()

            # Filtra None
            player_names = [row[0] for row in results if row[0] is not None]

            if not player_names:
                print("\nNenhum jogador encontrado no banco de dados.")
            else:
                print(f"\n📋 Nomes encontrados no banco ({len(player_names)}):")
                for i, name in enumerate(player_names, 1):
                    print(f"  {i}. {name}")

            return player_names

    except psycopg2.Error as e:
        print(f"❌ ERRO: Não foi possível conectar ou consultar o banco de dados.", file=sys.stderr)
        print(f"   Detalhes: {e}", file=sys.stderr)
        return []

    finally:
        if 'conn' in locals() and conn:
            conn.close()
            print("\n🔌 Conexão com o banco de dados fechada.")

if __name__ == "__main__":
    fetch_player_names_from_db()
