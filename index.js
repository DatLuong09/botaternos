const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;
const config = require('./settings.json');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Bot is online!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server started on port ${PORT}`);
});

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'], // offline / microsoft
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);

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
    console.log('[AfkBot] ✅ Bot joined the server');

    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      pendingPromise = pendingPromise
        .then(() => sendRegister(password))
        .then(() => sendLogin(password))
        .catch(err => console.error('[Auth Error]', err));
    }

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
    console.log(`[AfkBot] ✅ Arrived at goal: ${bot.entity.position}`);
  });

  bot.on('death', () => {
    console.log(`[AfkBot] ⚠️ Bot died and respawned at ${bot.entity.position}`);
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[Reconnect] Bot disconnected. Reconnecting...');
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
