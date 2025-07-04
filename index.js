const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
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

  bot.once('spawn', () => {
    console.log('[BOT] Spawned');

    // Load mcData safely
    const mcData = require('minecraft-data')(bot.version);
    if (!mcData) {
      console.error('[INIT ERROR] Unsupported bot version or failed to load mcData');
      process.exit(1);
    }

    bot.loadPlugin(pathfinder);
    const defaultMove = new Movements(bot, mcData);

    // Auto-auth
    if (config.utils['auto-auth'].enabled) {
      const pass = config.utils['auto-auth'].password;
      setTimeout(() => {
        bot.chat(`/register ${pass} ${pass}`);
        bot.chat(`/login ${pass}`);
        console.log('[AUTH] Sent register/login commands');
      }, 3000);
    }

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

    // Anti AFK jump/sneak
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }

      // Random move
      if (config.utils['anti-afk'].randomMove) {
        bot.loadPlugin(pathfinder);
        bot.pathfinder.setMovements(defaultMove);
        setInterval(() => {
          const dx = Math.floor(Math.random() * 3) - 1;
          const dz = Math.floor(Math.random() * 3) - 1;
          const pos = bot.entity.position.offset(dx, 0, dz);
          bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
          console.log(`[AFK] Moving randomly to ${pos.x}, ${pos.y}, ${pos.z}`);
        }, 15000); // every 15s
      }
    }

    // Move to set position if enabled
    if (config.position.enabled) {
      const pos = config.position;
      bot.loadPlugin(pathfinder);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      console.log(`[BOT] Moving to ${pos.x} ${pos.y} ${pos.z}`);
    }
  });

  bot.on('death', () => console.log('[BOT] Died and respawned'));
  bot.on('goal_reached', () => console.log('[BOT] Reached goal'));
  bot.on('kicked', reason => console.log(`[KICKED] ${reason}`));
  bot.on('error', err => console.error(`[ERROR] ${err.message}`));
  bot.on('end', () => {
    console.log('[BOT] Disconnected. Reconnecting...');
    setTimeout(createBot, config.utils['auto-recconect-delay']);
  });
}

createBot();
