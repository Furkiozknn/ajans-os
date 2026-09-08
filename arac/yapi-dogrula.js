#!/usr/bin/env node
/**
 * yapi-dogrula.js — src/ iskeletinin mimariye uydugunu dogrular.
 *
 * ADR-001'in test edilebilir olcutu: "src/ altindaki modul klasoru sayisi
 * 13'tur ve her birinin adi 00-BLUEPRINT.md §2'deki bir baslikla birebir
 * eslesir." Bu betik o olcutu ve ADR-002'nin cagri yonunu kontrol eder.
 *
 * Kontroller:
 *   1. Blueprint §2 baslik sayisi = src/ modul klasoru sayisi = 13
 *   2. Her modul klasoru bir §2 basliginin kebab-case hali
 *   3. Her modulde index.d.ts var
 *   4. Yalnizca orchestrator kardes modul import eder (ADR-002) — denetim
 *      hem .d.ts hem .js dosyalarinda calisir (ADR-009: import yonu kurali
 *      uygulama kodunda da gecerli)
 *   5. Her modul 08-YAPI-VE-ARAYUZLER.md icinde geciyor
 *
 * Kullanim: node arac/yapi-dogrula.js   (cikis kodu 0 = temiz)
 */

const fs = require("fs");
const path = require("path");

const kok = path.resolve(__dirname, "..");
const src = path.join(kok, "src");
const blueprint = path.join(kok, "docs", "mimari", "00-BLUEPRINT.md");
const yapiBelgesi = path.join(kok, "docs", "mimari", "08-YAPI-VE-ARAYUZLER.md");

const hatalar = [];
const bekleyen = 13; // ADR-001; degistirmek ADR'yi yeniden acmayi gerektirir

function kebap(baslik) {
  return baslik
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// 1 — blueprint §2 basliklari
const bpMetin = fs.readFileSync(blueprint, "utf8");
const basliklar = [...bpMetin.matchAll(/^### 2\.\d+ (.+)$/gm)].map((m) => m[1]);
if (basliklar.length !== bekleyen) {
  hatalar.push(`Blueprint §2'de ${basliklar.length} bilesen basligi var, ${bekleyen} bekleniyordu.`);
}
const beklenenKlasorler = basliklar.map(kebap);

// 2 — src/ modul klasorleri
const klasorler = fs
  .readdirSync(src, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (klasorler.length !== bekleyen) {
  hatalar.push(`src/ altinda ${klasorler.length} modul klasoru var, ${bekleyen} olmali (ADR-001).`);
}
for (const k of klasorler) {
  if (!beklenenKlasorler.includes(k)) {
    hatalar.push(`src/${k} blueprint §2'deki hicbir baslikla eslesmiyor.`);
  }
}
for (const b of beklenenKlasorler) {
  if (!klasorler.includes(b)) hatalar.push(`Blueprint §2'deki "${b}" icin src/ klasoru yok.`);
}

// 3 + 4 — index.d.ts ve import yonu (.d.ts + .js)
// import x from "../y/z.js" | import("../y") | require("../y") — tek tirnak da tutar.
const importDeseni = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'](\.\.\/[^"']+)["']/g;

function jsVeTipDosyalari(dizin) {
  const bulunan = [];
  for (const g of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, g.name);
    if (g.isDirectory()) bulunan.push(...jsVeTipDosyalari(tam));
    else if (/\.(d\.ts|js|mjs|cjs)$/.test(g.name)) bulunan.push(tam);
  }
  return bulunan;
}

for (const k of klasorler) {
  const modulDizini = path.join(src, k);
  if (!fs.existsSync(path.join(modulDizini, "index.d.ts"))) {
    hatalar.push(`src/${k}/index.d.ts yok.`);
    continue;
  }
  for (const dosya of jsVeTipDosyalari(modulDizini)) {
    const goreli = path.relative(kok, dosya).split(path.sep).join("/");
    for (const m of fs.readFileSync(dosya, "utf8").matchAll(importDeseni)) {
      // "../tipler.js" -> tipler, "../evaluator/index.js" -> evaluator
      const hedef = m[1].slice(3).split("/")[0].replace(/\.(d\.ts|js|mjs|cjs)$/, "");
      if (hedef === "tipler") continue;
      if (k !== "orchestrator") {
        hatalar.push(
          `${goreli} "${m[1]}" import ediyor. ADR-002: kardes modulu yalnizca orchestrator taniyabilir.`,
        );
      } else if (!klasorler.includes(hedef)) {
        hatalar.push(`${goreli} "${m[1]}" import ediyor ama "${hedef}" diye bir modul yok.`);
      }
    }
  }
}

// tipler.d.ts hicbir modulu tanimaz
const tipler = fs.readFileSync(path.join(src, "tipler.d.ts"), "utf8");
if (/from\s+"\.\//.test(tipler)) {
  hatalar.push("src/tipler.d.ts bir modulu import ediyor; ortak tipler modullerden bagimsiz olmali.");
}

// 5 — yapi belgesi her modulden bahsediyor mu
if (!fs.existsSync(yapiBelgesi)) {
  hatalar.push("docs/mimari/08-YAPI-VE-ARAYUZLER.md yok.");
} else {
  const belge = fs.readFileSync(yapiBelgesi, "utf8");
  for (const k of klasorler) {
    if (!belge.includes(`src/${k}/`)) hatalar.push(`08-YAPI-VE-ARAYUZLER.md "src/${k}/" yolundan hic bahsetmiyor.`);
  }
}

if (hatalar.length) {
  console.error(`YAPI DOGRULAMA: ${hatalar.length} sorun\n`);
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}
console.log(`YAPI DOGRULAMA: temiz. ${klasorler.length} modul, hepsi blueprint §2 ile esli, import yonu tek.`);
