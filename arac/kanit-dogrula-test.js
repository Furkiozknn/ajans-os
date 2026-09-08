#!/usr/bin/env node
/**
 * kanit-dogrula-test.js — v3.2 düzeltmelerinin regresyon testi.
 *
 *   node arac/kanit-dogrula-test.js
 *
 * Test verisi uydurma değil: İ4/İ5/İ6 `DENETIM.md` dosyalarında elle
 * doğrulanmış **gerçek yanlış alarmlar**. Her biri için beklenti, o
 * denetimin vardığı sonuçtur.
 *
 * 1. `yolEslesir` — tek parçalı kısaltma (`.../security/x.py`) ve depo adıyla
 *    başlayan yol (`semantic-conventions/CHANGELOG.md`) çözülmeli.
 * 2. Uçtan uca — üç izde **DOSYA-YOK sıfır** olmalı ve şüpheli sayısı
 *    denetimlerdeki taban değerin üstüne çıkmamalı (İ4 ≤18, İ5 ≤25, İ6 ≤8).
 *
 * Uçtan uca kısım klonlara (`D:/Repolar/_inceleme`) ihtiyaç duyar; klon yoksa
 * o bölüm atlanır ve bunu açıkça yazar — sessizce "geçti" demez.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KOK = path.resolve(__dirname, "..");
let gecen = 0;
const kalan = [];
function ol(ad, kosul, ek) {
  if (kosul) { gecen++; console.log("  ok   " + ad); }
  else { kalan.push(ad); console.log("  HATA " + ad + (ek ? "  -> " + ek : "")); }
}

// --- 1) yolEslesir: kaynaktan çekilip izole çalıştırılır --------------------
const kaynak = fs.readFileSync(path.join(__dirname, "kanit-dogrula.js"), "utf8");
const fnMetin = kaynak.match(/function yolEslesir\(alt, yol\) \{[\s\S]*?\n\}/);
if (!fnMetin) { console.error("yolEslesir bulunamadi - arac degismis olabilir"); process.exit(2); }
const yolEslesir = new Function("return " + fnMetin[0])();

console.log("— yolEslesir —");
ol("tek parcali kisaltma (I6: confirmation_policy)",
  yolEslesir("openhands-sdk/openhands/sdk/security/confirmation_policy.py", ".../security/confirmation_policy.py"));
ol("tek parcali kisaltma (I6: workspace/local.py)",
  yolEslesir("openhands-sdk/openhands/sdk/workspace/local.py", ".../workspace/local.py"));
ol("tam yol hala eslesiyor",
  yolEslesir("libs/checkpoint/langgraph/checkpoint/base/__init__.py", "checkpoint/base/__init__.py"));
ol("ilgisiz yol eslesmiyor",
  !yolEslesir("openhands-sdk/openhands/sdk/workspace/local.py", ".../security/confirmation_policy.py"));
ol("iki parcali kisaltma korunuyor",
  yolEslesir("src/agents/tracing/processors.py", "agents/...processors.py"));

// --- 2) uçtan uca: üç izde DOSYA-YOK sıfır ----------------------------------
console.log("\n— Uctan uca (uc iz) —");
const KLON = "D:/Repolar/_inceleme";
if (!fs.existsSync(KLON)) {
  console.log("  ATLANDI: klon klasoru yok (" + KLON + ") - uctan uca test kosulamadi");
} else {
  const tavan = { "i4-guvenilirlik": 18, "i5-gozlem-ekonomi": 25, "i6-kodlama-ogrenme": 8 };
  for (const [iz, sinir] of Object.entries(tavan)) {
    if (!fs.existsSync(path.join(KOK, "docs", "arastirma", iz))) { console.log("  ATLANDI: " + iz + " klasoru yok"); continue; }
    let cikti = "";
    try {
      cikti = execFileSync(process.execPath, [path.join(__dirname, "kanit-dogrula.js"), iz], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    } catch (e) { cikti = (e.stdout || "") + (e.stderr || ""); }
    const satir = (cikti.match(/^\| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|$/m) || []).slice(1).map(Number);
    if (satir.length !== 7) { ol(iz + ": ozet tablosu okunabildi", false, "tablo bulunamadi"); continue; }
    const [, , , , tokenYok, eof, dosyaYok] = satir;
    ol(iz + ": DOSYA-YOK sifir", dosyaYok === 0, "DOSYA-YOK=" + dosyaYok);
    ol(iz + ": supheli tabani asmiyor (<=" + sinir + ")", tokenYok + eof + dosyaYok <= sinir, "supheli=" + (tokenYok + eof + dosyaYok));
  }
}

console.log("\n" + gecen + " gecti, " + kalan.length + " kaldi.");
process.exit(kalan.length ? 1 : 0);
