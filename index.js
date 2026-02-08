// ================= ENV =================
try { require("dotenv").config(); } catch {}

process.on("uncaughtException", (e) => console.error("UNCAUGHT:", e));
process.on("unhandledRejection", (e) => console.error("UNHANDLED:", e));

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const TOKEN = (process.env.TOKEN || "").trim();
const ADMIN_ID = 6076530076;            // apna admin id
const BOT_USERNAME = "aicolortradingbot"; // without @

if (!TOKEN) { console.error("TOKEN missing"); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });

// ================= SERVER =================
const app = express();
app.get("/", (_, res) => res.send("🤖 AI COLOR TRADING BOT LIVE"));
app.listen(process.env.PORT || 3000);

// ================= DATA =================
const DATA_FILE = path.join(__dirname, "users.json");
let data = { allUsers: [], dailyUsers: {}, monthlyUsers: {}, referrals: {}, sureShotCredits: {} };
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
let ADMIN_BROADCAST = false;

// ================= /start + referral =================
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  trackUser(chatId);

  const ref = match?.[1];
  if (ref?.startsWith("REF_")) {
    const inviterId = ref.replace("REF_", "");
    if (inviterId && inviterId !== String(chatId)) {
      data.referrals[inviterId] = (data.referrals[inviterId] || 0) + 1;
      if (data.referrals[inviterId] % 5 === 0) {
        data.sureShotCredits[inviterId] = (data.sureShotCredits[inviterId] || 0) + 1;
        bot.sendMessage(inviterId, "🎉 Referral Reward! 5 invites = 1 Sure-Shot 💎").catch(()=>{});
      }
      saveData();
    }
  }

  USERS[chatId] = { step: 0 };

  bot.sendMessage(chatId,
`🔥 *AI COLOR TRADING BOT*
🎁 Invite 5 = 1 Sure-Shot
⚡ Premium Predictions

Choose an option 👇`,
{
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔮 Start Prediction", callback_data: "START_PRED" }],
      [{ text: "🔗 My Referral Link", url: `https://t.me/${BOT_USERNAME}?start=REF_${chatId}` }]
    ]
  }
});
});

// ================= CALLBACKS =================
bot.on("callback_query", (q) => {
  if (!q.message) return;
  const chatId = q.message.chat.id;
  trackUser(chatId);
  bot.answerCallbackQuery(q.id).catch(()=>{});

  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (q.data === "START_PRED") {
    user.step = 1;
    return bot.sendMessage(chatId, "🔢 Send last 3 digits of previous period (e.g. 555)");
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
    bot.sendMessage(chatId, "🧠 AI Engine Processing...");
    setTimeout(() => {
      const next = parseInt(user.period, 10) + 1;
      const size = Math.random() > 0.5 ? "BIG 🔥" : "SMALL ❄️";
      const colors = ["RED 🔴","GREEN 🟢","VIOLET 🟣"];
      const color = colors[Math.floor(Math.random()*colors.length)];
      const conf = Math.floor(80 + Math.random()*15);

      bot.sendMessage(chatId,
`💎 *AI Prediction*
🕒 Next Period: ${next}
📈 Result: ${size}
🎨 Color: ${color}
📊 Confidence: ${conf}%

⚠️ Play smart. Risk is yours.`,
{ parse_mode: "Markdown" });

      USERS[chatId] = { step: 0 };
    }, 800);
  }
});

// ================= MESSAGES (prediction + broadcast) =================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  trackUser(chatId);

  // Admin broadcast
  if (msg.text === "/send" && chatId === ADMIN_ID) {
    ADMIN_BROADCAST = true;
    return bot.sendMessage(chatId, "📤 Broadcast ON. Send anything. /cancel to stop");
  }
  if (msg.text === "/cancel" && chatId === ADMIN_ID) {
    ADMIN_BROADCAST = false;
    return bot.sendMessage(chatId, "❌ Broadcast OFF");
  }

  if (ADMIN_BROADCAST && chatId === ADMIN_ID) {
    for (const uid of data.allUsers) {
      if (uid === ADMIN_ID) continue;
      try {
        if (msg.text && !msg.text.startsWith("/")) await bot.sendMessage(uid, msg.text).catch(()=>{});
        else if (msg.photo) await bot.sendPhoto(uid, msg.photo.at(-1).file_id, { caption: msg.caption || "" }).catch(()=>{});
        else if (msg.video) await bot.sendVideo(uid, msg.video.file_id, { caption: msg.caption || "" }).catch(()=>{});
        else if (msg.voice) await bot.sendVoice(uid, msg.voice.file_id).catch(()=>{});
      } catch {}
    }
    return bot.sendMessage(chatId, "✅ Broadcast sent.");
  }

  if (!msg.text) return;
  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

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

// ================= STATS =================
bot.onText(/\/stats/, (msg) => {
  if (msg.chat.id !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id,
`📊 BOT STATS
👥 Total Users: ${data.allUsers.length}
📅 Today Active: ${data.dailyUsers[today()]?.length || 0}
🗓 This Month: ${data.monthlyUsers[month()]?.length || 0}`);
});