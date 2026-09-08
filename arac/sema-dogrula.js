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
  'maxItems', 'uniqueItems', 'items', '$ref', 'allOf', 'if', 'then', '$defs'
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

  if (sema.type) {
    // type bir dizi olabilir: ["number", "null"] — biri tutuyorsa geçer.
    const tipler = Array.isArray(sema.type) ? sema.type : [sema.type];
    if (!tipler.some((t) => tipUygun(deger, t))) {
      ekle(`tip '${tipler.join('|')}' bekleniyordu, '${Array.isArray(deger) ? 'array' : deger === null ? 'null' : typeof deger}' geldi`);
      return hatalar; // tip yanlışsa gerisi anlamsız
    }
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
    if (sema.maxItems !== undefined && deger.length > sema.maxItems) ekle(`en fazla ${sema.maxItems} öğe olmalı (${deger.length})`);
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
  // Doğrudan (allOf'suz) if/then: DESTEKLENEN listesinde olduğu için sessizce
  // geçiyordu — sessizce geçen doğrulayıcı doğrulamıyor demektir.
  if (sema.if && sema.then && gecerliMi(deger, sema.if, kok)) {
    hatalar.push(...dogrula(deger, sema.then, kok, yol));
  }
  return hatalar;
}

// --- şemanın ifade edemediği çapraz kontroller (yalnızca görev sözleşmesi) --
// ADR-002: "iki adım aynı alana yazamaz" ve graf bir DAG'dır. Bunlar tek bir
// adımın şemasıyla ifade edilemez; kontrol edilmezse karar temenniye döner (AP3).
function gorevCaprazKontrol(gorev) {
  const hatalar = [];
  const adimlar = ((gorev.graph || {}).steps) || [];
  const idler = new Set(adimlar.map((a) => a.id));

  for (const adim of adimlar) {
    for (const bagimlilik of adim.depends_on || []) {
      if (!idler.has(bagimlilik)) hatalar.push(`adım '${adim.id}': tanımsız bağımlılık '${bagimlilik}'`);
      if (bagimlilik === adim.id) hatalar.push(`adım '${adim.id}': kendine bağımlı`);
    }
  }

  // Döngü: topolojik sıralama tamamlanamıyorsa döngü vardır.
  const kalan = new Map(adimlar.map((a) => [a.id, new Set((a.depends_on || []).filter((d) => idler.has(d)))]));
  let ilerledi = true;
  while (kalan.size && ilerledi) {
    ilerledi = false;
    for (const [id, bag] of [...kalan]) {
      if (bag.size === 0) {
        kalan.delete(id);
        for (const b of kalan.values()) b.delete(id);
        ilerledi = true;
      }
    }
  }
  if (kalan.size) hatalar.push(`graf döngü içeriyor: ${[...kalan.keys()].join(', ')}`);

  // Aynı yola yazan iki adım (ADR-002 / İ1 S3): birleştirici yazılmaz, çakışma
  // grafın kendisinde çözülür.
  const yazan = new Map();
  for (const adim of adimlar) {
    for (const yol of adim.writes || []) {
      if (yazan.has(yol)) hatalar.push(`iki adım aynı alana yazıyor: '${yol}' (${yazan.get(yol)} ve ${adim.id})`);
      else yazan.set(yol, adim.id);
    }
  }

  // Kayıttaki her adım grafta var mı?
  for (const kayit of ((gorev.run || {}).step_records) || []) {
    if (!idler.has(kayit.step_id)) hatalar.push(`adım kaydı grafta olmayan adıma bakıyor: '${kayit.step_id}'`);
  }
  return hatalar;
}

// --- öz-test: bozuk sözleşmeler reddedilmeli -------------------------------

function ozTest(kok, temel) {
  const boz = (fn) => { const k = JSON.parse(JSON.stringify(temel)); fn(k); return k; };
  const durumlar = [
    ['ajan: sürüm 1.0 kabul edilmemeli', boz((k) => { k.contract_version = '1.0'; })],
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

// Görev sözleşmesi öz-testi: ADR-002/ADR-003/ADR-004'ün kuralları şemada
// gerçekten zorlanıyor mu?
function ozTestGorev(kok, temel) {
  const boz = (fn) => { const k = JSON.parse(JSON.stringify(temel)); fn(k); return k; };
  return [
    ['görev: yan etkili adımda telafi zorunlu', boz((k) => { delete k.graph.steps[0].compensation; })],
    ['görev: telafinin imkânsız hâli human-gate olmalı', boz((k) => { k.graph.steps[0].compensation.on_impossible = 'sessiz-gec'; })],
    ['görev: deterministik değerlendirmede checker zorunlu', boz((k) => { delete k.graph.steps[0].evaluation.checker; })],
    ['görev: duzelt modunda max_critique_items zorunlu', boz((k) => { delete k.graph.steps[0].retry.max_critique_items; })],
    ['görev: BITTI kaydında evaluation_result zorunlu', boz((k) => { delete k.run.step_records[0].evaluation_result; })],
    ['görev: BASARISIZ kaydında hata türü zorunlu', boz((k) => {
      const r = k.run.step_records[k.run.step_records.length - 1];
      r.status = 'BASARISIZ'; delete r.error_type; r.ended_at = r.started_at;
    })],
    ['görev: ONAY_BEKLIYOR kaydında approval_ref zorunlu', boz((k) => {
      const r = k.run.step_records[k.run.step_records.length - 1];
      r.status = 'ONAY_BEKLIYOR'; delete r.approval_ref;
    })],
    ['görev: DEGERLENDIRILMEDI insan kapısına bağlanmalı', boz((k) => {
      const r = k.run.step_records[0]; r.evaluation_result = 'DEGERLENDIRILMEDI'; delete r.approval_ref;
    })],
    ['görev: bilinmeyen durum adı reddedilmeli', boz((k) => { k.run.step_records[0].status = 'TAMAM'; })],
    ['görev: hata türü serbest metin olamaz', boz((k) => {
      const r = k.run.step_records[0]; r.error_type = 'bir seyler ters gitti';
    })],
    ['görev: yerel biçimli tarih reddedilmeli', boz((k) => { k.task.created_at = '08.09.2026 14:16'; })],
    ['görev: bütçe alanı çıkarılamaz', boz((k) => { delete k.task.budget; })],
    ['görev: tanımsız alan reddedilmeli', boz((k) => { k.graph.steps[0].yes_always = true; })]
  ];
}

// Mesaj sözleşmesi öz-testi: ADR-002'nin "ajan-ajan doğrudan mesaj yok" kuralı
// ve ADR-005'in iki eksen ayrımı şemada tutuyor mu?
function ozTestMesaj(kok, ornekler) {
  const ile = (kind) => JSON.parse(JSON.stringify(ornekler.find((o) => o.kind === kind)));
  const durumlar = [];
  const devir = ile('handoff');
  if (devir) {
    durumlar.push(['mesaj: ajandan ajana doğrudan mesaj reddedilmeli', (() => {
      const m = JSON.parse(JSON.stringify(devir)); m.to = { kind: 'agent', id: 'kod-gozden-gecirici' }; return m;
    })()]);
    durumlar.push(['mesaj: devir tavanı (3) aşılamaz', (() => {
      const m = JSON.parse(JSON.stringify(devir)); m.payload.handoff_depth = 4; return m;
    })()]);
    durumlar.push(['mesaj: devirde gerekçe zorunlu', (() => {
      const m = JSON.parse(JSON.stringify(devir)); delete m.payload.reason; return m;
    })()]);
  }
  const onay = ile('approval_request');
  if (onay) {
    durumlar.push(['mesaj: onay isteğinde kapsam boş olamaz', (() => {
      const m = JSON.parse(JSON.stringify(onay)); m.payload.scope = []; return m;
    })()]);
    durumlar.push(['mesaj: şiddet ve güvenilirlik tek "risk skoru"na ezilemez', (() => {
      const m = JSON.parse(JSON.stringify(onay));
      delete m.payload.severity; delete m.payload.reliability; m.payload.risk_score = 0.9; return m;
    })()]);
    durumlar.push(['mesaj: onay isteği kayda bağlanmalı', (() => {
      const m = JSON.parse(JSON.stringify(onay)); delete m.payload.recorded_in; return m;
    })()]);
  }
  const elestiri = ile('critique');
  if (elestiri) {
    durumlar.push(['mesaj: eleştiri üst sınırı (20) aşılamaz', (() => {
      const m = JSON.parse(JSON.stringify(elestiri));
      const o = m.payload.items[0];
      m.payload.items = Array.from({ length: 21 }, (_, i) => ({ ...o, id: `madde-${i + 1}` }));
      return m;
    })()]);
    durumlar.push(['mesaj: eleştiri maddesinde düzeltme ipucu zorunlu', (() => {
      const m = JSON.parse(JSON.stringify(elestiri)); delete m.payload.items[0].fix_hint; return m;
    })()]);
  }
  const hata = ile('error');
  if (hata) {
    durumlar.push(['mesaj: hatada makine-okur tür zorunlu', (() => {
      const m = JSON.parse(JSON.stringify(hata)); delete m.payload.error_type; return m;
    })()]);
  }
  const atama = ile('assignment');
  if (atama) {
    durumlar.push(['mesaj: atamayı yalnızca orkestratör gönderir', (() => {
      const m = JSON.parse(JSON.stringify(atama)); m.from = { kind: 'agent', id: 'kanit-denetcisi' }; return m;
    })()]);
  }
  return durumlar;
}

function testKos(baslik, kok, durumlar) {
  console.log(`\n${baslik}`);
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
const oku = (...p) => JSON.parse(fs.readFileSync(path.join(kokDizin, ...p), 'utf8'));
const dizinDosyalari = (...p) => {
  const d = path.join(kokDizin, ...p);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort() : [];
};

const SEMALAR = [
  { ad: 'agent', sema: 'agent.schema.json', ornekDizin: ['contracts', 'ornek'], enAz: 2 },
  { ad: 'task', sema: 'task.schema.json', ornekDizin: ['contracts', 'ornek', 'gorev'], enAz: 1 },
  { ad: 'message', sema: 'message.schema.json', ornekDizin: ['contracts', 'ornek', 'mesaj'], enAz: 3 }
];

let toplamHata = 0;
const yuklenen = {};

for (const s of SEMALAR) {
  const kok = oku('contracts', s.sema);
  const dosyalar = dizinDosyalari(...s.ornekDizin);
  yuklenen[s.ad] = { kok, ornekler: [] };
  console.log(`\nŞema: contracts/${s.sema} (contract_version ${kok.properties.contract_version.const}) — ${dosyalar.length} örnek`);
  if (dosyalar.length < s.enAz) {
    console.log(`✗ En az ${s.enAz} örnek bekleniyor.`);
    toplamHata++;
  }
  for (const dosya of dosyalar) {
    const icerik = oku(...s.ornekDizin, dosya);
    const hatalar = dogrula(icerik, kok, kok, '');
    if (s.ad === 'task') hatalar.push(...gorevCaprazKontrol(icerik));
    if (hatalar.length === 0) {
      const eksik = kok.required.filter((a) => !(a in icerik));
      yuklenen[s.ad].ornekler.push(icerik);
      console.log(`✓ ${dosya} — geçerli, ${kok.required.length - eksik.length}/${kok.required.length} zorunlu alan dolu`);
    } else {
      console.log(`✗ ${dosya} — ${hatalar.length} hata:`);
      hatalar.forEach((h) => console.log(`    ${h}`));
      toplamHata += hatalar.length;
    }
  }
}

if (process.argv.includes('--test')) {
  const ajan = yuklenen.agent.ornekler[0];
  const gorev = yuklenen.task.ornekler[0];
  if (!ajan || !gorev) { console.log('\nÖz-test için her şemadan en az bir geçerli örnek gerekiyor.'); toplamHata++; }
  else {
    console.log('\nÖz-test — bozulmuş sözleşmeler reddedilmeli:');
    toplamHata += ozTest(yuklenen.agent.kok, ajan);
    toplamHata += testKos('Görev sözleşmesi:', yuklenen.task.kok, ozTestGorev(yuklenen.task.kok, gorev));
    toplamHata += testKos('Mesaj sözleşmesi:', yuklenen.message.kok, ozTestMesaj(yuklenen.message.kok, yuklenen.message.ornekler));
    // Çapraz kontrolün kendisi de sınanır: bozulmuş graf yakalanmalı.
    console.log('\nGraf çapraz kontrolü:');
    const grafDurumlari = [
      ['iki adım aynı alana yazamaz', (() => {
        const g = JSON.parse(JSON.stringify(gorev));
        const hedef = (g.graph.steps[0].writes || ['docs/x.md'])[0];
        g.graph.steps[1].writes = [hedef];
        return g;
      })()],
      ['döngü yakalanmalı', (() => {
        const g = JSON.parse(JSON.stringify(gorev));
        g.graph.steps[0].depends_on = [g.graph.steps[g.graph.steps.length - 1].id];
        return g;
      })()],
      ['tanımsız bağımlılık yakalanmalı', (() => {
        const g = JSON.parse(JSON.stringify(gorev));
        g.graph.steps[1].depends_on = ['olmayan-adim'];
        return g;
      })()]
    ];
    for (const [ad, bozuk] of grafDurumlari) {
      const h = gorevCaprazKontrol(bozuk);
      if (h.length === 0) { console.log(`  ✗ ${ad} — ama kontrol GEÇTİ dedi`); toplamHata++; }
      else console.log(`  ✓ ${ad}`);
    }
  }
}

console.log(toplamHata === 0 ? '\nSonuç: temiz.' : `\nSonuç: ${toplamHata} hata.`);
process.exit(toplamHata === 0 ? 0 : 1);
