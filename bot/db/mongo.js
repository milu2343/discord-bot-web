const { MongoClient } = require("mongodb");

let client;
let db;

let optionsCollection;
let templateCollection;

async function connectMongo(uri) {
  if (db) return db; // ⬅️ WICHTIG: nur einmal verbinden

  client = new MongoClient(uri);
  await client.connect();

  db = client.db("discordBotDB");

  optionsCollection = db.collection("options");
  templateCollection = db.collection("template");

  // defaults
  await optionsCollection.updateOne(
    { _id: "default" },
    {
      $setOnInsert: {
        amounts: ["1K", "5K", "10K", "20K", "50K"],
        reasons: ["Event", "Support", "Sonstiges"]
      }
    },
    { upsert: true }
  );

  await templateCollection.updateOne(
    { _id: "current" },
    { $setOnInsert: { title: "—", dateTime: "—", participants: [] } },
    { upsert: true }
  );

  console.log("✅ MongoDB verbunden");
  return db;
}

function getOptionsCollection() {
  if (!optionsCollection) throw new Error("OptionsCollection not initialized");
  return optionsCollection;
}

function getTemplate() {
  if (!templateCollection) throw new Error("TemplateCollection not initialized");
  return templateCollection;
}

module.exports = {
  connectMongo,
  getOptionsCollection,
  getTemplate
};
