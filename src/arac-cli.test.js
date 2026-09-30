/**
 * arac/ komut satiri sozlesmesi: --help, bilinmeyen bayrak, okunamayan girdi.
 *
 * NEDEN. docs/DENETIM.md'de olculdu (kanit: kanit/ajans-os/once): bayrak yazim hatasi
 * sessizce "temiz" diyordu (`sema-dogrula.js --tset`), `matris-uret.js --help` yardim
 * yerine iki belgeyi yeniden yaziyordu, okunamayan girdi yigin izi ve kod 1 veriyordu.
 * Sessizce gecen dogrulayici dogrulamiyor demektir; bu dosya o sinifi kilitler.
 *
 * SOZLESME (degisen yalniz onceden yakalanmamis istisna olan yollar):
 *   0 temiz · 1 dogrulama hatasi (belge ya da ihlal) · 2 kullanim hatasi ya da girdi okunamadi
 */

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = fileURLToPath(new URL("..", import.meta.url));
const { oner } = createRequire(import.meta.url)("../arac/_cli.js");

const gecici = mkdtempSync(join(tmpdir(), "ajans-os-cli-"));
after(() => rmSync(gecici, { recursive: true, force: true }));

/** Bir arac/ betigini gercekten kosar; renk kapali, cwd depo koku. */
function kos(arac, args = [], env = {}) {
  const r = spawnSync(process.execPath, [join(KOK, "arac", arac), ...args], {
    encoding: "utf8",
    cwd: KOK,
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
  return { kod: r.status, cikti: r.stdout, hata: r.stderr };
}

/** Yakalanmamis istisna izi (yigin satirlari, Node surum satiri) sizmamali. */
function yiginIziYok(metin) {
  assert.doesNotMatch(metin, /^\s+at .+/m, `yigin izi sizmis:\n${metin}`);
  assert.doesNotMatch(metin, /Node\.js v\d+/, `Node hata dokumu sizmis:\n${metin}`);
}

/** Her arac: adi ve --help'in HICBIR sey yapmadigini gosteren normal-kosu isareti. */
const ARACLAR = {
  "sema-dogrula.js": /^Şema:/m,
  "sema-mutasyon.js": /^oldu\s|^HAYATTA\s/m,
  "yapi-dogrula.js": /YAPI DOGRULAMA:/,
  "yapi-dogrula-test.js": /YAPI KAPISI TESTI:/,
  "kanit-dogrula.js": /otomatik kanıt doğrulaması/,
  "kanit-dogrula-test.js": /— yolEslesir —/,
  "matris-uret.js": /^Yazıldı:|proje: \d+/m,
  "iz-izle.js": /farkli alinti/,
};

for (const [arac, normalKosu] of Object.entries(ARACLAR)) {
  test(`arac/${arac} --help ve -h: kullanimi basar, 0 ile cikar, baska hicbir sey yapmaz`, () => {
    for (const bayrak of ["--help", "-h"]) {
      const r = kos(arac, [bayrak]);
      assert.equal(r.kod, 0, `${bayrak}: cikis kodu\n${r.hata}`);
      assert.ok(r.cikti.trimStart().startsWith(`${arac} — `), `${bayrak}: ilk satir aracin adini soylemeli`);
      assert.match(r.cikti, /Kullanım/, `${bayrak}: kullanim bolumu yok`);
      assert.match(r.cikti, /Çıkış kodu/, `${bayrak}: cikis kodu bolumu yok`);
      assert.doesNotMatch(r.cikti, normalKosu, `${bayrak}: yardim yerine araci kosmus`);
      assert.equal(r.hata, "", `${bayrak}: stderr bos olmali`);
    }
  });

  test(`arac/${arac}: tanimadigi bayragi sessizce yutmaz, 2 ile cikar ve --help'i gosterir`, () => {
    const r = kos(arac, ["--bilinmeyen-bayrak"]);
    assert.equal(r.kod, 2);
    assert.match(r.hata, /bilinmeyen bayrak '--bilinmeyen-bayrak'/);
    assert.ok(r.hata.includes(`node arac/${arac} --help`), "hata --help'e yonlendirmeli");
    assert.equal(r.cikti, "", "hicbir sey kosmamis olmali (stdout bos)");
    yiginIziYok(r.hata);
  });
}

test("yazim hatasi onerilir: sema-dogrula.js --tset --test mi demek istediniz? diye sorar", () => {
  const r = kos("sema-dogrula.js", ["--tset"]);
  assert.equal(r.kod, 2, "eskiden 0 ve 'Sonuc: temiz.' diyordu");
  assert.match(r.hata, /--test mi demek istediniz\?/);
  assert.equal(r.cikti, "", "oz-test kosmamis, ornekler de dogrulanmamis olmali");
});

test("yazim hatasi onerilir: iz-izle.js --yzaz --yaz mi demek istediniz? diye sorar", () => {
  const r = kos("iz-izle.js", ["docs/02-EN-IYI-FIKIRLER.md", "--yzaz"]);
  assert.equal(r.kod, 2);
  assert.match(r.hata, /--yaz mi demek istediniz\?/);
});

test("iz-izle.js: belgesiz ya da olmayan belgeyle 2 (davranis degismedi) ve --help'e yonlendirir", () => {
  const yok = kos("iz-izle.js", ["yok.md"]);
  assert.equal(yok.kod, 2);
  assert.match(yok.hata, /Belge yok: yok\.md/);
  const bos = kos("iz-izle.js");
  assert.equal(bos.kod, 2);
  assert.match(bos.hata, /Kullanim: node arac\/iz-izle\.js/);
  assert.ok(bos.hata.includes("node arac/iz-izle.js --help"), "kullanim hatasi --help'e yonlendirmeli");
});

test("oner: yakin bayragi bulur, uzak olani onermez", () => {
  const bilinen = ["--test", "--dosya", "--sema", "--help"];
  assert.equal(oner("--tset", bilinen), "--test");
  assert.equal(oner("--dosay", bilinen), "--dosya");
  assert.equal(oner("--halp", bilinen), "--help");
  assert.equal(oner("--tamamen-baska-bir-sey", bilinen), null);
});

test("matris-uret.js --help ve bilinmeyen bayrak belgeleri YENIDEN YAZMAZ", () => {
  const yollar = ["docs/01-matris.json", "docs/01-KARSILASTIRMA-MATRISI.md"].map((y) => join(KOK, y));
  const goruntu = () => yollar.map((y) => [readFileSync(y, "utf8"), statSync(y).mtimeMs]);
  const once = goruntu();
  kos("matris-uret.js", ["--help"]);
  kos("matris-uret.js", ["--kuru-yanlis"]);
  assert.deepEqual(goruntu(), once, "matris-uret.js bayraksiz kosmus: belgeler degismis");
});

// --- sema-dogrula.js --dosya: verdikt (1) ile "dogrulanamadi" (2) ayri -------------

function dosyaYaz(ad, icerik) {
  const yol = join(gecici, ad);
  writeFileSync(yol, icerik, "utf8");
  return yol;
}

test("sema-dogrula.js --dosya: gecerli belge 0 (davranis degismedi)", () => {
  const r = kos("sema-dogrula.js", ["--dosya", "contracts/ornek/gorev/gece-mimari-turu.json", "--sema", "task.schema.json"]);
  assert.equal(r.kod, 0);
  assert.match(r.cikti, /task\.schema\.json ile geçerli\./);
});

test("sema-dogrula.js --dosya: sozlesmeye uymayan belge 1 (davranis degismedi)", () => {
  const r = kos("sema-dogrula.js", ["--dosya", dosyaYaz("bos.json", '{"a": 1}'), "--sema", "task.schema.json"]);
  assert.equal(r.kod, 1);
  assert.match(r.hata, /5 hata:/);
  assert.match(r.hata, /zorunlu alan eksik: contract_version/);
  assert.match(r.hata, /tanımsız alan: a/);
});

test("sema-dogrula.js --dosya: gecerli JSON olmayan dosya 1 ve tek satir (eskiden yigin izi)", () => {
  const r = kos("sema-dogrula.js", ["--dosya", dosyaYaz("bozuk.json", '{"bozuk": '), "--sema", "task.schema.json"]);
  assert.equal(r.kod, 1);
  assert.match(r.hata, /bozuk\.json — geçerli JSON değil: /);
  yiginIziYok(r.hata);
});

test("sema-dogrula.js --dosya: olmayan dosya 2 ('dogrulanamadi'), yigin izi yok", () => {
  const r = kos("sema-dogrula.js", ["--dosya", join(gecici, "yok.json"), "--sema", "task.schema.json"]);
  assert.equal(r.kod, 2, "eskiden yakalanmamis istisna, kod 1");
  assert.match(r.hata, /yok\.json okunamadı — böyle bir dosya yok/);
  yiginIziYok(r.hata);
});

test("sema-dogrula.js --dosya: klasor verilirse 2 ve 'klasor' der", () => {
  const dizin = join(gecici, "bir-klasor");
  mkdirSync(dizin, { recursive: true });
  const r = kos("sema-dogrula.js", ["--dosya", dizin, "--sema", "task.schema.json"]);
  assert.equal(r.kod, 2);
  assert.match(r.hata, /bu bir klasör, dosya değil/);
  yiginIziYok(r.hata);
});

test("sema-dogrula.js: --dosya'nin degeri eksikse (bos ya da baska bayrak) 2", () => {
  for (const args of [["--dosya"], ["--dosya", "--sema", "task.schema.json"]]) {
    const r = kos("sema-dogrula.js", args);
    assert.equal(r.kod, 2, args.join(" "));
    assert.match(r.hata, /--dosya bir dosya yolu ister/);
    assert.match(r.hata, /^Kullanım: --dosya <json> --sema </m);
    yiginIziYok(r.hata);
  }
});

test("sema-dogrula.js: --sema eksik ya da bilinmiyorsa 2 ve gecerli sema adlarini sayar", () => {
  const belge = dosyaYaz("herhangi.json", "{}");
  const eksik = kos("sema-dogrula.js", ["--dosya", belge]);
  assert.equal(eksik.kod, 2);
  assert.match(eksik.hata, /--sema eksik/);
  const yanlis = kos("sema-dogrula.js", ["--dosya", belge, "--sema", "yok.schema.json"]);
  assert.equal(yanlis.kod, 2);
  assert.match(yanlis.hata, /bilinmeyen şema 'yok\.schema\.json'/);
  for (const ad of ["agent", "task", "message", "permission", "span", "proposal"]) {
    assert.ok(yanlis.hata.includes(`${ad}.schema.json`), `${ad}.schema.json listede yok`);
  }
});

test("sema-dogrula.js: --sema tek basina anlamsiz, 2 (eskiden sessizce yutuluyordu)", () => {
  const r = kos("sema-dogrula.js", ["--sema", "task.schema.json"]);
  assert.equal(r.kod, 2);
  assert.match(r.hata, /--sema tek başına anlamsız/);
  assert.equal(r.cikti, "");
});

// --- kanit-dogrula.js: klon kokleri ------------------------------------------------

test("kanit-dogrula.js: iki klon koku de yoksa 2 ve cozumu soyler (eskiden ENOENT yigin izi)", () => {
  const yok = join(gecici, "hic-yok");
  const r = kos("kanit-dogrula.js", ["i1-orkestrasyon"], { AJANS_OS_KLONLAR: yok, AJANS_OS_DEPOLAR: yok });
  assert.equal(r.kod, 2);
  assert.match(r.hata, /doğrulanacak klon bulunamadı/);
  assert.match(r.hata, /AJANS_OS_KLONLAR=<klon-kök> node arac\/kanit-dogrula\.js i1-orkestrasyon/);
  yiginIziYok(r.hata);
});

test("kanit-dogrula.js: yalniz AJANS_OS_KLONLAR varsa calisir (README'nin onerdigi tek degisken)", () => {
  const klonlar = join(gecici, "klonlar");
  mkdirSync(klonlar, { recursive: true });
  // Bayrak izden once de gelebilir: iz = ilk bayrak-olmayan argüman.
  const r = kos("kanit-dogrula.js", ["--ayrinti", "i1-orkestrasyon"], { AJANS_OS_KLONLAR: klonlar, AJANS_OS_DEPOLAR: join(gecici, "hic-yok") });
  assert.equal(r.kod, 0, r.hata);
  assert.match(r.cikti, /^# i1-orkestrasyon — otomatik kanıt doğrulaması/m);
  assert.equal(r.hata, "");
});

test("kanit-dogrula.js: izsiz ya da olmayan izde 2 ve mevcut izleri sayar", () => {
  for (const args of [[], ["yok-iz"]]) {
    const r = kos("kanit-dogrula.js", args);
    assert.equal(r.kod, 2, args.join(" ") || "(argumansiz)");
    assert.match(r.hata, /izler: i1-orkestrasyon, /);
  }
});
