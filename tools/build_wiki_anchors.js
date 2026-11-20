/**
 * Сопоставляет предметы гида с заголовками MediaWiki (legacy id вида .D0.xx).
 * Пишет data/wiki_anchors.json: куда доскроллить «На вики Parapa».
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normKey(s) {
  return decodeEntities(s)
    .replace(/\u00a0/g, " ")
    .replace(/[«»„“”]/g, '"')
    .replace(/ё/gi, "е")
    .replace(/\(\s*[мж]\s*\)/gi, "")
    .replace(/["']/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function wikiPageTitle(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const fromQuery = u.searchParams.get("title");
    if (fromQuery) return decodeURIComponent(fromQuery).replace(/_/g, " ").trim();
    const mark = "/index.php/";
    const at = u.pathname.indexOf(mark);
    if (at >= 0) {
      return decodeURIComponent(u.pathname.slice(at + mark.length)).replace(/_/g, " ").trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

function indexHtml(html) {
  const headings = [];
  const chunks = [];
  const labels = new Map();
  const stack = [];
  let current = null;
  let skip = 0;
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] != null) {
      if (skip) continue;
      const decoded = decodeEntities(m[4]).replace(/\s+/g, " ");
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].collect) {
          stack[i].text += decoded;
          break;
        }
      }
      const text = decoded.trim();
      if (!text || text.length > 140 || !current) continue;
      const parent = stack.length ? stack[stack.length - 1].name : "";
      const rank = parent === "td" || parent === "th" || parent === "b" || parent === "strong" || parent === "li" || parent === "a" ? 2 : 1;
      if (text.length < 4 && rank < 2) continue;
      const key = normKey(text);
      if (!key || key.length < 2) continue;
      const prev = labels.get(key);
      if (!prev || rank > prev.rank) labels.set(key, { id: current.id, rank });
      continue;
    }
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    const attrs = m[3] || "";
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === name) {
          if (stack[i].collect) {
            const chunk = String(stack[i].text || "").replace(/\s+/g, " ").trim();
            if (chunk) chunks.push(chunk);
          }
          if (stack[i].skip) skip = Math.max(0, skip - 1);
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const selfClose = /\/>\s*$/.test(attrs) || name === "br" || name === "img" || name === "hr" || name === "meta" || name === "link";
    const idAttr = /id="([^"]*)"/.exec(attrs);
    const classAttr = /class="([^"]*)"/.exec(attrs);
    const isSkip =
      name === "script" ||
      name === "style" ||
      (idAttr && idAttr[1] === "toc") ||
      (classAttr && /(^|\s)toc(\s|$)/.test(classAttr[1]));
    const collect =
      !isSkip &&
      !skip &&
      (name === "td" || name === "th" || name === "p" || name === "li" || /^h[1-6]$/.test(name));
    if (!selfClose) {
      stack.push({ name, skip: isSkip, collect, text: "" });
      if (isSkip) skip++;
    }
    if (name === "h1" && /id="firstHeading"/.test(attrs)) {
      /* title is read separately */
    }
    if (!skip && /^h[2-6]$/.test(name)) {
      const span = /<span class="mw-headline" id="([^"]+)"[^>]*>([\s\S]*?)<\/span>/.exec(html.slice(m.index, m.index + 800));
      if (span) {
        const text = decodeEntities(span[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        const key = normKey(text);
        current = { id: span[1], text, norm: key };
        headings.push(current);
        if (key && (!labels.has(key) || labels.get(key).rank < 3)) {
          labels.set(key, { id: span[1], rank: 3 });
        }
      }
    }
  }
  const h1 = /<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const title = h1 ? decodeEntities(h1[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
  return { title, norm: normKey(title), headings, labels, chunks };
}

/** Текст строки, если первое вхождение на странице — сама ячейка с названием. */
function scrollText(page, item) {
  const name = String(item.name || "").replace(/\s+/g, " ").trim();
  if (!name || name.length < 2 || !page) return "";
  const key = normKey(name);
  if (!key || key === page.norm) return "";
  if (page.headings.some((h) => h.norm === key)) return "";
  for (const chunk of page.chunks || []) {
    if (!chunk.includes(name)) continue;
    return chunk === name ? name : "";
  }
  return "";
}

const COLOR_PREFIX = new Set([
  "красный", "черный", "белый", "желтый", "зеленый", "зелёный", "синий", "голубой",
  "розовый", "фиолетовый", "оранжевый", "серый", "коричневый", "золотой", "серебряный",
  "бирюзовый", "сиреневый", "малиновый", "бордовый", "бежевый", "салатовый", "лиловый",
  "пурпурный", "мятный", "персиковый", "медный", "бронзовый", "рыжий", "алый",
  "темно-синий", "светло-синий", "темно-зеленый", "светло-зеленый", "ярко-розовый",
]);

function namesOf(item) {
  const out = [];
  if (item.name) out.push(item.name);
  const g = item.genderNames || {};
  for (const v of Object.values(g)) if (v) out.push(v);
  return out;
}

function headingByNorm(page, key) {
  if (!key) return null;
  return page.headings.find((h) => h.norm === key) || null;
}

function resolve(page, item, shared) {
  if (!page) return null;
  const nameKeys = namesOf(item).map(normKey).filter(Boolean);
  if (nameKeys.some((k) => k === page.norm)) return null;
  for (const key of nameKeys) {
    const hit = headingByNorm(page, key);
    if (hit) return { id: hit.id, how: "name", heading: hit.text };
  }
  for (const key of nameKeys) {
    const hit = page.labels.get(key);
    if (hit && hit.rank >= 3) {
      const heading = page.headings.find((h) => h.id === hit.id);
      return { id: hit.id, how: "name", heading: heading ? heading.text : "" };
    }
    if (hit && shared) {
      const heading = page.headings.find((h) => h.id === hit.id);
      return { id: hit.id, how: "place", heading: heading ? heading.text : "" };
    }
  }
  if (shared) {
    for (const key of nameKeys) {
      if (key.length < 8) continue;
      const tail = " " + key;
      for (const [label, hit] of page.labels) {
        if (!label.endsWith(tail)) continue;
        const prefix = label.slice(0, label.length - tail.length).trim();
        if (!COLOR_PREFIX.has(prefix)) continue;
        const heading = page.headings.find((h) => h.id === hit.id);
        return { id: hit.id, how: "place", heading: heading ? heading.text : "" };
      }
    }
  }
  const cat = normKey(item.category || "");
  if (cat && cat !== page.norm) {
    const hit = headingByNorm(page, cat);
    if (hit) return { id: hit.id, how: "category", heading: hit.text };
  }
  const src = normKey(item.source || "");
  if (src && src.length >= 4 && src !== page.norm) {
    const hit = headingByNorm(page, src);
    if (hit) return { id: hit.id, how: "source", heading: hit.text };
    if (shared) {
      let best = null;
      let bestAt = Infinity;
      for (const h of page.headings) {
        if (!h.norm || h.norm.length < 8 || h.norm === page.norm) continue;
        const at = src.indexOf(h.norm);
        if (at < 0) continue;
        const beforeOk = at === 0 || src[at - 1] === " " || src[at - 1] === ",";
        const afterAt = at + h.norm.length;
        const afterOk = afterAt === src.length || src[afterAt] === " " || src[afterAt] === ",";
        if (!beforeOk || !afterOk) continue;
        if (at < bestAt || (at === bestAt && h.norm.length > best.norm.length)) {
          best = h;
          bestAt = at;
        }
      }
      if (best) return { id: best.id, how: "source", heading: best.text };
    }
  }
  return null;
}

function loadPages() {
  const pages = new Map();
  const files = fs.readdirSync(dataDir).filter((n) => n.startsWith("_wiki_") && n.endsWith(".html"));
  for (const name of files) {
    const html = fs.readFileSync(path.join(dataDir, name), "utf8");
    const page = indexHtml(html);
    if (!page.title) continue;
    const prev = pages.get(page.norm);
    if (!prev || page.headings.length > prev.headings.length) pages.set(page.norm, page);
  }
  return pages;
}

function main() {
  const pages = loadPages();
  const titles = JSON.parse(fs.readFileSync(path.join(dataDir, "titles.json"), "utf8"));
  const wiki = JSON.parse(fs.readFileSync(path.join(dataDir, "wiki_items.json"), "utf8"));
  const out = { t: {}, w: {}, tt: {}, wt: {} };
  const stats = { name: 0, place: 0, category: 0, source: 0, own: 0, miss: 0, noPage: 0, text: 0 };
  const byKind = {};
  const missSample = [];

  function take(bucket, key, item, url, sharedPages) {
    const title = wikiPageTitle(url);
    const page = title ? pages.get(normKey(title)) : null;
    const shared = page ? sharedPages.has(page.norm) : false;
    const kind = item.kind || "titles";
    if (!byKind[kind]) byKind[kind] = { name: 0, place: 0, category: 0, source: 0, own: 0, miss: 0, noPage: 0, text: 0 };
    if (!title) {
      stats.noPage++;
      byKind[kind].noPage++;
      return;
    }
    if (!page) {
      stats.noPage++;
      byKind[kind].noPage++;
      if (missSample.length < 12) missSample.push({ kind, name: item.name, why: "no html", page: title });
      return;
    }
    if (shared) {
      const text = scrollText(page, item);
      if (text) {
        stats.text++;
        byKind[kind].text++;
        (bucket === out.t ? out.tt : out.wt)[key] = text;
      }
    }
    if (namesOf(item).some((n) => normKey(n) === page.norm)) {
      stats.own++;
      byKind[kind].own++;
      return;
    }
    const hit = resolve(page, item, shared);
    if (!hit) {
      stats.miss++;
      byKind[kind].miss++;
      if (missSample.length < 25) missSample.push({ kind, name: item.name, category: item.category || "", page: title });
      return;
    }
    stats[hit.how]++;
    byKind[kind][hit.how]++;
    bucket[key] = hit.id;
  }

  const sharedPages = new Map();
  function countPage(url) {
    const title = wikiPageTitle(url);
    const key = normKey(title);
    if (!key) return;
    sharedPages.set(key, (sharedPages.get(key) || 0) + 1);
  }
  for (const it of titles.items || []) countPage(titles.source);
  for (const it of wiki.items || []) countPage(it.wiki || wiki.source || "");
  for (const [key, n] of [...sharedPages]) if (n < 2) sharedPages.delete(key);

  for (const it of titles.items || []) {
    take(out.t, String(it.id), { ...it, kind: "titles" }, titles.source, sharedPages);
  }
  for (const it of wiki.items || []) {
    take(out.w, `${it.kind}:${it.id}`, it, it.wiki || wiki.source || "", sharedPages);
  }

  const heads = {};
  for (const page of pages.values()) {
    if (!sharedPages.has(page.norm) || !page.headings.length) continue;
    const map = {};
    for (const h of page.headings) {
      if (h.norm && !map[h.norm]) map[h.norm] = h.id;
    }
    heads[page.norm] = map;
  }
  out.h = heads;

  const dest = path.join(dataDir, "wiki_anchors.json");
  fs.writeFileSync(dest, JSON.stringify(out));
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(JSON.stringify({ pages: pages.size, stats, byKind, kb, missSample }, null, 2));
}

main();
