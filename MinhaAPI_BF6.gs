// Nome do Projeto: MinhaAPI_BF6
// Versão: 12.0 - Versão Final com Medalhas e Bots Unificados
// Descrição: Gerencia a API (com medalhas), a lista de membros e o monitor de rankings.

// =========================================================================
// == CONFIGURAÇÕES GERAIS                                                  ==
// =========================================================================
const SPREADSHEET_ID = "1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs";
const NOME_DA_ABA_PELOTAO = 'Platoon'; 

// ▼▼▼ VERIFIQUE SE AS DUAS URLs ESTÃO CORRETAS ▼▼▼
const WEBHOOK_URL_LISTA_MEMBROS = 'https://discord.com/api/webhooks/1404814856476950579/RRTpoRNsSFI3WVZatfDmSOS0hBm-yhzyhHnS2isyCKW1wLKMmBcNlic520znceMtwBKT';
const WEBHOOK_URL_RANKING = 'https://discord.com/api/webhooks/1405347082776088586/yOc8jiN78gGKGNcU9BsIXvXUVanl7dKJsrKA4DvnkUytDi_-vjRaVili9LvqaURcFMD3';

// Configuração para a lista de membros
const ORDEM_PATENTES = {
    'Marechal': 0, 'General': 1, 'Coronel': 2, 'Tenente': 3,
    'Major': 4, 'Capitão': 5, 'Sargento': 6, 'Cabo': 7, 'Soldado': 8
};
const MEMBROS_POR_POSTAGEM = 10;
const MSG_TITLE_PREFIX = '📋 **Registro de Soldados F4F**';

// Configuração para o monitor de rankings (K=11, L=12, etc.)
const RANKINGS_CONFIG = {
    '11': { column: 'K/D', displayName: 'K/D' },
    '12': { column: 'Kills', displayName: 'Kills' },
    '13': { column: 'Assists', displayName: 'Assistências' },
    '14': { column: 'Revives', displayName: 'Revives' },
    '15': { column: 'Partidas', displayName: 'Partidas' },
    '16': { column: 'XP', displayName: 'XP' }
};

// =========================================================================
// == FUNÇÃO DE CONFIGURAÇÃO E INICIALIZAÇÃO (EXECUTAR APENAS UMA VEZ)    ==
// =========================================================================
function setupAndInitializeTriggers() {
    PropertiesService.getScriptProperties().deleteAllProperties();
    Logger.log("⚠️ Memória do bot (líderes e IDs de mensagem) foi limpa.");

    ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
    
    ScriptApp.newTrigger('masterOnEdit')
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onEdit()
        .create();
    Logger.log("✅ Gatilho único 'Ao Editar' foi configurado com sucesso!");

    Logger.log("🚀 Postando os líderes atuais de todas as categorias no Discord...");
    checkAllRankings();
}

// =========================================================================
// == FUNÇÃO "MESTRE" DO GATILHO onEdit                                   ==
// =========================================================================
function masterOnEdit(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();

    if (sheet.getName() !== NOME_DA_ABA_PELOTAO) return;

    if (col >= 11 && col <= 16) { // Rota 1: Edição de estatísticas
        Logger.log(`Edição na coluna ${col} detectada. Acionando ranking...`);
        checkRelevantRanking(col.toString());
    } else if (col >= 1 && col <= 4) { // Rota 2: Edição de dados de membro
        Logger.log(`Edição na coluna ${col} detectada. Acionando atualização da lista...`);
        atualizarListaDeMembrosDiscord();
    }
}

// =========================================================================
// == API PARA O SITE (COM MEDALHAS)                                      ==
// =========================================================================
// =========================================================================
// == API PARA O SITE (VERSÃO CORRETA COM MEDALHAS)                       ==
// =========================================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. Ler o catálogo de medalhas e criar um mapa de referência
    const medalSheet = ss.getSheetByName("Medalhas_Catalogo");
    const medalData = medalSheet.getDataRange().getValues();
    const medalHeaders = medalData.shift(); // Remove o cabeçalho
    const medalMap = {};
    medalData.forEach(row => {
      const medalName = row[0];
      if (medalName) {
        medalMap[medalName] = {
          nome: medalName,
          url: row[1],
          descricao: row[2]
        };
      }
    });

    // 2. Ler os dados dos jogadores da aba Platoon
    const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
    const platoonData = platoonSheet.getDataRange().getValues();
    const platoonHeaders = platoonData.shift(); // Remove o cabeçalho
    const medalColumnIndex = platoonHeaders.indexOf('Medalhas'); // Encontra a coluna de medalhas

    // 3. Montar o JSON final para o site, combinando os dados
    const jsonArray = platoonData
      .filter(row => (row[0] && row[0].toString().trim() !== "") && (row[2] && row[2].toString().trim() !== ""))
      .map(row => {
        const memberObject = {};
        platoonHeaders.forEach((header, i) => {
          if (header && header.trim() !== "") {
            memberObject[header] = row[i];
          }
        });
        
        // Processa as medalhas do jogador e cria a propriedade "MedalhasData"
        memberObject.MedalhasData = [];
        if (medalColumnIndex !== -1 && row[medalColumnIndex]) {
          const memberMedalNames = row[medalColumnIndex].toString().split(',').map(name => name.trim());
          memberMedalNames.forEach(name => {
            if (medalMap[name]) {
              memberObject.MedalhasData.push(medalMap[name]);
            }
          });
        }
        return memberObject;
      });
    
    return ContentService.createTextOutput(JSON.stringify(jsonArray)).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// == LÓGICA DO BOT DE RANKING                                            ==
// =========================================================================
function checkAllRankings() {
    const players = getSheetDataAsObjects();
    if (!players || players.length === 0) return;
    Object.values(RANKINGS_CONFIG).forEach(rankingInfo => {
        checkTopStat(players, rankingInfo);
        Utilities.sleep(2000);
    });
}
function checkRelevantRanking(editedColumn) {
    const rankingInfo = RANKINGS_CONFIG[editedColumn];
    if (!rankingInfo) return;
    const players = getSheetDataAsObjects();
    if (!players || players.length === 0) return;
    checkTopStat(players, rankingInfo);
}
function checkTopStat(players, rankingInfo) {
    const { column, displayName } = rankingInfo;
    const currentLeader = findTopPlayerForStat(players, column);
    if (!currentLeader) return;
    const leaderIdKey = `LAST_${column.replace(/[^A-Z0-9]/ig, "")}_LEADER_ID`;
    const messageIdKey = `LAST_${column.replace(/[^A-Z0-9]/ig, "")}_MESSAGE_ID`;
    const props = PropertiesService.getScriptProperties();
    const lastLeaderId = props.getProperty(leaderIdKey);
    const currentLeaderId = currentLeader['ID'];
    if (currentLeaderId !== lastLeaderId) {
        Logger.log(`🎉 NOVO LÍDER DE ${displayName.toUpperCase()}: ${currentLeader['Nome']}`);
        const lastMessageId = props.getProperty(messageIdKey);
        const newMessageId = postOrUpdateRankingMessage(currentLeader, rankingInfo, lastMessageId);
        if (newMessageId) {
            props.setProperty(leaderIdKey, currentLeaderId);
            props.setProperty(messageIdKey, newMessageId);
        }
    }
}
function findTopPlayerForStat(players, statColumn) {
    if (!players || players.length === 0) return null;
    return players.reduce((top, current) => {
        const topVal = parseFloat(String(top[statColumn] || '0').replace(/,/g, ''));
        const currentVal = parseFloat(String(current[statColumn] || '0').replace(/,/g, ''));
        return currentVal > topVal ? current : top;
    }, players[0]);
}
function postOrUpdateRankingMessage(player, rankingInfo, lastMessageId) {
    const { column, displayName } = rankingInfo;
    const payload = {
        embeds: [{
            author: { name: `👑 REI DE ${displayName.toUpperCase()} 👑` },
            description: `O ${player['Ranking']} **${player['Nome']} | ${player['ID']}** assumiu a liderança!`,
            color: 16766720,
            fields: [{ name: `Recorde de ${displayName}`, value: `**${player[column]}**`, inline: true }],
            footer: { text: "Ranking [F4F]" },
            timestamp: new Date().toISOString()
        }]
    };
    const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload) };
    let url = `${WEBHOOK_URL_RANKING}?wait=true`;
    if (lastMessageId) {
        options.method = 'patch';
        url = `${WEBHOOK_URL_RANKING}/messages/${lastMessageId}`;
    }
    try {
        const res = UrlFetchApp.fetch(url, options);
        return JSON.parse(res.getContentText()).id;
    } catch (e) {
        Logger.log(`❌ Erro no webhook de ranking: ${e.toString()}`);
        if (lastMessageId) return postOrUpdateRankingMessage(player, rankingInfo, null);
        return null;
    }
}

// =========================================================================
// == LÓGICA DO BOT DE LISTA DE MEMBROS                                     ==
// =========================================================================
function atualizarListaDeMembrosDiscord() {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOME_DA_ABA_PELOTAO);
    const rng = sh.getDataRange().getValues();
    if (rng.length < 2) return;
    const headers = rng[0].map(h => h.toString().trim());
    const colIndex = { id: headers.indexOf('ID'), nome: headers.indexOf('Nome'), ranking: headers.indexOf('Ranking'), plataforma: headers.indexOf('Plataforma') };
    let rows = rng.slice(1).filter(r => r[colIndex.nome] && r[colIndex.ranking] && r[colIndex.id] && r[colIndex.plataforma]);
    rows.sort((a, b) => (ORDEM_PATENTES[a[colIndex.ranking]] ?? 99) - (ORDEM_PATENTES[b[colIndex.ranking]] ?? 99) || a[colIndex.nome].toLowerCase().localeCompare(b[colIndex.nome].toLowerCase()));
    const chunks = [];
    for (let i = 0; i < rows.length; i += MEMBROS_POR_POSTAGEM) chunks.push(rows.slice(i, i + MEMBROS_POR_POSTAGEM));
    const props = PropertiesService.getScriptProperties();
    const oldMessageIds = JSON.parse(props.getProperty('DISCORD_MESSAGE_IDS_ARRAY') || '[]');
    const newMessageIds = [];
    const maxParts = Math.max(chunks.length, oldMessageIds.length);
    for (let i = 0; i < maxParts; i++) {
        const content = chunks[i] ? formatarConteudoListaMembros(chunks[i], i, chunks.length, colIndex) : null;
        if (chunks[i] && oldMessageIds[i]) {
            editarMensagemLista(oldMessageIds[i], content);
            newMessageIds.push(oldMessageIds[i]);
        } else if (chunks[i] && !oldMessageIds[i]) {
            const newId = criarMensagemLista(content);
            if (newId) newMessageIds.push(newId);
        } else if (!chunks[i] && oldMessageIds[i]) {
            apagarMensagemLista(oldMessageIds[i]);
        }
    }
    props.setProperty('DISCORD_MESSAGE_IDS_ARRAY', JSON.stringify(newMessageIds));
}
function formatarConteudoListaMembros(chunk, chunkIndex, totalParts, colIndex) {
    const partTitle = `${MSG_TITLE_PREFIX} (Parte ${chunkIndex + 1}/${totalParts})`;
    let listaSoldados = chunk.map((r, memberIndex) => {
        const globalIndex = chunkIndex * MEMBROS_POR_POSTAGEM + memberIndex;
        return `#### Membro ${globalIndex + 1} ####\n**Nick:** [F4F] ${r[colIndex.nome]}\n**ID EA:** ${r[colIndex.id]}\n**Plataforma:** ${r[colIndex.plataforma]}\n**Patente:** ${r[colIndex.ranking]}`;
    }).join('\n--------------------\n');
    return `${partTitle}\n\n${listaSoldados}\n\n*Atualizado em: ${Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm")}*`;
}
function criarMensagemLista(c) { try { const p = { method: 'post', contentType: 'application/json', payload: JSON.stringify({ content: c }), muteHttpExceptions: true }; const r = UrlFetchApp.fetch(`${WEBHOOK_URL_LISTA_MEMBROS}?wait=true`, p); return JSON.parse(r.getContentText()).id; } catch (e) { return null; } }
function editarMensagemLista(id, c) { UrlFetchApp.fetch(`${WEBHOOK_URL_LISTA_MEMBROS}/messages/${id}`, { method: 'patch', contentType: 'application/json', payload: JSON.stringify({ content: c }), muteHttpExceptions: true }); }
function apagarMensagemLista(id) { UrlFetchApp.fetch(`${WEBHOOK_URL_LISTA_MEMBROS}/messages/${id}`, { method: 'delete', muteHttpExceptions: true }); }

// =========================================================================
// == FUNÇÕES AUXILIARES                                                  ==
// =========================================================================
function getSheetDataAsObjects() {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOME_DA_ABA_PELOTAO);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    return data.filter(row => (row[0] && row[0].trim() !== "") && (row[2] && row[2].trim() !== "")).map(row => {
        const memberObject = {};
        headers.forEach((header, i) => { if (header) memberObject[header] = row[i]; });
        return memberObject;
    });
}