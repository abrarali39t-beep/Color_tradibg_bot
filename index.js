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
const BOT_USERNAME = "aicolortradingbot"; // without @

if (!TOKEN) { console.error("❌ TOKEN missing"); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });

// ================= SERVER =================
const app = express();
app.get("/", (_, res) => res.send("🤖 AI COLOR TRADING BOT LIVE"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Server running"));

// ================= DATA =================
const DATA_FILE = path.join(process.cwd(), "users.json");
let data = { allUsers: [], dailyUsers: {}, monthlyUsers: {}, referrals: {}, sureShotCredits: {}, _invitedBy: {} };

if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {}
}
const saveData = () => { try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch {} };

// ================= HELPERS =================
const today = () => new Date().toISOString().slice(0,10);
const month = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};
function trackUser(chatId){
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

// ================= /start + referral =================
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  trackUser(chatId);

  const ref = match?.[1];
  if (ref?.startsWith("REF_")) {
    const inviterId = ref.replace("REF_", "");
    if (inviterId && inviterId !== String(chatId)) {
      if (data._invitedBy[chatId] !== inviterId) {
        data._invitedBy[chatId] = inviterId;
        data.referrals[inviterId] = (data.referrals[inviterId] || 0) + 1;

        if (data.referrals[inviterId] % 5 === 0) {
          data.sureShotCredits[inviterId] = (data.sureShotCredits[inviterId] || 0) + 1;
          bot.sendMessage(inviterId, "🎉 Referral Reward!\n5 invites = 1 Sure-Shot 💎").catch(()=>{});
        }
        saveData();
      }
    }
  }

  USERS[chatId] = { step: 0 };

  bot.sendMessage(chatId,
`🔥 *AI COLOR TRADING BOT*
🔮 Prediction System
🎁 Invite 5 = 1 Sure-Shot`,
{
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔮 Start Prediction", callback_data: "START_PRED" }],
      [{ text: "📊 My Referral Record", callback_data: "REF_RECORD" }]
    ]
  }
});
});

// ================= SINGLE CALLBACK HANDLER =================
bot.on("callback_query", (q) => {
  if (!q.message) return;
  const chatId = q.message.chat.id;
  bot.answerCallbackQuery(q.id).catch(()=>{});
  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (q.data === "START_PRED") {
    user.step = 1;
    return bot.sendMessage(chatId, "🔢 Send last 3 digits (e.g. 555)");
  }

  if (q.data === "REF_RECORD") {
    const invites = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;
    const myLink = `https://t.me/${BOT_USERNAME}?start=REF_${chatId}`;
    const unlocked = invites >= 5 || credits > 0;

    return bot.sendMessage(chatId,
`📊 *My Referral Record*

👥 Invites: ${invites}/5  
💎 Sure-Shot Credits: ${credits}

🔗 Invite link:
${myLink}`,
{
  parse_mode: "Markdown",
  disable_web_page_preview: true,
  reply_markup: {
    inline_keyboard: [
      unlocked
        ? [{ text: "💎 Sure-Shot (UNLOCKED)", callback_data: "SURE_SHOT" }]
        : [{ text: "🔒 Sure-Shot (Invite 5 to Unlock)", callback_data: "LOCKED" }],
      [{ text: "⬅️ Back to Menu", callback_data: "BACK_MENU" }]
    ]
  }
});
  }

  if (q.data === "BACK_MENU") {
    return bot.sendMessage(chatId,
`🔥 *AI COLOR TRADING BOT*
🔮 Prediction System
🎁 Invite 5 = 1 Sure-Shot`,
{
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔮 Start Prediction", callback_data: "START_PRED" }],
      [{ text: "📊 My Referral Record", callback_data: "REF_RECORD" }]
    ]
  }
});
  }

  if (q.data === "LOCKED") {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ Sure-Shot locked! Invite 5 users to unlock.",
      show_alert: true
    });
  }

  if (q.data === "SURE_SHOT") {
    if (!user.period) {
      user.step = 1;
      return bot.sendMessage(chatId, "💎 Sure-Shot use karne se pehle last 3 digits bhejo (e.g. 555)");
    }

    const invites = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;

    if (invites < 5 && credits <= 0) {
      return bot.answerCallbackQuery(q.id, { text: "❌ Locked. Invite 5 users.", show_alert: true });
    }

    if (credits > 0) {
      data.sureShotCredits[chatId] = credits - 1;
      saveData();
    }

    const next = parseInt(user.period, 10) + 1;
    const size = Math.random() > 0.45 ? "BIG 🔥" : "SMALL ❄️";
    const colors = ["RED 🔴","GREEN 🟢","VIOLET 🟣"];
    const color = colors[Math.floor(Math.random()*colors.length)];
    const conf = Math.floor(90 + Math.random()*9);

    USERS[chatId] = { step: 0 };

    return bot.sendMessage(chatId,
`💎 *SURE-SHOT (Premium)*

🕒 Period: ${next}
📈 Result: ${size}
🎨 Color: ${color}
📊 Confidence: ${conf}%

⚠️ Risk involved. Play smart.`,
{ parse_mode: "Markdown" });
  }

  if (user.step === 3 && (q.data === "BIG" || q.data === "SMALL")) {
    user.step = 4;
    return bot.sendMessage(chatId, "🎨 Select Color", {
      reply_markup: { inline_keyboard: [
        [{ text: "🔴 RED", callback_data: "RED" }, { text: "🟢 GREEN", callback_data: "GREEN" }],
        [{ text: "🟣 VIOLET", callback_data: "VIOLET" }]
      ]}
    });
  }

  if (user.step === 4 && ["RED","GREEN","VIOLET"].includes(q.data)) {
    const next = parseInt(user.period, 10) + 1;
    const size = Math.random() > 0.5 ? "BIG 🔥" : "SMALL ❄️";
    const colors = ["RED 🔴","GREEN 🟢","VIOLET 🟣"];
    const color = colors[Math.floor(Math.random()*colors.length)];
    const conf = Math.floor(80 + Math.random()*15);

    USERS[chatId] = { step: 0 };

    return bot.sendMessage(chatId,
`💎 *AI Prediction*

🕒 Next Period: ${next}
📈 Result: ${size}
🎨 Color: ${color}
📊 Confidence: ${conf}%`,
{ parse_mode: "Markdown" });
  }
});

// ================= MESSAGES =================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  trackUser(chatId);
  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (!msg.text) return;

  if (user.step === 1) {
    if (!/^\d{3}$/.test(msg.text)) return bot.sendMessage(chatId, "❌ Enter exactly 3 digits (e.g. 555)");
    user.period = msg.text;
    user.step = 2;
    return bot.sendMessage(chatId, "🎯 Enter number (0–9)");
  }

  if (user.step === 2) {
    if (!/^[0-9]$/.test(msg.text)) return bot.sendMessage(chatId, "❌ Enter single digit (0–9)");
    user.step = 3;
    return bot.sendMessage(chatId, "⚖️ Choose Big or Small", {
      reply_markup: { inline_keyboard: [[
        { text: "🔥 BIG", callback_data: "BIG" },
        { text: "❄️ SMALL", callback_data: "SMALL" }
      ]]}
    });
  }
});

console.log("🤖 Bot started successfully...");