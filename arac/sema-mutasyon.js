/*
 * sema-mutasyon.js — doğrulayıcının öz-testi gerçekten neyi ölçüyor?
 *
 *   node arac/sema-mutasyon.js            # rapor + kapı (hayatta kalan varsa 1)
 *   node arac/sema-mutasyon.js --ayrinti  # hayatta kalan mutantın çıktısını da bas
 *
 * NEDEN VAR. `sema-dogrula.js --test` 106 kontrol koşuyor ve "temiz" diyor.
 * Bu, kontrollerin geçtiğini söyler; hangi kuralların *korunduğunu* söylemez.
 * Ölçüldü: `uniqueItems` zorlamasını tamamen kaldırdığımızda öz-test yine
 * "temiz" diyordu ve depo kapısı da yeşildi — yani o anahtar kelime için
 * doğrulayıcı sessizce doğrulamayı bırakabilirdi ve hiçbir şey fark etmezdi.
 * Dosyanın kendi başlığı bunu zaten yazıyor: "sessizce geçen doğrulayıcı
 * doğrulamıyor demektir." Bu araç o cümleyi ölçülebilir hale getiriyor.
 *
 * NASIL. Her zorlama noktası için doğrulayıcının bir KOPYASI üretilir, o tek
 * satır etkisizleştirilir ve kopyanın İKİ kipi de koşulur: kendi `--test`i ve
 * `contracts/ornek/` altındaki gerçek örnekleri doğrulaması. İkisi birden
 * depo kapısının o dosya için tuttuğu ağdır; biri bile düşerse mutant ÖLÜR.
 * İkisinden de sağ çıkan bir mutant, o kuralın zorlanmasını tamamen
 * kaldırabileceğinizi ve deponun bunu fark etmeyeceğini söyler.
 *
 * Mutantlar `arac/` içine yazılır ve silinir: `sema-dogrula.js` şemaları
 * `__dirname/..` üzerinden bulur, başka bir dizinden koşan kopya hiçbir şey
 * okuyamaz ve "öldü" sanılırdı — yanlış bir yeşil.
 *
 * Kendini de korur: bir mutasyonun arama metni kaynakta tam olarak bir kez
 * geçmiyorsa araç HATA verir. Doğrulayıcı yeniden düzenlendiğinde bu liste
 * sessizce eskimesin diye.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HEDEF = path.join(__dirname, 'sema-dogrula.js');
const ayrinti = process.argv.includes('--ayrinti');

/** Her biri: tek bir zorlama noktasını etkisizleştiren en küçük değişiklik. */
const MUTASYONLAR = [
  ['type', 'if (!tipler.some((t) => tipUygun(deger, t))) {', 'if (false) {'],
  ['const', "if ('const' in sema && deger !== sema.const)", "if (false)"],
  ['enum', 'if (sema.enum && !sema.enum.includes(deger))', 'if (false)'],
  ['pattern', 'if (sema.pattern && !new RegExp(sema.pattern).test(deger))', 'if (false)'],
  ['minLength', 'if (sema.minLength !== undefined && deger.length < sema.minLength)', 'if (false)'],
  ['maxLength', 'if (sema.maxLength !== undefined && deger.length > sema.maxLength)', 'if (false)'],
  ['minimum', 'if (sema.minimum !== undefined && deger < sema.minimum)', 'if (false)'],
  ['maximum', 'if (sema.maximum !== undefined && deger > sema.maximum)', 'if (false)'],
  ['minItems', 'if (sema.minItems !== undefined && deger.length < sema.minItems)', 'if (false)'],
  ['maxItems', 'if (sema.maxItems !== undefined && deger.length > sema.maxItems)', 'if (false)'],
  ['uniqueItems', 'if (sema.uniqueItems && new Set(deger.map((x) => JSON.stringify(x))).size !== deger.length)', 'if (false)'],
  ['items', 'if (sema.items) deger.forEach', 'if (false) deger.forEach'],
  ['required', 'for (const alan of sema.required || []) {', 'for (const alan of []) {'],
  ['additionalProperties', 'if (sema.additionalProperties === false && sema.properties) {', 'if (false) {'],
  ['properties', "for (const [alan, altSema] of Object.entries(sema.properties || {})) {", 'for (const [alan, altSema] of []) {'],
  ['allOf', 'for (const alt of sema.allOf || []) {', 'for (const alt of []) {'],
  ['if/then', 'if (sema.if && sema.then && gecerliMi(deger, sema.if, kok)) {', 'if (false) {'],
  ['bilinmeyen anahtar', "throw new Error(`${yol}: doğrulayıcı '${anahtar}' anahtar kelimesini bilmiyor`);", '/* etkisiz */;'],
  ['$ref', "if (!d) throw new Error('çözülemeyen $ref: ' + sema.$ref);", "if (!d) return {};"],
];

const kaynak = fs.readFileSync(HEDEF, 'utf8');

function kacKez(metin, parca) {
  return metin.split(parca).length - 1;
}

// Önce bütün arama metinleri kaynakta tam olarak bir kez geçiyor mu?
const bozuk = MUTASYONLAR.filter(([, bul]) => kacKez(kaynak, bul) !== 1);
if (bozuk.length) {
  console.error('MUTASYON LISTESI ESKIMIS — su desenler kaynakta tam olarak bir kez gecmiyor:');
  for (const [ad, bul] of bozuk) {
    console.error(`  ${ad}: ${kacKez(kaynak, bul)} kez\n    ${bul}`);
  }
  console.error('\nsema-dogrula.js yeniden duzenlendiyse bu listeyi de guncelle.');
  process.exit(2);
}

const hayatta = [];
for (const [ad, bul, koy] of MUTASYONLAR) {
  const mutantYolu = path.join(__dirname, `.sema-mutant-${ad.replace(/\W/g, '_')}.js`);
  fs.writeFileSync(mutantYolu, kaynak.replace(bul, koy));
  try {
    const oz = spawnSync(process.execPath, [mutantYolu, '--test'], { encoding: 'utf8' });
    const ornek = spawnSync(process.execPath, [mutantYolu], { encoding: 'utf8' });
    if (oz.status === 0 && ornek.status === 0) {
      hayatta.push(ad);
      console.log(`HAYATTA  ${ad} — zorlama kaldirildi, oz-test de ornekler de "temiz" dedi`);
      if (ayrinti) console.log((oz.stdout || '').split('\n').slice(-4).join('\n'));
    } else {
      const yakalayan = [oz.status !== 0 && 'oz-test', ornek.status !== 0 && 'ornekler']
        .filter(Boolean).join(' + ');
      console.log(`oldu     ${ad}  (${yakalayan})`);
    }
  } finally {
    fs.rmSync(mutantYolu, { force: true });
  }
}

console.log('');
if (hayatta.length) {
  console.log(`${hayatta.length}/${MUTASYONLAR.length} mutant hayatta: ${hayatta.join(', ')}`);
  console.log('Bu anahtar kelimeler icin depo kor: zorlamayi kaldirmak hicbir seyi');
  console.log('kirmiyor. sema-dogrula.js --test icine once BASARISIZ olan bir');
  console.log('kontrol ekle, sonra buraya geri don.');
  process.exit(1);
}
console.log(`${MUTASYONLAR.length}/${MUTASYONLAR.length} mutant oldu: her zorlama noktasi gercekten olculuyor.`);
