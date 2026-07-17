// 目でページを見て数字を拾うのと同じことを機械的にやるだけのスクリプト。
// AIの推測は一切使わない：HTMLをテキストとして取得し、正規表現で話数っぽい数字を全部拾って最大値を採用する。

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/manga.json");

function extractChapterNumbers(html) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*話/g, // 例：193話
    /chapter\s*(\d+(?:\.\d+)?)/gi, // 例：Chapter 193
    /ch\.?\s*(\d+(?:\.\d+)?)/gi, // 例：Ch.193
  ];
  const numbers = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const n = parseFloat(m[1]);
      if (!isNaN(n)) numbers.push(n);
    }
  }
  return numbers;
}

async function checkOne(item) {
  if (!item.url) {
    return { ...item, lastCheckError: "URL未設定", lastCheckedAt: Date.now() };
  }
  try {
    const res = await fetch(item.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MangaTrackerBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const numbers = extractChapterNumbers(html);
    if (numbers.length === 0) {
      return { ...item, lastCheckError: "話数を検出できず", lastCheckedAt: Date.now() };
    }
    const latest = Math.max(...numbers);
    return {
      ...item,
      latestChapter: String(latest),
      lastCheckedAt: Date.now(),
      lastCheckError: null,
    };
  } catch (e) {
    return { ...item, lastCheckError: e.message, lastCheckedAt: Date.now() };
  }
}

async function main() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const list = JSON.parse(raw);
  const results = [];
  for (const item of list) {
    const updated = await checkOne(item);
    results.push(updated);
    console.log(
      `${updated.title}: latest=${updated.latestChapter ?? "N/A"}${
        updated.lastCheckError ? " ⚠ " + updated.lastCheckError : ""
      }`
    );
    await new Promise((r) => setTimeout(r, 500)); // サイトへの負荷軽減
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(results, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
