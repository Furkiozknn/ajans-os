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

// ADR-005/ADR-007: izin kararının şemayla ifade edilemeyen kuralları. Şema tek
// alana bakar; bunlar alanlar ARASI tutarlılıktır ve kontrol edilmezse karar
// temenniye döner (AP3 → kural 4).
function izinCaprazKontrol(izin) {
  const hatalar = [];
  const checks = izin.checks || [];
  const gercek = checks.filter((c) => c.shadow !== true);

  // D5: denetleyici hatası güvenli tarafa düşer, ALLOW'a değil.
  if (gercek.some((c) => c.result === 'hata') && izin.decision === 'ALLOW') {
    hatalar.push('denetleyici hatası varken ALLOW verilemez (D5: hata yolu güvenli tarafa düşer)');
  }
  // D11: denetlenmemiş temiz değildir.
  if (izin.reliability === 'guclu' && gercek.some((c) => c.result === 'calistirilmadi' || c.result === 'hata')) {
    hatalar.push("çalıştırılmamış veya hata veren denetleyici varken güvenilirlik 'guclu' olamaz (D11)");
  }
  if (gercek.length === 0 && izin.reliability !== 'kontrol-edilmedi') {
    hatalar.push("hiç denetleyici çalışmadıysa güvenilirlik 'kontrol-edilmedi' olmalı");
  }
  // Kural 6: gölge moddaki detektör sinyal üretir, yetki almaz.
  if (izin.decision === 'BLOCK' && gercek.every((c) => c.result !== 'kaldi') &&
      checks.some((c) => c.shadow === true && c.result === 'kaldi')) {
    hatalar.push('gölge moddaki denetleyici tek başına BLOCK gerekçesi olamaz (kural 6)');
  }
  // D4: sır tek bir hedefe kapsamlanır ve o hedef kapsamda yazılı olmalı.
  for (const sir of izin.secret_injection || []) {
    if (!(izin.scope || []).some((s) => s === sir.target || s.includes(sir.target))) {
      hatalar.push(`sır '${sir.name}' kapsamda olmayan bir hedefe bağlanmış: '${sir.target}'`);
    }
  }
  // Süreli izin geçmişe veremez.
  const bitis = (izin.grant || {}).expires_at;
  if (bitis && izin.at && Date.parse(bitis) <= Date.parse(izin.at)) {
    hatalar.push('grant.expires_at kararın verildiği andan sonra olmalı');
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

// İzin sözleşmesi öz-testi: ADR-005'in dört kuralı ve ADR-007'nin sürüm bağı
// şemada gerçekten zorlanıyor mu, yoksa yalnızca alan açıklamasında mı yazıyor?
// Span öz-testi: §8'in sekiz kuralının her biri bir bozma denemesiyle sınanır.
// Bir kural burada karşılığı olmadan belgede kalırsa, o kural yoktur (AP3).
function ozTestSpan(ornekler) {
  const cagri = ornekler.find((o) => o.operation === 'inference' && o.cost && o.cost.usd !== null);
  const kok = ornekler.find((o) => o.operation === 'run');
  const izin = ornekler.find((o) => o.operation === 'permission_check');
  const durumlar = [];
  const b = (temel, fn) => { const k = JSON.parse(JSON.stringify(temel)); fn(k); return k; };
  if (cagri) {
    durumlar.push(['span: maliyet null iken sebep zorunlu (D6)', b(cagri, (k) => { k.cost.usd = null; })]);
    durumlar.push(['span: maliyet biliniyorken sebep yazilamaz (D6)', b(cagri, (k) => { k.cost.unknown_reason = 'olculmedi'; })]);
    durumlar.push(['span: inference usage olmadan yazilamaz (D3)', b(cagri, (k) => { delete k.usage; })]);
    durumlar.push(['span: inference model olmadan yazilamaz (D3)', b(cagri, (k) => { delete k.model; })]);
    durumlar.push(['span: icerik beyansiz kaydedilemez (§9)', b(cagri, (k) => { k.content = { input: 'x' }; })]);
    durumlar.push(['span: bitis baslangictan once olamaz', b(cagri, (k) => { k.ended_at = '2026-09-08T15:00:00+03:00'; })]);
    durumlar.push(['span: trace_id ile run_id ayrisamaz (§3)', b(cagri, (k) => { k.trace_id = 'baska-kosu'; })]);
    durumlar.push(['span: run disindaki span parentsiz olamaz (D4)', b(cagri, (k) => { k.parent_span_id = null; })]);
  }
  if (kok) {
    durumlar.push(['span: kok span parent tasiyamaz (D4)', b(kok, (k) => { k.parent_span_id = 'span-x'; })]);
    durumlar.push(['span: ajan/kosu span\'i token tasiyamaz (D3)', b(kok, (k) => { k.usage = { input_tokens: 1, output_tokens: 1 }; })]);
    durumlar.push(['span: ajan/kosu span\'i maliyet tasiyamaz (D3)', b(kok, (k) => {
      k.cost = { usd: 1, price_table: { version: '1', digest: 'sha256:' + '0'.repeat(64) } };
    })]);
  }
  if (izin) {
    durumlar.push(['span: golge sinyal izin karari tasiyamaz (AP5)', b(izin, (k) => { k.shadow = true; })]);
    durumlar.push(['span: bilinmeyen operation sinifi reddedilir', b(izin, (k) => { k.operation = 'guardrail'; })]);
    durumlar.push(['span: uydurma alan eklenemez', b(izin, (k) => { k.risk_score = 0.7; })]);
  }
  return durumlar;
}

function ozTestIzin(ornekler) {
  const ile = (karar) => {
    const o = ornekler.find((x) => x.decision === karar);
    return o ? JSON.parse(JSON.stringify(o)) : null;
  };
  const durumlar = [];
  const izinli = ile('ALLOW');
  if (izinli) {
    const b = (fn) => { const k = JSON.parse(JSON.stringify(izinli)); fn(k); return k; };
    durumlar.push(['izin: sabit sınıra dokunan çağrı ALLOW olamaz', b((k) => { k.hard_limit = { hit: true, rule: 'kalici-silme' }; })]);
    durumlar.push(['izin: geri alınamaz işlem ALLOW olamaz', b((k) => { k.irreversible = true; })]);
    durumlar.push(["izin: 'kontrol-edilmedi' güvenilirlikle ALLOW verilemez", b((k) => { k.reliability = 'kontrol-edilmedi'; })]);
    durumlar.push(['izin: ALLOW binding olmadan yazılamaz (ADR-007)', b((k) => { delete k.binding; })]);
    durumlar.push(['izin: kapsam boş küme olamaz', b((k) => { k.scope = []; })]);
    durumlar.push(['izin: tek "risk skoru" alanı uydurulamaz', b((k) => {
      delete k.severity; delete k.reliability; k.risk_score = 0.2;
    })]);
    durumlar.push(['izin: "--yes-always" karşılığı bir alan yazılamaz', b((k) => { k.yes_always = true; })]);
    durumlar.push(['izin: sırrın değeri sözleşmeye yazılamaz', b((k) => {
      k.secret_injection = [{ name: 'GITHUB_TOKEN', target: 'api.github.com', value: 'ghp_xxx' }];
    })]);
    durumlar.push(['izin: delete işlemi insan kapısına düşmek zorunda', b((k) => { k.action.operation = 'delete'; })]);
    durumlar.push(['izin: süreli izin binding/expires_at olmadan verilemez', b((k) => { k.grant = { mode: 'sureli' }; })]);
    durumlar.push(['izin: içerik özeti biçimi zorlanır', b((k) => { k.binding.digest = 'v1.4.2'; })]);
    durumlar.push(['izin: belleğe yazma düşük şiddetli sayılamaz', b((k) => {
      k.action.operation = 'memory_write'; k.severity = 'dusuk';
    })]);
  }
  const kapi = ile('HUMAN_REQUIRED');
  if (kapi) {
    const b = (fn) => { const k = JSON.parse(JSON.stringify(kapi)); fn(k); return k; };
    durumlar.push(['izin: insan kapısı kayda bağlanmalı', b((k) => { delete k.recorded_in; })]);
    durumlar.push(['izin: insan kapısı onay isteğine bağlanmalı', b((k) => { delete k.gate_ref; })]);
    durumlar.push(['izin: sabit sınır tetiklendiyse hangi kural olduğu yazılmalı', b((k) => { delete k.hard_limit.rule; })]);
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

// 06-GOZLEM.md §8: span sözleşmesinin şemayla ifade edilemeyen sekiz kuralı.
// Şema tek bir alanı doğrular; bu kurallar alanlar arasındadır.
function spanCaprazKontrol(s) {
  const h = [];
  const cagri = s.operation === 'inference';
  // 1 + 2: para ve token yalnızca çağrı sınırında (D3).
  for (const alan of ['model', 'usage', 'cost']) {
    if (!cagri && alan in s) h.push(`D3: '${alan}' yalnizca operation=inference span'inde bulunabilir (burada: ${s.operation}).`);
    if (cagri && !(alan in s)) h.push(`D3: inference span'i '${alan}' tasimak zorundadir.`);
  }
  // 3: bilinmeyen maliyetin sebebi yazilir (D6).
  if (s.cost) {
    if (s.cost.usd === null && !s.cost.unknown_reason) h.push("D6: cost.usd null ise unknown_reason zorunludur.");
    if (s.cost.usd !== null && s.cost.unknown_reason) h.push("D6: maliyet biliniyorken unknown_reason yazilamaz.");
  }
  // 4: icerik kaydi acikca beyan edilir (§9).
  if (s.content && s.content_recording !== 'acik') h.push("§9: content alani varsa content_recording 'acik' olmalidir.");
  // 5: koke gore parent (D4).
  if (s.operation === 'run' && s.parent_span_id !== null) h.push("D4: kok (run) span'inde parent_span_id null olmalidir.");
  if (s.operation !== 'run' && s.parent_span_id === null) h.push("D4: run disindaki her span bir ust span'e baglanir.");
  // 6: zaman tutarliligi.
  if (s.ended_at && Date.parse(s.ended_at) < Date.parse(s.started_at)) h.push("ended_at, started_at'ten once olamaz.");
  // 7: golge sinyal karar tasiyamaz (AP5 -> kural 6).
  if (s.shadow === true && s.operation === 'permission_check' && (s.attributes || {}).decision) {
    h.push("AP5: golge moddaki span bir izin karari tasiyamaz.");
  }
  // 8: tek kosu, tek iz.
  if (s.trace_id !== s.run_id) h.push("§3: trace_id ile run_id ayni kosuda ayrisamaz.");
  return h;
}

// Öneri sözleşmesi öz-testi: 07'nin kuralları şema ile çapraz kontrole
// dağılmış durumda; bozma denemesi hangisine takılırsa takılsın reddedilmiş
// sayılır. Hiçbirine takılmıyorsa o kural yok demektir.
function ozTestOneri(ornekler) {
  const temel = ornekler.find((o) => o.status === 'UYGULANDI') || ornekler[0];
  if (!temel) return [];
  const kopya = () => JSON.parse(JSON.stringify(temel));
  return [
    ['otomatik uygulama alani yazilamaz', (() => { const z = kopya(); z.auto_apply = true; return z; })()],
    ['onay kaydi olmadan UYGULANDI yazilamaz', (() => { const z = kopya(); delete z.approval; return z; })()],
    ['onaylayan bir bilesen olamaz', (() => { const z = kopya(); z.approval.by = 'orchestrator'; return z; })()],
    ['kalmis kapiyla uygulama olmaz', (() => { const z = kopya(); z.gates.threshold.result = 'kaldi'; return z; })()],
    ['calistirilmamis kapi gecmis sayilmaz', (() => { const z = kopya(); z.gates.valid.result = 'calistirilmadi'; return z; })()],
    ['tek basarili bayragi iki kapinin yerine gecemez', (() => { const z = kopya(); delete z.gates.threshold; z.gates.valid.result = 'gecti'; return z; })()],
    ['kanitsiz oneri yazilamaz', (() => { const z = kopya(); z.evidence.run_ids = []; return z; })()],
    ['canli sisteme bakan oneri yazilamaz', (() => { const z = kopya(); z.evidence.window_end = '2099-01-01T00:00:00+03:00'; return z; })()],
    ['surukleme sinyali esik kapisini geciremez', (() => { const z = kopya(); z.gates.threshold.evidence_kind = 'surukleme'; return z; })()],
    ['kapinin kendisi oneri hedefi olamaz', (() => { const z = kopya(); z.target.artifact = 'contracts/permission.schema.json'; return z; })()],
    ['sabit sinirlar oneri hedefi olamaz', (() => { const z = kopya(); z.target.artifact = 'docs/adr/ADR-005-izin-siniri.md'; return z; })()],
    ['surum ilerlemeden uygulama olmaz', (() => { const z = kopya(); z.target.version_after = z.target.version_before; return z; })()],
    ['geri sarma baska bir surume sabitlenemez', (() => { const z = kopya(); z.status = 'GERI_SARILDI'; z.reversal = { at: '2026-09-08T18:00:00+03:00', pin_to: '9.9', reason: 'deneme' }; return z; })()],
    ['kapali hedef listesi disina cikilamaz', (() => { const z = kopya(); z.target.kind = 'sabit-sinir'; return z; })()],
    ['red gerekcesi zorunludur', (() => { const z = kopya(); z.status = 'REDDEDILDI'; delete z.rejection_reason; return z; })()]
  ];
}

// Yasak hedefler: bu yollar bir onerinin hedefi olamaz (07 §4). Kapinin
// kendisini, sabit sinirlari ve programin kararlarini oneri degistiremez.
const ONERI_YASAK_HEDEF = [
  'contracts/permission.schema.json',
  'contracts/proposal.schema.json',
  'docs/adr/ADR-000',
  'docs/adr/ADR-005',
  'docs/mimari/05-GUVENLIK.md',
  'arac/sema-dogrula.js'
];

function oneriCaprazKontrol(o) {
  const h = [];
  const kapiGecti = (k) => k && k.result === 'gecti';
  // 1: oneri olmus bitmis bir kosu hakkindadir (06-GOZLEM D7).
  if (Date.parse(o.evidence.window_end) > Date.parse(o.at)) {
    h.push("D7: kanit penceresi onerinin yazildigi andan sonra kapanamaz — canli sisteme bakan oneri.");
  }
  if (Date.parse(o.evidence.window_start) > Date.parse(o.evidence.window_end)) {
    h.push("Kanit penceresi ters: window_start, window_end'den sonra olamaz.");
  }
  // 2: iki kapi ayridir ve ikisi de gecmeden uygulama olmaz (Desen A).
  if (o.status === 'UYGULANDI' && !(kapiGecti(o.gates.valid) && kapiGecti(o.gates.threshold))) {
    h.push("Desen A: UYGULANDI icin 'gecerli mi' ve 'esigi asti mi' kapilarinin IKISI de 'gecti' olmalidir.");
  }
  // 3: golge sinyal esik kapisini gecirmez (AP5 -> kural 6).
  if (o.gates.threshold.evidence_kind === 'surukleme') {
    h.push("AP5: surukleme sinyali golge modda yetki almaz, esik kapisinin kaniti olamaz.");
  }
  // 4: kapinin kendisi ve sabit sinirlar oneri hedefi olamaz (07 §4).
  const yol = o.target.artifact.replace(/\\/g, '/');
  for (const yasak of ONERI_YASAK_HEDEF) {
    if (yol.startsWith(yasak)) h.push(`07 §4: '${yol}' oneri hedefi olamaz — kapinin kendisi onerilerek degistirilemez.`);
  }
  // 5: surumsuz uygulama geri sarilamaz.
  if (o.status === 'UYGULANDI' && o.target.version_after === o.target.version_before) {
    h.push("Uygulanan oneri hedefin surumunu ilerletmek zorundadir; ayni surum geri sarmayi imkansiz kilar.");
  }
  // 6: geri sarma onceki surume sabitlenir (kural 9: geri alma degil, surum sabitleme).
  if (o.reversal && o.reversal.pin_to !== o.target.version_before) {
    h.push("Kural 9: geri sarma yalnizca target.version_before'a sabitlenebilir.");
  }
  // 7: insan kapisi bir bilesene devredilemez.
  if (o.approval && o.approval.by !== 'insan') h.push("AP1: onaylayan yalnizca 'insan' olabilir.");
  return h;
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
  { ad: 'message', sema: 'message.schema.json', ornekDizin: ['contracts', 'ornek', 'mesaj'], enAz: 3 },
  { ad: 'permission', sema: 'permission.schema.json', ornekDizin: ['contracts', 'ornek', 'izin'], enAz: 3 },
  { ad: 'span', sema: 'span.schema.json', ornekDizin: ['contracts', 'ornek', 'gozlem'], enAz: 3 },
  { ad: 'proposal', sema: 'proposal.schema.json', ornekDizin: ['contracts', 'ornek', 'oneri'], enAz: 3 }
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
    if (s.ad === 'permission') hatalar.push(...izinCaprazKontrol(icerik));
    if (s.ad === 'span') hatalar.push(...spanCaprazKontrol(icerik));
    if (s.ad === 'proposal') hatalar.push(...oneriCaprazKontrol(icerik));
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
    toplamHata += testKos('İzin sözleşmesi:', yuklenen.permission.kok, ozTestIzin(yuklenen.permission.ornekler));

    // İzin çapraz kontrolü: şemanın göremediği alanlar arası kurallar.
    console.log('\nİzin çapraz kontrolü:');
    const izinTemel = yuklenen.permission.ornekler.find((x) => x.decision === 'ALLOW');
    const izinDurumlari = izinTemel ? [
      ['denetleyici hatası ALLOW üretemez', (() => {
        const z = JSON.parse(JSON.stringify(izinTemel));
        z.checks[0].result = 'hata'; z.reliability = 'zayif'; return z;
      })()],
      ["çalıştırılmamış denetleyici 'guclu' güvenilirlik üretemez", (() => {
        const z = JSON.parse(JSON.stringify(izinTemel));
        z.checks[0].result = 'calistirilmadi'; return z;
      })()],
      ['hiç denetleyici yoksa güvenilirlik kontrol-edilmedi olmalı', (() => {
        const z = JSON.parse(JSON.stringify(izinTemel)); z.checks = []; return z;
      })()],
      ['sır kapsamda olmayan hedefe bağlanamaz', (() => {
        const z = JSON.parse(JSON.stringify(izinTemel));
        z.secret_injection = [{ name: 'GITHUB_TOKEN', target: 'api.gitlab.com' }]; return z;
      })()],
      ['süreli izin geçmişe verilemez', (() => {
        const z = JSON.parse(JSON.stringify(izinTemel));
        z.binding.digest = z.binding.digest || 'sha256:' + '0'.repeat(64);
        z.grant = { mode: 'sureli', expires_at: '2026-09-08T14:00:00+03:00', max_calls: 5 };
        return z;
      })()]
    ] : [];
    for (const [ad, bozuk] of izinDurumlari) {
      const h = izinCaprazKontrol(bozuk);
      if (h.length === 0) { console.log(`  ✗ ${ad} — ama kontrol GEÇTİ dedi`); toplamHata++; }
      else console.log(`  ✓ ${ad}`);
    }

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

    // Span: şema ve çapraz kontrol birlikte sınanır — §8'in kuralları
    // ikisine dağılmış durumda, bozma denemesi hangisine takılırsa takılsın
    // reddedilmiş sayılır. Hiçbirine takılmıyorsa kural yok demektir.
    console.log('\nSpan sözleşmesi (şema + çapraz kontrol):');
    for (const [ad, bozuk] of ozTestSpan(yuklenen.span.ornekler)) {
      const h = dogrula(bozuk, yuklenen.span.kok, yuklenen.span.kok, '').concat(spanCaprazKontrol(bozuk));
      if (h.length === 0) { console.log(`  ✗ ${ad} — ama kontrol GEÇTİ dedi`); toplamHata++; }
      else console.log(`  ✓ ${ad}`);
    }

    // Öneri: aynı kural — K7 zincirinin üçüncü halkası (07-KENDINI-GELISTIRME).
    console.log('\nÖneri sözleşmesi (şema + çapraz kontrol):');
    for (const [ad, bozuk] of ozTestOneri(yuklenen.proposal.ornekler)) {
      let h;
      try { h = dogrula(bozuk, yuklenen.proposal.kok, yuklenen.proposal.kok, '').concat(oneriCaprazKontrol(bozuk)); }
      catch (e) { h = ['çapraz kontrol bozuk kayıtta çöktü: ' + e.message]; }
      if (h.length === 0) { console.log(`  ✗ ${ad} — ama kontrol GEÇTİ dedi`); toplamHata++; }
      else console.log(`  ✓ ${ad}`);
    }
  }
}

console.log(toplamHata === 0 ? '\nSonuç: temiz.' : `\nSonuç: ${toplamHata} hata.`);
process.exit(toplamHata === 0 ? 0 : 1);
