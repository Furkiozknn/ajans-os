#!/usr/bin/env node
/**
 * kaydet.js — README demosunun kaydı: komutları GERÇEKTEN koşar, ne bastıklarını yazar.
 *
 *   node docs/demo/kaydet.js
 *
 * Çıktı (elle düzenlenmez, hiçbir satır elle yazılmaz):
 *   docs/demo/demo.json      kayıt; uret.py GIF'i ve dikey klibi bundan çizer
 *   docs/demo/komutlar.txt   aynı kayıt düz metin: komut, çıktı, çıkış kodu, süre
 *
 * Komutlar deponun GEÇİCİ bir kopyasında koşar; gerçek ağaca dokunmaz (sema-mutasyon.js
 * ve yapi-dogrula-test.js koşarken geçici dosya yazar). "Yabancı makine" taklidi: komşu
 * doğrulayıcı (../turkce-ajanlar) yok, AJANS_OS_KLONLAR / AJANS_OS_DEPOLAR var olmayan
 * bir yola (/yok) gösteriyor — yani ilk koşuda 1 test ve uçtan uca kanıt bölümü atlanır,
 * README'nin "İlk koşuda göreceğiniz" bölümünün anlattığı şey tam olarak budur.
 *
 * Bağımlılık yok. bash gerekir (boru hattı + `set -o pipefail`); Windows'ta Git Bash,
 * başka yerde BASH ortam değişkeniyle verilebilir.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AYRI = dirname(fileURLToPath(import.meta.url));
const KOK = resolve(AYRI, "..", "..");
const BASH = process.env.BASH || (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash");

// Sahne sırası: kabul koşusu (asıl kanıt) -> kapı kendini sınıyor -> doğrulayıcı
// mutasyonla ölçülüyor -> yazım hatası sessizce geçmiyor -> hepsi birden (`npm run kapi`).
const KOMUTLAR = [
  "node --test src/kabul-kosusu.test.js",
  "node arac/yapi-dogrula-test.js",
  "node arac/sema-mutasyon.js | tail -n 3",
  "node arac/sema-dogrula.js --tset",
  "npm run kapi | tail -n 6",
];

const kopya = mkdtempSync(join(tmpdir(), "ajans-os-demo-"));
const hedef = join(kopya, "ajans-os");
cpSync(KOK, hedef, {
  recursive: true,
  filter: (k) => !/[\\/](\.git|node_modules|_test|_eski)([\\/]|$)/.test(k),
});

const env = {
  ...process.env,
  NO_COLOR: "1",
  FORCE_COLOR: "0",
  AJANS_OS_KLONLAR: "/yok",
  AJANS_OS_DEPOLAR: "/yok",
  MSYS_NO_PATHCONV: "1", // Git Bash "/yok" değerini C:/Program Files/Git/yok'a çevirmesin
};
delete env.AJANS_OS_KOMSU;

const surum = (komut) => spawnSync(`${komut} --version`, { encoding: "utf8", shell: true }).stdout.trim();
const git = (...a) => spawnSync("git", ["-C", KOK, ...a], { encoding: "utf8" }).stdout.trim();

const adimlar = [];
try {
  for (const komut of KOMUTLAR) {
    const t0 = process.hrtime.bigint();
    // `{ ...; } 2>&1`: stdout ve stderr gerçek terminaldeki gibi iç içe, sırasıyla gelir.
    const r = spawnSync(BASH, ["-c", `set -o pipefail; { ${komut}; } 2>&1`], {
      cwd: hedef,
      env,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const sure = Number(process.hrtime.bigint() - t0) / 1e9;
    adimlar.push({
      komut,
      cikti: (r.stdout || "").replace(/\r/g, "").replace(/\n+$/, ""),
      cikis: r.status,
      sure_s: Math.round(sure * 100) / 100,
    });
    console.log(`${String(r.status).padStart(2)}  ${sure.toFixed(2).padStart(6)} s  ${komut}`);
  }
} finally {
  rmSync(kopya, { recursive: true, force: true });
}

/** Yerel saat + UTC farkı (2026-09-30T07:45:33+03:00): diğer kayıt dosyalarıyla aynı biçim. */
function yerelZaman(d = new Date()) {
  const fark = -d.getTimezoneOffset();
  const isaret = fark >= 0 ? "+" : "-";
  const iki = (n) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  return new Date(d.getTime() + fark * 60000).toISOString().slice(0, 19) + `${isaret}${iki(fark / 60)}:${iki(fark % 60)}`;
}

const meta = {
  tarih: yerelZaman(),
  commit: git("rev-parse", "--short", "HEAD") || null,
  agac_temiz: git("status", "--porcelain") === "",
  sistem: `${platform()} ${release()}`,
  node: process.version,
  npm: surum("npm"),
};

writeFileSync(join(AYRI, "demo.json"), JSON.stringify({ meta, adimlar }, null, 1) + "\n", "utf8");

const metin = [
  "# ajans-os terminal demosu: gerçek komutlar, gerçek çıktı; hiçbir satır elle yazılmadı",
  `# tarih: ${meta.tarih}`,
  `# sürüm: commit ${meta.commit}${meta.agac_temiz ? "" : " (+ commit edilmemiş değişiklik)"}`,
  `# ortam: ${meta.sistem}, Node ${meta.node}, npm ${meta.npm}`,
  "# her komut deponun geçici bir kopyasında, bash -c 'set -o pipefail; { KOMUT; } 2>&1' ile koşuldu; renkler kapalı (NO_COLOR=1)",
  "# yabancı makine taklidi: ../turkce-ajanlar yok; AJANS_OS_KLONLAR=/yok AJANS_OS_DEPOLAR=/yok (bu makinede D:/Repolar var)",
  "# betik: docs/demo/kaydet.js; çizim: docs/demo/uret.py",
  "",
  ...adimlar.flatMap((a) => ["$ " + a.komut, a.cikti, `[çıkış kodu ${a.cikis}] (${a.sure_s.toFixed(2)} s)`, ""]),
].join("\n");
writeFileSync(join(AYRI, "komutlar.txt"), metin, "utf8");
console.log("yazıldı: docs/demo/demo.json, docs/demo/komutlar.txt");
