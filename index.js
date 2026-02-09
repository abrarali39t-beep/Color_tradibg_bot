require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const BOT_USERNAME = "aicolortradingbot"; // without @
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

// ===== AI PREDICTION LOGIC =====
function aiPredictFromPeriod(periodStr) {
  const digits = periodStr.split("").map(n => parseInt(n, 10));
  const sum = digits.reduce((a,b)=>a+b, 0);
  const last = digits[2];

  const size = (sum % 2 === 0 || last >= 5) ? "BIG 🔥" : "SMALL ❄️";

  let color;
  if (sum % 3 === 0) color = "RED 🔴";
  else if (sum % 3 === 1) color = "GREEN 🟢";
  else color = "VIOLET 🟣";

  const confidence = 82 + (sum % 15); // 82–96%

  return { size, color, confidence };
}

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

  bot.sendMessage(chatId, "🔥 *AI COLOR TRADING BOT*", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔮 Start AI Prediction", callback_data: "START" }],
        [{ text: "💎 Sure-Shot (Premium)", callback_data: "SURE" }],
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

  if (q.data === "REF") {
    const invites = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;
    const link = `https://t.me/${BOT_USERNAME}?start=REF_${chatId}`;

    return bot.sendMessage(chatId,
`📊 *My Referral Record*

👥 Invites: ${invites}/5  
💎 Sure-Shot Credits: ${credits}

🔗 Invite Link:
${link}`, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "⬅ Back", callback_data: "BACK" }]] }
    });
  }

  if (q.data === "BACK") {
    return bot.sendMessage(chatId, "🔥 *AI COLOR TRADING BOT*", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔮 Start AI Prediction", callback_data: "START" }],
          [{ text: "💎 Sure-Shot (Premium)", callback_data: "SURE" }],
          [{ text: "📊 My Referral Record", callback_data: "REF" }]
        ]
      }
    });
  }

  if (q.data === "START") {
    user.step = 1;
    return bot.sendMessage(chatId, "🔢 Last period ke last 3 digits bhejo (e.g. 556)");
  }

  if (q.data === "SURE") {
    const invites = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;

    if (invites < 5 && credits <= 0) {
      return bot.sendMessage(chatId, "🔒 Sure-Shot locked! 5 users invite karo.");
    }

    if (credits > 0) {
      data.sureShotCredits[chatId] = credits - 1;
      save();
    }

    user.step = 2;
    return bot.sendMessage(chatId, "💎 Sure-Shot ke liye last 3 digits bhejo (e.g. 556)");
  }
});

// ===== TEXT FLOW =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const user = USERS[chatId] || {};
  if (!msg.text) return;

  if (user.step === 1 || user.step === 2) {
    if (!/^\d{3}$/.test(msg.text)) {
      return bot.sendMessage(chatId, "❌ Sirf 3 digits bhejo (e.g. 556)");
    }

    const period = msg.text;
    const nextPeriod = parseInt(period, 10) + 1;
    const ai = aiPredictFromPeriod(period);

    user.step = 0;
    USERS[chatId] = user;

    return bot.sendMessage(chatId,
`🧠 *AI Prediction*

🕒 Next Period: ${nextPeriod}
📈 Result: ${ai.size}
🎨 Color: ${ai.color}
📊 Confidence: ${ai.confidence}%

⚠️ Demo prediction. Real games se related nahi.`,
{ parse_mode: "Markdown" });
  }
});

console.log("🤖 BOT RUNNING");