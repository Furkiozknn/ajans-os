"use strict";
/**
 * _cli.js — arac/ betiklerinin ortak bayrak kapısı.
 *
 * NEDEN VAR. Betikler `process.argv`'i kendi başlarına okuyor ve tanımadıkları
 * bayrağı sessizce yutuyordu (docs/DENETIM.md, ölçüm kaydı: kanit/ajans-os/once):
 *   - `sema-dogrula.js --tset` (yazım hatası) öz-testi hiç koşmadan "Sonuç: temiz."
 *     deyip 0 ile çıkıyordu; sessizce geçen doğrulayıcı doğrulamıyor demektir.
 *   - `matris-uret.js --help` yardım yerine docs/01-*.md dosyalarını yeniden yazıyordu.
 *   - `sema-mutasyon.js --help` 8 saniyelik mutasyon ölçümünü koşuyordu.
 *
 * NE YAPAR. `--help` / `-h`: yardımı basar, 0 ile çıkar, başka hiçbir şey yapmaz.
 * Tanımadığı bir `-`/`--` bayrağında: en yakın tanınan bayrağı önererek 2 ile çıkar.
 * Gerisi (konumsal argümanlar, değerler, çıkış kodları) çağıran betiğe kalır.
 * Bağımlılık yok; betikler CommonJS (arac/package.json).
 */

/** Levenshtein uzaklığı: "--tset" -> "--test" için öneri üretmeye yeter. */
function uzaklik(a, b) {
  let onceki = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const simdiki = [i];
    for (let j = 1; j <= b.length; j++) {
      simdiki[j] = Math.min(onceki[j] + 1, simdiki[j - 1] + 1, onceki[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    onceki = simdiki;
  }
  return onceki[b.length];
}

/** Tanınan bayraklar içinde `yanlis`a en yakın olan, ≤ 2 uzaklıktaysa; yoksa null. */
function oner(yanlis, bilinen) {
  const [en] = bilinen.map((b) => [uzaklik(yanlis, b), b]).sort((x, y) => x[0] - y[0]);
  return en && en[0] <= 2 ? en[1] : null;
}

/**
 * @param {{ad: string, yardim: string, bayraklar: string[]}} secenek
 *   ad: betik dosya adı (hata mesajındaki "node arac/<ad> --help" için)
 *   yardim: --help çıktısı
 *   bayraklar: betiğin tanıdığı bayraklar (değer alanlar dahil, --help hariç)
 * @returns {string[]} process.argv.slice(2)
 */
function cli({ ad, yardim, bayraklar }) {
  const arg = process.argv.slice(2);
  if (arg.includes("--help") || arg.includes("-h")) {
    console.log(yardim.trim());
    process.exit(0);
  }
  const bilinen = [...bayraklar, "--help"];
  const yanlis = arg.find((a) => a.startsWith("-") && a !== "-" && !bilinen.includes(a));
  if (yanlis) {
    const yakin = oner(yanlis, bilinen);
    console.error(`hata: bilinmeyen bayrak '${yanlis}'${yakin ? ` — ${yakin} mi demek istediniz?` : ""}`);
    console.error(`Yardım: node arac/${ad} --help`);
    process.exit(2);
  }
  return arg;
}

module.exports = { cli, oner, uzaklik };
