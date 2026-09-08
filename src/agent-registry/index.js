/**
 * Agent Registry — ajan sozlesmelerinin tek kaynagi (U2).
 *
 * Blueprint §2.3, ADR-006 (K8): ev sahibi bicimleri sozlesmeden **turetilir**,
 * elle yazilmaz. `turet` diske yazmaz; yazilacak dosyalarin yol -> icerik
 * eslemesini dondurur, cunku dosya yazmak bir izin islemidir ve bu modulun
 * yetkisi degildir.
 *
 * Sozlesme: contracts/agent.schema.json. Kayit **once** dogrulanir: gecersiz
 * bir sozlesme sessizce atlanmaz, yukleme istisna atar. Sessizce atlanan
 * sozlesme "ajan neden yok" sorusunu bir sonraki tura birakirdi (AP3).
 *
 * Neden kendi sema dogrulayicisi: `src/` calisma zamanidir, `arac/` gelistirme
 * araci. Calisma zamani araca bagimli olamaz (ve `arac/sema-dogrula.js` bir CLI:
 * disari hicbir sey vermiyor, sonunda `process.exit` cagiriyor). Ayni semayi iki
 * dogrulayicinin okumasi bir surukleme riskidir; testte iki dogrulayici ayni
 * belgede karsilastirilarak bu risk olculur (index.test.js "arac ile ayni karar").
 *
 * Disariya bagimlilik yok, kardes modul import edilmez (ADR-002).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const VARSAYILAN_SEMA = fileURLToPath(new URL("../../contracts/agent.schema.json", import.meta.url));

// --- sema dogrulayici -------------------------------------------------------
// agent.schema.json'un kullandigi JSON Schema alt kumesi. Bilinmeyen anahtar
// kelime **istisna atar**: sessizce gecen dogrulayici dogrulamiyor demektir.
const ANAHTARLAR = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "default", "examples",
  "type", "required", "properties", "additionalProperties", "enum", "const",
  "pattern", "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems",
  "uniqueItems", "items", "allOf", "if", "then",
]);

function tipUygun(deger, tip) {
  switch (tip) {
    case "object": return deger !== null && typeof deger === "object" && !Array.isArray(deger);
    case "array": return Array.isArray(deger);
    case "string": return typeof deger === "string";
    case "number": return typeof deger === "number";
    case "integer": return typeof deger === "number" && Number.isInteger(deger);
    case "boolean": return typeof deger === "boolean";
    case "null": return deger === null;
    default: throw new Error(`bilinmeyen tip: ${tip}`);
  }
}

function coz(sema, kok) {
  if (!sema || !sema.$ref) return sema;
  let d = kok;
  for (const p of sema.$ref.replace(/^#\//, "").split("/")) d = d?.[p];
  if (!d) throw new Error(`cozulemeyen $ref: ${sema.$ref}`);
  return d;
}

function semaDogrula(deger, sema, kok, yol) {
  sema = coz(sema, kok);
  const hatalar = [];
  const ekle = (m) => hatalar.push(`${yol || "<kok>"}: ${m}`);

  for (const anahtar of Object.keys(sema)) {
    if (!ANAHTARLAR.has(anahtar)) throw new Error(`${yol}: dogrulayici '${anahtar}' anahtar kelimesini bilmiyor`);
  }

  if (sema.type) {
    const tipler = Array.isArray(sema.type) ? sema.type : [sema.type];
    if (!tipler.some((t) => tipUygun(deger, t))) {
      const gelen = Array.isArray(deger) ? "array" : deger === null ? "null" : typeof deger;
      ekle(`tip '${tipler.join("|")}' bekleniyordu, '${gelen}' geldi`);
      return hatalar; // tip yanlissa gerisi anlamsiz
    }
  }
  if ("const" in sema && deger !== sema.const) ekle(`deger ${JSON.stringify(sema.const)} olmali, ${JSON.stringify(deger)} yazilmis`);
  if (sema.enum && !sema.enum.includes(deger)) ekle(`deger sunlardan biri olmali: ${sema.enum.join(", ")} — ${JSON.stringify(deger)} yazilmis`);

  if (typeof deger === "string") {
    if (sema.pattern && !new RegExp(sema.pattern).test(deger)) ekle(`desene uymuyor: ${sema.pattern}`);
    if (sema.minLength !== undefined && deger.length < sema.minLength) ekle(`en az ${sema.minLength} karakter olmali (${deger.length})`);
    if (sema.maxLength !== undefined && deger.length > sema.maxLength) ekle(`en fazla ${sema.maxLength} karakter olmali (${deger.length})`);
  }
  if (typeof deger === "number") {
    if (sema.minimum !== undefined && deger < sema.minimum) ekle(`en az ${sema.minimum} olmali (${deger})`);
    if (sema.maximum !== undefined && deger > sema.maximum) ekle(`en fazla ${sema.maximum} olmali (${deger})`);
  }
  if (Array.isArray(deger)) {
    if (sema.minItems !== undefined && deger.length < sema.minItems) ekle(`en az ${sema.minItems} oge olmali (${deger.length})`);
    if (sema.maxItems !== undefined && deger.length > sema.maxItems) ekle(`en fazla ${sema.maxItems} oge olmali (${deger.length})`);
    if (sema.uniqueItems) {
      const gorulen = new Set(deger.map((o) => JSON.stringify(o)));
      if (gorulen.size !== deger.length) ekle("ogeler benzersiz olmali");
    }
    if (sema.items) deger.forEach((o, i) => hatalar.push(...semaDogrula(o, sema.items, kok, `${yol}[${i}]`)));
  }
  if (tipUygun(deger, "object")) {
    for (const alan of sema.required || []) if (!(alan in deger)) ekle(`zorunlu alan yok: ${alan}`);
    const ozellikler = sema.properties || {};
    if (sema.additionalProperties === false) {
      for (const alan of Object.keys(deger)) if (!(alan in ozellikler)) ekle(`tanimsiz alan: ${alan}`);
    }
    for (const [alan, alt] of Object.entries(ozellikler)) {
      if (alan in deger) hatalar.push(...semaDogrula(deger[alan], alt, kok, yol ? `${yol}.${alan}` : alan));
    }
  }

  for (const alt of sema.allOf || []) hatalar.push(...semaDogrula(deger, alt, kok, yol));
  if (sema.if && sema.then && semaDogrula(deger, sema.if, kok, yol).length === 0) {
    hatalar.push(...semaDogrula(deger, sema.then, kok, yol));
  }
  return hatalar;
}

// --- ev sahibi bicimleri (K8) ----------------------------------------------

/**
 * Frontmatter icin kucuk YAML: yalnizca skaler ve duz dize dizisi.
 *
 * Cift tirnak iceren metin YAML'in **tek tirnakli** bicimiyle yazilir. Sebep
 * olculdu: JSON.stringify `\\"` kacisi uretir ve ev sahiplerinin frontmatter
 * ayristiricilari (ornek: turkce-ajanlar/arac/dogrula.js) ters bolulu kacisi
 * cozmez — tetik ifadesi tirnak icinde gorunmez hale gelir. Tek tirnakli
 * bicimde tek kacis kurali `'` -> `''` ve icerideki cift tirnak oldugu gibi
 * kalir.
 */
function yamlDeger(deger) {
  if (Array.isArray(deger)) return `[${deger.map((d) => JSON.stringify(String(d))).join(", ")}]`;
  if (typeof deger === "string") {
    if (/^[A-Za-z0-9_.\-/]+$/.test(deger)) return deger;
    if (deger.includes('"')) return `'${deger.replace(/'/g, "''")}'`;
    return JSON.stringify(deger);
  }
  return JSON.stringify(deger);
}

/**
 * K8'in kayip bilgi noktasi: ev sahibi bicimi yazma kapsamini glob ile
 * daraltamaz. Sozlesmedeki kapsam frontmatter'a degil, ajan metnindeki sinir
 * cumlesine cevrilir (docs/mimari/01-AJAN.md §6).
 */
function sinirlar(sozlesme) {
  const izin = sozlesme.permissions || {};
  const dosya = izin.filesystem || {};
  const yaz = dosya.write || [];
  const oku = dosya.read || [];
  const ag = (izin.network || {}).allow || [];
  const satirlar = [
    oku.length ? `Yalnizca su desenleri okur: ${oku.join(", ")}` : "Hicbir dosyayi okumaz.",
    yaz.length ? `Yalnizca su desenlere yazar: ${yaz.join(", ")}` : "Hicbir dosyaya yazmaz.",
    "Kalici silme yapmaz; silme sozlesmeyle verilemez.",
    ag.length ? `Ag erisimi: ${ag.join(", ")}` : "Ag erisimi yok.",
  ];
  if ((izin.execute || {}).enabled) satirlar.push("Komut calistirabilir; yuksek riskli her cagri insan kapisindan gecer.");
  return satirlar;
}

/**
 * description elle yazilmaz: role.summary + capabilities + triggers'tan turer.
 *
 * `triggers` (sema 2.1, ADR-010) sozlesmenin "ne zaman cagrilir" alanidir ve
 * burada tirnak icinde description'a girer. Bu sus degil, kabul olcutu: ev
 * sahibi dogrulayicilari description'da tetikleyici ifade arar ve bulamazsa
 * turetilen dosyayi **reddeder** (U15). Tirnaklari sozlesme degil turetici koyar
 * — bicim ev sahibinin isi, sozlesme cumlenin kendisini tasir.
 */
function aciklamaTuret(sozlesme) {
  const yetenekler = (sozlesme.capabilities || []).map((y) => y.description).join(" ");
  const tetikler = (sozlesme.triggers || []).map((t) => `"${t}"`).join(", ");
  const tetikCumlesi = tetikler ? `Kullanici ${tetikler} dediginde kullan.` : "";
  return `${sozlesme.role.summary} ${yetenekler} ${tetikCumlesi}`.trim();
}

function claudeCodeUret(sozlesme, eslem) {
  // name ve description turetilir; eslem yazmis olsa bile turetilen kazanir (K8).
  const { name: _ad, description: _aciklama, ...kalan } = eslem.frontmatter || {};
  const on = { name: sozlesme.identity.id, description: aciklamaTuret(sozlesme), ...kalan };

  const satirlar = ["---"];
  for (const [anahtar, deger] of Object.entries(on)) satirlar.push(`${anahtar}: ${yamlDeger(deger)}`);
  satirlar.push("---", "");
  satirlar.push(`# ${sozlesme.identity.name}`, "");
  satirlar.push(sozlesme.mission, "");
  satirlar.push("## Yetenekler", "");
  for (const y of sozlesme.capabilities) satirlar.push(`- **${y.id}** — ${y.description}`);
  satirlar.push("", "## Calisma sirasi", "");
  sozlesme.workflow.steps.forEach((a, i) => satirlar.push(`${i + 1}. **${a.id}** — ${a.action}`));
  satirlar.push("", "## Basari olcutu", "");
  for (const o of sozlesme.success_criteria) satirlar.push(`- ${o.statement}${o.metric ? ` (olcum: ${o.metric})` : ""}`);
  satirlar.push("", "## Sinirlar", "");
  for (const s of sinirlar(sozlesme)) satirlar.push(`- ${s}`);
  satirlar.push("", `<!-- Bu dosya ${sozlesme.identity.id} sozlesmesinden turetilmistir (surum ${sozlesme.identity.version}). Elle duzenlenmez. -->`, "");
  return satirlar.join("\n");
}

const EV_SAHIPLERI = { "claude-code": claudeCodeUret };

// --- kayit defteri ----------------------------------------------------------

/**
 * @param {{ dizin: string, semaYolu?: string }} secenekler
 *   `dizin` sozlesme JSON dosyalarinin bulundugu klasor.
 */
export function ajanKaydi({ dizin, semaYolu = VARSAYILAN_SEMA }) {
  if (!dizin) throw new Error("ajanKaydi: `dizin` zorunlu");
  const sema = JSON.parse(readFileSync(semaYolu, "utf8"));

  /** @type {Map<string, object>|null} */
  let kayitlar = null;

  function dogrula(sozlesme) {
    if (!tipUygun(sozlesme, "object")) return { gecerli: false, hatalar: ["<kok>: sozlesme bir nesne olmali"] };
    const hatalar = semaDogrula(sozlesme, sema, sema, "");
    return { gecerli: hatalar.length === 0, hatalar };
  }

  /** Yukleme tembeldir ama sessiz degildir: gecersiz sozlesme istisna atar. */
  function yukle() {
    if (kayitlar) return kayitlar;
    kayitlar = new Map();
    for (const ad of readdirSync(dizin).filter((f) => f.endsWith(".json")).sort()) {
      const yol = join(dizin, ad);
      const sozlesme = JSON.parse(readFileSync(yol, "utf8"));
      const sonuc = dogrula(sozlesme);
      if (!sonuc.gecerli) throw new Error(`${ad}: sozlesme gecersiz — ${sonuc.hatalar.join("; ")}`);
      const id = sozlesme.identity.id;
      if (kayitlar.has(id)) throw new Error(`${ad}: '${id}' kimligi zaten kayitli; kimlik benzersiz olmali`);
      kayitlar.set(id, sozlesme);
    }
    return kayitlar;
  }

  return {
    dogrula,

    async getir(agent_id) {
      const s = yukle().get(agent_id);
      return s ? structuredClone(s) : null;
    },

    async listele(suzgec = {}) {
      let hepsi = [...yukle().values()];
      if (suzgec.role) hepsi = hepsi.filter((s) => s.role.kind === suzgec.role);
      if (suzgec.status) hepsi = hepsi.filter((s) => s.identity.status === suzgec.status);
      if (suzgec.tags) hepsi = hepsi.filter((s) => suzgec.tags.every((e) => (s.identity.tags || []).includes(e)));
      return hepsi.map((s) => structuredClone(s));
    },

    async turet(agent_id, ev_sahibi) {
      const sozlesme = yukle().get(agent_id);
      if (!sozlesme) throw new Error(`ajan yok: ${agent_id}`);
      const uret = EV_SAHIPLERI[ev_sahibi];
      if (!uret) throw new Error(`bilinmeyen ev sahibi: ${ev_sahibi} (bilinenler: ${Object.keys(EV_SAHIPLERI).join(", ")})`);
      const eslem = (sozlesme["x-host"] || {})[ev_sahibi];
      if (!eslem || !eslem.file) throw new Error(`${agent_id}: '${ev_sahibi}' icin x-host eslemi (veya 'file' alani) yok`);
      return { [eslem.file]: uret(sozlesme, eslem) };
    },
  };
}
