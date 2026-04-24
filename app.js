const express = require("express");
const bodyParser = require("body-parser");
const MessagingResponse = require("twilio").twiml.MessagingResponse;
const { createClient } = require("@supabase/supabase-js");
const Tesseract = require("tesseract.js");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;

/* =========================
   🧠 SUPABASE INIT
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   👤 SESSION MEMORY
========================= */
const users = {};

/* =========================
   💳 ECOCASH CONFIG
========================= */
const ECOCASH_NUMBER = "+263774524650";

/* =========================
   🔐 SUBSCRIPTION CHECK
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
   🧠 AI TUTOR ENGINE
========================= */
function aiTutor(q, a, grade = "grade3") {

  const steps = [
    "1️⃣ Understand question",
    "2️⃣ Identify known values",
    "3️⃣ Choose method",
    "4️⃣ Solve step-by-step",
    "5️⃣ Verify answer"
  ];

  return (
    "🧠 AI TUTOR\n\n" +
    "Q: " + q + "\n" +
    "A: " + a + "\n\n" +
    "Grade: " + grade + "\n\n" +
    steps.join("\n")
  );
}

/* =========================
   📊 ADAPTIVE LEARNING ENGINE
========================= */
function learnerLevel(history = []) {

  const last = history.slice(-10);
  if (!last.length) return "normal";

  const correct = last.filter(x => x.result === "PASS").length;
  const acc = (correct / last.length) * 100;

  if (acc >= 85) return "advanced";
  if (acc >= 60) return "normal";
  return "support";
}

/* =========================
   🧾 OCR ENGINE (TWILIO IMAGE)
========================= */
async function verifyScreenshot(url) {

  const result = await Tesseract.recognize(url, "eng");

  const text = result.data.text.toLowerCase();
  const confidence = result.data.confidence || 0;

  const hasKeywords =
    text.includes("ecocash") ||
    text.includes("paid") ||
    text.includes("cash");

  const amount = text.match(/\d+/g);

  return {
    text,
    confidence,
    hasKeywords,
    amount: amount ? amount[0] : null
  };
}

/* =========================
   🧨 FRAUD ENGINE
========================= */
function fraudScore(d) {
  let s = 0;

  if (d.confidence < 60) s += 40;
  if (!d.hasKeywords) s += 35;
  if (!d.amount) s += 25;

  return s;
}

function fraudDecision(s) {
  if (s >= 70) return "reject";
  if (s >= 40) return "manual";
  return "approve";
}

/* =========================
   🔓 ACTIVATE USER
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
      history: [],
      level: "normal"
    };
  }
  return users[id];
}

/* =========================
   🚀 MAIN BOT
========================= */
app.post("/", async (req, res) => {

  const msg = req.body.Body?.toLowerCase();
  const from = req.body.From;
  const numMedia = req.body.NumMedia;
  const mediaUrl = req.body.MediaUrl0;

  const twiml = new MessagingResponse();
  const u = initUser(from);

  /* =========================
     📸 OCR PAYMENT FLOW
  ========================= */
  if (numMedia && parseInt(numMedia) > 0) {

    const ocr = await verifyScreenshot(mediaUrl);

    const score = fraudScore(ocr);
    const decision = fraudDecision(score);

    if (decision === "approve") {
      await activateUser(from);
      return res.send(
        twiml.message("✅ Payment verified & subscription active").toString()
      );
    }

    if (decision === "manual") {
      await supabase.from("payments").insert([{
        user_id: from,
        amount: ocr.amount,
        status: "manual_review",
        text: ocr.text
      }]);

      return res.send(
        twiml.message("⏳ Payment under review").toString()
      );
    }

    return res.send(
      twiml.message("🚫 Payment rejected").toString()
    );
  }

  /* =========================
     💳 PAYMENT ENTRY
  ========================= */
  if (msg === "pay") {
    return res.send(
      twiml.message(
        "💳 ECOCASH\nSend to:\n" +
        ECOCASH_NUMBER +
        "\n\nThen send screenshot"
      ).toString()
    );
  }

  /* =========================
     🔐 ACCESS CONTROL
  ========================= */
  if (msg === "menu") {

    const sub = await getSubscription(from);

    if (!isSubscribed(sub)) {
      return res.send(
        twiml.message("🔒 Subscribe first. Type pay").toString()
      );
    }

    u.step = "grade";
    return res.send(
      twiml.message("Choose Grade 3–7").toString()
    );
  }

  /* =========================
     🎓 GRADE SELECTION
  ========================= */
  if (u.step === "grade") {
    u.grade = msg;
    u.step = "lesson";

    return res.send(
      twiml.message("📘 Learning started").toString()
    );
  }

  /* =========================
     🧠 AI EXPLANATION MODE
  ========================= */
  if (msg.startsWith("explain")) {

    const q = msg.replace("explain", "");

    return res.send(
      twiml.message(aiTutor(q, "step-by-step solution", u.grade)).toString()
    );
  }

  return res.send(
    twiml.message("Type menu").toString()
  );
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(PORT, () => {
  console.log("🚀 MASTER LMS RUNNING");
});
