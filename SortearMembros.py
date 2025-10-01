# script.py
import random

# --- DADOS DE ENTRADA ---

# Lista de pelotões disponíveis
lista_de_pelotoes = [
    "Vanguarda da Liberdade",
    "Sentinelas da Liberdade",
    "Martelos da Liberdade",
    "Arautos da Liberdade",
    "Vingadores da Liberdade"
]

# Lista de todos os membros (com "Rodrigo" adicionado)
lista_de_membros = [
    "Marcelo091", 
    "Weudson", 
    "Hugo", 
    "Mula", 
    "Jaguar",
    "Bruxo", 
    "Wesley", 
    "Fabiola", 
    "Cadu",
    "Safadowiski", 
    "Cangacero", 
    "Paulo (Sgt_KVRA)",
    "Ghost Maranhão", 
    "Matheus_270539", 
    "Macart",
    "pFrançosa", 
    "0Junior", 
    "TK-Ramos", 
    "JhonTremBala22",
    "Camila", 
    "Neto", 
    "Makarovv", 
    "Rodrigo",
    "TioDanger",
    ""  
    
]

# --- LÓGICA DO SORTEIO COM LÍDERES FIXOS ---

# 1. Define os líderes e seus pelotões
lideres_designados = {
    "Bruxo": "Vanguarda da Liberdade",
    "Makarovv": "Sentinelas da Liberdade",
    "Jaguar": "Martelos da Liberdade",
    "Rodrigo": "Arautos da Liberdade",
    "Weudson": "Vingadores da Liberdade"
}

# 2. Cria a estrutura final dos pelotões
pelotoes_com_membros = {nome: [] for nome in lista_de_pelotoes}

# 3. Adiciona os líderes designados aos seus pelotões primeiro
for lider, pelotao in lideres_designados.items():
    if pelotao in pelotoes_com_membros:
        # Adiciona o líder ao seu pelotão com uma marcação
        pelotoes_com_membros[pelotao].append(f"{lider} (Líder)")

# 4. Cria uma nova lista apenas com os membros que não são líderes
membros_para_sortear = [m for m in lista_de_membros if m not in lideres_designados]

# 5. Embaralha apenas os membros restantes
random.shuffle(membros_para_sortear)

# 6. Distribui os membros restantes de forma cíclica entre os pelotões
for i, membro in enumerate(membros_para_sortear):
    indice_pelotao = i % len(lista_de_pelotoes)
    nome_do_pelotao = lista_de_pelotoes[indice_pelotao]
    pelotoes_com_membros[nome_do_pelotao].append(membro)

# --- APRESENTAÇÃO DOS RESULTADOS ---

print("=" * 50)
print("SORTEIO DOS MEMBROS NOS PELOTÕES (COM LÍDERES FIXOS)")
print("=" * 50)

for nome_pelotao, membros_sorteados in pelotoes_com_membros.items():
    print(f"\n--- {nome_pelotao} ({len(membros_sorteados)} membros) ---")
    # Imprime o líder primeiro, se ele estiver na lista
    for membro in sorted(membros_sorteados, key=lambda x: "(Líder)" not in x):
        print(f" - {membro}")

print("\n" + "=" * 50)