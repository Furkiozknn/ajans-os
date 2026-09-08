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
 *   4. Yalnizca orchestrator kardes modul import eder (ADR-002)
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

// 3 + 4 — index.d.ts ve import yonu
const importDeseni = /from\s+"\.\.\/([a-z0-9-]+)"/g;
for (const k of klasorler) {
  const dosya = path.join(src, k, "index.d.ts");
  if (!fs.existsSync(dosya)) {
    hatalar.push(`src/${k}/index.d.ts yok.`);
    continue;
  }
  const metin = fs.readFileSync(dosya, "utf8");
  for (const m of metin.matchAll(importDeseni)) {
    const hedef = m[1];
    if (hedef === "tipler") continue;
    if (k !== "orchestrator") {
      hatalar.push(
        `src/${k}/index.d.ts "../${hedef}" import ediyor. ADR-002: kardes modulu yalnizca orchestrator taniyabilir.`,
      );
    } else if (!klasorler.includes(hedef)) {
      hatalar.push(`src/orchestrator "../${hedef}" import ediyor ama boyle bir modul yok.`);
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
