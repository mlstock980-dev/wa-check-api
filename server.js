import express from "express";
import cors from "cors";
import pkg from "@whiskeysockets/baileys";
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = pkg;
import P from "pino";
import fs from "fs";

// ===== GLOBAL ERROR HANDLER =====
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled:", err));

// ===== INIT =====
const app = express();
app.use(express.json());
app.use(cors());

if (!fs.existsSync("./session")) fs.mkdirSync("./session");

let sock;
let isReady = false;
let currentQR = null;

// ===== START WA =====
async function startWA() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: P({ level: "silent" }),
      browser: ["Railway", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        currentQR = qr;
        console.log("📱 QR READY");
      }

      if (connection === "open") {
        console.log("✅ WA CONNECTED");
        isReady = true;
      }

      if (connection === "close") {
        console.log("❌ WA DISCONNECTED");
        isReady = false;

        // AUTO RECONNECT
        setTimeout(() => {
          console.log("🔄 RECONNECTING...");
          startWA();
        }, 5000);
      }
    });

  } catch (err) {
    console.error("❌ WA ERROR:", err);
  }
}

// ===== INIT =====
startWA();

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("🔥 WA CHECK API RUNNING");
});

// ===== STATUS =====
app.get("/status", (req, res) => {
  res.json({
    ready: isReady,
    qr: !!currentQR
  });
});

// ===== QR WEB =====
app.get("/qr", (req, res) => {
  if (!currentQR) {
    return res.send("❌ QR belum tersedia, tunggu...");
  }

  res.send(`
    <h2>Scan QR WhatsApp</h2>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${currentQR}" />
  `);
});

// ===== PAIRING CODE =====
app.get("/pair", async (req, res) => {
  try {
    if (!sock) return res.json({ error: "WA belum siap" });

    if (sock.authState.creds.registered) {
      return res.json({ status: "connected" });
    }

    // 🔥 GANTI NOMOR LU DISINI (WAJIB FORMAT 62)
    const number = "6287710303740";

    await new Promise(r => setTimeout(r, 3000));

    const code = await sock.requestPairingCode(number);

    res.json({
      status: "success",
      code
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===== CHECK NOMOR =====
app.post("/check", async (req, res) => {
  try {
    let { number } = req.body;

    if (!number) return res.json({ error: "Nomor kosong" });

    number = number.replace(/\D/g, "");
    if (number.startsWith("0")) number = "62" + number.slice(1);

    if (!isReady) {
      return res.json({ error: "WA belum connect" });
    }

    const r = await sock.onWhatsApp(number);

    res.json({
      number,
      exists: r?.length > 0
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 API jalan di " + PORT));
