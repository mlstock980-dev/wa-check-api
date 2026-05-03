import express from "express";
import cors from "cors";
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import P from "pino";
import fs from "fs";

// ===== RESET SESSION BIAR QR MUNCUL =====
fs.rmSync("./session", { recursive: true, force: true });
fs.mkdirSync("./session");

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let currentQR = null; // 🔥 simpan QR disini

// ===== START WA =====
async function startWA() {
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
    const { connection, qr } = update;

    // 🔥 SIMPAN QR
    if (qr) {
      currentQR = qr;
      console.log("📲 QR TERBARU SIAP");
    }

    if (connection === "open") {
      console.log("✅ WA CONNECTED");
      currentQR = null; // hapus QR kalau sudah connect
    }

    if (connection === "close") {
      console.log("❌ WA DISCONNECTED");
    }
  });
}

startWA();

// ===== ENDPOINT QR =====
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

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("🔥 WA CHECK API RUNNING");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 API jalan di " + PORT));
