require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const BOT_USERNAME = "aicolortradingbot";
if (!TOKEN) throw new Error("TOKEN missing");

const bot = new TelegramBot(TOKEN, { polling: true });

// ===== SERVER =====
const app = express();
app.get("/", (_, res) => res.send("BOT LIVE"));
app.listen(process.env.PORT || 3000);

// ===== DATA =====
const DATA_FILE = path.join(process.cwd(), "users.json");
let data = { referrals: {}, sureShotCredits: {}, _invitedBy: {} };
if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {}
}
const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ===== STATE =====
const USERS = {};

// ===== /start =====
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;

  const ref = match?.[1];
  if (ref?.startsWith("REF_")) {
    const inviter = ref.replace("REF_", "");
    if (inviter !== String(chatId) && data._invitedBy[chatId] !== inviter) {
      data._invitedBy[chatId] = inviter;
      data.referrals[inviter] = (data.referrals[inviter] || 0) + 1;

      if (data.referrals[inviter] % 5 === 0) {
        data.sureShotCredits[inviter] = (data.sureShotCredits[inviter] || 0) + 1;
        bot.sendMessage(inviter, "🎉 5 referrals = 1 Sure-Shot unlocked!");
      }
      save();
    }
  }

  USERS[chatId] = { step: 0 };

  bot.sendMessage(chatId, "🔥 AI COLOR TRADING BOT", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔮 Start Prediction", callback_data: "START" }],
        [{ text: "💎 Sure-Shot", callback_data: "SURE" }],
        [{ text: "📊 My Referral Record", callback_data: "REF" }]
      ]
    }
  });
});

// ===== CALLBACKS =====
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  bot.answerCallbackQuery(q.id).catch(()=>{});

  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  // Referral record
  if (q.data === "REF") {
    const invites = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;
    const link = `https://t.me/${BOT_USERNAME}?start=REF_${chatId}`;

    return bot.sendMessage(chatId,
`📊 My Referral Record

Invites: ${invites}/5  
Sure-Shot Credits: ${credits}

Invite Link:
${link}`, {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅ Back", callback_data: "BACK" }]]
      }
    });
  }

  // Back
  if (q.data === "BACK") {
    return bot.sendMessage(chatId, "🔥 AI COLOR TRADING BOT", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔮 Start Prediction", callback_data: "START" }],
          [{ text: "💎 Sure-Shot", callback_data: "SURE" }],
          [{ text: "📊 My Referral Record", callback_data: "REF" }]
        ]
      }
    });
  }

  // Normal prediction start
  if (q.data === "START") {
    user.step = 1;
    return bot.sendMessage(chatId, "Send last 3 digits (e.g. 555)");
  }

  // Sure-Shot
  if (q.data === "SURE") {
    const invites = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;

    if (invites < 5 && credits <= 0) {
      return bot.sendMessage(chatId, "🔒 Sure-Shot locked! Invite 5 users to unlock.");
    }

    if (credits > 0) {
      data.sureShotCredits[chatId] = credits - 1;
      save();
    }

    return bot.sendMessage(chatId, "💎 Sure-Shot Result: BIG 🔥 | RED 🔴 (Demo)");
  }

  // BIG/SMALL choice
  if (q.data === "BIG" || q.data === "SMALL") {
    user.choice = q.data;
    user.step = 3;
    return bot.sendMessage(chatId, "Choose Color:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔴 RED", callback_data: "RED" }, { text: "🟢 GREEN", callback_data: "GREEN" }],
          [{ text: "🟣 VIOLET", callback_data: "VIOLET" }]
        ]
      }
    });
  }

  // Color result
  if (["RED","GREEN","VIOLET"].includes(q.data)) {
    user.step = 0;
    return bot.sendMessage(chatId, `✅ Prediction: ${user.choice} + ${q.data}`);
  }
});

// ===== TEXT FLOW =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const user = USERS[chatId] || {};

  if (!msg.text) return;

  if (user.step === 1) {
    user.step = 2;
    USERS[chatId] = user;
    return bot.sendMessage(chatId, "Choose BIG or SMALL", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 BIG", callback_data: "BIG" }],
          [{ text: "❄️ SMALL", callback_data: "SMALL" }]
        ]
      }
    });
  }
});

console.log("🤖 BOT RUNNING");