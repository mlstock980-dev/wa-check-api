import crypto from "crypto";
global.crypto = crypto.webcrypto;

import express from "express";
import cors from "cors";
import pkg from "@whiskeysockets/baileys";
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = pkg;
import P from "pino";
import fs from "fs";

// ===== ANTI CRASH =====
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ===== SESSION =====
if (!fs.existsSync("./session")) fs.mkdirSync("./session");

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let pairingCode = null;

// ===== START WA =====
async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("✅ WA CONNECTED");
      pairingCode = null;
    }

    if (connection === "close") {
      console.log("❌ WA DISCONNECTED");
    }
  });

  console.log("🚀 WA READY");
}

startWA();

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("🔥 WA CHECK API RUNNING");
});

// ===== PAIR ENDPOINT (AMAN) =====
app.get("/pair", async (req, res) => {
  try {
    if (!sock) {
      return res.json({ error: "WA belum siap" });
    }

    if (sock.authState.creds.registered) {
      return res.json({ status: "connected" });
    }

    // 🔥 generate pairing code
    await new Promise(r => setTimeout(r, 2000));
    const raw = await sock.requestPairingCode("6287710303740");

    // ✅ format jadi XXXX-XXXX
    const code = raw.match(/.{1,4}/g).join("-");

    pairingCode = code;

    res.json({
      status: "success",
      code
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===== CHECK =====
app.post("/check", async (req, res) => {
  try {
    let { number } = req.body;

    number = number.replace(/\D/g, "");
    if (number.startsWith("0")) number = "62" + number.slice(1);

    if (!sock) return res.json({ error: "WA belum siap" });

    const r = await sock.onWhatsApp(number);

    res.json({
      number,
      exists: r?.length > 0
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// ===== PORT =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 API jalan di", PORT);
});
