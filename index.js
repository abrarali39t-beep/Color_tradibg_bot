const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

const TOKEN = '8532834468:AAHn-bszPGuGzXP-zhbEQ0rB0IzBuAX3YZ8';
const ADMIN_USERNAME = 'willian2500'; // without @
const VIP_UPI = 'willianxpeed@pingpay';
const VIP_PRICE = '₹99 / Month';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database('./bot.db');

// DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    vip INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    bet INTEGER DEFAULT 1,
    period INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'free',
    history TEXT DEFAULT '[]'
  )`);
});

// Utils
function nextPeriod(p) {
  return parseInt(p) + 1;
}

function smartPredict(history) {
  // history = ['BIG','SMALL','BIG'] (last 3)
  if (history.length < 2) {
    return Math.random() > 0.5 ? 'BIG' : 'SMALL';
  }
  const last3 = history.slice(-3);
  const bigCount = last3.filter(x => x === 'BIG').length;
  const smallCount = last3.filter(x => x === 'SMALL').length;

  if (bigCount >= 2) return 'SMALL';
  if (smallCount >= 2) return 'BIG';
  return last3[last3.length - 1] === 'BIG' ? 'SMALL' : 'BIG';
}

function resetUser(userId, mode) {
  db.run(
    `INSERT OR REPLACE INTO users (id, vip, level, bet, period, mode, history)
     VALUES (?, (SELECT vip FROM users WHERE id=?), 1, 1, 0, ?, '[]')`,
    [userId, userId, mode]
  );
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  db.run(`INSERT OR IGNORE INTO users (id) VALUES (?)`, [userId]);

  bot.sendMessage(chatId,
`🎯 *Welcome to Color Trading Bot*

Choose Mode:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🆓 Start Free", callback_data: "start_free" }],
          [{ text: "💎 Buy VIP", callback_data: "buy_vip" }],
          [{ text: "🧑‍💻 Admin Support", url: `https://t.me/${ADMIN_USERNAME}` }]
        ]
      }
    });
});

// Buttons
bot.on('callback_query', (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === 'start_free') {
    resetUser(userId, 'free');
    bot.sendMessage(chatId, `🆓 Free Mode Started!\nSend last 3 digit period number (e.g. 555)`);
  }

  if (q.data === 'buy_vip') {
    bot.sendMessage(chatId,
`💎 *Buy VIP*

Price: ${VIP_PRICE}
UPI: \`${VIP_UPI}\`

After payment, contact admin:
@${ADMIN_USERNAME}`, { parse_mode: "Markdown" });
  }

  if (q.data === 'result_win' || q.data === 'result_loss') {
    handleResult(q, q.data === 'result_win' ? 'win' : 'loss');
  }
});

// Period input
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!/^\d{3,}$/.test(text)) return;

  db.get(`SELECT * FROM users WHERE id=?`, [userId], (err, user) => {
    if (!user) return;

    const currentPeriod = user.period === 0 ? text : user.period;
    const nextP = nextPeriod(currentPeriod);

    const history = JSON.parse(user.history || '[]');
    const prediction = smartPredict(history);

    db.run(`UPDATE users SET period=? WHERE id=?`, [nextP, userId]);

    bot.sendMessage(chatId,
`📊 *Prediction*

Next Period: ${nextP}
Prediction: *${prediction}*
Level: ${user.level}
Bet: ₹${user.bet}

Result select karo 👇`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ WIN", callback_data: "result_win" }],
            [{ text: "❌ LOSS", callback_data: "result_loss" }]
          ]
        }
      });
  });
});

// Handle Win/Loss via buttons
function handleResult(q, result) {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  db.get(`SELECT * FROM users WHERE id=?`, [userId], (err, user) => {
    if (!user) return;

    const maxLevel = user.mode === 'vip' ? 5 : 7;
    let history = JSON.parse(user.history || '[]');

    if (result === 'win') {
      history.push('WIN');
      if (history.length > 10) history.shift();

      db.run(`UPDATE users SET level=1, bet=1, history=? WHERE id=?`,
        [JSON.stringify(history), userId]);

      bot.sendMessage(chatId,
        `✅ *WIN!*\nReset to Level 1\n\nSend next period number 👇`,
        { parse_mode: "Markdown" });

    } else {
      history.push('LOSS');
      if (history.length > 10) history.shift();

      const nextLevel = user.level + 1;
      const nextBet = user.bet * 2;

      if (nextLevel > maxLevel) {
        bot.sendMessage(chatId, `❌ Max ${maxLevel} Levels Reached. Session Ended.`);
        resetUser(userId, user.mode);
      } else {
        db.run(`UPDATE users SET level=?, bet=?, history=? WHERE id=?`,
          [nextLevel, nextBet, JSON.stringify(history), userId]);

        bot.sendMessage(chatId,
`❌ *LOSS*
Next Level: ${nextLevel}
Next Bet: ₹${nextBet}

Send next period number 👇`,
          { parse_mode: "Markdown" });
      }
    }
  });
}