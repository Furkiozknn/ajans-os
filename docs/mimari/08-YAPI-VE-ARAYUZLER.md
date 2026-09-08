# 08 — Yapı ve arayüzler

**Tarih:** 2026-09-08 · **Faz:** 4 (tasarım) · **Girdi:** `00-BLUEPRINT.md`
(13 bileşen, §2), `ADR-001` (bileşen kümesi), `ADR-002` (yürütme ve iletişim),
`ADR-008` (arayüz dili).

Bu belge tek bir soruya cevap verir: **13 bileşen kodda nereye oturur ve
birbirine hangi imzayla bakar?** Uygulama yoktur; `src/` altında yalnızca
arayüz (`.d.ts`) bulunur. Uygulama Faz 5'in işidir.

Dil kararı [ADR-008](../adr/ADR-008-arayuz-dili.md): **TypeScript `.d.ts`.**
Belirleyici ölçüt popülerlik değil, doğrulanabilirlik — arayüz bir komutla
denetlenemiyorsa sözleşme değil belgedir (AP3).

---

## 1. Klasör yapısı

```
ajans-os/
├── contracts/            JSON Schema — sözleşmelerin TEK kaynağı
│   ├── agent.schema.json      task.schema.json      message.schema.json
│   ├── permission.schema.json span.schema.json      proposal.schema.json
│   └── ornek/            her sözleşme için geçerli örnek belgeler
├── docs/                 mimari, ADR, araştırma (bu belge dahil)
├── arac/                 doğrulama araçları (Node, çıkış kodu üretir)
│   ├── sema-dogrula.js   kanit-dogrula.js   iz-izle.js
│   ├── matris-uret.js    kanit-dogrula-test.js
│   └── yapi-dogrula.js   ← bu belgenin kapısı (§5)
├── src/                  ARAYÜZLER — uygulama yok
│   ├── tipler.d.ts       sözleşmelerden türeyen ortak tipler
│   ├── orchestrator/           src/task-manager/       src/agent-registry/
│   ├── tool-registry/          src/permission-manager/ src/memory-manager/
│   ├── context-manager/        src/evaluator/          src/critic/
│   ├── recovery-manager/       src/model-router/       src/cost-manager/
│   └── observability/
└── tsconfig.json         yalnızca src/**/*.d.ts, strict, noEmit
```

**Klasör adı kuralı:** her modül klasörünün adı `00-BLUEPRINT.md` §2'deki bir
başlığın kebab-case hâlidir (`### 2.2 Task Manager` → `src/task-manager/`).
Eşleşme `arac/yapi-dogrula.js` tarafından kontrol edilir; on dördüncü bir
klasör açmak ADR-001'i yeniden açmayı gerektirir.

**Dosya kuralı:** her modülde tek bir `index.d.ts`. Modül büyüdüğünde dosya
bölünebilir, ama dışarıya bakan yüz `index.d.ts` olarak kalır.

---

## 2. Bağımlılık yönü — tek yön, tek yer

ADR-002: **diğer bileşenleri yalnızca Orchestrator çağırır.** Bu kural burada
bir yorum değil, dosya düzeyinde bir kısıttır:

| Dosya | Neyi import edebilir |
|---|---|
| `src/tipler.d.ts` | hiçbir modülü — sözleşmelerden türer, kimseyi tanımaz |
| `src/<modul>/index.d.ts` | yalnızca `../tipler` |
| `src/orchestrator/index.d.ts` | `../tipler` **ve** 12 kardeş modülün tamamı |

Bu yüzden `Kanit` ve `DegerlendirmeSonucu` gibi iki modülün paylaştığı her tip
`tipler.d.ts` içindedir; Critic, Evaluator'ı import etmez — ikisi de ortak tipi
import eder. İhlali `arac/yapi-dogrula.js` yakalar.

**Sonuç — her modül tek başına test edilebilir:** bir modülü test etmek için
`tipler.d.ts` dışında hiçbir şey gerekmez; Orchestrator'ı test etmek için 12
sahte (stub) nesne yeterlidir, çünkü bağımlılıkları `OrchestratorBagimliliklari`
alanında adlarıyla listelidir.

---

## 3. Arayüzler — özet

Tam imzalar `src/` altındadır; burada her modülün **dışarıya verdiği söz**
ve mimariden gelen kısıtı var.

| # | Modül | Arayüz ve ana metotlar | Mimari kısıt |
|---|---|---|---|
| 2.1 | `src/orchestrator/` | `Orchestrator`: `kosuyu_yurut`, `kosuyu_surdur`, `adimi_yurut` + `OrchestratorBagimliliklari` | Tek çağıran (ADR-002); `adimi_yurut` blueprint §3.2'deki 1–10 sırasını izler |
| 2.2 | `src/task-manager/` | `TaskManager`: `yukle`, `sonraki_adim`, `basladi_yaz`, `bitti_yaz`, `basarisiz_yaz`, `durum_degistir`, `tamamlandi_mi` | Adım sınırında **iki** yazma (ADR-003); `tamamlandi_mi` yan etkinin sessiz tekrarını keser |
| 2.3 | `src/agent-registry/` | `AgentRegistry`: `getir`, `listele`, `dogrula`, `turet` | Ev sahibi biçimleri türetilir (K8); `turet` dosya **yazmaz**, içerik döndürür |
| 2.4 | `src/tool-registry/` | `ToolRegistry`: `getir`, `listele`, `argumanlari_dogrula` | Araç şeması MCP'den; izin sınıfı kayıtta yazar, araç adından türetilmez |
| 2.5 | `src/permission-manager/` | `PermissionManager`: `karar`, `insan_kapisina_yaz`, `onayi_isle` | Üç değerli karar; `BLOCK`/`HUMAN_REQUIRED` istisna değil, **belge** döndürür |
| 2.6 | `src/memory-manager/` | `MemoryManager`: `oku`, `yaz`, `gecersiz_kil` | Yazma bir izin işlemidir → `yaz` imzasında `IzinKarari` zorunlu argüman (AP9 → kural 10) |
| 2.7 | `src/context-manager/` | `ContextManager`: `esik`, `kisilma_sirasi`, `butcele` | Kısılma sırası `readonly` — çalışma anında "neyi atalım" kararı yok |
| 2.8 | `src/evaluator/` | `Evaluator`: `gecerli_mi`, `esigi_asti_mi` | Girdi tipi `Kanit`; LLM çıktısı bu tipe **giremez** (ADR-004) |
| 2.9 | `src/critic/` | `Critic`: `elestir` | Dönüş `MesajSozlesmesi` (`kind: "critique"`), `string` değil; geçme kararına oy yok |
| 2.10 | `src/recovery-manager/` | `RecoveryManager`: `mod_sec`, `bekleme_ms` | Modlar: `duzelt` / `temiz-sayfa` / `insan-kapisi` / `durdur`; telafisi olmayan eylem insana düşer (AP8 → kural 9) |
| 2.11 | `src/model-router/` | `ModelRouter`: `sec`, `cagir` + `ModelTasiyici` | Sınır seçim/taşıma arasında: `sec` sağlayıcı-agnostik, sağlayıcıya özel her şey `ModelTasiyici` arkasında (K4) |
| 2.12 | `src/cost-manager/` | `CostManager`: `tablo_yukle`, `usage_isle`, `gecis_gerekli_mi`, `adim_tavani` | Fiyat tablosu veri; bilinmeyen maliyet `null` ve `bilinmeyen_cagri` sayacı (AP10 → kural 11) |
| 2.13 | `src/observability/` | `Observability`: `span_yaz`, `span_ac`, `kosu_izleri` | Tek yönlü: `span_yaz` `void` döner ve istisna atmaz — iz kaydı koşuyu düşüremez |

---

## 4. Adlandırma kuralları (ADR-008)

1. **Sözleşme alan adları JSON şemasındakinin birebir aynısı**, İngilizce:
   `step_id`, `contract_version`, `decision`, `usage`. Şema ile kod arasında ad
   eşlemesi tutmamak için çeviri yapılmaz.
2. **Metot ve tip adları Türkçe**, metotlar snake_case: `sonraki_adim`,
   `mod_sec`. Bu biçim ADR-004'ün sabitlediği `gecerli_mi()` /
   `esigi_asti_mi()` ile aynıdır; ikinci bir kural açılmadı.
3. `src/tipler.d.ts` şemaların **türevidir**. Çelişki hâlinde şema haklıdır;
   kural dosyanın başındaki yorumda da yazılıdır. Bu yüzden sözleşme
   gövdelerinde zorunlu olmayan alanlar `[alan: string]: unknown` ile açık
   bırakıldı — tip sistemi imza uyumu içindir, doğrulama `arac/sema-dogrula.js`
   ve JSON Schema'nın işidir.

---

## 5. Doğrulama — iki komut

```
npx -p typescript@5.6 tsc -p tsconfig.json    # 13 arayüz birbiriyle tutarlı mı
node arac/yapi-dogrula.js                     # yapı ADR-001/ADR-002'ye uyuyor mu
```

`yapi-dogrula.js` beş şeyi kontrol eder:

1. Blueprint §2 başlık sayısı = `src/` modül klasörü sayısı = **13**
2. Her klasör adı bir §2 başlığının kebab-case hâli
3. Her modülde `index.d.ts` var
4. `../<kardes-modul>` import'u yalnızca `orchestrator` içinde geçiyor
5. Her modül yolu (`src/<modul>/`) bu belgede geçiyor

İkisi de çıkış kodu 0 verirse Faz 4'ün ilk maddesi uygulanmıştır. Çevrimdışı
bir turda `tsc` çalışmaz (`npx` indirme gerektirir); o durumda yalnızca
`yapi-dogrula.js` çalıştırılır ve bu durum günlüğe yazılır.

---

## 6. Bu iskelette bilerek olmayanlar

- **Uygulama kodu.** `src/` altında uygulama dosyası (`.ts`) yok; modül dosyalarının hepsi `.d.ts`. Faz 4'ün şartı
  bu; `tsconfig.json` `noEmit` ile bunu pekiştirir.
- **Planlayıcı, yönlendirici servis, bilgi grafı, guardrail motoru, öğrenme
  katmanı** için klasör. Beşi de blueprint §4'te gerekçesiyle dışarıda; "ne
  olursa girer" koşulları orada yazılı.
- **Ortak bir `BaseComponent`/soyut sınıf.** Tek uygulaması olmayan soyutlama
  açılmadı; her modül kendi arayüzüyle yeter.
- **Olay veri yolu (event bus).** Observability tek yönlü dinleyicidir ve
  Orchestrator'ın doğrudan çağrısıyla beslenir; araya bir yol koymak ADR-002'nin
  tek çağıran kuralını gizlerdi.
- **Bağımlılık enjeksiyon çatısı.** `OrchestratorBagimliliklari` düz bir nesne;
  Faz 5'te elle bağlanır.

---

## 7. Faz 5'e devreden

Bu iskelet, yol haritasının ikinci Faz 4 maddesine (Implementation Roadmap)
doğrudan girdi verir: **her modül klasörü bir uygulama maddesidir** ve "bitti"
ölçütü o modülün arayüzünü karşılayan bir uygulama + testtir. Sıra kısıtı:
`tipler` → `task-manager` → `agent-registry`/`tool-registry` →
`permission-manager` → geri kalanlar → `orchestrator` (hepsini o çağırdığı için
en son).
