const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const express = require('express');
const util = require('minecraft-server-util');
const config = require('./settings.json');

const app = express();
const PORT = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send('✅ Bot is online!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server started on port ${PORT}`);
});

async function isServerOnline(host, port) {
  try {
    const status = await util.status(host, port, { timeout: 5000 });
    return status.players.online >= 0;
  } catch {
    return false;
  }
}

async function createBot() {
  const online = await isServerOnline(config.server.ip, config.server.port);
  if (!online) {
    console.log('[WAIT] Server offline. Rechecking in 1 minute...');
    return setTimeout(createBot, 60000);
  }

  const bot = mineflayer.createBot({
    username: config["bot-account"].username,
    password: config["bot-account"].password,
    auth: config["bot-account"].type,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);
  const mcData = mcDataLoader(bot.version);
  const defaultMove = new Movements(bot, mcData);

  bot.once('spawn', () => {
    if (bot.settings) bot.settings.colorsEnabled = false;
    console.log('[INFO] Bot spawned into server.');

    // Auto-auth
    if (config.utils["auto-auth"].enabled) {
      const pw = config.utils["auto-auth"].password;
      bot.chat(`/register ${pw} ${pw}`);
      setTimeout(() => bot.chat(`/login ${pw}`), 3000);
    }

    // Chat loop
    if (config.utils["chat-messages"].enabled) {
      const messages = config.utils["chat-messages"].messages;
      const delay = config.utils["chat-messages"]["repeat-delay"] * 1000;
      let i = 0;
      if (config.utils["chat-messages"].repeat) {
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, delay);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    // Anti-AFK
    if (config.utils["anti-afk"].enabled) {
      bot.setControlState('jump', true);
      if (config.utils["anti-afk"].sneak) {
        bot.setControlState('sneak', true);
      }
    }

    // Di chuyển đến vị trí
    if (config.position.enabled) {
      const pos = config.position;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      console.log(`[MOVE] Moving to (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  });

  bot.on('goal_reached', () => {
    console.log(`[MOVE] Reached goal at ${bot.entity.position}`);
  });

  bot.on('death', () => {
    console.log(`[INFO] Bot died. Respawning...`);
  });

  if (config.utils["auto-reconnect"]) {
    bot.on('end', () => {
      const delay = config.utils["auto-recconect-delay"] + Math.floor(Math.random() * 5000);
      console.log(`[RECONNECT] Reconnecting in ${delay}ms...`);
      setTimeout(createBot, delay);
    });
  }

  bot.on('kicked', reason => {
    console.log(`[KICKED] Reason: ${reason}`);
  });

  bot.on('error', err => {
    console.error(`[ERROR] ${err.message}`);
  });
}

createBot();
