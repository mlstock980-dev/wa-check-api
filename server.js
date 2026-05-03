import express from "express";
import cors from "cors";
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import P from "pino";

const app = express();
app.use(express.json());
app.use(cors());

let sock;

// ⛔ JANGAN auto start langsung
async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);
}

// ✅ start WA saat server jalan
async function init() {
  await startWA();
}

init();

app.post("/check", async (req, res) => {
  try {
    let { number } = req.body;

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API jalan di " + PORT));
