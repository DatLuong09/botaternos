const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('✅ Bot is running!'));
app.listen(PORT, () => console.log(`[WEB] Listening on port ${PORT}`));

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account'].username,
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);

  bot.once('spawn', () => {
    console.log('[INFO] Bot spawned');

    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      let i = 0;
      setInterval(() => {
        bot.chat(messages[i]);
        i = (i + 1) % messages.length;
      }, config.utils['chat-messages']['repeat-delay'] * 1000);
    }

    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }

      // 🟡 Random move:
      if (config.utils['anti-afk'].randomMove) {
        setInterval(() => {
          const pos = bot.entity.position;
          const x = pos.x + (Math.random() * 6 - 3);
          const z = pos.z + (Math.random() * 6 - 3);
          const y = pos.y;
          bot.pathfinder.setMovements(defaultMove);
          bot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
        }, 15000);
      }
    }

    if (config.position.enabled) {
      const p = config.position;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(p.x, p.y, p.z));
    }
  });

  bot.on('end', () => {
    if (config.utils['auto-reconnect']) {
      console.log('[RECONNECT] Disconnected, reconnecting...');
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    }
  });

  bot.on('kicked', reason => console.log('[KICKED]', reason));
  bot.on('error', err => console.log('[ERROR]', err.message));
}

createBot();
