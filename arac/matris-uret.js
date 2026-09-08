/*
 * matris-uret.js — iz özetlerinden (docs/arastirma/<iz>/OZET.md) karşılaştırma
 * matrisini üretir. Protokol §6.
 *
 *   node arac/matris-uret.js            # docs/01-matris.json + docs/01-KARSILASTIRMA-MATRISI.md
 *   node arac/matris-uret.js --kuru     # sadece ekrana
 *
 * Neden kod: tablo biçimi sabit (§6.2); LLM'e "matrisi yaz" demek hem pahalı
 * hem hataya açık. Araç sayıları taşır, yorumu (§6.4) araştırmacı yazar —
 * markdown'daki `<!-- YORUM -->` bloğu yeniden üretimde korunur.
 *
 * İz özetlerinde iki tablo aranır:
 *   1) "Proje" + kanıt bağlantısı olan puan tablosu (6 puan sütunu 1–5)
 *   2) "sağlayıcı bağımsız / sözleşme var / insan kapısı / checkpoint" tablosu
 * Sütun adları izden ize değişebilir; eşleme anahtar kelimeyle yapılır.
 */

const fs = require("fs");
const path = require("path");

const KOK = path.resolve(__dirname, "..");
const ARASTIRMA = path.join(KOK, "docs", "arastirma");
const JSON_CIKTI = path.join(KOK, "docs", "01-matris.json");
const MD_CIKTI = path.join(KOK, "docs", "01-KARSILASTIRMA-MATRISI.md");
const kuru = process.argv.includes("--kuru");

const norm = (s) => String(s).toLowerCase().replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }[c])).replace(/[^a-z0-9]/g, "");
const PUAN_ANAHTAR = ["olgunluk", "mimari_netlik", "genisletilebilirlik", "guvenilirlik", "gozlemlenebilirlik", "guvenlik"];
const MATRIS_ANAHTAR = ["saglayici_bagimsiz", "sozlesme_var", "insan_kapisi", "checkpoint"];
// puan sütunları başlıktan tanınır (kısaltmalar dahil: "Güv.ilk." -> guvilk, "Gözl." -> gozl)
const PUAN_BASLIK = [/^olg/, /^mim/, /^gen/, /^guvenilirlik|^guvilk/, /^gozl/, /^guvenlik/];

// ---------------------------------------------------------------- markdown tablo ayrıştırma
function tablolar(md) {
  const satirlar = md.split(/\r?\n/);
  const sonuc = [];
  for (let i = 0; i < satirlar.length - 1; i++) {
    if (!/^\|.*\|\s*$/.test(satirlar[i]) || !/^\|[\s:|-]+\|\s*$/.test(satirlar[i + 1])) continue;
    const baslik = hucreler(satirlar[i]);
    const satirlarT = [];
    let j = i + 2;
    while (j < satirlar.length && /^\|.*\|\s*$/.test(satirlar[j])) { satirlarT.push(hucreler(satirlar[j])); j++; }
    sonuc.push({ baslik, satirlar: satirlarT, satirNo: i + 1 });
    i = j;
  }
  return sonuc;
}
function hucreler(satir) { return satir.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((h) => h.trim()); }
const temizAd = (h) => h.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s*\(.*?\)\s*$/, "").trim();
const baglanti = (h) => { const m = h.match(/\]\(([^)]+\.md)\)/); return m ? m[1] : null; };
const sayi = (h) => { const m = String(h).replace(/\./g, "").replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const ucluDeger = (h) => { const n = norm(h); if (n.startsWith("evet")) return "evet"; if (n.startsWith("kismen")) return "kismen"; if (n.startsWith("hayir")) return "hayir"; return null; };

// ---------------------------------------------------------------- iz özetlerini oku
const projeler = new Map(); // anahtar: norm(proje) -> kayıt
const uyarilar = [];
const izler = fs.existsSync(ARASTIRMA) ? fs.readdirSync(ARASTIRMA, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];

for (const izKlasor of izler) {
  const ozetYol = path.join(ARASTIRMA, izKlasor, "OZET.md");
  if (!fs.existsSync(ozetYol)) { uyarilar.push(`${izKlasor}: OZET.md yok (iz henüz bitmemiş)`); continue; }
  const izId = izKlasor.split("-")[0];
  const md = fs.readFileSync(ozetYol, "utf8");
  const tl = tablolar(md);

  const puanT = tl.find((t) => t.baslik.some((b) => norm(b) === "proje") && PUAN_BASLIK.every((re) => t.baslik.some((b) => re.test(norm(b)))));
  const matrisT = tl.find((t) => t.baslik.some((b) => /saglayici|sozlesme|insankapisi|checkpoint/.test(norm(b))));
  if (!puanT) { uyarilar.push(`${izKlasor}: puan tablosu bulunamadı`); continue; }

  // sütun eşleme
  const bas = puanT.baslik.map(norm);
  const idx = (re) => bas.findIndex((b) => re.test(b));
  const iProje = idx(/^proje$/), iDil = idx(/^dil$/), iYildiz = idx(/yildiz|star/), iPush = idx(/push|commit/), iLisans = idx(/lisans|license/), iCanli = idx(/canlilik/);
  const puanIdx = PUAN_BASLIK.map((re) => bas.findIndex((b) => re.test(b)));
  const puanTam = puanIdx.every((i) => i >= 0);
  if (!puanTam) uyarilar.push(`${izKlasor}: puan sütunu eşleşmedi (${PUAN_ANAHTAR.filter((_, n) => puanIdx[n] < 0).join(", ")}) — başlık: ${puanT.baslik.join(" | ")}`);

  for (const r of puanT.satirlar) {
    if (r.length < 4) continue;
    const ad = temizAd(r[iProje] || r[0]);
    if (!ad) continue;
    const anahtar = norm(ad.split("/").pop());
    const kanitH = r.find((h) => /\]\([^)]+\.md\)/.test(h));
    const kayit = projeler.get(anahtar) || { repo: ad, iz: [], canlilik: null, yildiz: null, son_push: null, lisans: null, dil: null, puan: {}, saglayici_bagimsiz: null, sozlesme_var: null, insan_kapisi: null, checkpoint: null, kanit: [] };
    if (!kayit.iz.includes(izId)) kayit.iz.push(izId);
    if (iYildiz >= 0 && kayit.yildiz == null) kayit.yildiz = sayi(r[iYildiz]);
    if (iPush >= 0 && !kayit.son_push) kayit.son_push = (r[iPush].match(/\d{4}-\d{2}-\d{2}/) || [null])[0];
    if (iLisans >= 0 && !kayit.lisans) kayit.lisans = r[iLisans].replace(/\*\*/g, "").trim();
    if (iDil >= 0 && !kayit.dil) kayit.dil = r[iDil].trim();
    if (iCanli >= 0 && !kayit.canlilik) kayit.canlilik = norm(r[iCanli]).startsWith("gecti") ? "gecti" : "tarihi";
    if (!kayit.canlilik) kayit.canlilik = "gecti";
    if (!Object.keys(kayit.puan).length && puanTam) PUAN_ANAHTAR.forEach((k, n) => { const v = parseInt(r[puanIdx[n]], 10); kayit.puan[k] = v >= 1 && v <= 5 ? v : null; });
    if (kanitH) { const b = baglanti(kanitH); if (b) { const yol = `docs/arastirma/${izKlasor}/${b}`; if (!kayit.kanit.includes(yol)) kayit.kanit.push(yol); } }
    projeler.set(anahtar, kayit);
  }

  if (matrisT) {
    const mb = matrisT.baslik.map(norm);
    const mi = (re) => mb.findIndex((b) => re.test(b));
    const kolon = { saglayici_bagimsiz: mi(/saglayici/), sozlesme_var: mi(/sozlesme/), insan_kapisi: mi(/insankapisi|insan/), checkpoint: mi(/checkpoint/) };
    for (const r of matrisT.satirlar) {
      const ad = temizAd(r[0]); const nad = norm(ad.split("/").pop());
      let kayit = projeler.get(nad);
      if (!kayit) { for (const [k, v] of projeler) if (k.includes(nad) || nad.includes(k)) { kayit = v; break; } }
      if (!kayit) { uyarilar.push(`${izKlasor}: matris satırı "${ad}" puan tablosuyla eşleşmedi`); continue; }
      for (const k of MATRIS_ANAHTAR) if (kolon[k] >= 0 && kayit[k] == null) kayit[k] = ucluDeger(r[kolon[k]]);
    }
  } else uyarilar.push(`${izKlasor}: sağlayıcı/sözleşme/insan kapısı/checkpoint tablosu bulunamadı`);
}

// ---------------------------------------------------------------- çıktı
const liste = [...projeler.values()].sort((a, b) => a.iz[0].localeCompare(b.iz[0]) || (b.yildiz || 0) - (a.yildiz || 0));
const tarih = new Date().toISOString().slice(0, 10);
const json = { uretim_tarihi: tarih, kaynak: "docs/arastirma/*/OZET.md", arac: "arac/matris-uret.js", iz_sayisi: izler.filter((i) => fs.existsSync(path.join(ARASTIRMA, i, "OZET.md"))).length, projeler: liste, uyarilar };

// sütun istatistikleri: liderler ve boşluklar için ham veri
const ist = {};
for (const k of PUAN_ANAHTAR) { const v = liste.map((p) => p.puan[k]).filter((x) => Number.isInteger(x)); ist[k] = v.length ? { ort: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), en_iyi: liste.filter((p) => p.puan[k] === Math.max(...v)).map((p) => p.repo) } : null; }
for (const k of MATRIS_ANAHTAR) { ist[k] = { evet: liste.filter((p) => p[k] === "evet").length, kismen: liste.filter((p) => p[k] === "kismen").length, hayir: liste.filter((p) => p[k] === "hayir").length, bos: liste.filter((p) => p[k] == null).length }; }
json.istatistik = ist;

const fmt = (v) => (v == null ? "—" : v);
const y = (v) => (v == null ? "—" : v.toLocaleString("tr-TR"));
const md = [];
md.push("# Karşılaştırma matrisi", "", `*Üretim: ${tarih} · kaynak: ${json.iz_sayisi} iz özeti · araç: \`arac/matris-uret.js\` — tabloyu elle düzenleme, yeniden üretilir. Yorum bölümü korunur.*`, "");
md.push("## Matris", "");
md.push("| Repo | İz | Canlılık | ★ | Son push | Lisans | Dil | Olg | Mim | Gen | Güv.ilk | Göz | Güvenlik | Sağl.bağımsız | Sözleşme | İnsan kapısı | Checkpoint | Kanıt |");
md.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const p of liste) md.push(`| ${p.repo} | ${p.iz.join(",")} | ${p.canlilik} | ${y(p.yildiz)} | ${fmt(p.son_push)} | ${fmt(p.lisans)} | ${fmt(p.dil)} | ${PUAN_ANAHTAR.map((k) => fmt(p.puan[k])).join(" | ")} | ${MATRIS_ANAHTAR.map((k) => fmt(p[k])).join(" | ")} | ${p.kanit.map((k) => `[${path.basename(k, ".md")}](${k.replace(/^docs\//, "")})`).join(", ")} |`);
md.push("", "## Sütun istatistikleri (yorum için ham veri)", "", "| Ölçüt | Ortalama | En iyi |", "|---|---|---|");
for (const k of PUAN_ANAHTAR) if (ist[k]) md.push(`| ${k} | ${ist[k].ort} | ${ist[k].en_iyi.join(", ")} |`);
md.push("", "| Özellik | evet | kısmen | hayır | boş |", "|---|---|---|---|---|");
for (const k of MATRIS_ANAHTAR) md.push(`| ${k} | ${ist[k].evet} | ${ist[k].kismen} | ${ist[k].hayir} | ${ist[k].bos} |`);
if (uyarilar.length) { md.push("", "## Ayrıştırma uyarıları", "", ...uyarilar.map((u) => "- " + u)); }

// yorum bloğunu koru
let yorum = "\n<!-- YORUM:BASLANGIC -->\n\n## Yorum (protokol §6.4 — araştırmacı yazar, araç dokunmaz)\n\n### Sütun bazında liderler\n\n_(henüz yazılmadı)_\n\n### Boşluklar\n\n_(henüz yazılmadı)_\n\n### Çelişkiler\n\n_(henüz yazılmadı)_\n\n<!-- YORUM:SON -->\n";
if (fs.existsSync(MD_CIKTI)) { const eski = fs.readFileSync(MD_CIKTI, "utf8"); const m = eski.match(/<!-- YORUM:BASLANGIC -->[\s\S]*<!-- YORUM:SON -->/); if (m) yorum = "\n" + m[0] + "\n"; }
const mdMetin = md.join("\n") + "\n" + yorum;

if (kuru) { console.log(mdMetin); console.log("\n(kuru çalıştırma — dosya yazılmadı)"); }
else { fs.writeFileSync(JSON_CIKTI, JSON.stringify(json, null, 2), "utf8"); fs.writeFileSync(MD_CIKTI, mdMetin, "utf8"); console.log("Yazıldı: " + JSON_CIKTI + "\n         " + MD_CIKTI); }
console.log(`\nproje: ${liste.length} · iz: ${json.iz_sayisi} · uyarı: ${uyarilar.length}`);
for (const u of uyarilar) console.log("  ! " + u);
