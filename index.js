// ================= SAFE ERROR HANDLING =================
process.on("uncaughtException", (err) => console.error("UNCAUGHT:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED:", err));

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const ADMIN_ID = 6076530076;
const BOT_USERNAME = "aicolortradingbot"; // without @

if (!TOKEN) {
  console.log("❌ ERROR: TOKEN not set in ENV");
  process.exit(1);
}

console.log("🤖 BOT STARTED:", BOT_USERNAME);

// ================= BOT =================
const bot = new TelegramBot(TOKEN, { polling: true });

// ================= SERVER (Render Health) =================
const app = express();
app.get("/", (req, res) => res.send("🤖 AI COLOR TRADING BOT LIVE"));
app.listen(process.env.PORT || 3000);

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
    console.log("⚠️ users.json corrupted, reset");
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

  USERS[chatId] = USERS[chatId] || { step: 0 };
  const user = USERS[chatId];

  if (query.data === "START_PRED") {
    user.step = 1;
    return bot.sendMessage(chatId, "🔢 Send last *3 digits* of previous period\nExample: `555`", { parse_mode: "Markdown" });
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
      return bot.sendMessage(chatId, "❌ Session expired. Please start again.");
    }

    bot.sendMessage(chatId, "🧠 AI Engine Processing...");

    setTimeout(() => {
      const next = parseInt(user.period) + 1;
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
    }, 1000);
  }

  bot.answerCallbackQuery(query.id).catch(() => {});
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
    user.number = msg.text; // store number
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