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
 * Uçtan uca kısım klonlara ihtiyaç duyar (`AJANS_OS_KLONLAR`, varsayılan
 * `D:/Repolar/_inceleme`). Klon yoksa o bölüm atlanır.
 *
 * ATLAMA ARTIK SAYILIYOR. Eskiden atlama ekrana yazılıyordu ama özet satırı
 * yalnızca "5 geçti, 0 kaldı" diyor ve çıkış kodu 0 oluyordu: insan görürdü,
 * bir kapı görmezdi. Bu depo aynı körlüğü bir kez daha yaşadı - U15 testi
 * komşu doğrulayıcıyı bulamayınca kendini atlıyordu ve CI yeşil kalıyordu; o
 * yüzden iş akışında ayrı bir "U15 atlanmadı mı" adımı var. Burada atlamalar
 * özete yazılır ve `--kati` ile atlama başarısızlık sayılır.
 *
 *   node arac/kanit-dogrula-test.js          # klon yoksa atlar, 0 doner
 *   node arac/kanit-dogrula-test.js --kati   # atlama varsa 1 doner
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KOK = path.resolve(__dirname, "..");
const kati = process.argv.includes("--kati");
let gecen = 0;
const kalan = [];
const atlanan = [];
function atla(ad, neden) {
  atlanan.push(ad);
  console.log("  ATLANDI: " + ad + " - " + neden);
}
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
const KLON = process.env.AJANS_OS_KLONLAR || "D:/Repolar/_inceleme";
if (!fs.existsSync(KLON)) {
  atla("uctan uca (uc iz)", "klon klasoru yok: " + KLON);
} else {
  const tavan = { "i4-guvenilirlik": 18, "i5-gozlem-ekonomi": 25, "i6-kodlama-ogrenme": 8 };
  for (const [iz, sinir] of Object.entries(tavan)) {
    if (!fs.existsSync(path.join(KOK, "docs", "arastirma", iz))) { atla(iz, "iz klasoru yok"); continue; }
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

console.log("\n" + gecen + " gecti, " + kalan.length + " kaldi, " + atlanan.length + " atlandi.");
if (atlanan.length) {
  console.log("Atlananlar: " + atlanan.join(", "));
  console.log("Uctan uca bolum icin: AJANS_OS_KLONLAR=<klon-kok> node arac/kanit-dogrula-test.js");
}
if (kati && atlanan.length) {
  console.log("--kati verildi: atlanan bir bolum basarisizliktir.");
  process.exit(1);
}
process.exit(kalan.length ? 1 : 0);
