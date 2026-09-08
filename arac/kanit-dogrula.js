/*
 * kanit-dogrula.js — araştırma dosyalarındaki dosya:satır alıntılarını
 * gerçek klonlarda doğrular. Protokol §4 "Denetim adımı"nın aracı.
 *
 *   node arac/kanit-dogrula.js i2-bellek            # ekrana rapor
 *   node arac/kanit-dogrula.js i2-bellek --yaz      # + <iz>/DENETIM-otomatik.md
 *   node arac/kanit-dogrula.js i1-orkestrasyon --ayrinti
 *
 * v3 — token eşleme düzeltmeleri (v2 hâlâ %11 yanlış alarm üretiyordu):
 *   - `ad(arg)` → `ad`; `Sinif.metot` → hem tamı hem `metot`; `k=v` → `k` ve `v`
 *   - Backtick içindeki boşluklu kod parçaları (`a = b.c`) alt-dizge olarak aranır
 *   - Kod olmayan token'lar elenir: Türkçe karakterli/stopword'lü ifadeler,
 *     `:124` gibi çıplak sayılar, `*graph*` gibi joker, ≤6 harflik düz sözcükler
 *   - Yoldaki `...` kısaltması joker sayılır (`libs/checkpoint/.../base/__init__.py`)
 *   - YAKIN bandı ±120 (aynı sınıfın metotları birbirinden uzak olabiliyor)
 * v3.2: çıplak dosya adı önce depo kökünde, kardeş iz belgesine atıf çözülür,
 * çok alıntılı satırda token penceresi dar (İ4/İ5/İ6 denetim dersleri).
 * v2: tüm adaylar denenir, depo ipucu satırdaki proje adlarından, uzak dal
 *     desteği (git ls-tree / show), yakınlığa göre token eşleme.
 *
 * Sınıflar: TAM (±3 / aralık) · YAKIN (±120) · VAR (token yok, dosya+satır var)
 *           TOKEN-YOK · EOF · DOSYA-YOK  → elle bak. Araç karar vermez.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KOK = path.resolve(__dirname, "..");
const KLON_KOK = "D:/Repolar/_inceleme";
const KULLANICI_DEPOLARI = "D:/Repolar";
const iz = process.argv[2];
const yaz = process.argv.includes("--yaz");
const ayrinti = process.argv.includes("--ayrinti");
if (!iz) { console.error("kullanım: node arac/kanit-dogrula.js <iz-klasörü> [--yaz] [--ayrinti]"); process.exit(2); }
const IZ_DIR = path.join(KOK, "docs", "arastirma", iz);
if (!fs.existsSync(IZ_DIR)) { console.error("iz klasörü yok: " + IZ_DIR); process.exit(2); }

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// ---------------------------------------------------------------- indeks
const ATLA = new Set([".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", "site-packages", ".next", "coverage", ".mypy_cache", ".pytest_cache"]);
const depoKok = {}; const indeks = [];
function gez(kok, depo, altKok, d) {
  if (d > 16) return; let g; try { g = fs.readdirSync(kok, { withFileTypes: true }); } catch { return; }
  for (const e of g) { if (ATLA.has(e.name)) continue; const p = path.join(kok, e.name); const alt = (altKok ? altKok + "/" : "") + e.name;
    if (e.isDirectory()) gez(p, depo, alt, d + 1); else indeks.push({ tam: p.replace(/\\/g, "/"), alt, depo }); }
}
if (fs.existsSync(KLON_KOK)) for (const d of fs.readdirSync(KLON_KOK, { withFileTypes: true })) if (d.isDirectory()) { depoKok[d.name] = path.join(KLON_KOK, d.name); gez(depoKok[d.name], d.name, "", 0); }
for (const d of fs.readdirSync(KULLANICI_DEPOLARI, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith("_") || d.name === "ajans-os") continue;
  const k = path.join(KULLANICI_DEPOLARI, d.name);
  if (fs.existsSync(path.join(k, ".git"))) { depoKok[d.name] = k; gez(k, d.name, "", 0); }
}
const depolar = Object.keys(depoKok);

// Kardes iz belgeleri de aday: OZET.md siklikla `langfuse.md:119` gibi ayni
// klasordeki baska belgeye atif yapiyor; klon indeksinde karsiligi yok
// (I5 denetimi: 6 DOSYA-YOK'un tamami buydu).
const izBelgeIndeksi = [];

const dalIndeks = {};
function dalDosyalari(depo) {
  if (dalIndeks[depo]) return dalIndeks[depo]; const liste = [];
  if (!depoKok[depo]) { dalIndeks[depo] = liste; return liste; }   // "(iz)" gibi sahte depo: git cagrisi yok
  try {
    const dallar = execFileSync("git", ["-C", depoKok[depo], "branch", "-r", "--format=%(refname:short)"], { encoding: "utf8" }).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.includes("HEAD"));
    for (const dal of dallar.slice(0, 8)) { const out = execFileSync("git", ["-C", depoKok[depo], "ls-tree", "-r", "--name-only", dal], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); for (const alt of out.split(/\r?\n/)) if (alt) liste.push({ dal, alt }); }
  } catch { }
  dalIndeks[depo] = liste; return liste;
}
const onbellek = new Map();
function okuSatirlar(anahtar, okuyucu) { if (!onbellek.has(anahtar)) { try { onbellek.set(anahtar, okuyucu().split(/\r?\n/)); } catch { onbellek.set(anahtar, null); } } return onbellek.get(anahtar); }

// ---------------------------------------------------------------- alıntı / token
const ALINTI = /(?<![\w/])((?:[A-Za-z0-9_][A-Za-z0-9_.\-]*|\.\.\.)(?:\/(?:[A-Za-z0-9_][A-Za-z0-9_.\-]*|\.\.\.))*\.(?:py|pyi|ts|tsx|js|mjs|cjs|md|toml|json|ya?ml|rs|go|txt|cfg|ini|sql|sh|ps1)):(\d+)(?:\s*[-–]\s*(\d+))?/g;
const YOL_GIBI = /[\/\\]|\.(py|pyi|ts|tsx|js|md|toml|json|ya?ml|rs|go)(:|$)/;
const TURKCE = /[çğıöşüÇĞİÖŞÜ]/;
const TR_STOP = new Set(["her","zaman","olarak","veri","yok","var","ile","icin","için","gibi","bir","bu","ve","ya","da","de","sonra","once","önce","kim","karar","verir","yazmaya","mu","mi","ne","olur","olan","degil","değil","ama","hem","tek","cok","çok","az","ancak","yani","icinde","içinde"]);

function tokenVaryantlari(x) {
  const v = new Set();
  let t = x.trim().replace(/^[@#.$]+/, "").replace(/[:;,]+$/, "");
  if (!t) return [];
  // cagri: ad(...)  -> ad
  const cagri = t.match(/^([A-Za-z_][\w.]*)\s*\(.*\)$/); if (cagri) t = cagri[1];
  if (/^[:*\[\]\d.]/.test(t)) return [];               // :124, *graph*, [OK], 0.7
  if (/[*?]/.test(t)) return [];                        // joker
  t = t.replace(/\s*=\s*/g, "=");                        // `a = b` -> `a=b`
  if (/\s/.test(t)) {                                    // bosluklu kod parcasi / alinti
    const kelimeler = t.toLowerCase().split(/\s+/);
    if (kelimeler.every((k) => TR_STOP.has(k))) return [];
    if (kelimeler.some((k) => TR_STOP.has(k)) && !/[=().\[\]_]/.test(t)) return [];
    if (kelimeler.length < 4 && !/[=().\[\]_A-Z0-9]/.test(t)) return [];
    v.add(t);
    // paraphrase edilmis kod parcasinin icindeki tanimlayicilar tek tek de aranir
    for (const id of t.match(/[A-Za-z_][A-Za-z0-9_]{3,}/g) || []) if (/[_A-Z0-9]/.test(id) && !TR_STOP.has(id.toLowerCase())) v.add(id);
    return [...v];
  }
  if (/^[a-z]{1,4}$/.test(t)) return [];                 // add, get, run, list: ayirt etmez
  v.add(t);
  const kv = t.match(/^([A-Za-z_][\w.]*)=(.+)$/); if (kv) { v.add(kv[1]); if (kv[2].length >= 3 && !/^\d+$/.test(kv[2])) v.add(kv[2].replace(/^['"]|['"]$/g, "")); }
  // Sinif.metot -> metot da aranir (kodda `def metot` yazar); Edge.delete -> delete
  if (t.includes(".")) { const son = t.split(".").pop().replace(/=.*$/, ""); if (son && son.length >= 3) v.add(son); }
  return [...v].filter((s) => s.length >= 3);
}

function tokenAdaylari(satir) {
  const t = [];
  for (const m of satir.matchAll(/`([^`]{2,120})`/g)) {
    const x = m[1]; if (YOL_GIBI.test(x) || TURKCE.test(x)) continue;
    for (const v of tokenVaryantlari(x)) t.push({ tok: v, poz: m.index });
  }
  for (const m of satir.matchAll(/["“]([^"”]{5,120})["”]/g)) {
    const x = m[1].trim(); if (TURKCE.test(x)) continue;
    for (const v of tokenVaryantlari(x)) t.push({ tok: v, poz: m.index });
  }
  return t;
}
function yakinTokenlar(adaylar, poz, diger, pencere = 160) {
  return [...new Set(adaylar.filter((a) => Math.abs(a.poz - poz) <= pencere).filter((a) => diger.every((p) => Math.abs(a.poz - poz) <= Math.abs(a.poz - p))).map((a) => a.tok))];
}
function bulTokens(lines, a, b, toks) {
  const sl = lines.slice(Math.max(0, a - 1), Math.min(lines.length, b)).join("\n");
  return toks.filter((tk) => {
    if (/\s/.test(tk)) return sl.includes(tk);
    const re = new RegExp("(^|[^A-Za-z0-9_])" + tk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Za-z0-9_]|$)");
    // buyuk/kucuk harf farkina tolerans: md `max_total_tokens` der, kod
    // `DEFAULT_MAX_TOTAL_TOKENS` yazar - ayni sey.
    return re.test(sl) || sl.includes(tk) || sl.toLowerCase().includes(tk.toLowerCase());
  });
}
function yolEslesir(alt, yol) {
  if (!yol.includes("...")) return alt === yol || alt.endsWith("/" + yol);
  const parcalar = yol.split("...").map((p) => p.replace(/^\/|\/$/g, "")).filter(Boolean);
  const bas = parcalar[0], son = parcalar[parcalar.length - 1];
  // Tek parca: `.../security/confirmation_policy.py` — bas ile son ayni, yalnizca
  // sonu eslesmesi yeter (I6 denetimi: iki yanlis DOSYA-YOK buradan geldi).
  if (parcalar.length === 1) return alt === son || alt.endsWith("/" + son);
  return (alt.endsWith("/" + son) || alt === son) && (alt === bas || alt.startsWith(bas + "/") || alt.includes("/" + bas + "/"));
}

// ---------------------------------------------------------------- depo ipucu
const projeAdlari = fs.readdirSync(IZ_DIR).filter((f) => f.endsWith(".md") && !/^(OZET|DENETIM)/.test(f)).map((f) => f.replace(/\.md$/, ""));
for (const f of fs.readdirSync(IZ_DIR)) if (f.endsWith(".md")) izBelgeIndeksi.push({ tam: path.join(IZ_DIR, f).replace(/\\/g, "/"), alt: f, depo: "(iz)" });
function depoEsle(ad) { const n = norm(ad); if (!n) return []; const k = n.slice(0, Math.min(5, n.length)); return depolar.filter((d) => norm(d).includes(k) || n.includes(norm(d).slice(0, Math.min(5, norm(d).length)))); }
function satirIpucu(satir, dosyaIpucu) {
  const set = new Set(dosyaIpucu); const ns = norm(satir);
  for (const p of projeAdlari) { const n = norm(p); if (n && ns.includes(n)) for (const d of depoEsle(p)) set.add(d); }
  for (const d of depolar) { const n = norm(d); if (n.length >= 4 && ns.includes(n)) set.add(d); }
  return [...set];
}

// ---------------------------------------------------------------- doğrulama
const SIRA = { TAM: 0, YAKIN: 1, VAR: 2, "TOKEN-YOK": 3, EOF: 4, "DOSYA-YOK": 5 };
const sonuc = { TAM: 0, YAKIN: 0, VAR: 0, "TOKEN-YOK": 0, EOF: 0, "DOSYA-YOK": 0 };
const supheli = [], tumu = [], dosyaOzet = [];
function degerlendir(lines, a, b, toks) {
  if (!lines) return null;
  if (a > lines.length) return { sinif: "EOF" };
  if (!toks.length) return { sinif: "VAR", bulunan: (lines[a - 1] || "").trim().slice(0, 70) };
  const pen = b === a ? [a - 3, a + 3] : [a, b];
  let hit = bulTokens(lines, pen[0], pen[1], toks); if (hit.length) return { sinif: "TAM", bulunan: hit[0] };
  hit = bulTokens(lines, a - 120, b + 120, toks); if (hit.length) return { sinif: "YAKIN", bulunan: hit[0] };
  return { sinif: "TOKEN-YOK" };
}

for (const md of fs.readdirSync(IZ_DIR).filter((f) => f.endsWith(".md") && !/^DENETIM/.test(f)).sort()) {
  const base = md.replace(/\.md$/, ""); const dosyaIpucu = base === "OZET" ? [] : depoEsle(base);
  const icerik = fs.readFileSync(path.join(IZ_DIR, md), "utf8").split(/\r?\n/);
  // Cok surumlu spec depolari (MCP: docs/specification/<tarih>/): md hangi
  // surumu inceledigini Kimlik bolumunde yazar; adaylar o surume daraltilir.
  // I3 denetiminde `index.mdx` bu yuzden SEP dizinine denk gelmisti.
  const surumM = icerik.join("\n").match(/(?:specification|schema)\/(\d{4}-\d{2}-\d{2})/);
  const surumIpucu = surumM ? surumM[1] : null;
  const yerel = { TAM: 0, YAKIN: 0, VAR: 0, "TOKEN-YOK": 0, EOF: 0, "DOSYA-YOK": 0 };
  icerik.forEach((satir, si) => {
    const alintilar = [...satir.matchAll(ALINTI)]; if (!alintilar.length) return;
    const adaylarTok = tokenAdaylari(satir); const ipucu = satirIpucu(satir, dosyaIpucu); const pozlar = alintilar.map((m) => m.index);
    for (const m of alintilar) {
      const yol = m[1], a = parseInt(m[2], 10), b = m[3] ? parseInt(m[3], 10) : a;
      const toks = yakinTokenlar(adaylarTok, m.index, pozlar.filter((p) => p !== m.index), alintilar.length >= 3 ? 80 : 160);
      // Yol depo adiyla basliyorsa (`semantic-conventions/CHANGELOG.md`) o on ek
      // atilir: indeksteki `alt` depo kokune gore (I5 denetimi: 3 yanlis DOSYA-YOK).
      const ilkParca = yol.split("/")[0];
      const depoOnEki = yol.includes("/") && depolar.includes(ilkParca) ? ilkParca : null;
      const yolSade = depoOnEki ? yol.split("/").slice(1).join("/") : yol;
      let adaylar = indeks.filter((e) => yolEslesir(e.alt, yol) ||
        (depoOnEki && e.depo === depoOnEki && yolEslesir(e.alt, yolSade)));
      // Ciplak dosya adi: depo kokundeki once denensin (I4/I5/I6'da dspy ve
      // RouteLLM README'leri ic ice kopyaya cozulup 4 yanlis alarm uretti).
      if (!yol.includes("/")) adaylar = adaylar.slice().sort((x, y) =>
        (x.alt === yol ? 0 : 1) - (y.alt === yol ? 0 : 1) ||
        x.alt.split("/").length - y.alt.split("/").length || x.alt.length - y.alt.length);
      // Kardes iz belgesine atif (OZET.md -> langfuse.md:119)
      const izAday = izBelgeIndeksi.filter((e) => yolEslesir(e.alt, yol));
      if (izAday.length) adaylar = izAday.concat(adaylar);
      const ipucuAday = adaylar.filter((e) => ipucu.includes(e.depo)); if (ipucuAday.length) adaylar = ipucuAday;
      if (surumIpucu) { const sv = adaylar.filter((e) => e.alt.includes("/" + surumIpucu + "/")); if (sv.length) adaylar = sv; }
      let enIyi = { sinif: "DOSYA-YOK" }, nerede = "";
      for (const e of adaylar.slice(0, 200)) {
        const r = degerlendir(okuSatirlar(e.tam, () => fs.readFileSync(e.tam, "utf8")), a, b, toks);
        if (r && SIRA[r.sinif] < SIRA[enIyi.sinif]) { enIyi = r; nerede = e.depo + "/" + e.alt; }
        if (enIyi.sinif === "TAM") break;
      }
      if (enIyi.sinif !== "TAM" && enIyi.sinif !== "YAKIN") {
        const dalDepolar = ipucu.length ? ipucu : [...new Set(adaylar.map((e) => e.depo))];
        for (const depo of dalDepolar) {
          for (const x of dalDosyalari(depo).filter((x) => yolEslesir(x.alt, yol)).slice(0, 40)) {
            const lines = okuSatirlar(depo + "@" + x.dal + ":" + x.alt, () => execFileSync("git", ["-C", depoKok[depo], "show", x.dal + ":" + x.alt], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
            const r = degerlendir(lines, a, b, toks);
            if (r && SIRA[r.sinif] < SIRA[enIyi.sinif]) { enIyi = r; nerede = depo + "@" + x.dal + "/" + x.alt; }
            if (enIyi.sinif === "TAM") break;
          }
          if (enIyi.sinif === "TAM") break;
        }
      }
      sonuc[enIyi.sinif]++; yerel[enIyi.sinif]++;
      const kayit = { md, satir: si + 1, alinti: m[0], sinif: enIyi.sinif, toks, nerede, bulunan: enIyi.bulunan || "" };
      tumu.push(kayit); if (["TOKEN-YOK", "DOSYA-YOK", "EOF"].includes(enIyi.sinif)) supheli.push(kayit);
    }
  });
  dosyaOzet.push({ md, ...yerel, toplam: Object.values(yerel).reduce((x, y) => x + y, 0) });
}

// ---------------------------------------------------------------- rapor
const toplam = Object.values(sonuc).reduce((x, y) => x + y, 0), dogrulanabilir = toplam - sonuc.VAR, dogrulanan = sonuc.TAM + sonuc.YAKIN;
const yuzde = dogrulanabilir ? Math.round((dogrulanan / dogrulanabilir) * 100) : 0;
const out = [];
out.push(`# ${iz} — otomatik kanıt doğrulaması (v3)`, "", `*${new Date().toLocaleString("tr-TR")} · ${indeks.length.toLocaleString("tr-TR")} dosya, ${depolar.length} depo · araç: arac/kanit-dogrula.js*`, "");
out.push("## Özet", "", "| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |", "|---|---|---|---|---|---|---|", `| ${toplam} | ${sonuc.TAM} | ${sonuc.YAKIN} | ${sonuc.VAR} | ${sonuc["TOKEN-YOK"]} | ${sonuc.EOF} | ${sonuc["DOSYA-YOK"]} |`, "");
out.push(`Doğrulanabilir ${dogrulanabilir} alıntının **%${yuzde}**'i doğrulandı (TAM+YAKIN). Şüpheli: **${supheli.length}**. Araç karar vermez; şüpheliler elle bakılır.`, "");
out.push("## Dosya bazında", "", "| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |", "|---|---|---|---|---|---|");
for (const d of dosyaOzet) out.push(`| ${d.md} | ${d.toplam} | ${d.TAM} | ${d.YAKIN} | ${d.VAR} | ${d["TOKEN-YOK"] + d.EOF + d["DOSYA-YOK"]} |`);
out.push("");
if (supheli.length) { out.push("## Şüpheli alıntılar (elle bak)", ""); for (const s of supheli) out.push(`- **${s.sinif}** \`${s.md}:${s.satir}\` → \`${s.alinti}\`${s.toks.length ? " beklenen: " + s.toks.slice(0, 4).map((t) => "`" + t + "`").join(", ") : ""}${s.nerede ? " · bakılan: `" + s.nerede + "`" : ""}`); out.push(""); }
if (ayrinti) { out.push("## Tüm alıntılar", ""); for (const s of tumu) out.push(`- ${s.sinif.padEnd(9)} \`${s.md}:${s.satir}\` ${s.alinti}${s.bulunan ? " → " + s.bulunan : ""}${s.nerede ? " (" + s.nerede + ")" : ""}`); out.push(""); }
const metin = out.join("\n"); console.log(metin);
if (yaz) { const h = path.join(IZ_DIR, "DENETIM-otomatik.md"); fs.writeFileSync(h, metin, "utf8"); console.log("\nYazıldı: " + h); }
