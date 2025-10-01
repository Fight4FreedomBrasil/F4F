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
const WEBHOOK_URL_RANKING = 'https://discord.com/api/webhooks/1419476262422057084/W7roHTWuOjfa3ZBJ2b4aH1IJL5FlzAp7bAmXrFZ_yFjotYn4wpY0Xvqagl_2tXL6eEqa';

// Configuração para a lista de membros
const ORDEM_PATENTES = {
  'Marechal': 0,
  'General de Exército': 1,
  'General de Divisão': 2,
  'General de Brigada': 3,
  'Coronel': 4,
  'Tenente-Coronel': 5,
  'Major': 6,
  'Capitão': 7,
  '1º Tenente': 8,
  '2º Tenente': 9,
  'Subtenente': 10,
  '1º Sargento': 11,
  '2º Sargento': 12,
  '3º Sargento': 13,
  'Cabo': 14,
  'Soldado': 15
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
// =========================================================================
// == FUNÇÃO "MESTRE" DO GATILHO onEdit (VERSÃO CORRIGIDA)               ==
// =========================================================================
function masterOnEdit(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();
    const row = range.getRow();

    if (sheet.getName() !== NOME_DA_ABA_PELOTAO) return;

    if (col >= 11 && col <= 16) { // Rota 1: Edição de estatísticas
        Logger.log(`Edição na coluna ${col} detectada. Acionando ranking...`);
        checkRelevantRanking(col.toString());
    } else if (col >= 1 && col <= 4) { // Rota 2: Edição de dados de membro
        Logger.log(`Edição na coluna ${col} detectada. Acionando atualização da lista...`);
        atualizarListaDeMembrosDiscord();
    } else if (col === 18 || col === 19) { // 🔥 CORREÇÃO APLICADA AQUI 🔥
        // Rota 3: Edição de Medalhas (R, col 18) OU Pontuação manual (S, col 19)
        Logger.log(`Alteração na linha ${row} (col ${col}) detectada. Verificando promoção...`);
        // Adiciona um pequeno delay para garantir que a fórmula da Coluna S já tenha recalculado
        Utilities.sleep(500); 
        verificarPromocao(sheet.getRange(row, col)); // Passa o range da célula editada
    }
}

// =========================================================================
// == API PARA O SITE (VERSÃO MAIS ROBUSTA E COM MEDALHAS)                ==
// =========================================================================
// =========================================================================
// == API PARA O SITE (VERSÃO CORRIGIDA E COMPLETA)                      ==
// =========================================================================
// =========================================================================
// == API PARA O SITE (VERSÃO ATUALIZADA COM INSÍGNIAS)                  ==
// =========================================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // --- 1. Buscar e processar dados das patentes ---
    const patentesSheet = ss.getSheetByName("Patente");
    let patentesArray = [];
    const patentesMap = {};
    if (patentesSheet) {
        const patentesValues = patentesSheet.getDataRange().getValues();
        patentesValues.shift();
        patentesArray = patentesValues.map(row => {
            const nome = (row[0] || '').toString().trim();
            const url = (row[1] || '').toString().trim();
            const pontos = parseInt(row[2] || 0);
            if (nome && url) patentesMap[nome] = url;
            return { nome, url, pontosNecessarios: pontos };
        }).filter(p => p.nome);

        patentesArray.sort((a, b) => a.pontosNecessarios - b.pontosNecessarios);
    } else {
        Logger.log('Aviso: Aba "Patente" não encontrada.');
    }

    // --- 2. Buscar catálogo de medalhas ---
    const medalSheet = ss.getSheetByName("Medalhas_Catalogo");
    const medalMap = {};
    if (medalSheet) {
        const medalData = medalSheet.getDataRange().getValues();
        medalData.shift();
        medalData.forEach(row => {
            const medalName = (row[0] || '').toString().trim();
            if (medalName) {
                medalMap[medalName] = { nome: medalName, url: row[1], descricao: row[2], tipo: row[4] };
            }
        });
    }

    // --- 3. Buscar dados dos membros e adicionar dados de progressão ---
    const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
    const platoonData = platoonSheet.getDataRange().getValues();
    const platoonHeaders = platoonData.shift().map(h => h.toString().trim());
    
    const colIdx = {
        medalhas: platoonHeaders.indexOf('Medalhas'),
        pontuacao: platoonHeaders.indexOf('Pontuação'),
        ranking: platoonHeaders.indexOf('Ranking'),
        insignia: platoonHeaders.indexOf('Insígnia') // <-- ADICIONADO AQUI
    };

    const membersArray = platoonData
      .filter(row => (row[0] && row[0].toString().trim() !== "") && (row[2] && row[2].toString().trim() !== ""))
      .map(row => {
        const memberObject = {};
        platoonHeaders.forEach((header, i) => {
          memberObject[header] = row[i];
        });
        
        // Adiciona a Insígnia ao objeto do membro
        if (colIdx.insignia !== -1) {
            memberObject.Insignia = row[colIdx.insignia] || ''; // <-- ADICIONADO AQUI
        }

        memberObject.MedalhasData = [];
        if (colIdx.medalhas !== -1 && row[colIdx.medalhas]) {
          const memberMedalNames = row[colIdx.medalhas].toString().split(',').map(name => name.trim());
          memberMedalNames.forEach(name => {
            if (medalMap[name]) memberObject.MedalhasData.push(medalMap[name]);
          });
        }
        
        const pontuacaoAtual = parseInt(row[colIdx.pontuacao] || 0);
        const patenteAtualNome = row[colIdx.ranking] || '';
        
        const indexPatenteAtual = patentesArray.findIndex(p => p.nome === patenteAtualNome);
        const patenteAtual = patentesArray[indexPatenteAtual] || { nome: patenteAtualNome, url: patentesMap[patenteAtualNome] || '', pontosNecessarios: 0 };
        const proximaPatente = (indexPatenteAtual !== -1 && indexPatenteAtual < patentesArray.length - 1) 
                                 ? patentesArray[indexPatenteAtual + 1] 
                                 : null;

        memberObject.progressao = {
          pontuacaoAtual: pontuacaoAtual,
          patenteAtual: {
            nome: patenteAtual.nome,
            url: patenteAtual.url,
            pontosNecessarios: patenteAtual.pontosNecessarios
          },
          proximaPatente: proximaPatente ? {
            nome: proximaPatente.nome,
            url: proximaPatente.url,
            pontosNecessarios: proximaPatente.pontosNecessarios
          } : null
        };

        return memberObject;
      });

    // --- 4. Montar a resposta final combinada ---
    const finalResponse = {
        membros: membersArray,
        patentes: patentesMap
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(finalResponse))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Erro na API: ' + error.toString() + ' Stack: ' + error.stack);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message, stack: error.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// == LÓGICA DE PROMOÇÃO AUTOMÁTICA                                      ==
// =========================================================================
// =========================================================================
// == LÓGICA DE PROMOÇÃO AUTOMÁTICA (COM VERIFICAÇÃO DE CÉLULA PROTEGIDA) ==
// =========================================================================
function verificarPromocao(range) {
    const sheet = range.getSheet();
    const row = range.getRow();
    if (row < 2) return; // Ignora o cabeçalho

    const rankCell = sheet.getRange(row, 2); // Célula da patente na Coluna B

    // >>> NOVA LÓGICA QUE VERIFICA SE A CÉLULA ESTÁ PROTEGIDA <<<
    const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    let isProtected = false;
    for (const protection of protections) {
        if (protection.getRange().getSheet().getName() === sheet.getName()) {
            const protectedRange = protection.getRange();
            if (rankCell.getRow() >= protectedRange.getRow() &&
                rankCell.getRow() <= protectedRange.getLastRow() &&
                rankCell.getColumn() >= protectedRange.getColumn() &&
                rankCell.getColumn() <= protectedRange.getLastColumn()) {
                isProtected = true;
                break; // Célula encontrada em um intervalo protegido, pode parar de procurar
            }
        }
    }

    if (isProtected) {
        Logger.log(`A célula B${row} está protegida. Nenhuma ação será tomada.`);
        return; // Para a execução se a patente estiver protegida
    }
    
    // Se a célula NÃO está protegida, a lógica de promoção continua...
    const dadosLinha = sheet.getRange(row, 1, 1, 19).getValues()[0];
    const patenteAtual = dadosLinha[1].toString().trim(); // Coluna B
    const pontuacaoAtual = dadosLinha[18]; // Coluna S

    const patentesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Patente");
    if (!patentesSheet) return;
    
    const patentesValues = patentesSheet.getDataRange().getValues();
    patentesValues.shift();
    const patentesArray = patentesValues.map(r => ({ nome: r[0], pontosNecessarios: parseInt(r[2] || 0) }))
                                        .filter(p => p.nome && !isNaN(p.pontosNecessarios))
                                        .sort((a, b) => b.pontosNecessarios - a.pontosNecessarios);

    for (const patente of patentesArray) {
        if (pontuacaoAtual >= patente.pontosNecessarios) {
            if (patente.nome !== patenteAtual) {
                rankCell.setValue(patente.nome);
                Logger.log(`🎉 PROMOÇÃO! O soldado na linha ${row} foi promovido para ${patente.nome}.`);
            }
            return;
        }
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