// ================= ENV =================
require("dotenv").config();

process.on("uncaughtException", (e) => console.error("UNCAUGHT:", e));
process.on("unhandledRejection", (e) => console.error("UNHANDLED:", e));

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const TOKEN = (process.env.TOKEN || "").trim();
const ADMIN_ID = 6076530076;
const BOT_USERNAME = "aicolortradingbot"; // without @

if (!TOKEN) {
  console.error("❌ TOKEN missing in ENV");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ================= SERVER =================
const app = express();
app.get("/", (_, res) => res.send("🤖 AI COLOR TRADING BOT LIVE"));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Server started");
});

// ================= DATA =================
const DATA_FILE = path.join(process.cwd(), "users.json");

let data = {
  allUsers: [],
  dailyUsers: {},
  monthlyUsers: {},
  referrals: {},
  sureShotCredits: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    console.log("⚠️ users.json corrupted, creating new");
  }
}

const saveData = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("Save error:", e.message);
  }
};

// ================= HELPERS =================
const today = () => new Date().toISOString().slice(0, 10);
const month = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function trackUser(chatId) {
  const t = today(), m = month();
  if (!data.allUsers.includes(chatId)) data.allUsers.push(chatId);
  data.dailyUsers[t] = data.dailyUsers[t] || [];
  if (!data.dailyUsers[t].includes(chatId)) data.dailyUsers[t].push(chatId);
  data.monthlyUsers[m] = data.monthlyUsers[m] || [];
  if (!data.monthlyUsers[m].includes(chatId)) data.monthlyUsers[m].push(chatId);
  saveData();
}

// ================= STATE =================
let USERS = {};
let ADMIN_BROADCAST = false;

// ================= /start =================
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  trackUser(chatId);

  const myLink = `https://t.me/${BOT_USERNAME}?start=REF_${chatId}`;

  bot.sendMessage(chatId,
`🔥 AI COLOR TRADING BOT

🔮 Prediction System
🎁 Invite 5 = 1 Sure-Shot

Your Link:
${myLink}`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔮 Start Prediction", callback_data: "START_PRED" }],
      [{ text: "🔗 My Referral Link", url: myLink }]
    ]
  }
});
});

// ================= CALLBACK =================
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (q.data === "START_PRED") {
    user.step = 1;
    return bot.sendMessage(chatId, "🔢 Send last 3 digits (e.g. 555)");
  }

  if (user.step === 3 && (q.data === "BIG" || q.data === "SMALL")) {
    user.step = 4;
    return bot.sendMessage(chatId, "🎨 Select Color", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔴 RED", callback_data: "RED" }, { text: "🟢 GREEN", callback_data: "GREEN" }],
          [{ text: "🟣 VIOLET", callback_data: "VIOLET" }]
        ]
      }
    });
  }

  if (user.step === 4) {
    const next = parseInt(user.period, 10) + 1;
    const size = Math.random() > 0.5 ? "BIG 🔥" : "SMALL ❄️";
    const colors = ["RED 🔴", "GREEN 🟢", "VIOLET 🟣"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    bot.sendMessage(chatId,
`💎 AI Prediction
Next Period: ${next}
Result: ${size}
Color: ${color}`);

    USERS[chatId] = { step: 0 };
  }
});

// ================= MESSAGE =================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (!msg.text) return;

  if (user.step === 1) {
    if (!/^\d{3}$/.test(msg.text)) return bot.sendMessage(chatId, "❌ 3 digits only");
    user.period = msg.text;
    user.step = 2;
    return bot.sendMessage(chatId, "🎯 Enter number (0–9)");
  }

  if (user.step === 2) {
    if (!/^[0-9]$/.test(msg.text)) return bot.sendMessage(chatId, "❌ 0–9 only");
    user.step = 3;
    return bot.sendMessage(chatId, "⚖️ Big or Small?", {
      reply_markup: {
        inline_keyboard: [[
          { text: "🔥 BIG", callback_data: "BIG" },
          { text: "❄️ SMALL", callback_data: "SMALL" }
        ]]
      }
    });
  }
});

console.log("🤖 Bot started successfully...");