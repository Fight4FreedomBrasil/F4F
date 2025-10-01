// Nome do Projeto: MinhaAPI_BF6
// Versão: 14.1 - Bot de Loadouts com Traduções para Português
// Descrição: Gerencia as APIs, bots de membros, ranking e o bot de loadouts S-Tier em português.

// =========================================================================
// == CONFIGURAÇÕES GERAIS                                                ==
// =========================================================================
const SPREADSHEET_ID = "1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs";
const NOME_DA_ABA_PELOTAO = 'Platoon';
const NOME_DA_ABA_LOADOUTS = 'Loadouts';
const NOME_DA_ABA_ARMAS = 'Armas';

const WEBHOOK_URL_LISTA_MEMBROS = 'https://discord.com/api/webhooks/1404814856476950579/RRTpoRNsSFI3WVZatfDmSOS0hBm-yhzyhHnS2isyCKW1wLKMmBcNlic520znceMtwBKT';
const WEBHOOK_URL_RANKING = 'https://discord.com/api/webhooks/1419476262422057084/W7roHTWuOjfa3ZBJ2b4aH1IJL5FlzAp7bAmXrFZ_yFjotYn4wpY0Xvqagl_2tXL6eEqa';
const WEBHOOK_URL_LOADOUTS = 'https://discord.com/api/webhooks/1422972200398487733/iAssDyejDbhyPWRU0nilqP6LbAK2-vNeWF7OKnytd7wKEE_Qe2bKR1pZTZaC7rHqyIcp';

const ORDEM_PATENTES = {'Marechal': 0,'General de Exército': 1,'General de Divisão': 2,'General de Brigada': 3,'Coronel': 4,'Tenente-Coronel': 5,'Major': 6,'Capitão': 7,'1º Tenente': 8,'2º Tenente': 9,'Subtenente': 10,'1º Sargento': 11,'2º Sargento': 12,'3º Sargento': 13,'Cabo': 14,'Soldado': 15};
const MEMBROS_POR_POSTAGEM = 10;
const MSG_TITLE_PREFIX = '📋 **Registro de Soldados F4F**';
const RANKINGS_CONFIG = {'11': { column: 'K/D', displayName: 'K/D' },'12': { column: 'Kills', displayName: 'Kills' },'13': { column: 'Assists', displayName: 'Assistências' },'14': { column: 'Revives', displayName: 'Revives' },'15': { column: 'Partidas', displayName: 'Partidas' },'16': { column: 'XP', displayName: 'XP' }};

// =========================================================================
// == NOVO DICIONÁRIO DE TRADUÇÕES                                        ==
// =========================================================================
const dicionarioTraducoes = {
    // Acessórios
    "Muzzle": "Bocal",
    "Barrel": "Cano",
    "Underbarrel": "Acoplamento",
    "Magazine": "Carregador",
    "Ammunition": "Munição",
    "Scope": "Luneta",
    "Ergonomics": "Ergonomia",
    "Optic": "Óptica",
    "Top": "Trilho Superior",
    "Right": "Trilho Direito",
    
    // Playstyles
    "Playstyle": "Estilo de Jogo",
    "Balanced": "Equilibrado",
    "Close Quarters": "Curta Distância",
    "Long Range": "Longo Alcance",
    "Close Range": "Curto Alcance"
};

// =========================================================================
// == NOVA FUNÇÃO AUXILIAR PARA TRADUZIR                                  ==
// =========================================================================
function traduzir(termo) {
  return dicionarioTraducoes[termo] || termo;
}

// ... todo o resto do código permanece o mesmo, exceto pela função formatarEmbedLoadout ...

function setupAndInitializeTriggers() {
    PropertiesService.getScriptProperties().deleteAllProperties();
    Logger.log("⚠️ Memória de todos os bots foi limpa.");
    ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
    ScriptApp.newTrigger('masterOnEdit')
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onEdit()
        .create();
    Logger.log("✅ Gatilho único 'masterOnEdit' foi configurado com sucesso!");
    Logger.log("🚀 Postando os líderes atuais de todas as categorias no Discord...");
    checkAllRankings();
    Logger.log("🚀 Postando os loadouts S-Tier atuais no Discord...");
    atualizarLoadoutsDiscord();
}

function masterOnEdit(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();
    const row = range.getRow();
    const sheetName = sheet.getName();

    if (sheetName === NOME_DA_ABA_PELOTAO) {
        if (col >= 11 && col <= 16) { 
            Logger.log(`Edição em '${sheetName}' (col ${col}). Acionando ranking...`);
            checkRelevantRanking(col.toString());
        } else if (col >= 1 && col <= 4) {
            Logger.log(`Edição em '${sheetName}' (col ${col}). Acionando atualização da lista de membros...`);
            atualizarListaDeMembrosDiscord();
        } else if (col === 18 || col === 19) { 
            Logger.log(`Edição em '${sheetName}' (col ${col}). Verificando promoção...`);
            Utilities.sleep(500); 
            verificarPromocao(sheet.getRange(row, col));
        }
    } else if (sheetName === NOME_DA_ABA_LOADOUTS) {
        Logger.log(`Edição detectada na aba '${sheetName}'. Acionando bot de Loadouts do Discord...`);
        Utilities.sleep(500);
        atualizarLoadoutsDiscord();
    }
}

function doGet(e) {
  const page = e.parameter.page;
  if (page === 'loadouts') {
    return getLoadoutsData();
  } else {
    return getPlatoonData();
  }
}

function getPlatoonData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
    const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
    const platoonData = platoonSheet.getDataRange().getValues();
    const platoonHeaders = platoonData.shift().map(h => h.toString().trim());
    const colIdx = {
        medalhas: platoonHeaders.indexOf('Medalhas'),
        pontuacao: platoonHeaders.indexOf('Pontuação'),
        ranking: platoonHeaders.indexOf('Ranking'),
        insignia: platoonHeaders.indexOf('Insígnia')
    };
    const membersArray = platoonData
      .filter(row => (row[0] && row[0].toString().trim() !== "") && (row[2] && row[2].toString().trim() !== ""))
      .map(row => {
        const memberObject = {};
        platoonHeaders.forEach((header, i) => {
          memberObject[header] = row[i];
        });
        if (colIdx.insignia !== -1) {
            memberObject.Insignia = row[colIdx.insignia] || '';
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
    const finalResponse = {
        membros: membersArray,
        patentes: patentesMap
    };
    return ContentService
      .createTextOutput(JSON.stringify(finalResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro na API de Pelotão: ' + error.toString() + ' Stack: ' + error.stack);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message, stack: error.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getLoadoutsData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const armasSheet = ss.getSheetByName(NOME_DA_ABA_ARMAS);
    const armasData = armasSheet.getDataRange().getValues().slice(1);
    const armaTipoMap = {};
    armasData.forEach(row => {
      const nomeArma = row[0];
      const tipoArma = row[1];
      if (nomeArma) armaTipoMap[nomeArma] = tipoArma;
    });
    const loadoutsSheet = ss.getSheetByName(NOME_DA_ABA_LOADOUTS);
    const loadoutsValues = loadoutsSheet.getDataRange().getValues();
    const loadoutsHeaders = loadoutsValues.shift();
    const loadoutsArray = loadoutsValues.map(row => {
      const loadoutObject = {};
      loadoutsHeaders.forEach((header, i) => {
        loadoutObject[header] = row[i];
      });
      loadoutObject.Categoria = armaTipoMap[loadoutObject.Arma] || 'Desconhecida';
      return loadoutObject;
    });
    const groupedByTier = {};
    const tierTitles = {
        'S': 'Absolute Meta - S Tier',
        'A': 'Meta - A Tier',
        'B': 'B Tier',
        'C': 'C Tier',
        'D': 'D Tier'
    };
    loadoutsArray.forEach(loadout => {
      const tier = loadout.Tipo || 'Outros';
      if (!groupedByTier[tier]) {
        groupedByTier[tier] = {
          tier: tier,
          title: tierTitles[tier] || `${tier} Tier`,
          weapons: []
        };
      }
      groupedByTier[tier].weapons.push(loadout);
    });
    const tierOrder = {'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5};
    const finalResponse = Object.values(groupedByTier).sort((a, b) => {
        const orderA = tierOrder[a.tier] || 99;
        const orderB = tierOrder[b.tier] || 99;
        return orderA - orderB;
    });
    return ContentService
      .createTextOutput(JSON.stringify(finalResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro na API de Loadouts: ' + error.toString() + ' Stack: ' + error.stack);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: "Erro ao buscar dados de loadouts: " + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function atualizarLoadoutsDiscord() {
  const props = PropertiesService.getScriptProperties();
  let oldMessages = JSON.parse(props.getProperty('DISCORD_LOADOUT_MESSAGES') || '{}');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOME_DA_ABA_LOADOUTS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const colIndex = {
    arma: headers.indexOf('Arma'),
    tipo: headers.indexOf('Tipo'),
    imagem: headers.indexOf('Imagem'),
    playstyle: headers.indexOf('Playstyle')
  };
  const attachmentHeaders = ['Muzzle', 'Barrel', 'Underbarrel', 'Magazine', 'Ammunition', 'Scope', 'Ergonomics', 'Optic', 'Top', 'Right'];
  const currentSTierLoadouts = {};
  values.forEach(row => {
    if (row[colIndex.tipo] === 'S') {
      const loadout = {};
      headers.forEach((header, i) => {
        loadout[header] = row[i];
      });
      const uniqueKey = `${loadout.Arma}_${loadout.Playstyle}`;
      currentSTierLoadouts[uniqueKey] = loadout;
    }
  });
  const newMessages = {};
  const processedKeys = new Set();
  for (const key in currentSTierLoadouts) {
    const loadout = currentSTierLoadouts[key];
    const oldMessageId = oldMessages[key];
    if (oldMessageId) {
      Logger.log(`Atualizando loadout existente para ${key}...`);
      editarLoadoutExistente(oldMessageId, loadout, attachmentHeaders);
      newMessages[key] = oldMessageId;
    } else {
      Logger.log(`Criando novo post para ${key}...`);
      const newMessageId = postarNovoLoadout(loadout, attachmentHeaders);
      if (newMessageId) {
        newMessages[key] = newMessageId;
      }
    }
    processedKeys.add(key);
  }
  for (const key in oldMessages) {
    if (!processedKeys.has(key)) {
      Logger.log(`Removendo post antigo para ${key} (não é mais S-Tier)...`);
      apagarLoadoutAntigo(oldMessages[key]);
    }
  }
  props.setProperty('DISCORD_LOADOUT_MESSAGES', JSON.stringify(newMessages));
  Logger.log("✅ Bot de Loadouts finalizou a sincronização.");
}

// =========================================================================
// == FUNÇÃO DE EMBED MODIFICADA PARA USAR TRADUÇÕES                      ==
// =========================================================================
function formatarEmbedLoadout(loadout, attachmentHeaders) {
  const fields = attachmentHeaders
    .map(header => ({
      name: traduzir(header), // Traduz o nome do campo
      value: loadout[header] || '---',
      inline: true
    }))
    .filter(field => field.value !== '---');

  return {
    author: {
      name: `🏆 [S-TIER] ${loadout.Arma}`,
      icon_url: 'https://i.imgur.com/83hD4Bw.png'
    },
    description: `**${traduzir('Playstyle')}:** \`${traduzir(loadout.Playstyle) || 'N/A'}\``, // Traduz o valor do Playstyle
    color: 16766720,
    thumbnail: {
      url: loadout.Imagem
    },
    fields: fields,
    footer: {
      text: "F4F Loadouts"
    },
    timestamp: new Date().toISOString()
  };
}

function postarNovoLoadout(loadout, attachmentHeaders) {
  const embed = formatarEmbedLoadout(loadout, attachmentHeaders);
  const payload = { embeds: [embed] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}?wait=true`, options);
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      return JSON.parse(response.getContentText()).id;
    }
    Logger.log(`Erro ao criar post de loadout: ${response.getContentText()}`);
    return null;
  } catch(e) {
    Logger.log(`Exceção ao criar post de loadout: ${e.toString()}`);
    return null;
  }
}

function editarLoadoutExistente(messageId, loadout, attachmentHeaders) {
  const embed = formatarEmbedLoadout(loadout, attachmentHeaders);
  const payload = { embeds: [embed] };
  const options = { method: 'patch', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}/messages/${messageId}`, options);
    if (response.getResponseCode() !== 200) {
        Logger.log(`Erro ao editar post ${messageId}: ${response.getContentText()}`);
    }
  } catch(e) {
    Logger.log(`Exceção ao editar post ${messageId}: ${e.toString()}`);
  }
}

function apagarLoadoutAntigo(messageId) {
  const options = { method: 'delete', muteHttpExceptions: true };
  try {
    UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}/messages/${messageId}`, options);
  } catch(e) {
    Logger.log(`Exceção ao apagar post ${messageId}: ${e.toString()}`);
  }
}

function verificarPromocao(range) {
    const sheet = range.getSheet();
    const row = range.getRow();
    if (row < 2) return; 
    const rankCell = sheet.getRange(row, 2); 
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
                break;
            }
        }
    }
    if (isProtected) {
        Logger.log(`A célula B${row} está protegida. Nenhuma ação será tomada.`);
        return; 
    }
    const dadosLinha = sheet.getRange(row, 1, 1, 19).getValues()[0];
    const patenteAtual = dadosLinha[1].toString().trim(); 
    const pontuacaoAtual = dadosLinha[18];
    const patentesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Patente");
    if (!patentesSheet) return;
    const patentesValues = patentesSheet.getDataRange().getValues();
    patentesValues.shift();
    const patentesArray = patentesValues.map(r