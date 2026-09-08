/**
 * Tool Registry — arac tanimlarinin kaynagi (U3).
 *
 * Blueprint §2.4: arac sozlesmesi **yeniden icat edilmez**; MCP'nin JSON
 * Schema'si (`inputSchema`) oldugu gibi kullanilir. Bu modulun tuttugu tek ek
 * bilgi, semada olmayan iki alandir: aracin **izin sinifi** (`operation`) ve
 * geri alinabilirligi (`irreversible`).
 *
 * Izin sinifi kayittan okunur, arac **adindan turetilmez**. Ad kirilgan bir
 * anahtardir: `read_file` adli bir arac yazabilir, `search` bir yere baglanabilir.
 * Bu yuzden burada ad uzerinde hicbir desen eslemesi yoktur ve bunu bir test
 * sabitler (index.test.js "izin sinifi addan turetilmez").
 *
 * Kapsam disi: gercek MCP sunucusuna baglanma. Kayitlar cagirandan gelir;
 * sunucu kesfini yapan taraf onlari `kayitlar` olarak verir.
 *
 * ADR-002: kardes modul import edilmez. Bir ajanin arac listesi Agent
 * Registry'de durur, bu yuzden `listele(agent_id)` icin gereken eslem
 * `ajan_araclari` olarak disaridan verilir — modul kimseyi cagirmaz.
 */

/** contracts/agent.schema.json + tipler.d.ts IzinSinifi. */
const IZIN_SINIFLARI = new Set([
  "read", "write", "execute", "network", "delete", "publish", "memory_write",
]);

// --- inputSchema dogrulayicisi ----------------------------------------------
// MCP arac semalarinin kullandigi JSON Schema alt kumesi. Bilinmeyen anahtar
// kelime **istisna atar**: sessizce gecen dogrulayici dogrulamiyor demektir.
const ANAHTARLAR = new Set([
  "$schema", "$id", "title", "description", "default", "examples",
  "type", "required", "properties", "additionalProperties", "enum", "const",
  "pattern", "minLength", "maxLength", "minimum", "maximum",
  "minItems", "maxItems", "items",
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

function semaDogrula(deger, sema, yol) {
  const hatalar = [];
  const nerede = yol || "<kok>";
  for (const anahtar of Object.keys(sema)) {
    if (!ANAHTARLAR.has(anahtar)) throw new Error(`${nerede}: desteklenmeyen sema anahtari '${anahtar}'`);
  }

  if (sema.type !== undefined) {
    const tipler = Array.isArray(sema.type) ? sema.type : [sema.type];
    if (!tipler.some((t) => tipUygun(deger, t))) {
      return [`${nerede}: tip '${tipler.join("|")}' olmali`];
    }
  }
  if (sema.const !== undefined && deger !== sema.const) hatalar.push(`${nerede}: '${sema.const}' olmali`);
  if (sema.enum !== undefined && !sema.enum.includes(deger)) {
    hatalar.push(`${nerede}: su degerlerden biri olmali: ${sema.enum.join(", ")}`);
  }

  if (typeof deger === "string") {
    if (sema.minLength !== undefined && deger.length < sema.minLength) hatalar.push(`${nerede}: en az ${sema.minLength} karakter`);
    if (sema.maxLength !== undefined && deger.length > sema.maxLength) hatalar.push(`${nerede}: en fazla ${sema.maxLength} karakter`);
    if (sema.pattern !== undefined && !new RegExp(sema.pattern).test(deger)) hatalar.push(`${nerede}: '${sema.pattern}' desenine uymuyor`);
  }
  if (typeof deger === "number") {
    if (sema.minimum !== undefined && deger < sema.minimum) hatalar.push(`${nerede}: en az ${sema.minimum}`);
    if (sema.maximum !== undefined && deger > sema.maximum) hatalar.push(`${nerede}: en fazla ${sema.maximum}`);
  }
  if (Array.isArray(deger)) {
    if (sema.minItems !== undefined && deger.length < sema.minItems) hatalar.push(`${nerede}: en az ${sema.minItems} oge`);
    if (sema.maxItems !== undefined && deger.length > sema.maxItems) hatalar.push(`${nerede}: en fazla ${sema.maxItems} oge`);
    if (sema.items) deger.forEach((o, i) => hatalar.push(...semaDogrula(o, sema.items, `${nerede}[${i}]`)));
  }
  if (tipUygun(deger, "object")) {
    for (const zorunlu of sema.required || []) {
      if (!(zorunlu in deger)) hatalar.push(`${nerede}: zorunlu alan eksik: '${zorunlu}'`);
    }
    const ozellikler = sema.properties || {};
    for (const [ad, deger2] of Object.entries(deger)) {
      if (ozellikler[ad]) hatalar.push(...semaDogrula(deger2, ozellikler[ad], `${nerede}.${ad}`));
      else if (sema.additionalProperties === false) hatalar.push(`${nerede}: taninmayan alan: '${ad}'`);
    }
  }
  return hatalar;
}

/**
 * @param {{ kayitlar: object[], ajan_araclari?: Record<string, string[]> }} secenekler
 */
export function aracKaydi({ kayitlar, ajan_araclari = {} }) {
  if (!Array.isArray(kayitlar)) throw new Error("aracKaydi: `kayitlar` bir dizi olmali");

  /** @type {Map<string, object>} */
  const kayit = new Map();
  for (const k of kayitlar) {
    // Gecersiz kayit sessizce atlanmaz: atlanan arac "bu arac neden yok"
    // sorusunu calisma anina birakirdi (AP3).
    if (!k || typeof k !== "object") throw new Error("kayit bir nesne olmali");
    const ad = k.tanim?.name;
    if (typeof ad !== "string" || ad === "") throw new Error("kayit: 'tanim.name' zorunlu");
    if (!tipUygun(k.tanim.inputSchema, "object")) throw new Error(`${ad}: 'tanim.inputSchema' bir nesne olmali (MCP semasi)`);
    if (!IZIN_SINIFLARI.has(k.operation)) {
      throw new Error(`${ad}: gecersiz izin sinifi '${k.operation}' (bilinenler: ${[...IZIN_SINIFLARI].join(", ")})`);
    }
    if (typeof k.irreversible !== "boolean") throw new Error(`${ad}: 'irreversible' bir boolean olmali`);
    if (typeof k.kaynak !== "string" || k.kaynak === "") throw new Error(`${ad}: 'kaynak' zorunlu`);
    if (kayit.has(ad)) throw new Error(`'${ad}' araci zaten kayitli; arac adi benzersiz olmali`);
    kayit.set(ad, structuredClone(k));
  }

  return {
    async getir(arac_adi) {
      const k = kayit.get(arac_adi);
      return k ? structuredClone(k) : null;
    },

    async listele(agent_id) {
      if (agent_id === undefined) return [...kayit.values()].map((k) => structuredClone(k));
      const adlar = ajan_araclari[agent_id];
      if (!adlar) throw new Error(`ajan icin arac eslemi yok: ${agent_id}`);
      return adlar.map((ad) => {
        const k = kayit.get(ad);
        // Cozulemeyen arac sessizce dusurulmez: ajan sozlesmesi kayitla
        // uyusmuyorsa bu bir yapilandirma hatasidir.
        if (!k) throw new Error(`${agent_id}: '${ad}' araci kayitli degil`);
        return structuredClone(k);
      });
    },

    argumanlari_dogrula(arac_adi, argumanlar) {
      const k = kayit.get(arac_adi);
      if (!k) return { gecerli: false, hatalar: [`arac kayitli degil: ${arac_adi}`] };
      const hatalar = semaDogrula(argumanlar, k.tanim.inputSchema, "");
      return { gecerli: hatalar.length === 0, hatalar };
    },
  };
}
