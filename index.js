const mineflayer = require('mineflayer');
const { Movements } = require('mineflayer-pathfinder');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;
const config = require('./settings.json');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('✅ Bot is online!'));
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
    bot.settings.colorsEnabled = false;

    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);

    // ❌ Chặn đập và đặt block
    bot.dig = () => {
      console.log('[BLOCKED] bot.dig() bị chặn');
    };
    bot.placeBlock = () => {
      console.log('[BLOCKED] bot.placeBlock() bị chặn');
    };

    // Auto-auth
    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      bot.chat(`/register ${password} ${password}`);
      bot.once('chat', () => bot.chat(`/login ${password}`));
    }

    // Auto chat
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

    // Di chuyển đến tọa độ
    if (config.position.enabled) {
      const pos = config.position;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
    }

    // Anti-AFK
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }

      setInterval(() => {
        const dx = (Math.random() - 0.5) * 4;
        const dz = (Math.random() - 0.5) * 4;
        const pos = bot.entity.position.offset(dx, 0, dz);
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(new GoalBlock(
          Math.floor(pos.x),
          Math.floor(pos.y),
          Math.floor(pos.z)
        ));
      }, 15000);

      setInterval(() => {
        const yaw = Math.random() * 2 * Math.PI;
        const pitch = (Math.random() - 0.5) * Math.PI / 2;
        bot.look(yaw, pitch, true);
      }, 8000);

      setInterval(() => {
        const vehicle = bot.entity.vehicle;
        if (vehicle) {
          bot.useEntity(vehicle);
        }
      }, 30000);
    }
  });

  bot.on('goal_reached', () => {
    console.log(`[BOT] Reached target location.`);
  });

  bot.on('death', () => {
    console.log(`[BOT] Bot died and respawned.`);
  });

  bot.on('kicked', reason => {
    console.log(`[KICKED] Reason: ${reason}`);
  });

  bot.on('error', err => {
    console.log(`[ERROR] ${err.message}`);
  });

  // Reconnect
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[Reconnect] Bot disconnected. Reconnecting...');
      setTimeout(createBot, config.utils['auto-reconnect-delay']);
    });
  }
}

createBot();


