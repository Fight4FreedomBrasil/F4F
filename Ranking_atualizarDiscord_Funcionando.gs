// Nome do Projeto: MinhaAPI_BF6
// Versão: 11.0 - Versão Final Unificada
// Descrição: Gerencia a API do site, a lista de membros e o monitor de rankings através de um único gatilho onEdit.

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
    'Major': 4, 'Capitão': 5, 'Cabo': 6, 'Soldado': 7
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
// == FUNÇÃO "MESTRE" DO GATILHO onEdit                                   ==
// =========================================================================
function masterOnEdit(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();

    if (sheet.getName() !== NOME_DA_ABA_PELOTAO) return;

    // Rota 1: Se a edição for nas colunas de estatísticas (K a P)
    if (col >= 11 && col <= 16) {
        Logger.log(`Edição de estatística na coluna ${col} detectada. Acionando verificação de ranking...`);
        checkRelevantRanking(col.toString());
    }

    // Rota 2: Se a edição for nas colunas de cadastro de membro (A a D)
    if (col >= 1 && col <= 4) {
        Logger.log(`Edição de membro na coluna ${col} detectada. Acionando atualização da lista de membros...`);
        atualizarListaDeMembrosDiscord();
    }
}


// =========================================================================
// == LÓGICA DO BOT DE RANKING                                            ==
// =========================================================================
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

    Logger.log(`🏆 Líder atual de ${displayName}: ${currentLeader['Nome']} (${currentLeader[column]})`);
    
    const leaderIdKey = `LAST_${column.replace(/[^A-Z0-9]/ig, "")}_LEADER_ID`;
    const messageIdKey = `LAST_${column.replace(/[^A-Z0-9]/ig, "")}_MESSAGE_ID`;
    
    const props = PropertiesService.getScriptProperties();
    const lastLeaderId = props.getProperty(leaderIdKey);
    const lastMessageId = props.getProperty(messageIdKey);
    const currentLeaderId = currentLeader['ID'];

    if (currentLeaderId !== lastLeaderId) {
        Logger.log(`🎉 NOVO LÍDER DE ${displayName.toUpperCase()}: ${currentLeader['Nome']}`);
        const newMessageId = postOrUpdateRankingMessage(currentLeader, rankingInfo, lastMessageId);
        if (newMessageId) {
            props.setProperty(leaderIdKey, currentLeaderId);
            props.setProperty(messageIdKey, newMessageId);
        }
    } else {
        Logger.log(`👍 Líder de ${displayName} permanece o mesmo.`);
    }
}

function findTopPlayerForStat(players, statColumn) {
    if (!players || players.length === 0) return null;
    return players.reduce((topPlayer, currentPlayer) => {
        try {
            const topValue = parseFloat(String(topPlayer[statColumn] || '0').replace(/,/g, ''));
            const currentValue = parseFloat(String(currentPlayer[statColumn] || '0').replace(/,/g, ''));
            return currentValue > topValue ? currentPlayer : topPlayer;
        } catch (e) { return topPlayer; }
    }, players[0]);
}

function postOrUpdateRankingMessage(player, rankingInfo, lastMessageId) {
    const { column, displayName } = rankingInfo;
    const message = `O ${player['Ranking']} **${player['Nome']} | ${player['ID']}** assumiu a liderança!`;
    const statValue = player[column];

    const payload = {
        embeds: [{
            author: { name: `👑 REI DE ${displayName.toUpperCase()} 👑` },
            description: message,
            color: 16766720,
            fields: [{ name: `Recorde de ${displayName}`, value: `**${statValue}**`, inline: true }],
            footer: { text: "BF6.online | Ranking Monitor" },
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
        const response = UrlFetchApp.fetch(url, options);
        const jsonResponse = JSON.parse(response.getContentText());
        Logger.log(`✅ Mensagem de ranking enviada/atualizada. ID: ${jsonResponse.id}`);
        return jsonResponse.id;
    } catch (e) {
        Logger.log(`❌ Erro no webhook de ranking: ${e.toString()}`);
        if (lastMessageId) return postOrUpdateRankingMessage(player, rankingInfo, null);
        return null;
    }
}


// =========================================================================
// == LÓGICA DO BOT DE LISTA DE MEMBROS                                     ==
// =========================================================================
const PROPS_LISTA = PropertiesService.getScriptProperties();

function atualizarListaDeMembrosDiscord() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
    if (!sh) { return; }

    const rng = sh.getDataRange().getValues();
    if (rng.length < 2) { return; }
    
    const headers = rng[0].map(h => h.toString().trim());
    const colIndex = { id: headers.indexOf('ID'), nome: headers.indexOf('Nome'), ranking: headers.indexOf('Ranking'), plataforma: headers.indexOf('Plataforma') };
    if (Object.values(colIndex).some(i => i === -1)) { return; }

    let rows = rng.slice(1).filter(r => r[colIndex.nome] && r[colIndex.ranking] && r[colIndex.id] && r[colIndex.plataforma]);
    
    rows.sort((a, b) => {
        const pesoA = ORDEM_PATENTES[a[colIndex.ranking]] ?? 99;
        const pesoB = ORDEM_PATENTES[b[colIndex.ranking]] ?? 99;
        if (pesoA !== pesoB) return pesoA - pesoB;
        return a[colIndex.nome].toLowerCase().localeCompare(b[colIndex.nome].toLowerCase());
    });

    const chunks = [];
    for (let i = 0; i < rows.length; i += MEMBROS_POR_POSTAGEM) {
        chunks.push(rows.slice(i, i + MEMBROS_POR_POSTAGEM));
    }

    const oldMessageIds = JSON.parse(PROPS_LISTA.getProperty('DISCORD_MESSAGE_IDS_ARRAY') || '[]');
    const newMessageIds = [];
    
    const maxParts = Math.max(chunks.length, oldMessageIds.length);

    for (let i = 0; i < maxParts; i++) {
        const chunk = chunks[i];
        const messageId = oldMessageIds[i];

        if (chunk && messageId) {
            const content = formatarConteudoListaMembros(chunk, i, chunks.length, colIndex);
            editarMensagemLista(messageId, content);
            newMessageIds.push(messageId);
        } else if (chunk && !messageId) {
            const content = formatarConteudoListaMembros(chunk, i, chunks.length, colIndex);
            const newId = criarMensagemLista(content);
            if (newId) {
                newMessageIds.push(newId);
            }
        } else if (!chunk && messageId) {
            apagarMensagemLista(messageId);
        }
    }
    PROPS_LISTA.setProperty('DISCORD_MESSAGE_IDS_ARRAY', JSON.stringify(newMessageIds));
    Logger.log("Lista de membros atualizada no Discord.");
}

function formatarConteudoListaMembros(chunk, chunkIndex, totalParts, colIndex) {
    const partTitle = `${MSG_TITLE_PREFIX} (Parte ${chunkIndex + 1}/${totalParts})`;
    let listaSoldados = '';
    chunk.forEach((r, memberIndex) => {
        const globalIndex = chunkIndex * MEMBROS_POR_POSTAGEM + memberIndex;
        listaSoldados += `#### Membro ${globalIndex + 1} ####\n`;
        listaSoldados += `**Nick:** [F4F] ${r[colIndex.nome]}\n`;
        listaSoldados += `**ID EA:** ${r[colIndex.id]}\n`;
        listaSoldados += `**Plataforma:** ${r[colIndex.plataforma]}\n`;
        listaSoldados += `**Patente:** ${r[colIndex.ranking]}\n`;
        if (memberIndex < chunk.length - 1) { listaSoldados += `--------------------\n`; }
    });
    return `${partTitle}\n\n${listaSoldados}\n\n*Atualizado em: ${Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm")}*`;
}

function criarMensagemLista(content) {
    const payload = { content };
    const params = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
    const res = UrlFetchApp.fetch(WEBHOOK_URL_LISTA_MEMBROS + '?wait=true', params);
    if (res.getResponseCode() >= 400) { console.error("ERRO (criar):", res.getContentText()); return null; }
    const data = JSON.parse(res.getContentText());
    return data && data.id ? data.id : null;
}

function editarMensagemLista(messageId, content) {
    const payload = { content };
    const params = { method: 'patch', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
    UrlFetchApp.fetch(WEBHOOK_URL_LISTA_MEMBROS + '/messages/' + messageId, params);
}

function apagarMensagemLista(messageId) {
    const params = { method: 'delete', muteHttpExceptions: true };
    UrlFetchApp.fetch(WEBHOOK_URL_LISTA_MEMBROS + '/messages/' + messageId, params);
}

// =========================================================================
// == FUNÇÕES AUXILIARES E API PARA O SITE                                ==
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

function doGet(e) {
    try {
        const jsonArray = getSheetDataAsObjects();
        return ContentService.createTextOutput(JSON.stringify(jsonArray)).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

// =========================================================================
// == FUNÇÃO DE CONFIGURAÇÃO (EXECUTAR APENAS UMA VEZ)                    ==
// =========================================================================
function setupTrigger() {
    ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
    
    ScriptApp.newTrigger('masterOnEdit')
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onEdit()
        .create();
    
    Logger.log("✅ Gatilho único 'Ao Editar' para a função 'masterOnEdit' foi configurado com sucesso!");
}