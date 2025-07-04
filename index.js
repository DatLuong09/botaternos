const mineflayer = require('mineflayer');
const { Movements } = require('mineflayer-pathfinder');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;
const config = require('./settings.json');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('✅ Bot is online!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Web server running on port ${PORT}`);
});

// Ping chính mình để giữ online (Render không cần nhưng vẫn để nếu chạy trên Replit)
setInterval(() => {
  require('http').get(`http://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
}, 280000);

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
  bot.settings.colorsEnabled = false;

  let pendingPromise = Promise.resolve();

  function sendRegister(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/register ${password} ${password}`);
      console.log(`[Auth] Sent /register`);
      bot.once('chat', (username, message) => {
        console.log(`[Chat] <${username}> ${message}`);
        if (message.includes('successfully registered') || message.includes('already registered')) {
          resolve();
        } else {
          reject(`[Auth] Unexpected register message: "${message}"`);
        }
      });
    });
  }

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      console.log(`[Auth] Sent /login`);
      bot.once('chat', (username, message) => {
        console.log(`[Chat] <${username}> ${message}`);
        if (message.includes('successfully logged in')) {
          resolve();
        } else {
          reject(`[Auth] Unexpected login message: "${message}"`);
        }
      });
    });
  }

  bot.once('spawn', () => {
    console.log('[33m[AfkBot] Bot joined the server[0m');

    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      pendingPromise = pendingPromise
        .then(() => sendRegister(password))
        .then(() => sendLogin(password))
        .catch(err => console.error('[Auth Error]', err));
    }

    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages']['messages'];
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

    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }
    }

    if (config.position.enabled) {
      const pos = config.position;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      console.log(`[AfkBot] Moving to (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  });

  bot.on('goal_reached', () => {
    console.log(`[AfkBot] Reached goal: ${bot.entity.position}`);
  });

  bot.on('death', () => {
    console.log(`[AfkBot] Bot died and respawned`);
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[Reconnect] Disconnected. Reconnecting...');
      setTimeout(createBot, config.utils['auto-recconect-delay']);
    });
  }

  bot.on('kicked', reason => {
    console.log(`[Kicked] Reason: ${reason}`);
  });

  bot.on('error', err => {
    console.error(`[ERROR] ${err.message}`);
  });
}

createBot();
