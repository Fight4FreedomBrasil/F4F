const fetch = require('node-fetch');
const { scriptUrl } = require('../config.json');

module.exports = {
  name: 'patente',
  description: 'Consulta patentes via Google Apps Script',
  async execute(message, args) {
    try {
      // Exemplo: enviar tipo = 1
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 1 })
      });

      const data = await response.json();

      // Envia resposta no Discord
      message.channel.send(`Resultado: \`\`\`${JSON.stringify(data, null, 2)}\`\`\``);
    } catch (err) {
      console.error(err);
      message.channel.send('Erro ao consultar patentes.');
    }
  }
};
