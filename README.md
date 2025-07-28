# Projeto BF6.online - Loadouts e Estatísticas de Pelotão

Este projeto é a base para o site **BF6.online**, uma plataforma para visualizar os melhores loadouts de armas e acompanhar as estatísticas dos membros de um pelotão de Battlefield.

## Funcionalidades

* **Página Principal:** Exibe uma lista de armas classificadas por Tier (S, A, B, etc.), com detalhes de loadout (acessórios) para cada uma.
* **Página do Pelotão:** Mostra uma lista de todos os membros do pelotão, organizados por patente, com suas estatísticas de combate (K/D, SPM, Kills, etc.).
* **Backend com Google Sheets:** Todos os dados são gerenciados de forma centralizada em uma planilha do Google Sheets.
* **API com Google Apps Script:** Um script unificado serve os dados da planilha para o site de forma segura e eficiente.
* **Automação com Python:** Scripts em Python são usados para extrair dados de estatísticas do site Battlelog e atualizar a planilha automaticamente.

## Como Funciona

1.  **`index.html` e `pelotao.html`:** Estrutura do site.
2.  **`style.css`:** Estilização visual.
3.  **`script.js` e `pelotao.js`:** Fazem chamadas para a API do Google Apps Script e renderizam os dados dinamicamente nas páginas.
4.  **`MinhaAPI_BF6.gs`:** O código do Google Apps Script que lê a planilha e serve os dados como uma API JSON.
5.  **Scripts Python:**
    * `extrair_dados_final.py`: Usa Selenium para fazer web scraping do Battlelog e salvar os dados.
    * `atualizar_planilha.py`: Lê os dados salvos e atualiza a planilha do Google Sheets.

## Implantação no GitHub Pages

1.  Envie todos os arquivos (exceto os ignorados pelo `.gitignore`) para um novo repositório no GitHub.
2.  No seu repositório, vá em **Settings > Pages**.
3.  Na seção "Build and deployment", em "Source", selecione **Deploy from a branch**.
4.  Escolha a branch `main` (ou `master`) e a pasta `/root`.
5.  Clique em **Save**. Seu site estará disponível em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

---# battlefield6_BR
