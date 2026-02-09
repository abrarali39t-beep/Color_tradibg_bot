const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");

const TOKEN = process.env.TOKEN;
const ADMIN_ID = 6076530076;
const BOT_USERNAME = "aicolortradingbot"; // without @

const bot = new TelegramBot(TOKEN, { polling: true });

// ================= SERVER
const app = express();
app.get("/", (req, res) => res.send("🤖 Dark AI Bot Running"));
app.listen(process.env.PORT || 3000);

// ================= DATA FILE
const DATA_FILE = "users.json";
let data = {
  users: {},
  vip: [ADMIN_ID],
  referralVIP: {} // { userId: expiryTimestamp }
};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ================= HELPERS
function isVIP(id) {
  if (data.vip.includes(id)) return true;
  const exp = data.referralVIP[id];
  return exp && Date.now() < exp;
}

function initUser(id) {
  if (!data.users[id]) {
    data.users[id] = {
      basePeriod: null,
      currentPeriod: null,
      level: 1,
      bet: 1,
      prediction: null,
      history: [],
      referrals: 0,
      referredBy: null
    };
    saveData();
  }
}

function getMaxLevel(chatId) {
  return isVIP(chatId) ? 5 : 7; // VIP 5 | FREE 7
}

// ================= START + REFERRAL
bot.onText(/\/start(?:\s+ref_(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  initUser(chatId);

  const refBy = match && match[1];
  if (refBy && refBy !== String(chatId) && !data.users[chatId].referredBy) {
    initUser(refBy);
    data.users[chatId].referredBy = refBy;
    data.users[refBy].referrals += 1;

    // reward on every 3 refs
    if (data.users[refBy].referrals % 3 === 0) {
      const vipDays = 7;
      data.referralVIP[refBy] = Date.now() + vipDays * 24 * 60 * 60 * 1000;
      bot.sendMessage(refBy, `🎉 You unlocked *${vipDays} days VIP* via referrals!`, { parse_mode: "Markdown" });
      bot.sendMessage(ADMIN_ID, `🔥 Referral VIP unlocked by user ${refBy}`);
    }
    saveData();
  }

  bot.sendMessage(chatId,
`👋 *Welcome to AI Color Prediction Bot*

🆓 Free: 7 Levels  
👑 VIP: 5 Levels  

Choose an option 👇`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "▶️ Start Free", callback_data: "START_FREE" }],
          [{ text: "👑 Buy VIP", callback_data: "BUY_VIP" }]
        ]
      }
    }
  );
});

// ================= REF DASHBOARD
bot.onText(/\/ref/, (msg) => {
  const chatId = msg.chat.id;
  initUser(chatId);
  const u = data.users[chatId];

  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`;
  const vipStatus = isVIP(chatId) ? "👑 VIP Active" : "🆓 Free User";

  bot.sendMessage(chatId,
`📊 *Referral Dashboard*

👥 Referrals: ${u.referrals}
🎁 Reward: 3 refs = 7 days VIP

🔗 Your link:
${refLink}

Status: ${vipStatus}`,
    { parse_mode: "Markdown" }
  );
});

// ================= LEADERBOARD
bot.onText(/\/leaderboard/, (msg) => {
  const list = Object.entries(data.users)
    .map(([id, u]) => ({ id, refs: u.referrals || 0 }))
    .sort((a, b) => b.refs - a.refs)
    .slice(0, 10);

  if (!list.length) return bot.sendMessage(msg.chat.id, "No referrals yet.");

  let text = "🏆 *Top Referrers*\n\n";
  list.forEach((u, i) => {
    text += `${i + 1}. User ${u.id} — 👥 ${u.refs} refs\n`;
  });

  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// ================= SEND PREDICTION
function sendPrediction(chatId) {
  const user = data.users[chatId];
  const maxLevel = getMaxLevel(chatId);

  if (user.level > maxLevel) {
    user.level = 1;
    user.bet = 1;
    saveData();
    return bot.sendMessage(chatId, "🚫 Max level reached. System reset.");
  }

  user.currentPeriod += 1;
  const prediction = Math.random() > 0.5 ? "BIG" : "SMALL";
  user.prediction = prediction;
  saveData();

  bot.sendMessage(chatId,
`🤖 *AI PREDICTION SYSTEM*
🎯 Level: ${user.level}/${maxLevel}
📌 Period: ${user.currentPeriod}
💰 Bet: ₹${user.bet}
📊 Mode: ${isVIP(chatId) ? "👑 VIP" : "🆓 FREE"}
🔮 Prediction: *${prediction}*

Result batao 👇`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ WIN", callback_data: "WIN" }, { text: "❌ LOSS", callback_data: "LOSS" }]
        ]
      }
    }
  );
}

// ================= CALLBACK HANDLER
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  initUser(chatId);
  const user = data.users[chatId];

  if (q.data === "START_FREE") {
    user.basePeriod = null;
    user.currentPeriod = null;
    user.level = 1;
    user.bet = 1;
    user.history = [];
    user.prediction = null;
    saveData();
    bot.answerCallbackQuery(q.id);
    return bot.sendMessage(chatId, "🔢 Last 3 digits of previous period bhejo (e.g. 555)");
  }

  if (q.data === "BUY_VIP") {
    bot.answerCallbackQuery(q.id);
    return bot.sendMessage(chatId,
`👑 *VIP ACCESS*

💎 Price: ₹99 / 1 Month  
👤 Admin: @willian2500  
💳 UPI: willianxpeed@pingpay  

Payment screenshot admin ko bhejo.`,
      { parse_mode: "Markdown" }
    );
  }

  if (q.data === "WIN" || q.data === "LOSS") {
    if (!user.prediction) {
      bot.answerCallbackQuery(q.id, { text: "No active prediction", show_alert: false });
      return;
    }

    const maxLevel = getMaxLevel(chatId);

    if (q.data === "WIN") {
      user.level = 1;
      user.bet = 1;
    } else {
      user.level += 1;
      user.bet *= 2;
      if (user.level > maxLevel) {
        user.level = 1;
        user.bet = 1;
      }
    }

    user.prediction = null;
    saveData();

    bot.answerCallbackQuery(q.id);
    return setTimeout(() => sendPrediction(chatId), 1500);
  }
});

// ================= PERIOD INPUT HANDLER
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  initUser(chatId);
  const user = data.users[chatId];

  if (user.basePeriod === null) {
    if (!/^\d{3}$/.test(text)) {
      return bot.sendMessage(chatId, "❌ Enter exactly 3 digits (e.g. 555)");
    }

    user.basePeriod = parseInt(text);
    user.currentPeriod = user.basePeriod;
    user.level = 1;
    user.bet = 1;
    user.prediction = null;
    saveData();

    return sendPrediction(chatId);
  } else {
    return bot.sendMessage(chatId, "ℹ️ Game already started. Use WIN / LOSS buttons.");
  }
});