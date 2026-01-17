require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { Client, GatewayIntentBits, Events } = require("discord.js");

const setupInteractions = require("./bot/interactions");
const { connectMongo, getOptionsCollection, getTemplate } = require("./db/mongo");

// ================== DISCORD CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================== EXPRESS / SOCKET ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== DASHBOARD STATIC ==================
app.use("/dashboard", express.static(__dirname + "/dashboard"));

// ================== API ==================

// ---- Options (Amounts / Reasons)
app.get("/api/options", async (req, res) => {
  try {
    const data = await getOptionsCollection().findOne({ _id: "default" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Options error");
  }
});

app.post("/api/options", async (req, res) => {
  try {
    const { amounts, reasons } = req.body;

    await getOptionsCollection().updateOne(
      { _id: "default" },
      { $set: { amounts, reasons } }
    );

    io.emit("optionsUpdate", { amounts, reasons });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Options update error");
  }
});

// ---- Template (Live Preview)
app.get("/api/template", async (req, res) => {
  try {
    const data = await getTemplate().findOne({ _id: "current" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Template error");
  }
});

// ================== SOCKET.IO ==================
let dashboardConnected = false;

io.on("connection", socket => {
  if (!dashboardConnected) {
    console.log("🌐 Dashboard verbunden");
    dashboardConnected = true;
  }

  // Disconnects (Reloads) bewusst ignorieren
  socket.on("disconnect", () => {
    // kein Log → Reloads sind normal
  });
});


// ================== DISCORD READY ==================
client.once(Events.ClientReady, () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
});

// ================== START ==================
(async () => {
  try {
    // 🔑 EINMAL Mongo verbinden
    await connectMongo(process.env.MONGO_URI);

    // 🔑 Interactions initialisieren
    setupInteractions(client, io);

    // 🔑 Discord Login
    await client.login(process.env.TOKEN);

    // 🔑 Webserver
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () =>
      console.log(`🌍 Server läuft auf Port ${PORT}`)
    );

  } catch (err) {
    console.error("❌ Startup Fehler:", err);
    process.exit(1);
  }
})();
