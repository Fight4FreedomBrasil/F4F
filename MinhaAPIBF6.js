// Nome do Projeto: MinhaAPI_BF6
// Versão: 20.0 - Correção Definitiva do Anúncio de Promoções
// Descrição: Lógica de anúncio de promoção refeita para garantir a exibição correta dos requisitos faltantes.

// =========================================================================
// == CONFIGURAÇÕES GERAIS                                                  ==
// =========================================================================
const SPREADSHEET_ID = "1AyOdH_UvyDSf7HdMFqkQCI1p62KzJf_EACg06iAQRMs";
const NOME_DA_ABA_PELOTAO = 'Platoon';
const NOME_DA_ABA_PATENTES = 'Patente';
const NOME_DA_ABA_LOADOUTS = 'Loadouts';
const NOME_DA_ABA_ARMAS = 'Armas';

// ▼▼▼ URLs de Webhook do Discord ▼▼▼
const WEBHOOK_URL_LISTA_MEMBROS = 'https://discord.com/api/webhooks/1404814856476950579/RRTpoRNsSFI3WVZatfDmSOS0hBm-yhzyhHnS2isyCKW1wLKMmBcNlic520znceMtwBKT';
const WEBHOOK_URL_RANKING = 'https://discord.com/api/webhooks/1419476262422057084/W7roHTWuOjfa3ZBJ2b4aH1IJL5FlzAp7bAmXrFZ_yFjotYn4wpY0Xvqagl_2tXL6eEqa';
const WEBHOOK_URL_LOADOUTS = 'https://discord.com/api/webhooks/1422972200398487733/iAssDyejDbhyPWRU0nilqP6LbAK2-vNeWF7OKnytd7wKEE_Qe2bKR1pZTZaC7rHqyIcp';
const WEBHOOK_URL_PROMOCOES = 'https://discord.com/api/webhooks/1424158053359419452/lmfWgdNat7wr0oZn5S5jX7yBzKWj1861wVLZWxpThpHIRUePYnVKmVKs6E7DnN4n6s7l';

// Configurações diversas
const ORDEM_PATENTES = {'Marechal': 0,'General de Exército': 1,'General de Divisão': 2,'General de Brigada': 3,'Coronel': 4,'Tenente-Coronel': 5,'Major': 6,'Capitão': 7,'1º Tenente': 8,'2º Tenente': 9,'Subtenente': 10,'1º Sargento': 11,'2º Sargento': 12,'3º Sargento': 13,'Cabo': 14,'Soldado': 15};
const MEMBROS_POR_POSTAGEM = 10;
const MSG_TITLE_PREFIX = '📋 **Registro de Soldados F4F**';
const RANKINGS_CONFIG = {'11': { column: 'K/D', displayName: 'K/D' },'12': { column: 'Kills', displayName: 'Kills' },'13': { column: 'Assists', displayName: 'Assistências' },'14': { column: 'Revives', displayName: 'Revives' },'15': { column: 'Partidas', displayName: 'Partidas' },'16': { column: 'XP', displayName: 'XP' }};
const dicionarioTraducoes = {"Muzzle": "Bocal","Barrel": "Cano","Underbarrel": "Acoplamento","Magazine": "Carregador","Ammunition": "Munição","Scope": "Mira","Ergonomics": "Ergonomia","Optic": "Óptica","Top": "Trilho Superior","Right": "Trilho Direito","Playstyle": "Estilo de Jogo","Balanced": "Equilibrado","Close Quarters": "Curta Distância","Long Range": "Longo Alcance","Close Range": "Curto Alcance"};

function traduzir(termo) { return dicionarioTraducoes[termo] || termo; }


// =========================================================================
// == ENDPOINTS PRINCIPAIS (ENTRADAS DA API)                                ==
// =========================================================================

function doPost(e) {
  try {
    const event = JSON.parse(e.postData.contents);
    if (event.type === 1) {
      return ContentService.createTextOutput(JSON.stringify({ type: 1 })).setMimeType(ContentService.MimeType.JSON);
    }
    if (event.type === 2 && event.data.name === "patente") {
      const soldierId = event.data.options[0].value.trim();
      const responseMessage = getPatenteInfo(soldierId);
      const response = { type: 4, data: { content: responseMessage } };
      return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    Logger.log(err);
    const errorResponse = { type: 4, data: { content: `❌ Ocorreu um erro: ${err.message}` } };
    return ContentService.createTextOutput(JSON.stringify(errorResponse)).setMimeType(ContentService.MimeType.JSON);
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

// =========================================================================
// == GATILHO PRINCIPAL E SISTEMA DE PROMOÇÃO                               ==
// =========================================================================

function masterOnEdit(e) {
  const range = e.range, sheet = range.getSheet(), col = range.getColumn(), row = range.getRow(), sheetName = sheet.getName();
  if (sheetName === NOME_DA_ABA_PELOTAO && row > 1) {
    if (col === 2) { 
        notificarPromocao(e);
    } 
    else if (col === 19 || col === 20) {
        Utilities.sleep(500);
        verificarPromocao(e);
    }
    else if (col >= 11 && col <= 16) { checkRelevantRanking(col.toString()); } 
    else if (col >= 1 && col <= 4) { atualizarListaDeMembrosDiscord(); } 
  } else if (sheetName === NOME_DA_ABA_LOADOUTS) {
    Utilities.sleep(500);
    atualizarLoadoutsDiscord();
  }
}

function verificarPromocao(e) {
  const PATENTES_FIXAS = ['Marechal', 'General de Exército', 'General de Divisão', 'General de Brigada', 'Coronel'];
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  if (row < 2) return;

  const dadosLinha = sheet.getRange(row, 1, 1, 20).getValues()[0];
  const patenteAtual = dadosLinha[1].toString().trim();
  const pontuacaoAtual = dadosLinha[18];
  const tempoDeJogoAtual = dadosLinha[19];
  
  if (PATENTES_FIXAS.includes(patenteAtual)) return;

  const patentesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_DA_ABA_PATENTES);
  if (!patentesSheet) return;

  const patentesArray = patentesSheet.getDataRange().getValues().slice(1)
    .map(r => ({ 
      nome: r[0], 
      pontosNecessarios: parseInt(r[2] || 0),
      tempoNecessario: parseInt(r[4] || 0)
    }))
    .filter(p => p.nome && !isNaN(p.pontosNecessarios))
    .sort((a, b) => b.pontosNecessarios - a.pontosNecessarios);

  for (const patente of patentesArray) {
    if (pontuacaoAtual >= patente.pontosNecessarios && tempoDeJogoAtual >= patente.tempoNecessario) {
      const novaPatenteSugerida = patente.nome;
      if (novaPatenteSugerida !== patenteAtual) {
        const indicePatenteAtual = ORDEM_PATENTES[patenteAtual];
        const indiceNovaPatente = ORDEM_PATENTES[novaPatenteSugerida];
        if (typeof indicePatenteAtual === 'undefined' || indiceNovaPatente < indicePatenteAtual) {
          sheet.getRange(row, 2).setValue(novaPatenteSugerida);
        }
      }
      return;
    }
  }
}

// =========================================================================
// == SISTEMA DE ANÚNCIO DE PROMOÇÕES                                       ==
// =========================================================================

function notificarPromocao(e) {
  const valorAntigo = e.oldValue;
  const valorNovo = e.value;

  if (!valorNovo || valorNovo === valorAntigo) { return; }
  
  const indicePatenteAntiga = ORDEM_PATENTES[valorAntigo];
  const indicePatenteNova = ORDEM_PATENTES[valorNovo];

  if (typeof indicePatenteNova === 'undefined' || indicePatenteNova >= indicePatenteAntiga) {
    return;
  }
  
  const sheet = e.source.getSheetByName(NOME_DA_ABA_PELOTAO);
  const dadosLinha = sheet.getRange(e.range.getRow(), 1, 1, 20).getValues()[0];
  const nomeSoldado = dadosLinha[0];
  const idSoldado = dadosLinha[2];
  const pontuacaoAtual = parseInt(dadosLinha[18]);
  const tempoAtual = parseInt(dadosLinha[19]);
  
  enviarAnuncioDePromocao(nomeSoldado, idSoldado, pontuacaoAtual, tempoAtual, valorAntigo, valorNovo);
}

function enviarAnuncioDePromocao(nomeSoldado, idSoldado, pontuacaoAtual, tempoAtual, patenteAntiga, patenteNova) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const patentesSheet = ss.getSheetByName(NOME_DA_ABA_PATENTES);
  const patentesArray = patentesSheet.getDataRange().getValues().slice(1).map(row => ({
    nome: row[0],
    url: row[1],
    pontosNecessarios: parseInt(row[2] || 0),
    tempoNecessario: parseInt(row[4] || 0)
  })).sort((a, b) => a.pontosNecessarios - b.pontosNecessarios);

  const patenteAntigaInfo = patentesArray.find(p => p.nome === patenteAntiga);
  const urlImagemPatenteAntiga = patenteAntigaInfo ? patenteAntigaInfo.url : '';
  
  let urlImagemPatenteNova = '';
  const indexPatenteAtual = patentesArray.findIndex(p => p.nome === patenteNova);
  if (indexPatenteAtual !== -1) {
    urlImagemPatenteNova = patentesArray[indexPatenteAtual].url;
  }

  const linhaStatus = `Você atingiu **${pontuacaoAtual.toLocaleString('pt-BR')}** pontos e **${tempoAtual.toLocaleString('pt-BR')}** horas de jogo.`;
  let linhaProgresso = '';
  
  const proximaPatente = (indexPatenteAtual !== -1 && indexPatenteAtual < patentesArray.length - 1)
    ? patentesArray[indexPatenteAtual + 1]
    : null;

  if (proximaPatente) {
    const pontosFaltantes = Math.max(0, proximaPatente.pontosNecessarios - pontuacaoAtual);
    const tempoFaltante = Math.max(0, proximaPatente.tempoNecessario - tempoAtual);
    
    let faltantes = [];
    if (pontosFaltantes > 0) faltantes.push(`**${pontosFaltantes.toLocaleString('pt-BR')}** pontos`);
    if (tempoFaltante > 0) faltantes.push(`**${tempoFaltante.toLocaleString('pt-BR')}** horas de jogo`);

    if (faltantes.length > 0) {
      linhaProgresso = `Faltam ${faltantes.join(' e ')} para a próxima promoção!`;
    } else {
      linhaProgresso = "Você já cumpre os requisitos para a próxima patente!";
    }
  } else {
    linhaProgresso = "Você alcançou a patente máxima, parabéns!";
  }

  const payload = {
    content: `Parabéns, ${nomeSoldado}!`,
    embeds: [{
      title: "PROMOÇÃO DE PATENTE! [F4F]", // Adicionado para verificação
      color: 16766720,
      description: `**${nomeSoldado}**, ID (${idSoldado}), demonstrou bravura e foi promovido!\n\n${linhaStatus}\n${linhaProgresso}`,
      fields: [
        { name: "Patente Anterior", value: patenteAntiga, inline: true },
        { name: "Nova Patente", value: `**${patenteNova}**`, inline: true }
      ],
      thumbnail: { url: urlImagemPatenteAntiga },
      image: { url: urlImagemPatenteNova },
      footer: { text: "Pelotão F4F - Tabela de Promoções" },
      timestamp: new Date().toISOString()
    }]
  };
  
  try {
    UrlFetchApp.fetch(WEBHOOK_URL_PROMOCOES, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch (err) {
    Logger.log(`Erro ao enviar anúncio de promoção: ${err.toString()}`);
  }
}

// ... (Resto do seu código, começando com getPatenteInfo, permanece inalterado e está correto)

// =========================================================================
// == LÓGICA DO BOT /patente                                                ==
// =========================================================================
function getPatenteInfo(soldierId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const patentesSheet = ss.getSheetByName(NOME_DA_ABA_PATENTES);
  const patentesArray = patentesSheet.getDataRange().getValues().slice(1).map(row => ({
    nome: row[0],
    pontosNecessarios: parseInt(row[2] || 0),
    tempoNecessario: parseInt(row[4] || 0)
  })).sort((a, b) => a.pontosNecessarios - b.pontosNecessarios);

  const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
  const platoonData = platoonSheet.getDataRange().getValues();
  const headers = platoonData.shift();
  const idColIndex = headers.indexOf('ID');
  const rankColIndex = headers.indexOf('Ranking');
  const scoreColIndex = headers.indexOf('Pontuação');
  const timeColIndex = headers.indexOf('Tempo de jogo');

  const soldierRow = platoonData.find(row => row[idColIndex] && row[idColIndex].toString().trim() === soldierId);

  if (!soldierRow) { return `Soldado com ID **${soldierId}** não encontrado.`; }

  const patenteAtualNome = soldierRow[rankColIndex];
  const pontuacaoAtual = parseInt(soldierRow[scoreColIndex]);
  const tempoAtual = parseInt(soldierRow[timeColIndex]);

  const indexPatenteAtual = patentesArray.findIndex(p => p.nome === patenteAtualNome);
  const proximaPatente = (indexPatenteAtual !== -1 && indexPatenteAtual < patentesArray.length - 1)
    ? patentesArray[indexPatenteAtual + 1]
    : null;

  let mensagemProgresso;
  if (proximaPatente) {
    const pontosFaltantes = proximaPatente.pontosNecessarios - pontuacaoAtual;
    const tempoFaltante = proximaPatente.tempoNecessario - tempoAtual;
    
    let faltantes = [];
    if (pontosFaltantes > 0) faltantes.push(`**${pontosFaltantes.toLocaleString('pt-BR')}** pontos`);
    if (tempoFaltante > 0) faltantes.push(`**${tempoFaltante.toLocaleString('pt-BR')}** horas de jogo`);

    if (faltantes.length > 0) {
      mensagemProgresso = `Faltam ${faltantes.join(' e ')} para **${proximaPatente.nome}**.`;
    } else {
      mensagemProgresso = `Você já tem os requisitos para **${proximaPatente.nome}**! A promoção deve ocorrer em breve.`;
    }
  } else {
    mensagemProgresso = "Você alcançou a patente máxima! Parabéns!";
  }

  return `Olá **${soldierId}**!\n- **Sua patente é:** ${patenteAtualNome}\n- **Sua pontuação é:** ${pontuacaoAtual.toLocaleString('pt-BR')}\n- **Seu tempo de jogo é:** ${tempoAtual.toLocaleString('pt-BR')} horas\n- ${mensagemProgresso}`;
}

// =========================================================================
// == VERIFICADOR AUTOMÁTICO DE PROMOÇÕES (POR TEMPO)                       ==
// =========================================================================
function verificarPromocoesAutomaticas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
  
  const dadosAtuais = platoonSheet.getRange("A2:T" + platoonSheet.getLastRow()).getValues();
  
  const patentesAtuais = {};
  dadosAtuais.forEach(linha => {
    const [nome, patente, id, ...rest] = linha;
    const pontuacao = linha[18];
    const tempoDeJogo = linha[19];
    if (id) {
      patentesAtuais[id] = { nome, patente, pontuacao, tempoDeJogo };
    }
  });

  const props = PropertiesService.getScriptProperties();
  const patentesAntigas = JSON.parse(props.getProperty('STATUS_PATENTES') || '{}');

  for (const id in patentesAtuais) {
    const dadosAtuaisDoMembro = patentesAtuais[id];
    const dadosAntigosDoMembro = patentesAntigas[id];

    if (dadosAntigosDoMembro && dadosAtuaisDoMembro.patente !== dadosAntigosDoMembro.patente) {
      const indicePatenteAntiga = ORDEM_PATENTES[dadosAntigosDoMembro.patente];
      const indicePatenteNova = ORDEM_PATENTES[dadosAtuaisDoMembro.patente];
      
      if (typeof indicePatenteNova !== 'undefined' && indicePatenteNova < indicePatenteAntiga) {
        enviarAnuncioDePromocao(
          dadosAtuaisDoMembro.nome, 
          id, 
          dadosAtuaisDoMembro.pontuacao, 
          dadosAtuaisDoMembro.tempoDeJogo, 
          dadosAntigosDoMembro.patente, 
          dadosAtuaisDoMembro.patente
        );
      }
    }
  }
  
  props.setProperty('STATUS_PATENTES', JSON.stringify(patentesAtuais));
  Logger.log('Verificação de promoções automáticas concluída.');
}

function inicializarStatusDasPatentes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
  const dadosAtuais = platoonSheet.getRange("A2:T" + platoonSheet.getLastRow()).getValues();
  
  const patentesAtuais = {};
  dadosAtuais.forEach(linha => {
    const [nome, patente, id, ...rest] = linha;
    const pontuacao = linha[18];
    const tempoDeJogo = linha[19];
    if (id) {
      patentesAtuais[id] = { nome, patente, pontuacao, tempoDeJogo };
    }
  });

  const props = PropertiesService.getScriptProperties();
  props.setProperty('STATUS_PATENTES', JSON.stringify(patentesAtuais));
  Logger.log('✅ Estado inicial das patentes (com tempo de jogo) foi salvo com sucesso!');
}

// =========================================================================
// == LÓGICA DA API PARA PÁGINA WEB                                         ==
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
        const nome = (row[0] || '').toString().trim(), url = (row[1] || '').toString().trim(), pontos = parseInt(row[2] || 0);
        if (nome && url) patentesMap[nome] = url;
        return { nome, url, pontosNecessarios: pontos };
      }).filter(p => p.nome).sort((a, b) => a.pontosNecessarios - b.pontosNecessarios);
    }
    const medalSheet = ss.getSheetByName("Medalhas_Catalogo");
    const medalMap = {};
    if (medalSheet) {
      medalSheet.getDataRange().getValues().slice(1).forEach(row => {
        const medalName = (row[0] || '').toString().trim();
        if (medalName) medalMap[medalName] = { nome: medalName, url: row[1], descricao: row[2], tipo: row[4] };
      });
    }
    const platoonSheet = ss.getSheetByName(NOME_DA_ABA_PELOTAO);
    const platoonData = platoonSheet.getDataRange().getValues();
    const platoonHeaders = platoonData.shift().map(h => h.toString().trim());
    const colIdx = { medalhas: platoonHeaders.indexOf('Medalhas'), pontuacao: platoonHeaders.indexOf('Pontuação'), ranking: platoonHeaders.indexOf('Ranking'), insignia: platoonHeaders.indexOf('Insígnia') };
    const membersArray = platoonData.filter(row => (row[0] && row[0].toString().trim() !== "") && (row[2] && row[2].toString().trim() !== "")).map(row => {
      const memberObject = {};
      platoonHeaders.forEach((header, i) => { memberObject[header] = row[i]; });
      if (colIdx.insignia !== -1) memberObject.Insignia = row[colIdx.insignia] || '';
      memberObject.MedalhasData = [];
      if (colIdx.medalhas !== -1 && row[colIdx.medalhas]) {
        row[colIdx.medalhas].toString().split(',').map(name => name.trim()).reverse().forEach(name => {
          if (medalMap[name]) memberObject.MedalhasData.push(medalMap[name]);
        });
      }
      const pontuacaoAtual = parseInt(row[colIdx.pontuacao] || 0);
      const patenteAtualNome = row[colIdx.ranking] || '';
      const indexPatenteAtual = patentesArray.findIndex(p => p.nome === patenteAtualNome);
      const patenteAtual = patentesArray[indexPatenteAtual] || { nome: patenteAtualNome, url: patentesMap[patenteAtualNome] || '', pontosNecessarios: 0 };
      const proximaPatente = (indexPatenteAtual !== -1 && indexPatenteAtual < patentesArray.length - 1) ? patentesArray[indexPatenteAtual + 1] : null;
      memberObject.progressao = {
        pontuacaoAtual: pontuacaoAtual,
        patenteAtual: { nome: patenteAtual.nome, url: patenteAtual.url, pontosNecessarios: patenteAtual.pontosNecessarios },
        proximaPatente: proximaPatente ? { nome: proximaPatente.nome, url: proximaPatente.url, pontosNecessarios: proximaPatente.pontosNecessarios } : null
      };
      return memberObject;
    });
    return ContentService.createTextOutput(JSON.stringify({ membros: membersArray, patentes: patentesMap })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro na API de Pelotão: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getLoadoutsData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const armasSheet = ss.getSheetByName(NOME_DA_ABA_ARMAS);
    const armaTipoMap = {};
    armasSheet.getDataRange().getValues().slice(1).forEach(row => { if (row[0]) armaTipoMap[row[0]] = row[1]; });
    const loadoutsSheet = ss.getSheetByName(NOME_DA_ABA_LOADOUTS);
    const loadoutsValues = loadoutsSheet.getDataRange().getValues();
    const loadoutsHeaders = loadoutsValues.shift();
    const loadoutsArray = loadoutsValues.map(row => {
      const loadoutObject = {};
      loadoutsHeaders.forEach((header, i) => { loadoutObject[header] = row[i]; });
      loadoutObject.Categoria = armaTipoMap[loadoutObject.Arma] || 'Desconhecida';
      return loadoutObject;
    });
    const groupedByTier = {};
    const tierTitles = { 'S': 'Absolute Meta - S Tier', 'A': 'Meta - A Tier', 'B': 'B Tier', 'C': 'C Tier', 'D': 'D Tier' };
    loadoutsArray.forEach(loadout => {
      const tier = loadout.Tipo || 'Outros';
      if (!groupedByTier[tier]) {
        groupedByTier[tier] = { tier: tier, title: tierTitles[tier] || `${tier} Tier`, weapons: [] };
      }
      groupedByTier[tier].weapons.push(loadout);
    });
    const tierOrder = { 'S': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5 };
    const finalResponse = Object.values(groupedByTier).sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99));
    return ContentService.createTextOutput(JSON.stringify(finalResponse)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Erro na API de Loadouts: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Erro ao buscar dados de loadouts: " + error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// == BOTS DE SINCRONIZAÇÃO COM DISCORD (GATILHOS onEdit)                   ==
// =========================================================================

function checkAllRankings() { Object.values(RANKINGS_CONFIG).forEach(rankingInfo => { checkTopStat(getSheetDataAsObjects(), rankingInfo); Utilities.sleep(2000); }); }
function checkRelevantRanking(editedColumn) { const rankingInfo = RANKINGS_CONFIG[editedColumn]; if (rankingInfo) checkTopStat(getSheetDataAsObjects(), rankingInfo); }

function checkTopStat(players, rankingInfo) {
  if (!players || players.length === 0) return;
  const { column, displayName } = rankingInfo;
  const currentLeader = players.reduce((top, current) => parseFloat(String(current[column] || '0').replace(/,/g, '')) > parseFloat(String(top[column] || '0').replace(/,/g, '')) ? current : top, players[0]);
  if (!currentLeader) return;
  const leaderIdKey = `LAST_${column.replace(/[^A-Z0-9]/ig, "")}_LEADER_ID`, messageIdKey = `LAST_${column.replace(/[^A-Z0-9]/ig, "")}_MESSAGE_ID`;
  const props = PropertiesService.getScriptProperties(), lastLeaderId = props.getProperty(leaderIdKey);
  if (currentLeader['ID'] !== lastLeaderId) {
    const newMessageId = postOrUpdateRankingMessage(currentLeader, rankingInfo, props.getProperty(messageIdKey));
    if (newMessageId) { props.setProperty(leaderIdKey, currentLeader['ID']); props.setProperty(messageIdKey, newMessageId); }
  }
}

function postOrUpdateRankingMessage(player, rankingInfo, lastMessageId) {
  const { column, displayName } = rankingInfo;
  const payload = { embeds: [{ author: { name: `👑 REI DE ${displayName.toUpperCase()} 👑` }, description: `O ${player['Ranking']} **${player['Nome']} | ${player['ID']}** assumiu a liderança!`, color: 16766720, fields: [{ name: `Recorde de ${displayName}`, value: `**${player[column]}**`, inline: true }], footer: { text: "Ranking [F4F]" }, timestamp: new Date().toISOString() }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload) };
  let url = `${WEBHOOK_URL_RANKING}?wait=true`;
  if (lastMessageId) { options.method = 'patch'; url = `${WEBHOOK_URL_RANKING}/messages/${lastMessageId}`; }
  try {
    return JSON.parse(UrlFetchApp.fetch(url, options).getContentText()).id;
  } catch (e) {
    if (lastMessageId) return postOrUpdateRankingMessage(player, rankingInfo, null);
    return null;
  }
}

// ...existing code...
function atualizarLoadoutsDiscord() {
  const props = PropertiesService.getScriptProperties();
  let oldMessages = JSON.parse(props.getProperty('DISCORD_LOADOUT_MESSAGES') || '{}');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(NOME_DA_ABA_LOADOUTS);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const attachmentHeaders = ['Muzzle', 'Barrel', 'Underbarrel', 'Magazine', 'Ammunition', 'Scope', 'Ergonomics', 'Optic', 'Top', 'Right'];
  
  const currentSTierLoadouts = {};
  const processedUniqueKeys = new Set(); // Conjunto para rastrear chaves já processadas

  values.forEach((row) => {
    const tipoIndex = headers.indexOf('Tipo');
    if (row[tipoIndex] === 'S') {
      const loadout = {};
      headers.forEach((header, i) => { loadout[header] = row[i]; });
      
      // Chave única baseada apenas na Arma e Playstyle
      const uniqueKey = `${loadout.Arma}_${loadout.Playstyle}`;

      // Se esta combinação de Arma+Playstyle ainda não foi processada, adicione-a.
      // Isso impede que linhas duplicadas na planilha gerem múltiplas postagens.
      if (!processedUniqueKeys.has(uniqueKey)) {
        currentSTierLoadouts[uniqueKey] = loadout;
        processedUniqueKeys.add(uniqueKey);
      }
    }
  });

  const newMessages = {};
  // Itera sobre as chaves dos loadouts que SÃO S-Tier atualmente
  for (const key in currentSTierLoadouts) {
    const loadout = currentSTierLoadouts[key];
    const oldMessageId = oldMessages[key];

    if (oldMessageId) {
      // O loadout já existia, então edita a mensagem existente
      editarLoadoutExistente(oldMessageId, loadout, attachmentHeaders);
      newMessages[key] = oldMessageId; // Mantém o ID da mensagem
    } else {
      // O loadout é novo, então posta uma nova mensagem
      const newMessageId = postarNovoLoadout(loadout, attachmentHeaders);
      if (newMessageId) {
        newMessages[key] = newMessageId;
      }
    }
  }

  // Itera sobre as chaves das mensagens ANTIGAS para encontrar as que foram removidas
  for (const key in oldMessages) {
    // Se uma chave de uma mensagem antiga NÃO está na lista de loadouts S-Tier atuais...
    if (!currentSTierLoadouts[key]) {
      // ...então o loadout foi rebaixado ou removido. Apague a mensagem do Discord.
      apagarLoadoutAntigo(oldMessages[key]);
    }
  }
  
  props.setProperty('DISCORD_LOADOUT_MESSAGES', JSON.stringify(newMessages));
}

function formatarEmbedLoadout(loadout, attachmentHeaders) {
  const fields = attachmentHeaders.map(header => ({ name: traduzir(header), value: loadout[header] || '---', inline: true })).filter(field => field.value !== '---');
  return { author: { name: `🏆 [META] ${loadout.Arma}`, icon_url: 'https://i.imgur.com/83hD4Bw.png' }, description: `**${traduzir('Playstyle')}:** \`${traduzir(loadout.Playstyle) || 'N/A'}\``, color: 16766720, thumbnail: { url: loadout.Imagem }, fields: fields, footer: { text: "F4F Loadouts" }, timestamp: new Date().toISOString() };
}
function postarNovoLoadout(loadout, attachmentHeaders) {
  const payload = { embeds: [formatarEmbedLoadout(loadout, attachmentHeaders)] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}?wait=true`, options);
    return (response.getResponseCode() >= 200 && response.getResponseCode() < 300) ? JSON.parse(response.getContentText()).id : null;
  } catch(e) { return null; }
}
function editarLoadoutExistente(messageId, loadout, attachmentHeaders) {
  const payload = { embeds: [formatarEmbedLoadout(loadout, attachmentHeaders)] };
  UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}/messages/${messageId}`, { method: 'patch', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
}
function apagarLoadoutAntigo(messageId) {
  UrlFetchApp.fetch(`${WEBHOOK_URL_LOADOUTS}/messages/${messageId}`, { method: 'delete', muteHttpExceptions: true });
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
    if (chunks[i] && oldMessageIds[i]) { editarMensagemLista(oldMessageIds[i], content); newMessageIds.push(oldMessageIds[i]); } 
    else if (chunks[i] && !oldMessageIds[i]) { const newId = criarMensagemLista(content); if (newId) newMessageIds.push(newId); } 
    else if (!chunks[i] && oldMessageIds[i]) { apagarMensagemLista(oldMessageIds[i]); }
  }
  props.setProperty('DISCORD_MESSAGE_IDS_ARRAY', JSON.stringify(newMessageIds));
}

function formatarConteudoListaMembros(chunk, chunkIndex, totalParts, colIndex) {
  const partTitle = `${MSG_TITLE_PREFIX} (Parte ${chunkIndex + 1}/${totalParts})`;
  let listaSoldados = chunk.map((r, memberIndex) => `#### Membro ${chunkIndex * MEMBROS_POR_POSTAGEM + memberIndex + 1} ####\n**Nick:** [F4F] ${r[colIndex.nome]}\n**ID EA:** ${r[colIndex.id]}\n**Plataforma:** ${r[colIndex.plataforma]}\n**Patente:** ${r[colIndex.ranking]}`).join('\n--------------------\n');
  return `${partTitle}\n\n${listaSoldados}\n\n*Atualizado em: ${Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm")}*`;
}
function criarMensagemLista(c) { try { const r = UrlFetchApp.fetch(`${WEBHOOK_URL_LISTA_MEMBROS}?wait=true`, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ content: c }), muteHttpExceptions: true }); return JSON.parse(r.getContentText()).id; } catch (e) { return null; } }
function editarMensagemLista(id, c) { UrlFetchApp.fetch(`${WEBHOOK_URL_LISTA_MEMBROS}/messages/${id}`, { method: 'patch', contentType: 'application/json', payload: JSON.stringify({ content: c }), muteHttpExceptions: true }); }
function apagarMensagemLista(id) { UrlFetchApp.fetch(`${WEBHOOK_URL_LISTA_MEMBROS}/messages/${id}`, { method: 'delete', muteHttpExceptions: true }); }


// =========================================================================
// == FUNÇÕES AUXILIARES E DE TESTE                                         ==
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

function setupAndInitializeTriggers() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('masterOnEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  checkAllRankings();
  atualizarLoadoutsDiscord();
}

function testarBuscaDePatente() {
  const idDeTeste = "Chrisley_Chrys"; // <--- TROQUE POR UM ID VÁLIDO DA SUA PLANILHA
  const resultado = getPatenteInfo(idDeTeste);
  Logger.log(resultado);
}