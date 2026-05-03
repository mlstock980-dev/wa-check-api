import express from "express";
import cors from "cors";
import baileys from "@whiskeysockets/baileys";
import P from "pino";
import fs from "fs";

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = baileys;

// ===== PROTEKSI ERROR GLOBAL =====
process.on("uncaughtException", (err) => {
  console.error("Uncaught:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled:", err);
});

// ===== BUAT FOLDER SESSION =====
if (!fs.existsSync("./session")) {
  fs.mkdirSync("./session");
}

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let latestQR = null;

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
      const { connection, qr } = update;

      if (qr) {
        latestQR = qr;
        console.log("📱 QR updated");
      }

      if (connection === "open") {
        console.log("✅ WA Connected");
      }

      if (connection === "close") {
        console.log("❌ WA Disconnected");
      }
    });

    console.log("🚀 WA starting...");
  } catch (err) {
    console.error("❌ WA gagal start:", err);
  }
}

// ===== INIT =====
async function init() {
  try {
    await startWA();
  } catch (err) {
    console.error("Init error:", err);
  }
}

init();

// ===== API CHECK NOMOR =====
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

// ===== API QR =====
app.get("/qr", (req, res) => {
  if (!latestQR) {
    return res.json({ status: "waiting", message: "QR belum ready" });
  }

  res.json({
    status: "success",
    qr: latestQR
  });
});

// ===== SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 API jalan di " + PORT));
