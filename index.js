// ================= ENV (Render + Local) =================
try {
  require("dotenv").config();
} catch {}

// ================= SAFE ERROR HANDLING =================
process.on("uncaughtException", (err) => console.error("UNCAUGHT:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED:", err));

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN && process.env.TOKEN.trim();
const ADMIN_ID = 6076530076;
const BOT_USERNAME = "aicolortradingbot"; // without @

// 🔎 ENV sanity log (comment out after stable)
console.log("ENV TOKEN EXISTS:", !!TOKEN);
console.log("ENV TOKEN LENGTH:", TOKEN ? TOKEN.length : 0);

if (!TOKEN) {
  console.error("❌ ERROR: TOKEN missing. Set TOKEN in Render Environment.");
  process.exit(1);
}

console.log("🤖 BOT STARTING:", BOT_USERNAME);

// ================= BOT (Polling) =================
const bot = new TelegramBot(TOKEN, { polling: true });

// ================= SERVER (Render Health) =================
const app = express();
app.get("/", (req, res) => res.send("🤖 AI COLOR TRADING BOT LIVE"));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server running");
});

// ================= DATA FILE =================
const DATA_FILE = path.join(__dirname, "users.json");

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
  } catch {
    console.log("⚠️ users.json corrupted, resetting.");
  }
}
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ================= DATE HELPERS =================
const today = () => new Date().toISOString().slice(0, 10);
const month = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ================= TRACK USERS =================
function trackUser(chatId) {
  const t = today();
  const m = month();

  if (!data.allUsers.includes(chatId)) data.allUsers.push(chatId);

  data.dailyUsers[t] = data.dailyUsers[t] || [];
  if (!data.dailyUsers[t].includes(chatId)) data.dailyUsers[t].push(chatId);

  data.monthlyUsers[m] = data.monthlyUsers[m] || [];
  if (!data.monthlyUsers[m].includes(chatId)) data.monthlyUsers[m].push(chatId);

  saveData();
}

// ================= USER STATE =================
let USERS = {};
let ADMIN_BROADCAST = false;
// ================= /start + referral =================
bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  trackUser(chatId);

  const refParam = match?.[1];
  if (refParam?.startsWith("REF_")) {
    const inviterId = refParam.replace("REF_", "");
    if (inviterId && inviterId !== String(chatId)) {
      data.referrals[inviterId] = (data.referrals[inviterId] || 0) + 1;

      if (data.referrals[inviterId] % 5 === 0) {
        data.sureShotCredits[inviterId] =
          (data.sureShotCredits[inviterId] || 0) + 1;

        bot.sendMessage(inviterId,
`🎉 Referral Reward!
5 users invited ✅  
1 Sure-Shot Credit added 💎`).catch(() => {});
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
      [{ text: "🔗 My Referral Link", callback_data: "MY_REF" }]
    ]
  }
});
});

// ================= CALLBACK HANDLER =================
bot.on("callback_query", (query) => {
  if (!query.message) return;
  const chatId = query.message.chat.id;
  trackUser(chatId);

  // Always answer callback to avoid frozen buttons
  bot.answerCallbackQuery(query.id).catch(() => {});

  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (query.data === "START_PRED") {
    user.step = 1;
    return bot.sendMessage(chatId, "🔢 Send last 3 digits of previous period (e.g. 555)");
  }

  if (query.data === "MY_REF") {
    const count = data.referrals[chatId] || 0;
    const credits = data.sureShotCredits[chatId] || 0;
    const link = `https://t.me/${BOT_USERNAME}?start=REF_${chatId}`;

    return bot.sendMessage(chatId,
`👥 *Your Referral Dashboard*

🔗 Link:
${link}

📊 Invites: ${count}/5  
🎁 Sure-Shot Credits: ${credits}`,
{ parse_mode: "Markdown" });
  }

  if (user.step === 3 && (query.data === "BIG" || query.data === "SMALL")) {
    user.size = query.data;
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

  if (user.step === 4 && ["RED", "GREEN", "VIOLET"].includes(query.data)) {
    if (!user.period) {
      USERS[chatId] = { step: 0 };
      return bot.sendMessage(chatId, "❌ Session expired. Please /start again.");
    }

    bot.sendMessage(chatId, "🧠 AI Engine Processing...");

    setTimeout(() => {
      const next = parseInt(user.period, 10) + 1;
      const size = Math.random() > 0.5 ? "BIG 🔥" : "SMALL ❄️";
      const colors = ["RED 🔴", "GREEN 🟢", "VIOLET 🟣"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const conf = Math.floor(80 + Math.random() * 15);

      bot.sendMessage(chatId,
`💎 *AI Prediction*

🕒 Next Period: ${next}  
📈 Result: ${size}  
🎨 Color: ${color}  
📊 Confidence: ${conf}%  

⚠️ Play smart. Risk is yours.`,
{ parse_mode: "Markdown" });

      USERS[chatId] = { step: 0 };
    }, 900);
  }
});

// ================= USER MESSAGES =================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  trackUser(chatId);

  if (!msg.text) return;
  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (user.step === 1) {
    if (!/^\d{3}$/.test(msg.text))
      return bot.sendMessage(chatId, "❌ Enter exactly 3 digits (Example: 555)");
    user.period = msg.text;
    user.step = 2;
    return bot.sendMessage(chatId, "🎯 Enter number (0–9)");
  }

  if (user.step === 2) {
    if (!/^[0-9]$/.test(msg.text))
      return bot.sendMessage(chatId, "❌ Enter single digit (0–9)");
    user.number = msg.text; // stored for future logic
    user.step = 3;
    return bot.sendMessage(chatId, "⚖️ Choose Big or Small", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 BIG", callback_data: "BIG" }, { text: "❄️ SMALL", callback_data: "SMALL" }]
        ]
      }
    });
  }
});

// ================= ADMIN STATS =================
bot.onText(/\/stats/, (msg) => {
  if (msg.chat.id !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id,
`📊 BOT STATS

👥 Total Users: ${data.allUsers.length}  
📅 Today: ${data.dailyUsers[today()]?.length || 0}  
🗓 This Month: ${data.monthlyUsers[month()]?.length || 0}`);
});
// ================= ADMIN BROADCAST =================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  // Start broadcast mode
  if (msg.text === "/send" && chatId === ADMIN_ID) {
    ADMIN_BROADCAST = true;
    return bot.sendMessage(chatId, "📤 Broadcast ON\nSend any text/photo/video/voice\n/cancel to stop");
  }

  // Stop broadcast mode
  if (msg.text === "/cancel" && chatId === ADMIN_ID) {
    ADMIN_BROADCAST = false;
    return bot.sendMessage(chatId, "❌ Broadcast OFF");
  }

  // Send to all users
  if (ADMIN_BROADCAST && chatId === ADMIN_ID) {
    for (const userId of data.allUsers) {
      if (userId === ADMIN_ID) continue;

      try {
        if (msg.text && !msg.text.startsWith("/")) {
          await bot.sendMessage(userId, msg.text).catch(()=>{});
        } else if (msg.photo) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          await bot.sendPhoto(userId, fileId, { caption: msg.caption || "" }).catch(()=>{});
        } else if (msg.video) {
          await bot.sendVideo(userId, msg.video.file_id, { caption: msg.caption || "" }).catch(()=>{});
        } else if (msg.voice) {
          await bot.sendVoice(userId, msg.voice.file_id, { caption: msg.caption || "" }).catch(()=>{});
        }
      } catch {}
    }
    return bot.sendMessage(chatId, "✅ Broadcast sent to all users.");
  }
});
bot.onText(/\/stats/, (msg) => {
  if (msg.chat.id !== ADMIN_ID) return;

  bot.sendMessage(msg.chat.id,
`📊 BOT STATS

👥 Total Users: ${data.allUsers.length}
📅 Today Active: ${data.dailyUsers[today()]?.length || 0}
🗓 This Month: ${data.monthlyUsers[month()]?.length || 0}
`);
});