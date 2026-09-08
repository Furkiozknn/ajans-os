#!/usr/bin/env node
// Sözleşme doğrulayıcı — bağımlılıksız, JSON Schema'nın bu depoda kullanılan
// alt kümesini destekler: type, required, properties, additionalProperties:false,
// enum, const, pattern, minLength/maxLength, minimum/maximum, minItems,
// uniqueItems, items, $ref (#/$defs/...), allOf, if/then.
//
// Kullanım:
//   node arac/sema-dogrula.js          contracts/ornek/*.json dosyalarını doğrular
//   node arac/sema-dogrula.js --test   doğrulayıcının kendi öz-testi (bozuk sözleşmeler reddedilmeli)
//
// Neden ajv değil: bu depoda hiç bağımlılık yok ve olmasın (arac/ altındaki dört
// script de saf Node). Desteklenmeyen bir anahtar kelime görürse hata verir —
// sessizce geçmez, çünkü sessizce geçen doğrulayıcı doğrulamıyor demektir.

const fs = require('fs');
const path = require('path');

const DESTEKLENEN = new Set([
  '$schema', '$id', 'title', 'description', 'default', 'examples',
  'type', 'required', 'properties', 'additionalProperties', 'enum', 'const',
  'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems',
  'uniqueItems', 'items', '$ref', 'allOf', 'if', 'then', '$defs'
]);

function tipUygun(deger, tip) {
  switch (tip) {
    case 'object': return deger !== null && typeof deger === 'object' && !Array.isArray(deger);
    case 'array': return Array.isArray(deger);
    case 'string': return typeof deger === 'string';
    case 'number': return typeof deger === 'number';
    case 'integer': return typeof deger === 'number' && Number.isInteger(deger);
    case 'boolean': return typeof deger === 'boolean';
    case 'null': return deger === null;
    default: throw new Error('bilinmeyen tip: ' + tip);
  }
}

function coz(sema, kok) {
  if (!sema || !sema.$ref) return sema;
  const yol = sema.$ref.replace(/^#\//, '').split('/');
  let d = kok;
  for (const p of yol) d = d[p];
  if (!d) throw new Error('çözülemeyen $ref: ' + sema.$ref);
  return d;
}

// Bir alt şemayı sessizce geçer mi diye sınar; if/then için kullanılır.
function gecerliMi(deger, sema, kok) {
  return dogrula(deger, sema, kok, '').length === 0;
}

function dogrula(deger, sema, kok, yol) {
  const hatalar = [];
  sema = coz(sema, kok);

  for (const anahtar of Object.keys(sema)) {
    if (!DESTEKLENEN.has(anahtar)) {
      throw new Error(`${yol}: doğrulayıcı '${anahtar}' anahtar kelimesini bilmiyor`);
    }
  }
  const ekle = (m) => hatalar.push(`${yol || '<kök>'}: ${m}`);

  if (sema.type && !tipUygun(deger, sema.type)) {
    ekle(`tip '${sema.type}' bekleniyordu, '${Array.isArray(deger) ? 'array' : deger === null ? 'null' : typeof deger}' geldi`);
    return hatalar; // tip yanlışsa gerisi anlamsız
  }
  if ('const' in sema && deger !== sema.const) ekle(`değer ${JSON.stringify(sema.const)} olmalı, ${JSON.stringify(deger)} yazılmış`);
  if (sema.enum && !sema.enum.includes(deger)) ekle(`değer şunlardan biri olmalı: ${sema.enum.join(', ')} — ${JSON.stringify(deger)} yazılmış`);

  if (typeof deger === 'string') {
    if (sema.pattern && !new RegExp(sema.pattern).test(deger)) ekle(`desene uymuyor: ${sema.pattern}`);
    if (sema.minLength !== undefined && deger.length < sema.minLength) ekle(`en az ${sema.minLength} karakter olmalı (${deger.length})`);
    if (sema.maxLength !== undefined && deger.length > sema.maxLength) ekle(`en fazla ${sema.maxLength} karakter olmalı (${deger.length})`);
  }
  if (typeof deger === 'number') {
    if (sema.minimum !== undefined && deger < sema.minimum) ekle(`en az ${sema.minimum} olmalı`);
    if (sema.maximum !== undefined && deger > sema.maximum) ekle(`en fazla ${sema.maximum} olmalı`);
  }
  if (Array.isArray(deger)) {
    if (sema.minItems !== undefined && deger.length < sema.minItems) ekle(`en az ${sema.minItems} öğe olmalı (${deger.length})`);
    if (sema.uniqueItems && new Set(deger.map((x) => JSON.stringify(x))).size !== deger.length) ekle('öğeler benzersiz olmalı');
    if (sema.items) deger.forEach((o, i) => hatalar.push(...dogrula(o, sema.items, kok, `${yol}[${i}]`)));
  }
  if (deger !== null && typeof deger === 'object' && !Array.isArray(deger)) {
    for (const alan of sema.required || []) {
      if (!(alan in deger)) ekle(`zorunlu alan eksik: ${alan}`);
    }
    if (sema.additionalProperties === false && sema.properties) {
      for (const alan of Object.keys(deger)) {
        if (!(alan in sema.properties)) ekle(`tanımsız alan: ${alan}`);
      }
    }
    for (const [alan, altSema] of Object.entries(sema.properties || {})) {
      if (alan in deger) hatalar.push(...dogrula(deger[alan], altSema, kok, yol ? `${yol}.${alan}` : alan));
    }
  }

  for (const alt of sema.allOf || []) {
    if (alt.if) {
      if (gecerliMi(deger, alt.if, kok)) hatalar.push(...dogrula(deger, alt.then, kok, yol));
    } else {
      hatalar.push(...dogrula(deger, alt, kok, yol));
    }
  }
  return hatalar;
}

// --- öz-test: bozuk sözleşmeler reddedilmeli -------------------------------

function ozTest(kok, temel) {
  const boz = (fn) => { const k = JSON.parse(JSON.stringify(temel)); fn(k); return k; };
  const durumlar = [
    ['sürüm 1.0 kabul edilmemeli', boz((k) => { k.contract_version = '1.0'; })],
    ['identity.status eksikse reddedilmeli', boz((k) => { delete k.identity.status; })],
    ['tanımsız alan reddedilmeli', boz((k) => { k.uydurma_alan = 1; })],
    ['risk=high + scope=write aracı insan kapısız olmamalı', boz((k) => {
      k.tools.push({ name: 'Bash', purpose: 'komut', scope: 'write', risk: 'high', requires_human_approval: false });
    })],
    ['yan etkili ajanda compensation.method zorunlu', boz((k) => {
      k.recovery_strategy.compensation = { side_effects: true };
    })],
    ['retry varsa max_critique_items zorunlu', boz((k) => {
      k.recovery_strategy.retry = { max_attempts: 2, backoff: 'exponential' };
    })],
    ['bellek yazımı varsa retention zorunlu', boz((k) => {
      k.memory_scope.write = ['project']; delete k.memory_scope.retention;
    })],
    ['pii_allowed=true ise gerekçe zorunlu', boz((k) => { k.memory_scope.pii_allowed = true; })],
    ['mode=iterative ise max_iterations zorunlu', boz((k) => {
      k.workflow.mode = 'iterative'; delete k.workflow.max_iterations;
    })],
    ['permissions.filesystem.delete true olamaz', boz((k) => { k.permissions.filesystem.delete = true; })],
    ['failure_modes boş olamaz', boz((k) => { k.failure_modes = []; })],
    ['id kebab-case olmalı', boz((k) => { k.identity.id = 'Kod_Gozden_Gecirici'; })]
  ];
  let hata = 0;
  for (const [ad, bozuk] of durumlar) {
    const h = dogrula(bozuk, kok, kok, '');
    if (h.length === 0) { console.log(`  ✗ ${ad} — ama doğrulayıcı GEÇTİ dedi`); hata++; }
    else console.log(`  ✓ ${ad}`);
  }
  return hata;
}

// --- ana ------------------------------------------------------------------

const kokDizin = path.resolve(__dirname, '..');
const semaYolu = path.join(kokDizin, 'contracts', 'agent.schema.json');
const kok = JSON.parse(fs.readFileSync(semaYolu, 'utf8'));
const ornekDizin = path.join(kokDizin, 'contracts', 'ornek');
const ornekler = fs.existsSync(ornekDizin)
  ? fs.readdirSync(ornekDizin).filter((f) => f.endsWith('.json')).sort()
  : [];

let toplamHata = 0;
console.log(`Şema: contracts/agent.schema.json (contract_version ${kok.properties.contract_version.const})`);
console.log(`Örnek sözleşme: ${ornekler.length} dosya\n`);

if (ornekler.length < 2) {
  console.log('✗ En az iki tam örnek sözleşme bekleniyor (yol haritası "Agent Architecture" maddesi).');
  toplamHata++;
}

for (const dosya of ornekler) {
  const icerik = JSON.parse(fs.readFileSync(path.join(ornekDizin, dosya), 'utf8'));
  const hatalar = dogrula(icerik, kok, kok, '');
  if (hatalar.length === 0) {
    const zorunlu = kok.required.filter((a) => !(a in icerik));
    console.log(`✓ ${dosya} — geçerli, ${kok.required.length - zorunlu.length}/${kok.required.length} zorunlu alan dolu`);
  } else {
    console.log(`✗ ${dosya} — ${hatalar.length} hata:`);
    hatalar.forEach((h) => console.log(`    ${h}`));
    toplamHata += hatalar.length;
  }
}

if (process.argv.includes('--test')) {
  const temel = ornekler.length
    ? JSON.parse(fs.readFileSync(path.join(ornekDizin, ornekler[0]), 'utf8'))
    : null;
  if (!temel) { console.log('\nÖz-test için en az bir geçerli örnek gerekiyor.'); toplamHata++; }
  else {
    console.log('\nÖz-test — bozulmuş sözleşmeler reddedilmeli:');
    toplamHata += ozTest(kok, temel);
  }
}

console.log(toplamHata === 0 ? '\nSonuç: temiz.' : `\nSonuç: ${toplamHata} hata.`);
process.exit(toplamHata === 0 ? 0 : 1);
