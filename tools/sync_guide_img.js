#!/usr/bin/env node
/**
 * Синхронизирует значки (и лёгкие look ≤ maxBytes) из data/wiki_img → data/guide_img.
 * Тяжёлые wiki-look'и на Pages не кладём — в списке показывается значок.
 *
 * Usage: node tools/sync_guide_img.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const wikiPath = path.join(ROOT, "data", "wiki_items.json");
const srcDir = path.join(ROOT, "data", "wiki_img");
const destDir = path.join(ROOT, "data", "guide_img");
const MAX = 500 * 1024;

const wiki = JSON.parse(fs.readFileSync(wikiPath, "utf8"));
fs.mkdirSync(destDir, { recursive: true });

const need = new Map(); // base -> src path
function consider(p) {
  const img = String(p || "").replace(/^\.\//, "");
  if (!/^data\/wiki_img\//i.test(img)) return;
  const src = path.join(ROOT, img);
  if (!fs.existsSync(src)) return;
  const sz = fs.statSync(src).size;
  if (sz > MAX) return;
  const base = path.basename(img);
  if (!base) return;
  need.set(base, src);
}

for (const it of wiki.items || []) {
  consider(it.image);
  consider(it.lookImage);
  for (const v of it.lookVariants || []) {
    consider(v.image);
    consider(v.lookImage);
  }
}

let copied = 0;
let bytes = 0;
for (const [base, src] of need) {
  const dest = path.join(destDir, base);
  fs.copyFileSync(src, dest);
  copied++;
  bytes += fs.statSync(dest).size;
}

// убрать из guide_img лишнее (тяжёлые/устаревшие)
let removed = 0;
for (const f of fs.readdirSync(destDir)) {
  if (!need.has(f)) {
    fs.unlinkSync(path.join(destDir, f));
    removed++;
  }
}

console.log(
  JSON.stringify(
    {
      kept: copied,
      mb: +(bytes / 1024 / 1024).toFixed(1),
      removed,
      maxKb: MAX / 1024,
      dest: "data/guide_img",
    },
    null,
    2
  )
);
