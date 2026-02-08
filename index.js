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

// ===== SERVER (Render keepalive) =====
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
        inline_keyboard: [
          [{ text: "⬅ Back", callback_data: "BACK" }]
        ]
      }
    });
  }

  if (q.data === "BACK") {
    return bot.sendMessage(chatId, "🔥 AI COLOR TRADING BOT", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔮 Start Prediction", callback_data: "START" }],
          [{ text: "📊 My Referral Record", callback_data: "REF" }]
        ]
      }
    });
  }

  if (q.data === "START") {
    USERS[chatId].step = 1;
    return bot.sendMessage(chatId, "Send last 3 digits (e.g. 555)");
  }
});

// ===== TEXT FLOW =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const user = USERS[chatId] || {};

  if (!msg.text) return;

  if (user.step === 1) {
    user.period = msg.text;
    user.step = 0;
    USERS[chatId] = user;
    return bot.sendMessage(chatId, "✅ Prediction generated (demo)");
  }
});

console.log("🤖 BOT RUNNING");