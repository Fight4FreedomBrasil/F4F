const { Client, GatewayIntentBits } = require('discord.js');
// Nova linha, que lê a variável de ambiente:
const token = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,          // sempre habilitar
        GatewayIntentBits.GuildMessages,   // mensagens em servidores
        GatewayIntentBits.MessageContent   // habilitar só se Message Content Intent estiver ativa
    ]
});

client.once('ready', () => {
    console.log(`Bot online como ${client.user.tag}`);
});

client.on('messageCreate', message => {
    if (message.author.bot) return;
    if (message.content === '!oi') message.channel.send('Olá! Estou funcionando ✅');
});

client.login('DISCORD_TOKEN');
