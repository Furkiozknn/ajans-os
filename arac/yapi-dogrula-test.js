#!/usr/bin/env node
/**
 * yapi-dogrula-test.js — yapi kapisinin gercekten kapali oldugunu kanitlar.
 *
 * U0'in bitti olcutu: `yapi-dogrula.js` bir `.js` dosyasindaki import yonu
 * ihlalini yakalamali. Bir kural, ihlali sinanmadan "gecti" demez (AP3).
 * Bu betik kasitli bir ihlal dosyasi yazar, denetimi kosar, cikis kodunun 1
 * oldugunu dogrular ve dosyayi her durumda siler.
 *
 * Kullanim: node arac/yapi-dogrula-test.js   (cikis kodu 0 = kapi calisiyor)
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const kok = path.resolve(__dirname, "..");
const denetim = path.join(kok, "arac", "yapi-dogrula.js");
const ihlalDosyasi = path.join(kok, "src", "evaluator", "_ihlal-gecici.js");

function kos() {
  return spawnSync(process.execPath, [denetim], { encoding: "utf8" });
}

const hatalar = [];

// 1 — temiz agacta kapi acik olmali
const temiz = kos();
if (temiz.status !== 0) {
  hatalar.push(`Temiz agacta yapi-dogrula 0 donmedi (${temiz.status}):\n${temiz.stderr}`);
}

// 2 — kasitli ihlal: evaluator kardes modulu import ediyor (ADR-002 ihlali)
try {
  fs.writeFileSync(
    ihlalDosyasi,
    '// KASITLI IHLAL — yapi-dogrula-test.js tarafindan yazildi, hemen silinir.\nimport { Critic } from "../critic/index.js";\nexport const x = Critic;\n',
    "utf8",
  );
  const ihlalli = kos();
  if (ihlalli.status !== 1) {
    hatalar.push(`Kasitli .js ihlalinde cikis kodu 1 bekleniyordu, ${ihlalli.status} geldi.`);
  }
  if (!/_ihlal-gecici\.js/.test(ihlalli.stderr) || !/ADR-002/.test(ihlalli.stderr)) {
    hatalar.push(`Hata mesaji ihlal dosyasini ve ADR-002'yi anmiyor:\n${ihlalli.stderr}`);
  }
} finally {
  if (fs.existsSync(ihlalDosyasi)) fs.unlinkSync(ihlalDosyasi);
}

// 3 — ihlal dosyasi gercekten silindi mi
if (fs.existsSync(ihlalDosyasi)) hatalar.push("Ihlal dosyasi silinemedi; agac kirli kaldi.");
const sonrasi = kos();
if (sonrasi.status !== 0) {
  hatalar.push(`Temizlik sonrasi yapi-dogrula 0 donmedi (${sonrasi.status}):\n${sonrasi.stderr}`);
}

if (hatalar.length) {
  console.error(`YAPI KAPISI TESTI: ${hatalar.length} sorun\n`);
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}
console.log("YAPI KAPISI TESTI: temiz. Kasitli .js ihlali yakalandi, agac geri birakildi.");
