const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");

const TOKEN = process.env.TOKEN;
const ADMIN_ID = 6076530076;
const BOT_USERNAME = "aicolortradingbot"; // <-- change this

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
  referralVIP: {} // { userId: expiry }
};

if (fs.existsSync(DATA_FILE)) data = JSON.parse(fs.readFileSync(DATA_FILE));
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ================= VIP CHECK
function isVIP(id) {
  if (data.vip.includes(id)) return true;
  const exp = data.referralVIP[id];
  if (exp && Date.now() < exp) return true;
  return false;
}

// ================= INIT USER
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

// ================= MAX LEVEL
function getMaxLevel(chatId) {
  return isVIP(chatId) ? 5 : 7;
}

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

Result batayein 👇`,
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

// ================= /start with referral
bot.onText(/\/start(?:\s+ref_(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  initUser(chatId);

  const refBy = match && match[1];
  if (refBy && refBy !== String(chatId) && !data.users[chatId].referredBy) {
    initUser(refBy);
    data.users[chatId].referredBy = refBy;
    data.users[refBy].referrals += 1;

    if (data.users[refBy].referrals % 3 === 0) {
      const vipDays = 7;
      const exp = Date.now() + vipDays * 24 * 60 * 60 * 1000;
      data.referralVIP[refBy] = exp;

      bot.sendMessage(refBy, `🎉 Congrats! You unlocked *${vipDays} days VIP* via referrals!`);
      bot.sendMessage(ADMIN_ID, `🔥 Referral VIP unlocked by user ${refBy}`);
    }
    saveData();
  }

  bot.sendMessage(chatId,
`👋 *Welcome to Dark AI Predictor Bot*

🆓 Free: 7 Levels  
👑 VIP: 5 Levels  

Commands:
🔗 /ref – Referral dashboard  
🏆 /leaderboard – Top referrers`,
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

// ================= /ref (Dashboard)
bot.onText(/\/ref/, (msg) => {
  const chatId = msg.chat.id;
  initUser(chatId);

  const u = data.users[chatId];
  const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`;
  const vipStatus = isVIP(chatId)
    ? "👑 VIP Active"
    : "🆓 Free User";

  bot.sendMessage(chatId,
`📊 *Referral Dashboard*

👥 Total Referrals: ${u.referrals}
🎁 Reward: 3 referrals = 7 days VIP
🔗 Your Link:
${refLink}

Status: ${vipStatus}`,
    { parse_mode: "Markdown" }
  );
});

// ================= /leaderboard
bot.onText(/\/leaderboard/, (msg) => {
  const arr = Object.entries(data.users)
    .map(([id, u]) => ({ id, refs: u.referrals || 0 }))
    .sort((a, b) => b.refs - a.refs)
    .slice(0, 10);

  if (arr.length === 0) {
    return bot.sendMessage(msg.chat.id, "No referrals yet.");
  }

  let text = "🏆 *Top Referrers*\n\n";
  arr.forEach((u, i) => {
    text += `${i + 1}. User ${u.id} — 👥 ${u.refs} referrals\n`;
  });

  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// ================= BUTTON HANDLER (WIN/LOSS + START_FREE + BUY_VIP)
// (Use your previous WIN/LOSS logic here – unchanged)
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  initUser(chatId);
  const user = data.users[chatId];

  // ▶️ START FREE
  if (q.data === "START_FREE") {
    user.basePeriod = null;
    user.currentPeriod = null;
    user.level = 1;
    user.bet = 1;
    user.history = [];
    saveData();

    bot.answerCallbackQuery(q.id);
    return bot.sendMessage(chatId, "🔢 Last 3 digits of previous period bhejo (e.g. 555)");
  }

  // 👑 BUY VIP
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

  // ✅ WIN / ❌ LOSS
  if (q.data === "WIN" || q.data === "LOSS") {
    if (!user.prediction) {
      bot.answerCallbackQuery(q.id, { text: "No active prediction", show_alert: false });
      return;
    }

    const maxLevel = getMaxLevel(chatId);

    user.history.push({
      period: user.currentPeriod,
      bet: user.bet,
      prediction: user.prediction,
      result: q.data
    });
    if (user.history.length > 10) user.history.shift();

    let msg = "";

    if (q.data === "WIN") {
      user.level = 1;
      user.bet = 1;
      msg = `✅ *WIN*\nLevel reset → 1\nBet reset → ₹1`;
    } else {
      user.level += 1;
      user.bet *= 2;

      if (user.level > maxLevel) {
        msg = `🚫 *MAX LEVEL REACHED*\nSystem reset`;
        user.level = 1;
        user.bet = 1;
      } else {
        msg = `❌ *LOSS*\nNext Level: ${user.level}\nNext Bet: ₹${user.bet}`;
      }
    }

    user.prediction = null;
    saveData();

    bot.answerCallbackQuery(q.id);
    bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });

    setTimeout(() => sendPrediction(chatId), 2000);
  }
});