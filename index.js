const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const config = require('./settings.json');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send('✅ Bot is online!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server started on port ${PORT}`);
});

let reconnectAttempts = 0;

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);

  // Auth
  async function handleAuth() {
    const password = config.utils['auto-auth'].password;
    try {
      if (config.utils['auto-auth'].enabled) {
        await new Promise((res) => {
          bot.chat(`/register ${password} ${password}`);
          bot.once('chat', res);
        });
        await new Promise((res) => {
          bot.chat(`/login ${password}`);
          bot.once('chat', res);
        });
      }
    } catch (err) {
      console.log('[AUTH ERROR]', err.message);
    }
  }

  bot.once('spawn', () => {
    reconnectAttempts = 0;
    console.log(`[SPAWNED] Bot ${bot.username} has joined the server.`);

    handleAuth();

    // Chat loop
    if (config.utils['chat-messages'].enabled) {
      const msgs = config.utils['chat-messages'].messages;
      const delay = config.utils['chat-messages']['repeat-delay'] * 1000;
      let i = 0;
      setInterval(() => {
        bot.chat(msgs[i]);
        i = (i + 1) % msgs.length;
      }, delay);
    }

    // Anti AFK
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }

    // Move
    if (config.position.enabled) {
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`[KICKED] Reason: ${reason}`);
  });

  bot.on('error', (err) => {
    console.log(`[ERROR] ${err.message}`);
  });

  bot.on('end', () => {
    reconnectAttempts++;
    const delay = Math.min(config.utils['auto-recconect-delay'] * reconnectAttempts, 300000); // Tối đa 5 phút
    console.log(`[Reconnect] Disconnected. Waiting ${delay / 1000}s before reconnecting...`);
    setTimeout(createBot, delay);
  });
}

createBot();

