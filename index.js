const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const config = require('./settings.json');
const express = require('express');
const app = express();

// Dùng port mặc định hoặc do Render cung cấp
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('✅ Bot is online!'));
app.listen(PORT, () => console.log(`🌐 Web server started on port ${PORT}`));

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);

  function sendRegister(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/register ${password} ${password}`);
      bot.once('chat', (_, message) => {
        if (message.includes('successfully registered') || message.includes('already registered')) resolve();
        else reject(`[Register] Unexpected: "${message}"`);
      });
    });
  }

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      bot.once('chat', (_, message) => {
        if (message.includes('successfully logged in')) resolve();
        else reject(`[Login] Unexpected: "${message}"`);
      });
    });
  }

  bot.once('spawn', () => {
    console.log(`[Bot] Joined server.`);

    // Auto-auth
    if (config.utils['auto-auth'].enabled) {
      const pw = config.utils['auto-auth'].password;
      sendRegister(pw).then(() => sendLogin(pw)).catch(console.error);
    }

    // Anti-AFK: Jump/Sneak
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }

    // Anti-AFK: Random Move
    if (config.utils['anti-afk'].randomMove) {
      setInterval(() => {
        const x = bot.entity.position.x + (Math.random() * 6 - 3);
        const y = bot.entity.position.y;
        const z = bot.entity.position.z + (Math.random() * 6 - 3);
        const goal = new GoalBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(goal);
        console.log(`[ANTI-AFK] Random move to (${goal.x}, ${goal.y}, ${goal.z})`);
      }, 10000);
    }

    // Chat messages
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

    // Di chuyển đến vị trí
    if (config.position.enabled) {
      const pos = config.position;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      console.log(`[Bot] Moving to (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  });

  bot.on('goal_reached', () => {
    console.log(`[Bot] Reached goal at ${bot.entity.position}`);
  });

  bot.on('death', () => {
    console.log(`[Bot] Died and respawned at ${bot.entity.position}`);
  });

  bot.on('kicked', reason => {
    console.log(`[Kicked] Reason: ${reason}`);
  });

  bot.on('error', err => {
    console.error(`[ERROR] ${err.message}`);
  });

  // Auto reconnect
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[Reconnect] Disconnected. Reconnecting...');
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }
}

createBot();

