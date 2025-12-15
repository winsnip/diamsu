require("dotenv").config();
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { ethers } = require("ethers");

// ======================= COLORS ========================
const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
};

// ======================= LOGO (ANIMATED) =================
const LOGO_LINES = [
  "██     ██ ██ ███    ██ ███████ ███    ██ ██ ██████  ",
  "██     ██ ██ ████   ██ ██      ████   ██ ██ ██   ██ ",
  "██  █  ██ ██ ██ ██  ██ ███████ ██ ██  ██ ██ ██████  ",
  "██ ███ ██ ██ ██  ██ ██      ██ ██  ██ ██ ██ ██      ",
  " ███ ███  ██ ██   ████ ███████ ██   ████ ██ ██      ",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function printLogo() {
  console.clear();

  for (const line of LOGO_LINES) {
    for (const ch of line) {
      process.stdout.write(colors.cyan(ch));
      await sleep(4); // speed typewriter
    }
    process.stdout.write("\n");
  }

  console.log(
    colors.yellow("\nJoin our Telegram channel: https://t.me/winsnip\n")
  );

  const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  const start = Date.now();
  let i = 0;

  while (Date.now() - start < 1200) {
    process.stdout.write(
      `\r${colors.yellow(frames[i % frames.length])} ${colors.yellow("Starting bot")}`
    );
    await sleep(90);
    i++;
  }

  process.stdout.write("\r");
  console.log(colors.green("✔ Ready\n"));
}

// ========================= ENV =========================
const API_BASE = process.env.API_BASE;
const CONNECT_BASE = process.env.CONNECT_BASE;

let ACCESS_TOKEN = process.env.ACCESS_TOKEN || "key";
let COOKIE = process.env.COOKIE || "";
let USER_ID = process.env.USER_ID || "";

const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();
let ADDRESS = (process.env.ADDRESS || "").trim();

const AMOUNT = Number(process.env.AMOUNT || "0.0001");
const MIN_BALANCE = Number(process.env.MIN_BALANCE || "0.001");
const CHECK_INTERVAL_SECONDS = Number(process.env.CHECK_INTERVAL_SECONDS || "10");

const TARGET_FILE = process.env.TARGET_FILE || "targets.txt";
const LOG_FILE = process.env.LOG_FILE || "tx_log.jsonl";
const PERSIST_COOKIE =
  (process.env.PERSIST_COOKIE || "false").toLowerCase() === "true";

// Random delay
const MIN_DELAY = Number(process.env.MIN_DELAY || "2");
const MAX_DELAY = Number(process.env.MAX_DELAY || "6");

// Device info
const DEVICE_ID = process.env.DEVICE_ID || "BOT01";
const DEVICE_SOURCE = process.env.DEVICE_SOURCE || "bot_script";
const DEVICE_TYPE = process.env.DEVICE_TYPE || "Linux";
const BROWSER = process.env.BROWSER || "Chrome";
const IP_ADDRESS = process.env.IP_ADDRESS || "0.0.0.0";
const LATITUDE = Number(process.env.LATITUDE || "12.9715987");
const LONGITUDE = Number(process.env.LONGITUDE || "77.5945627");

const CITY = process.env.CITY || "Unknown";
const COUNTRY = process.env.COUNTRY || "Unknown";
const CONTINENT = process.env.CONTINENT || "Unknown";
const CONTINENT_CODE = process.env.CONTINENT_CODE || "Unknown";
const COUNTRY_CODE = process.env.COUNTRY_CODE || "Unknown";
const REGION = process.env.REGION || "Unknown";
const REGION_CODE = process.env.REGION_CODE || "Unknown";

// =================== LOGGING FUNCTION ===================
async function logLine(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  await fs.appendFile(LOG_FILE, line + "\n");
}

// =================== BUILD AXIOS CLIENT ==================
function buildAxios(cookie) {
  const headers = {
    "Content-Type": "application/json",
    "access-token": ACCESS_TOKEN,
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    accept: "application/json, text/plain, */*",
    origin: "https://campaign.diamante.io",
    referer: "https://campaign.diamante.io/",
    "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    "sec-gpc": "1",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  if (cookie) headers["cookie"] = cookie;

  return axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers,
    withCredentials: true,
    validateStatus: () => true,
  });
}

let axiosInstance = buildAxios(COOKIE);

// ====================== RETRY ============================
async function retry(fn, tries = 4, delay = 400) {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
}

// ================= LOAD TARGETS ==========================
async function loadTargets() {
  try {
    const raw = await fs.readFile(TARGET_FILE, "utf8");
    return raw.split("\n").map((x) => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// =============== RANDOM DELAY ============================
async function randomDelay() {
  const delay =
    (Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY) * 1000;
  console.log(colors.yellow(`⏳ Delay: ${(delay / 1000).toFixed(2)}s\n`));
  await sleep(delay);
}

// ===================== CONNECT WALLET =====================
async function connectWallet() {
  if (!ADDRESS) {
    if (PRIVATE_KEY) {
      const w = new ethers.Wallet(PRIVATE_KEY);
      ADDRESS = await w.getAddress();
    } else {
      console.log(colors.red("❌ ADDRESS or PRIVATE_KEY must be set in .env"));
      return false;
    }
  }

  const payload = {
    address: ADDRESS,
    browser: BROWSER,
    city: CITY,
    continent: CONTINENT,
    continentCode: CONTINENT_CODE,
    country: COUNTRY,
    countryCode: COUNTRY_CODE,
    deviceId: DEVICE_ID,
    deviceSource: DEVICE_SOURCE,
    deviceType: DEVICE_TYPE,
    ipAddress: IP_ADDRESS,
    latitude: LATITUDE,
    longitude: LONGITUDE,
    region: REGION,
    regionCode: REGION_CODE,
  };

  const c = axios.create({
    baseURL: CONNECT_BASE,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      "access-token": ACCESS_TOKEN,
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      origin: "https://campaign.diamante.io",
      referer: "https://campaign.diamante.io/",
    },
    validateStatus: () => true,
  });

  const resp = await c.post("/connect-wallet", payload);

  const sc = resp.headers["set-cookie"];
  if (sc) {
    const tokenLine = sc.find((x) => x.includes("access_token="));
    if (tokenLine) {
      COOKIE = tokenLine.split(";")[0];
      axiosInstance = buildAxios(COOKIE);
    }
  }

  if (resp.data?.data?.userId) USER_ID = resp.data.data.userId;

  if (!COOKIE || !USER_ID) {
    console.log(colors.red("❌ connect-wallet failed"));
    return false;
  }

  console.log(colors.green(`✅ connect-wallet OK — USER_ID: ${USER_ID}`));
  return true;
}

// ====================== VALIDATE =========================
async function validateCookie() {
  if (!COOKIE || !USER_ID) return false;
  const r = await axiosInstance.get(`/get-balance/${USER_ID}`);
  return r.data?.success === true;
}

// ================== GET BALANCE ==========================
async function getBalance() {
  const r = await axiosInstance.get(`/get-balance/${USER_ID}`);
  if (!r.data?.success) throw new Error("get-balance failed");
  return r.data.data.balance;
}

// ================== SEND TRANSFER ========================
async function sendTransfer(to, amount) {
  const r = await axiosInstance.post("/transfer", {
    toAddress: to,
    amount,
    userId: USER_ID,
  });
  if (!r.data?.success) throw new Error("transfer failed");
  return r.data.data.transferData;
}

// ===================== MAIN LOOP =========================
let index = 0;
let running = false;

async function mainLoop() {
  if (running) return;
  running = true;

  try {
    if (!(await validateCookie())) {
      console.log(colors.red("🔄 Session expired — reconnecting..."));
      if (!(await connectWallet())) return;
    }

    const targets = await loadTargets();
    if (!targets.length) {
      console.log(colors.red("⚠ targets.txt kosong"));
      return;
    }

    if (index >= targets.length) {
      console.log(colors.cyan("🎯 Target completed — restart\n"));
      index = 0;
    }

    const to = targets[index];
    const balance = await getBalance();

    console.log(colors.green(`💰 Balance: ${balance}`));

    if (balance < MIN_BALANCE) {
      console.log(colors.red("❌ Balance too low"));
      return;
    }

    console.log(colors.cyan(`➡️ Sending ${AMOUNT} → ${to}`));
    const tx = await sendTransfer(to, AMOUNT);

    console.log(
      colors.green(
        `✅ TX confirmed | hash: ${tx.hash.slice(0, 14)}...`
      )
    );

    await logLine({ to, amount: AMOUNT, tx });
    index++;

    await randomDelay();
  } catch (e) {
    console.error(colors.red(`❌ Error: ${e.message}`));
  } finally {
    running = false;
  }
}

// ====================== BOOT ============================
(async () => {
  await printLogo(); // animated logo, logic unchanged
  console.log(colors.cyan("🚀 Bot starting...\n"));
  await connectWallet();
  mainLoop();
  setInterval(mainLoop, CHECK_INTERVAL_SECONDS * 1000);
})();
