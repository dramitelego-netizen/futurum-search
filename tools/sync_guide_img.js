#!/usr/bin/env node
/**
 * Копирует картинки гида из data/wiki_img → data/guide_img.
 * Полный wiki_img в git/Pages не кладём; guide_img — постоянный набор значков.
 *
 * Usage: node tools/sync_guide_img.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const wikiPath = path.join(ROOT, "data", "wiki_items.json");
const srcDir = path.join(ROOT, "data", "wiki_img");
const destDir = path.join(ROOT, "data", "guide_img");
const MAX = 8 * 1024 * 1024; // защита от случайных гигантов

const wiki = JSON.parse(fs.readFileSync(wikiPath, "utf8"));
fs.mkdirSync(destDir, { recursive: true });

const seen = new Set();
let copied = 0;
let skipped = 0;
let missing = 0;
let bytes = 0;

for (const it of wiki.items || []) {
  const img = String(it.image || "").replace(/^\.\//, "");
  if (!/^data\/wiki_img\//i.test(img)) continue;
  const base = path.basename(img);
  if (!base || seen.has(base)) continue;
  seen.add(base);
  const src = path.join(ROOT, img);
  if (!fs.existsSync(src)) {
    missing++;
    continue;
  }
  const sz = fs.statSync(src).size;
  if (sz > MAX) {
    skipped++;
    continue;
  }
  const dest = path.join(destDir, base);
  fs.copyFileSync(src, dest);
  copied++;
  bytes += sz;
}

console.log(
  JSON.stringify(
    {
      copied,
      mb: +(bytes / 1024 / 1024).toFixed(1),
      skipped,
      missing,
      dest: "data/guide_img",
    },
    null,
    2
  )
);
if (missing) process.exitCode = 1;
