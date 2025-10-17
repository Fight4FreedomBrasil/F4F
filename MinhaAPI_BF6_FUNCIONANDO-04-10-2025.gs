// Nome do Projeto: MinhaAPI_BF6
// Versão: 14.0 - Bot de Loadouts para o Discord
// Descrição: Gerencia as APIs, bots de membros, ranking e agora o bot de loadouts S-Tier.

// =========================================================================
// == CONFIGURAÇÕES GERAIS                                                ==
// =========================================================================
const SPREADSHEET_ID = "1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs";
const NOME_DA_ABA_PELOTAO = 'Platoon';
const NOME_DA_ABA_LOADOUTS = 'Loadouts';
const NOME_DA_ABA_ARMAS = 'Armas';

// ▼▼▼ URLs de Webhook do Discord ▼▼▼
const WEBHOOK_URL_LISTA_MEMBROS = 'https://discord.com/api/webhooks/1404814856476950579/RRTpoRNsSFI3WVZatfDmSOS0hBm-yhzyhHnS2isyCKW1wLKMmBcNlic520znceMtwBKT';
const WEBHOOK_URL_RANKING = 'https://discord.com/api/webhooks/1419476262422057084/W7roHTWuOjfa3ZBJ2b4aH1IJL5FlzAp7bAmXrFZ_yFjotYn4wpY0Xvqagl_2tXL6eEqa';
const WEBHOOK_URL_LOADOUTS = 'https://discord.com/api/webhooks/1422972200398487733/iAssDyejDbhyPWRU0nilqP6LbAK2-vNeWF7OKnytd7wKEE_Qe2bKR1pZTZaC7rHqyIcp';

// Configuração para a lista de membros
const ORDEM_PATENTES = {'Marechal': 0,'General de Exército': 1,'General de Divisão': 2,'General de Brigada': 3,'Coronel': 4,'Tenente-Coronel': 5,'Major': 6,'Capitão': 7,'1º Tenente': 8,'2º Tenente': 9,'Subtenente': 10,'1º Sargento': 11,'2º Sargento': 12,'3º Sargento': 13,'Cabo': 14,'Soldado': 15};
const MEMBROS_POR_POSTAGEM = 10;
const MSG_TITLE_PREFIX = '📋 **Registro de Soldados F4F**';

// Configuração para o monitor de rankings
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
    "Scope": "Mira",
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

// =========================================================================
// == FUNÇÃO DE CONFIGURAÇÃO E INICIALIZAÇÃO (EXECUTAR APENAS UMA VEZ)    ==
// =========================================================================
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
    atualizarLoadoutsDiscord(); // Adicionado para postar o estado inicial dos loadouts
}

// =========================================================================
// == ROTEADOR PRINCIPAL DA API (NOVA FUNÇÃO doGet)                       ==
// =========================================================================
function doGet(e) {
  const page = e.parameter.page;
  if (page === 'loadouts') {
    return getLoadoutsData();
  } else {
    return getPlatoonData();
  }
}

// =========================================================================
// == API PARA A PÁGINA DE MEMBROS E PERFIL (CÓDIGO ATUALIZADO)           ==
// =========================================================================
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
            // ▼▼▼ LINHA MODIFICADA ▼▼▼
            // Adicionado .reverse() para inverter a ordem das medalhas (mais nova primeiro)
            const memberMedalNames = row[colIdx.medalhas].toString().split(',').map(name => name.trim()).reverse();
            // ▲▲▲ FIM DA MODIFICAÇÃO ▲▲▲
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

// =========================================================================
// == NOVO BOT - ATUALIZAÇÃO DE LOADOUTS NO DISCORD                       ==
// =========================================================================
function atualizarLoadoutsDiscord() {
  const props = PropertiesService.getScriptProperties();
  let oldMessages = JSON.parse(props.getProperty('DISCORD_LOADOUT_MESSAGES') || '{}');
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOME_DA_ABA_LOADOUTS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();

  // Mapeia os índices das colunas para facilitar a leitura
  const colIndex = {
    arma: headers.indexOf('Arma'),
    tipo: headers.indexOf('Tipo'), // Coluna N
    imagem: headers.indexOf('Imagem'),
    playstyle: headers.indexOf('Playstyle')
  };

  const attachmentHeaders = ['Muzzle', 'Barrel', 'Underbarrel', 'Magazine', 'Ammunition', 'Scope', 'Ergonomics', 'Optic', 'Top', 'Right'];

  // 1. Identifica os loadouts que são S-Tier atualmente
  const currentSTierLoadouts = {};
  values.forEach(row => {
    if (row[colIndex.tipo] === 'S') {
      const loadout = {};
      headers.forEach((header, i) => {
        loadout[header] = row[i];
      });
      // A chave única será a combinação da arma e do playstyle para evitar conflitos
      const uniqueKey = `${loadout.Arma}_${loadout.Playstyle}`;
      currentSTierLoadouts[uniqueKey] = loadout;
    }
  });
  
  const newMessages = {};
  const processedKeys = new Set();

  // 2. Itera sobre os S-Tiers atuais para criar ou editar posts
  for (const key in currentSTierLoadouts) {
    const loadout = currentSTierLoadouts[key];
    const oldMessageId = oldMessages[key];
    
    if (oldMessageId) {
      // Se já existe um post, edita
      Logger.log(`Atualizando loadout existente para ${key}...`);
      editarLoadoutExistente(oldMessageId, loadout, attachmentHeaders);
      newMessages[key] = oldMessageId;
    } else {
      // Se não existe, cria um novo post
      Logger.log(`Criando novo post para ${key}...`);
      const newMessageId = postarNovoLoadout(loadout, attachmentHeaders);
      if (newMessageId) {
        newMessages[key] = newMessageId;
      }
    }
    processedKeys.add(key);
  }

  // 3. Itera sobre os posts antigos para apagar os que não são mais S-Tier
  for (const key in oldMessages) {
    if (!processedKeys.has(key)) {
      Logger.log(`Removendo post antigo para ${key} (não é mais S-Tier)...`);
      apagarLoadoutAntigo(oldMessages[key]);
    }
  }

  // 4. Salva o novo mapa de mensagens
  props.setProperty('DISCORD_LOADOUT_MESSAGES', JSON.stringify(newMessages));
  Logger.log("✅ Bot de Loadouts finalizou a sincronização.");
}

function formatarEmbedLoadout(loadout, attachmentHeaders) {
  const fields = attachmentHeaders
    .map(header => ({
      name: header,
      value: loadout[header] || '---', // Usa '---' se o campo estiver vazio
      inline: true
    }))
    .filter(field => field.value !== '---'); // Remove campos vazios

  return {
    author: {
      name: `🏆 [S-TIER] ${loadout.Arma}`,
      icon_url: 'https://i.imgur.com/83hD4Bw.png' // Ícone de troféu
    },
    description: `**Estilo de Jogo:** \`${loadout.Playstyle || 'N/A'}\``,
    color: 16766720, // Dourado
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
      name: `🏆 [META] ${loadout.Arma}`,
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
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

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
  const options = {
    method: 'patch',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
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
  const options = {
    method: 'delete',
    muteHttpExceptions: true
  };
  try {
    UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}/messages/${messageId}`, options);
  } catch(e) {
    Logger.log(`Exceção ao apagar post ${messageId}: ${e.toString()}`);
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
            // A mágica acontece aqui: .reverse() inverte a ordem das medalhas
            const memberMedalNames = row[colIdx.medalhas].toString().split(',').map(name => name.trim()).reverse();
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

// =========================================================================
// == API PARA A PÁGINA DE LOADOUTS (ATUALIZADA COM ORDENAÇÃO)            ==
// =========================================================================
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

    // ===== LÓGICA DE ORDENAÇÃO PERSONALIZADA =====
    const tierOrder = {'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5};
    const finalResponse = Object.values(groupedByTier).sort((a, b) => {
        const orderA = tierOrder[a.tier] || 99; // Joga tiers não definidos para o final
        const orderB = tierOrder[b.tier] || 99;
        return orderA - orderB;
    });
    // =============================================

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

// ... (O restante do seu código, começando com a função 'setupAndInitializeTriggers', permanece exatamente o mesmo. Cole-o aqui.)

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
// == FUNÇÃO "MESTRE" DO GATILHO onEdit (ATUALIZADA)                      ==
// =========================================================================
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
        // Rota 4: Edição na aba de Loadouts
        Logger.log(`Edição detectada na aba '${sheetName}'. Acionando bot de Loadouts do Discord...`);
        Utilities.sleep(500); // Delay para garantir que a edição foi salva
        atualizarLoadoutsDiscord();
    }
}

function verificarPromocao(range) {
    // Lista de patentes que são fixas e nunca devem ser alteradas por pontuação.
    const PATENTES_FIXAS = [
        'Marechal',
        'General de Exército',
        'General de Divisão',
        'General de Brigada',
        'Coronel'
    ];

    const sheet = range.getSheet();
    const row = range.getRow();
    if (row < 2) return;

    const rankCell = sheet.getRange(row, 2);
    const dadosLinha = sheet.getRange(row, 1, 1, 19).getValues()[0];
    const patenteAtual = dadosLinha[1].toString().trim();
    const pontuacaoAtual = dadosLinha[18];

    // 1. Primeira trava: Verifica se a patente é fixa.
    if (PATENTES_FIXAS.includes(patenteAtual)) {
        Logger.log(`A patente '${patenteAtual}' na linha ${row} é fixa e não será alterada.`);
        return;
    }

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

    const patentesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Patente");
    if (!patentesSheet) return;

    const patentesValues = patentesSheet.getDataRange().getValues();
    patentesValues.shift();
    const patentesArray = patentesValues.map(r => ({ nome: r[0], pontosNecessarios: parseInt(r[2] || 0) }))
                                         .filter(p => p.nome && !isNaN(p.pontosNecessarios))
                                         .sort((a, b) => b.pontosNecessarios - a.pontosNecessarios);

    for (const patente of patentesArray) {
        if (pontuacaoAtual >= patente.pontosNecessarios) {
            const novaPatenteSugerida = patente.nome;

            // ▼▼▼ NOVA LÓGICA ANTI-REBAIXAMENTO ▼▼▼
            // Usamos ORDEM_PATENTES para obter o nível numérico de cada patente (menor número = maior patente)
            const indicePatenteAtual = ORDEM_PATENTES[patenteAtual];
            const indiceNovaPatente = ORDEM_PATENTES[novaPatenteSugerida];

            // Se a nova patente sugerida for de nível inferior à atual (ou seja, seu índice é MAIOR), bloqueia a ação.
            if (typeof indicePatenteAtual !== 'undefined' && indiceNovaPatente > indicePatenteAtual) {
                Logger.log(`Ação de rebaixamento para '${novaPatenteSugerida}' foi BLOQUEADA para o membro na linha ${row}. A patente atual '${patenteAtual}' foi mantida.`);
                return; // Interrompe a função para prevenir o rebaixamento.
            }
            // ▲▲▲ FIM DA LÓGICA ANTI-REBAIXAMENTO ▲▲▲

            // Se a nova patente for uma promoção, aplica.
            if (novaPatenteSugerida !== patenteAtual) {
                rankCell.setValue(novaPatenteSugerida);
                Logger.log(`🎉 PROMOÇÃO! O soldado na linha ${row} foi promovido para ${novaPatenteSugerida}.`);
            }
            
            // Encontramos a patente correta (e garantimos que não é um rebaixamento), então podemos sair.
            return;
        }
    }
}

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