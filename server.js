// Import Fastify
const fastify = require("fastify")({ logger: true });
const formbody = require("@fastify/formbody");
fastify.register(formbody);

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const moment = require("moment-timezone");
moment.tz.setDefault("Asia/Jakarta").locale("id");

const store = makeInMemoryStore({
  logger: pino().child({ level: "silent", stream: "store" }),
});

const storeFilePath = "./baileys_store.json";

store?.readFromFile(storeFilePath);

setInterval(() => {
  store.writeToFile(storeFilePath);
}, 15_000);

const getRandom = () => {
  return `${Math.floor(Math.random() * 10000)}`;
};

const start = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./piyobot`);
    __path = process.cwd();

    const conn = makeWASocket({
      logger: pino({ level: "silent" }),
      printQRInTerminal: true,
      auth: state,
      qrTimeout: 30_000,
      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return {
          conversation: "hello",
        };
      },
      printQRInTerminal: true,
    });

    conn.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
          ? start()
          : console.log("Koneksi Terputus...");
      } else if (connection === "connecting") {
        console.log("Menghubungkan...");
      } else if (connection === "open") {
        console.log("Terhubung...");
      }
    });

    conn.ev.on("creds.update", saveCreds);

    store.bind(conn.ev);

    return conn;
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

async function startApi() {
  const conn = await start();

  fastify.get("/", async (request, reply) => {
    reply.send({ hello: "world" });
  });

  fastify.post("/send-message", async (request, reply) => {
    const { to, text } = request.body;
    let numberReplace = to.replace(/\D/g, "");
    if (numberReplace.startsWith("08")) {
      numberReplace = "628" + numberReplace.slice(2);
    } else if (numberReplace.startsWith("8")) {
      numberReplace = "628" + numberReplace.slice(1);
    }
    const message = await conn.sendMessage(numberReplace + "@s.whatsapp.net", {
      text: text,
    });
    reply.send(message);
  });

  await fastify.listen({ port: 3000 });
  console.log("Server running at http://localhost:3000");
}

startApi();
