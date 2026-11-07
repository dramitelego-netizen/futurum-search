#!/usr/bin/env node
/**
 * Обёртка: собирает data/guide_img из data/wiki_img (со сжатием крупных look).
 * Все картинки гида хранятся локально — parapa не нужен.
 *
 * Usage: node tools/sync_guide_img.js
 */
const { spawnSync } = require("child_process");
const path = require("path");

const ps1 = path.join(__dirname, "sync_guide_img.ps1");
const r = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1],
  { stdio: "inherit", cwd: path.join(__dirname, "..") }
);
process.exit(r.status == null ? 1 : r.status);
