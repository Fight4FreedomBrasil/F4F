// =========================================================================
// == CONFIGURAÇÕES OBRIGATÓRIAS                                        ==
// =========================================================================

// 1. Webhook para o canal #📋・registro-de-soldados
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1404814856476950579/RRTpoRNsSFI3WVZatfDmSOS0hBm-yhzyhHnS2isyCKW1wLKMmBcNlic520znceMtwBKT';

// 2. Nome exato da aba onde estão os dados
const NOME_DA_ABA = 'Platoon'; 

// =========================================================================
// == CONFIGURAÇÕES OPCIONAIS                                           ==
// =========================================================================

const MSG_TITLE = '📋 **Registro de Soldados F4F**';
const MAX_ROWS = 25;

// =========================================================================
// == LÓGICA DO SCRIPT (NÃO ALTERAR DAQUI PARA BAIXO)                     ==
// =========================================================================

const PROPS = PropertiesService.getScriptProperties();

function atualizarDiscord() {
  console.log("================ INÍCIO DA EXECUÇÃO ================");
  console.log("Iniciando a atualização do Discord...");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(NOME_DA_ABA);
  if (!sh) { console.error(`ERRO: A aba "${NOME_DA_ABA}" não foi encontrada!`); return; }
  console.log(`LOG: Aba "${NOME_DA_ABA}" encontrada.`);

  const rng = sh.getDataRange().getValues();
  if (rng.length < 2) { console.log("AVISO: Planilha sem dados."); return; }
  console.log(`LOG: Leitura da planilha concluída.`);

  const headers = rng[0].map(h => h.toString().trim());
  const colIndex = { id: headers.indexOf('ID'), nome: headers.indexOf('Nome'), ranking: headers.indexOf('Ranking'), plataforma: headers.indexOf('Plataforma') };
  
  if (Object.values(colIndex).some(i => i === -1)) { console.error("ERRO: Cabeçalhos não encontrados."); return; }
  console.log("LOG: Cabeçalhos encontrados.");

  const rows = rng.slice(1).filter(r => r[colIndex.nome] && r[colIndex.ranking] && r[colIndex.id] && r[colIndex.plataforma]);
  console.log(`LOG: Encontradas ${rows.length} linhas completas.`);
  
  if (rows.length === 0) { console.log("AVISO: Nenhuma linha completa encontrada."); return; }

  const show = rows.slice(0, MAX_ROWS);
  const restantes = rows.length - show.length;
  
  let listaSoldados = '';
  show.forEach((r, index) => {
    listaSoldados += `#### Membro ${index + 1} ####\n`;
    listaSoldados += `**Nick:** [F4F] ${r[colIndex.nome]}\n`;
    listaSoldados += `**ID EA:** ${r[colIndex.id]}\n`;
    listaSoldados += `**Plataforma:** ${r[colIndex.plataforma]}\n`;
    listaSoldados += `**Patente:** ${r[colIndex.ranking]}\n`;
    if (index < show.length - 1) { listaSoldados += `--------------------\n`; }
  });

  let footer = '';
  if (restantes > 0) { footer += `\n... e mais **${restantes}** soldado(s) registrado(s).`; }
  
  const content = `${MSG_TITLE}\n\n${listaSoldados}${footer}\n\n*Última atualização: ${formatarAgoraBr()}*`;
  console.log("LOG: Conteúdo da mensagem preparado.");
  
  const messageId = PROPS.getProperty('DISCORD_MESSAGE_ID');
  console.log(`LOG: ID de mensagem salvo: ${messageId || 'Nenhum'}`);
  
  if (messageId) {
    console.log(`AÇÃO: Tentando editar a mensagem (ID: ${messageId})...`);
    const response = editarMensagemDiscord(messageId, content); // Captura a resposta da edição
    
    // NOVO: LÓGICA DE AUTOCORREÇÃO
    if (response.getResponseCode() >= 400) {
      try {
        const errorData = JSON.parse(response.getContentText());
        if (errorData.code === 10008) { // 10008 = Unknown Message
          console.warn("AVISO: A mensagem antiga não foi encontrada no Discord (provavelmente foi apagada). Limpando o ID antigo...");
          PROPS.deleteProperty('DISCORD_MESSAGE_ID'); // Limpa o ID inválido
          
          console.log("AÇÃO: Tentando criar uma nova mensagem para substituir a antiga...");
          const newId = criarMensagemDiscord(content); // Cria uma nova mensagem
          if (newId) {
            PROPS.setProperty('DISCORD_MESSAGE_ID', newId);
            console.log(`SUCESSO: Nova mensagem criada e novo ID (${newId}) foi salvo.`);
          }
        }
      } catch(e) { /* Ignora erros de parse caso a resposta não seja JSON */ }
    } else {
      console.log("SUCESSO: Mensagem editada.");
    }

  } else {
    console.log("AÇÃO: Criando nova mensagem no Discord...");
    const id = criarMensagemDiscord(content);
    if (id) {
      PROPS.setProperty('DISCORD_MESSAGE_ID', id);
      console.log(`SUCESSO: Nova mensagem criada e seu ID (${id}) foi salvo.`);
    }
  }
  
  console.log("================ FIM DA EXECUÇÃO ================");
}

function criarMensagemDiscord(content) {
  const payload = { content };
  const params = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  const res = UrlFetchApp.fetch(WEBHOOK_URL + '?wait=true', params);
  if (res.getResponseCode() >= 400) { console.error("ERRO NO DISCORD (criar): ", res.getContentText()); return null; }
  const data = JSON.parse(res.getContentText());
  return data && data.id ? data.id : null;
}

function editarMensagemDiscord(messageId, content) {
  const payload = { content };
  const params = { method: 'patch', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  const editUrl = WEBHOOK_URL + '/messages/' + messageId;
  const res = UrlFetchApp.fetch(editUrl, params);
  // NOVO: Retorna a resposta completa para ser analisada
  return res;
}

function formatarAgoraBr() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm");
}