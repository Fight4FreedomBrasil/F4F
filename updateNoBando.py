import os
import sys
import psycopg2
from dotenv import load_dotenv

def update_player_name():
    """
    Conecta ao banco de dados e executa um comando UPDATE para corrigir
    o nome de um jogador específico.
    """
    # Carrega as variáveis do arquivo .env
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")

    # Nomes para a atualização
    old_name = 'ldlablopk'
    new_name = 'lDiablopk'

    if not db_url:
        print("ERRO: Variavel DATABASE_URL nao encontrada no arquivo .env.")
        sys.exit(1)

    conn = None
    try:
        # Conecta ao banco de dados
        conn = psycopg2.connect(db_url)
        print("Conectado ao banco de dados com sucesso.")
        
        # O cursor é o objeto que executa os comandos SQL
        with conn.cursor() as cur:
            
            # Comando SQL com placeholders (%s) para evitar SQL Injection
            query = "UPDATE players_stats SET player_name = %s WHERE player_name = %s;"
            
            # Executa o comando, passando os nomes como parâmetros
            cur.execute(query, (new_name, old_name))
            
            # Salva (efetiva) a alteração no banco de dados
            conn.commit()

            # cur.rowcount informa quantas linhas foram afetadas pelo comando
            if cur.rowcount > 0:
                print(f"Sucesso! {cur.rowcount} registro atualizado de '{old_name}' para '{new_name}'.")
            else:
                print(f"Aviso: Nenhum registro encontrado com o nome '{old_name}'. Nenhuma alteracao foi feita.")

    except psycopg2.Error as e:
        print(f"ERRO ao executar o comando no banco de dados: {e}")
        if conn:
            conn.rollback()  # Desfaz a transação em caso de erro

    finally:
        if conn:
            conn.close()
            print("Conexao com o banco de dados fechada.")

if __name__ == "__main__":
    update_player_name()