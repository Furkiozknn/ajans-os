#!/usr/bin/env node
/**
 * iz-izle.js — Faz 2/3 belgelerindeki her `dosya:satır` alıntısının iz
 * belgelerinde (docs/arastirma/**) karşılığı var mı?
 *
 *   node arac/iz-izle.js docs/02-EN-IYI-FIKIRLER.md
 *   node arac/iz-izle.js docs/03-ANTI-PATTERNS.md --yaz
 *
 * Neden: Faz 2 belgeleri "yeni kanıt üretmez, iz özetlerinden alır" diye
 * yazılır. Bu araç o iddiayı mekanik olarak sınar — kaydırılmış ya da
 * uydurulmuş satır numarasını yakalar. `kanit-dogrula.js` kaynak koda bakar;
 * bu araç bir halka yukarısına, belge → iz zincirine bakar.
 *
 * Sınıflar: BIREBIR (aynı dosya + aynı satır), YAKIN (±5 satır ya da kesişen
 * aralık), YOK (iz belgelerinde hiç geçmiyor — elle bakılır).
 * Çıkış kodu: YOK varsa 1, yoksa 0.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const KOK = path.resolve(__dirname, "..");
const argümanlar = process.argv.slice(2);
const yaz = argümanlar.includes("--yaz");
const hedefler = argümanlar.filter((a) => !a.startsWith("--"));
if (!hedefler.length) {
  console.error("Kullanim: node arac/iz-izle.js <belge.md> [<belge.md> ...] [--yaz]");
  process.exit(2);
}

// --- iz belgelerini tek havuzda topla ---------------------------------------
const izKok = path.join(KOK, "docs", "arastirma");
const izDosyalar = [];
if (fs.existsSync(izKok)) {
  for (const d of fs.readdirSync(izKok)) {
    const p = path.join(izKok, d);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p)) if (f.endsWith(".md")) izDosyalar.push(path.join(p, f));
  }
}
if (!izDosyalar.length) { console.error("docs/arastirma altinda iz belgesi yok."); process.exit(2); }
// Tire çeşitleri (– —) normalize edilir: iz belgeleri aralıkta ikisini de kullanıyor.
const havuz = izDosyalar.map((f) => fs.readFileSync(f, "utf8")).join("\n").replace(/[–—]/g, "-");

const ALINTI = /`([A-Za-z0-9_.\/-]+\.(?:py|pyi|ts|tsx|js|mjs|cjs|md|toml|json|ya?ml|rs|go|txt|cfg|ini|sql|sh|ps1)):(\d+)(?:-(\d+))?`/g;

function belgeyiTara(belge) {
  const metin = fs.readFileSync(belge, "utf8");
  const satirlar = metin.split(/\r?\n/);
  const gorulen = new Map();
  for (let i = 0; i < satirlar.length; i++) {
    ALINTI.lastIndex = 0;
    let m;
    while ((m = ALINTI.exec(satirlar[i])) !== null) {
      const anahtar = m[1] + ":" + m[2] + (m[3] ? "-" + m[3] : "");
      if (!gorulen.has(anahtar)) gorulen.set(anahtar, { dosya: m[1], a: Number(m[2]), b: m[3] ? Number(m[3]) : Number(m[2]), satir: i + 1 });
    }
  }
  const sonuc = { birebir: [], yakin: [], yok: [] };
  for (const [anahtar, v] of gorulen) {
    const base = path.basename(v.dosya).replace(/\./g, "\\.");
    const re = new RegExp(base + ":(\\d+)(?:-(\\d+))?", "g");
    let tam = false, yakin = false, m2;
    while ((m2 = re.exec(havuz)) !== null) {
      const c = Number(m2[1]), d = m2[2] ? Number(m2[2]) : c;
      if (v.a === c && v.b === d) { tam = true; break; }
      if (Math.max(v.a, c) <= Math.min(v.b, d) + 5 && Math.min(v.b, d) >= Math.max(v.a, c) - 5) yakin = true;
    }
    (tam ? sonuc.birebir : yakin ? sonuc.yakin : sonuc.yok).push({ anahtar, satir: v.satir });
  }
  return sonuc;
}

let hataVar = false;
const satirlarMd = ["# İz izlenebilirliği", "", "*Üretim: " + new Date().toISOString().slice(0, 10) + " · araç: `arac/iz-izle.js` · kaynak: `docs/arastirma/**` (" + izDosyalar.length + " belge)*", ""];
for (const h of hedefler) {
  const belge = path.isAbsolute(h) ? h : path.join(KOK, h);
  if (!fs.existsSync(belge)) { console.error("Belge yok: " + h); process.exit(2); }
  const s = belgeyiTara(belge);
  const toplam = s.birebir.length + s.yakin.length + s.yok.length;
  const gorece = path.relative(KOK, belge).replace(/\\/g, "/");
  console.log("\n" + gorece + ": " + toplam + " farkli alinti | BIREBIR " + s.birebir.length + " · YAKIN " + s.yakin.length + " · YOK " + s.yok.length);
  for (const y of s.yakin) console.log("  YAKIN " + y.anahtar + "  (belge satiri " + y.satir + ")");
  for (const y of s.yok) console.log("  YOK   " + y.anahtar + "  (belge satiri " + y.satir + ")");
  if (s.yok.length) hataVar = true;
  satirlarMd.push("## " + gorece, "", "| Toplam | BİREBİR | YAKIN | YOK |", "|---|---|---|---|",
    "| " + toplam + " | " + s.birebir.length + " | " + s.yakin.length + " | " + s.yok.length + " |", "");
  if (s.yakin.length || s.yok.length) {
    satirlarMd.push("| Alıntı | Sınıf | Belge satırı |", "|---|---|---|");
    for (const y of s.yakin) satirlarMd.push("| `" + y.anahtar + "` | YAKIN | " + y.satir + " |");
    for (const y of s.yok) satirlarMd.push("| `" + y.anahtar + "` | **YOK** | " + y.satir + " |");
    satirlarMd.push("");
  } else satirlarMd.push("Tüm alıntılar iz belgelerinde birebir bulundu.", "");
}
if (yaz) {
  const cikti = path.join(KOK, "docs", "inceleme", "iz-izlenebilirlik.md");
  fs.mkdirSync(path.dirname(cikti), { recursive: true });
  fs.writeFileSync(cikti, satirlarMd.join("\n") + "\n", "utf8");
  console.log("\nYazildi: " + cikti);
}
process.exit(hataVar ? 1 : 0);
