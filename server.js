import express from "express";
import cors from "cors";
import pkg from "@whiskeysockets/baileys";
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = pkg;
import P from "pino";
import fs from "fs";

// ===== ERROR HANDLER (ANTI CRASH) =====
process.on("uncaughtException", (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled:", err));

// ===== FORCE RESET SESSION (BIAR QR MUNCUL) =====
if (fs.existsSync("./session")) {
  fs.rmSync("./session", { recursive: true, force: true });
}
fs.mkdirSync("./session");

// ===== EXPRESS =====
const app = express();
app.use(express.json());
app.use(cors());

let sock;
let currentQR = null;

// ===== START WHATSAPP =====
async function startWA() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: P({ level: "silent" }),
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      console.log("UPDATE:", update); // 🔥 DEBUG

      const { connection, qr } = update;

      if (qr) {
        currentQR = qr;
        console.log("📲 QR READY");
      }

      if (connection === "open") {
        console.log("✅ WA CONNECTED");
        currentQR = null;
      }

      if (connection === "close") {
        console.log("❌ WA DISCONNECTED");
      }
    });

    console.log("🚀 WA starting...");
  } catch (err) {
    console.error("❌ WA ERROR:", err);
  }
}

// 🚀 JANGAN BLOCK SERVER
startWA();

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("🔥 WA CHECK API RUNNING");
});

// ===== QR ENDPOINT =====
app.get("/qr", (req, res) => {
  if (!currentQR) {
    return res.json({
      status: "waiting",
      message: "QR belum tersedia / sudah connect"
    });
  }

  res.json({
    status: "success",
    qr: currentQR
  });
});

// ===== CHECK NOMOR =====
app.post("/check", async (req, res) => {
  try {
    let { number } = req.body;

    if (!number) {
      return res.json({ error: "Nomor kosong" });
    }

    number = number.replace(/\D/g, "");
    if (number.startsWith("0")) number = "62" + number.slice(1);

    if (!sock) {
      return res.json({ error: "WA belum siap" });
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

// ===== PORT RAILWAY =====
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 API jalan di", PORT);
});
