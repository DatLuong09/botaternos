const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('✅ Bot is online!');
});

app.listen(PORT, () => {
  console.log(`[WEB] Listening on port ${PORT}`);
});

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.once('spawn', () => {
    console.log('[BOT] Spawned');

    // ✅ Chờ thêm 200ms rồi mới load plugin để tránh lỗi null
    setTimeout(() => {
      bot.loadPlugin(pathfinder);
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);

      // ✅ Random move mỗi 15s
      if (config.utils['anti-afk'].enabled && config.utils['anti-afk'].randomMove) {
        setInterval(() => {
          const x = bot.entity.position.x + (Math.random() - 0.5) * 4;
          const z = bot.entity.position.z + (Math.random() - 0.5) * 4;
          const y = bot.entity.position.y;
          bot.pathfinder.setMovements(defaultMove);
          bot.pathfinder.setGoal(new GoalBlock(x, y, z));
        }, 15000);
      }

      // ✅ Di chuyển cố định nếu có cấu hình
      if (config.position.enabled) {
        const pos = config.position;
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
        console.log(`[BOT] Moving to (${pos.x}, ${pos.y}, ${pos.z})`);
      }
    }, 200); // ← Delay load plugin

    // Chat loop
    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      const delay = config.utils['chat-messages']['repeat-delay'] * 1000;
      let i = 0;
      if (config.utils['chat-messages'].repeat) {
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, delay);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    // Anti-AFK (sneak, jump)
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }
    }
  });

  bot.on('end', () => {
    console.log('[BOT] Disconnected, reconnecting...');
    if (config.utils['auto-reconnect']) {
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    }
  });

  bot.on('kicked', reason => {
    console.log('[BOT] Kicked:', reason);
  });

  bot.on('error', err => {
    console.error('[ERROR]', err.message);
  });
}

createBot();

