require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const MessagingResponse = require("twilio").twiml.MessagingResponse;
const { createClient } = require("@supabase/supabase-js");
const Tesseract = require("tesseract.js");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;

/* =========================
   🔐 SAFE SUPABASE SETUP
========================= */
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://your-project.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_KEY || "your-service-role-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================
   👤 SESSION MEMORY
========================= */
const users = {};

/* =========================
   💳 ECOCASH NUMBER
========================= */
const ECOCASH_NUMBER = "+263774524650";

/* =========================
   🔐 SUBSCRIPTION
========================= */
async function getSubscription(id) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .single();

  return data;
}

function isSubscribed(sub) {
  return sub && sub.status === "active";
}

/* =========================
   🧠 AI TUTOR
========================= */
function aiTutor(q) {
  return (
    "🧠 AI Tutor\n\n" +
    "Question: " + q + "\n\n" +
    "Steps:\n" +
    "1. Understand the problem\n" +
    "2. Identify numbers\n" +
    "3. Solve step-by-step\n" +
    "4. Check your answer\n\n" +
    "Try solving it now!"
  );
}

/* =========================
   📊 ADAPTIVE ENGINE
========================= */
function getLevel(history = []) {
  if (history.length < 5) return "normal";

  const correct = history.filter(h => h === true).length;
  const acc = (correct / history.length) * 100;

  if (acc >= 80) return "advanced";
  if (acc >= 50) return "normal";
  return "support";
}

/* =========================
   📸 OCR PAYMENT CHECK
========================= */
async function verifyPayment(url) {
  const result = await Tesseract.recognize(url, "eng");

  const text = result.data.text.toLowerCase();
  const confidence = result.data.confidence;

  const valid =
    text.includes("ecocash") ||
    text.includes("paid") ||
    text.includes("transfer");

  return {
    text,
    confidence,
    valid
  };
}

/* =========================
   🔓 ACTIVATE SUBSCRIPTION
========================= */
async function activateUser(id) {
  await supabase.from("subscriptions").upsert([
    {
      id,
      plan: "basic",
      status: "active",
      created_at: new Date()
    }
  ]);
}

/* =========================
   👤 INIT USER
========================= */
function initUser(id) {
  if (!users[id]) {
    users[id] = {
      step: "menu",
      grade: null,
      history: []
    };
  }
  return users[id];
}

/* =========================
   🚀 MAIN BOT LOGIC
========================= */
app.post("/", async (req, res) => {

  const msg = req.body.Body?.toLowerCase();
  const from = req.body.From;
  const numMedia = req.body.NumMedia;
  const mediaUrl = req.body.MediaUrl0;

  const twiml = new MessagingResponse();
  const user = initUser(from);

  /* 📸 PAYMENT SCREENSHOT */
  if (numMedia && parseInt(numMedia) > 0) {

    const result = await verifyPayment(mediaUrl);

    if (result.valid && result.confidence > 50) {
      await activateUser(from);
      return res.send(
        twiml.message("✅ Payment verified. Subscription active!").toString()
      );
    }

    return res.send(
      twiml.message("⏳ Payment unclear. Will be reviewed.").toString()
    );
  }

  /* 💳 PAYMENT OPTION */
  if (msg === "pay") {
    return res.send(
      twiml.message(
        "💳 Pay via EcoCash:\n" +
        ECOCASH_NUMBER +
        "\n\nSend screenshot after payment."
      ).toString()
    );
  }

  /* 🔐 MENU */
  if (msg === "menu") {

    const sub = await getSubscription(from);

    if (!isSubscribed(sub)) {
      return res.send(
        twiml.message("🔒 Please subscribe first. Type PAY").toString()
      );
    }

    user.step = "grade";

    return res.send(
      twiml.message("📘 Choose Grade (3–7)").toString()
    );
  }

  /* 🎓 GRADE */
  if (user.step === "grade") {
    user.grade = msg;
    user.step = "lesson";

    return res.send(
      twiml.message("📚 Lesson started for " + msg).toString()
    );
  }

  /* 🧠 AI HELP */
  if (msg.startsWith("explain")) {
    return res.send(
      twiml.message(aiTutor(msg.replace("explain", ""))).toString()
    );
  }

  return res.send(
    twiml.message("Type MENU to begin").toString()
  );
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(PORT, () => {
  console.log("🚀 MASTER LMS RUNNING");
});
