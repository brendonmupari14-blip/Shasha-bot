const express = require("express");
const bodyParser = require("body-parser");
const MessagingResponse = require("twilio").twiml.MessagingResponse;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Shasha bot is running");
});

app.post("/", (req, res) => {
  const msg = req.body.Body ? req.body.Body.toLowerCase() : "";
  const twiml = new MessagingResponse();

  if (msg.includes("math")) {
    twiml.message("📘 2 + 2 = 4\nWhat is 3 + 3?");
  } else if (msg === "6") {
    twiml.message("✅ Correct!");
  } else {
    twiml.message("Type 'Math' to start");
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
