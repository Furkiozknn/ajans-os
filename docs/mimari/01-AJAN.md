# 01 — Ajan mimarisi

**Tarih:** 2026-09-08 · **Faz:** 3 (mimari sentez) · **Girdi:**
`docs/mimari/00-BLUEPRINT.md`, `docs/02-EN-IYI-FIKIRLER.md`,
`docs/03-ANTI-PATTERNLER.md` §6, ADR-000 · **Karar:**
[ADR-006](../adr/ADR-006-ajan-sozlesmesi.md)

Blueprint bileşenleri saydı. Bu belge onlardan birinin — ajanın — ne olduğunu,
sözleşmesinin neyi garanti ettiğini ve doğuşundan arşivine kadar hangi
bileşenin elinden geçtiğini yazar.

Çıktılar: bu belge, `contracts/agent.schema.json` v2.0, `contracts/ornek/`
altında iki tam sözleşme, `arac/sema-dogrula.js` (doğrulayıcı + öz-test).

---

## 1. Ajan nedir, ne değildir

**Ajan, bir sözleşmedir.** Prompt metni değil, sınıf değil, süreç değil:
`agent.schema.json`'a uyan bir JSON belgesi. Çalışma anındaki hâli
(çağrılan model, dolan bağlam, üretilen çıktı) ajanın kendisi değil, bir
**koşumudur**; koşumun kaydı Task Manager'da, izi Observability'dedir.

Bu ayrım üç şeyi doğrudan belirler:

- Ajan **sürümlüdür**. Kayıt defterinin anahtarı `identity.id + identity.version`.
  Aynı id'nin iki sürümü aynı anda kayıtlı olabilir.
- Ajan **taşınabilirdir**. Claude Code biçimi sözleşmeden türetilir, tersi
  değil (ADR-000 K8, §6).
- Ajan **kendi kendini çalıştırmaz**. Döngü Orchestrator'ındır; ajan ne retry
  eder, ne kendini puanlar, ne bir sonraki ajanı çağırır (ADR-002).

**Ajan olmayan üç şey.** Blueprint §4 bunları zaten dışarıda bıraktı, burada
sonucu yazılıyor:

| Sanılan | Gerçekte |
|---|---|
| Planlayıcı bir bileşendir | Plan üretmek bir **ajan rolüdür** (`role.kind: planner`); çıktısı görev grafıdır, onu Orchestrator yürütür (blueprint §4.1). |
| Yönlendirici bir servistir | Yönlendirme, adım çıktısının bir alanıdır; Orchestrator + Agent Registry karşılar (blueprint §4.2, İ1 D5). |
| Ajan araçlarını çağırır | Ajan araç **ister**; çağrı kararını Permission Manager verir (ADR-000 K6). |

---

## 2. Sözleşme v2.0 — neyi garanti eder

v1.0'ın eksiği alan eksikliği değildi; **zorlama** eksikliğiydi.
`docs/03-ANTI-PATTERNLER.md` §6'nın 12 kuralından beşi doğrudan ajan
sözleşmesine düşüyor ve v1.0'da beşi de yalnızca alan açıklamasında yazan bir
temenniydi. Şema onları kabul de ederdi, reddederdi de — kimse bakmazsa fark
edilmezdi. AP3'ün tanımı budur.

v2.0 bu beşini `if/then` ile şemaya gömdü:

| Kural | Şemadaki karşılığı | İhlal denemesi ne olur |
|---|---|---|
| 1 — sabit sınırlar config'ten okunmaz (AP1) | `tools[]`: `risk: high` + `scope ≠ read` ise `requires_human_approval` **const true** | `false` yazan sözleşme reddedilir |
| 7 — kapsamsızlık boş kümedir (AP6) | `permissions.filesystem.read/write`: `default: []` | Yazılmayan kapsam "hepsi" değil, hiçbir şey |
| 9 — geri alma diye bir alan yok (AP8) | `recovery_strategy.compensation`: `side_effects` zorunlu; true ise `method` + `on_impossible: "human-gate"` zorunlu | Yan etkili ajan telafi yazmadan kaydedilemez |
| 10 — belleğe yazmak izin işlemidir (AP9) | `memory_scope`: `write` doluysa `retention` zorunlu; `pii_allowed` true ise `pii_basis` zorunlu | Saklama süresi tanımsız yazma reddedilir |
| 12 — yansıma belleği sınırlıdır (AP11) | `workflow.max_iterations` (mode `iterative` ise zorunlu) + `recovery_strategy.retry.max_critique_items` (`max_attempts ≥ 1` ise zorunlu) | Üst sınırsız döngü reddedilir |

Buna bir alan daha eklendi: **`identity.status`** (`draft` / `active` /
`deprecated` / `archived`) ve `supersedes`. Gerekçesi §3.6'da — yaşam
döngüsünün arşiv ucunun makine-okur bir karşılığı yoktu, olmayınca da "arşiv"
bir belge cümlesi olarak kalıyordu.

Kaldırılan tek alan `recovery_strategy.rollback`'tir. Sebebi kural 9: o
kelimenin adlandırdığı işlem beş projede de gerçekte yapılmıyordu — durum geri
sarılıyor, dünya geri alınmıyordu. Yerine gelen `compensation` **farklı bir
soru sorar**: bu ajanın dünyada bıraktığı iz nedir ve telafisi ne? Telafisi
yoksa cevap tek: insan kapısı.

Alan alan gerekçe ve elenen seçenekler: [ADR-006](../adr/ADR-006-ajan-sozlesmesi.md).

---

## 3. Yaşam döngüsü

Altı aşama. Her aşamanın **bir sahibi**, **okuduğu sözleşme alanları** ve
**başarısızlık hâli** var. Sahip her zaman bir bileşendir; ajan hiçbir aşamanın
sahibi değildir.

```
  sözleşme dosyası
        │
   [1] KAYIT ──── şema geçmezse: kaydedilmez, draft bile olmaz
        │
   [2] SEÇİM ──── uygun ajan yoksa: görev ONAY_BEKLIYOR (insan seçer)
        │
   [3] BAŞLATMA ─ zorunlu girdi eksikse: ajan hiç başlatılmaz
        │
   [4] YÜRÜTME ── HUMAN_REQUIRED: ONAY_BEKLIYOR (kesintili, süreç ölebilir)
        │
   [5] DEĞERLENDİRME ── deterministik kaynak yoksa: DEGERLENDIRILMEDI → insan kapısı
        │
   [6] ARŞİV ──── sözleşme silinmez; status=archived, izler kalır
```

### 3.1 Kayıt

**Sahibi:** Agent Registry. **Girdi:** sözleşme dosyası.

Şema doğrulaması burada, bir kez yapılır. Geçmeyen sözleşme **kaydedilmez** —
`draft` olarak bile girmez, çünkü `draft` bir eksiklik durumu değil, "yazıldı,
henüz canlıya alınmadı" durumudur. Bugünkü karşılığı `node arac/sema-dogrula.js`
çıkış kodudur.

Kayıt aynı zamanda türetilmiş biçimleri üretir (§6): ev sahibi dosyaları
sözleşmeden yeniden üretilir, elle düzenlenmez. Genişleme maliyeti burada
**bir dosya + bir kayıt satırı**dır (D6); çekirdekte hiçbir dosya büyümez (AP7).

Bağımlılığı eksik olan ajan kaydedilir ama **hazır değil** işaretlenir:
`dependencies.agents` içindeki bir id kayıtlı değilse, ya da
`dependencies.services` karşılanmıyorsa seçilemez.

### 3.2 Seçim

**Sahibi:** Orchestrator; **danıştığı:** Agent Registry. Ayrı bir yönlendirici
bileşen **yoktur** (blueprint §4.2).

Sırayla:

1. `identity.status == "active"` — `deprecated` yalnızca adıyla açıkça
   çağrılırsa çalışır, `archived` hiç çalışmaz, `draft` yalnızca elle test
   koşumunda.
2. `role.kind` — adımın istediği rol.
3. `capabilities[].id` / `tags` — adımın istediği yetenek.
4. `permissions` — adımın gerektirdiği erişim sözleşmede **zaten** var mı?
   Yoksa ajan seçilmez. İzin, seçimden sonra genişletilmez; ajanlar birbirinin
   iznini devralmaz (ADR-000 K6).
5. Eşitlik bozucu: `capabilities[].confidence`, sonra
   `permissions.budget.max_cost_usd`.

Hiçbir ajan geçmezse **uydurma yapılmaz**: görev `ONAY_BEKLIYOR` olur ve
`raporlar/ONAY-BEKLEYENLER.md`'ye satır düşer. "Yakın olanı çalıştır" bu
mimaride yok — kapsamsızlık boş kümedir (kural 7).

### 3.3 Başlatma

**Sahibi:** Task Manager + Context Manager.

1. Task Manager adım kaydını `BASLADI` yazar — **yan etkiden önce** (ADR-003).
2. Girdiler `inputs` şemasına göre doğrulanır. Zorunlu girdi eksikse ajan
   başlatılmaz; bu bir çalışma anı hatası değil, başlatma reddidir.
3. Context Manager prompt'u bütçeler; kısılma sırası önceden yazılıdır.
   Ajanın sözleşmesi (sistem sözleşmesi payı) kısılmaz — kısılırsa ajan artık
   o ajan değildir.
4. Model Router `dependencies.models` tercihlerine bakar. `forbidden` mutlaktır;
   `preferred` boşsa `min_capability` alt sınırdır.

### 3.4 Yürütme

**Sahibi:** Orchestrator. Ajan `workflow.steps` sırasını izler ve **adım
atlayamaz**.

- Her araç çağrısı Permission Manager'a gider: `ALLOW` / `BLOCK` /
  `HUMAN_REQUIRED`. `HUMAN_REQUIRED` görevi `ONAY_BEKLIYOR`'a düşürür; durum
  **kesintilidir**, süreç ölebilir, akış onay olayıyla canlanır.
- Onay geldiğinde adım **baştan çalıştırılmaz**: kayıttaki `BASLADI` görülür ve
  yalnızca onaya bağlı eylem yürütülür (ADR-003, S3). Kapıdan geçen çağrı,
  kapıdan önce yapılmış hiçbir yan etkiyi tekrarlamaz.
- `checkpoint: true` olan adımdan sonra durum kalıcılaşır; koşum oradan devam
  edebilir.
- `mode: iterative` ise `max_iterations` üst sınırdır ve şema onu zorunlu kılar.
- Adım hatası `on_failure` ile sözleşmede yazılıdır (`retry` / `skip` / `abort` /
  `escalate`) — Orchestrator'ın içinde politika yaşamaz (ADR-002).

### 3.5 Değerlendirme

**Sahibi:** Evaluator; **yardımcı:** Critic, Recovery Manager (ADR-004).

1. `gecerli_mi()` — çıktı `outputs[].schema`'ya uyuyor mu? Deterministik.
2. `esigi_asti_mi()` — `evaluation_criteria[].threshold` karşılandı mı?
   `how: test` / `metric` deterministik; `how: rubric` / `human` değil.
3. Deterministik kaynağı olmayan ölçüt için sonuç `GECTI` ya da `KALDI` değil,
   **`DEGERLENDIRILMEDI`**'dir (D11: "kontrol edilmedi" ≠ "temiz"). Adım `BITTI`
   olur, görev `ONAY_BEKLIYOR` işaretlenir, gece koşusu durmaz.
4. Kaldıysa Critic yapılandırılmış bir düzeltme yazar — serbest metin değil.
   Bir sonraki denemeye taşınacak eleştiri sayısı `retry.max_critique_items` ile
   sınırlıdır; taşınmayanlar **silinmez**, ham kayıtta kalır (kural 12).
5. Recovery Manager modu seçer: *düzelt* (bağlamı koru, eleştiriyi ekle) veya
   *temiz sayfa* (bağlamı at). Ajanın kendisi bu kararı vermez.

Ajan **kendi çıktısını puanlamaz.** `success_criteria` ajanın kendine koyduğu
hedef, `evaluation_criteria` başkasının uyguladığı ölçüttür; ikisi bilerek ayrı
alanlardır.

### 3.6 Arşiv

**Sahibi:** insan; **uygulayan:** Agent Registry.

`active → deprecated → archived`. Geçiş bir **sürüm değişikliğidir**: sözleşme
dosyası düzenlenir, yeni sürüm kaydedilir, yerini alan ajan `supersedes` ile
eskisini gösterir. Sistem bu geçişi kendiliğinden yapmaz — önerir, insan onaylar
(ADR-000 K7).

Arşiv **silme değildir.** Sözleşme dosyası kalır (gerekirse `_eski/` altına
taşınır), Observability'deki izler kalır, geçmiş koşumlar okunabilir olmaya
devam eder. `archived` bir ajan seçilemez; çağrılırsa hata döner, sessizce
başka ajana düşülmez.

### 3.7 Aşama × sözleşme alanı

Hangi aşamanın hangi alanı okuduğu — sözleşmede kullanılmayan alan olmadığının
kontrolü de budur:

| Alan | Kayıt | Seçim | Başlatma | Yürütme | Değerlendirme | Arşiv |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `contract_version` | ● | | | | | |
| `identity` | ● | ● | | | | ● |
| `role`, `capabilities` | | ● | | | | |
| `mission` | | ● | ● | | | |
| `inputs` | | | ● | | | |
| `outputs` | | | | | ● | |
| `tools` | ● | ● | | ● | | |
| `permissions` | ● | ● | ● | ● | | |
| `dependencies` | ● | ● | ● | | | |
| `workflow` | | | | ● | | |
| `success_criteria` | | | ● | | ● | |
| `failure_modes` | | | | ● | ● | |
| `recovery_strategy` | | | | ● | ● | |
| `evaluation_criteria` | | | | | ● | |
| `memory_scope` | ● | | ● | ● | | |
| `communication_protocol` | | ● | | ● | | |
| `x-host` | ● | | | | | |

---

## 4. Sözleşme ne kadar katı — İ1'in S4 sorusu

Blueprint §6 bu soruyu bu maddeye havale etmişti. Cevap: **katı çekirdek, tek
kaçış kapısı.** Her nesne `additionalProperties: false`, 17 alan zorunlu, ev
sahibine özgü her şey yalnızca `x-host` altında ve çekirdek orayı okumaz.

Bedeli açık: yeni ajan eklemek beş satır frontmatter değil, ~150 satır JSON.
Bu bedel bilinçli kabul edildi — gerekçe ve elenen iki seçenek
[ADR-006](../adr/ADR-006-ajan-sozlesmesi.md)'da. `x-host` altındaki bir bilginin
çekirdeğe terfisi bir şema değişikliğidir, sessiz alan eklemesi değil.

---

## 5. İki örnek sözleşme ve doğrulama

`contracts/ornek/` altında iki tam sözleşme var; ikisi de bilerek farklı
dalları geziyor:

| | `kod-gozden-gecirici.json` | `kanit-denetcisi.json` |
|---|---|---|
| Kaynak | `turkce-ajanlar/agents/kod-gozden-gecirici.md`'den türetildi | bu depodaki denetim işinden yazıldı |
| Rol | `reviewer` | `evaluator` |
| Yazma izni | yok (`write: []`) | tek glob: `docs/arastirma/*/DENETIM.md` |
| Akış | `multi-step` | `iterative`, `max_iterations: 3` |
| Bellek yazımı | `task` / `retention: task` | `project` / `retention: permanent` |
| Telafi | yan etki var (Bash), kapı zorunlu | yan etki var (dosya), `_eski/`'ye taşıma |
| Zorunlu kıldığı kural | 1 (insan kapısı) | 10 (saklama süresi) |

**Doğrulama.** `arac/sema-dogrula.js` bağımlılıksız bir JSON Schema alt küme
doğrulayıcısıdır (`if/then`, `$ref`, `allOf` dahil) ve desteklemediği bir
anahtar kelime görürse **hata verir, sessizce geçmez** — sessizce geçen
doğrulayıcı doğrulamıyor demektir.

```
$ node arac/sema-dogrula.js --test
✓ kanit-denetcisi.json — geçerli, 17/17 zorunlu alan dolu
✓ kod-gozden-gecirici.json — geçerli, 17/17 zorunlu alan dolu
Öz-test — bozulmuş sözleşmeler reddedilmeli:   12 durumun 12'si reddedildi
Sonuç: temiz.
```

Öz-test, geçerli sözleşmeyi tek noktadan bozup **reddedilmesi gerektiğini**
sınar: `contract_version: "1.0"`, eksik `identity.status`, tanımsız alan,
kapısız `risk: high` araç, telafisiz yan etki, üst sınırsız eleştiri,
saklama süresiz bellek yazımı, gerekçesiz PII, üst sınırsız döngü,
`delete: true`, boş `failure_modes`, kebab olmayan id. On ikisi de reddedildi.
Bu, "şema kuralları zorluyor" iddiasının kanıtıdır — iddianın kendisi değil.

---

## 6. Ev sahibi türetme (ADR-000 K8) ve iki boşluk

Sözleşme kaynaktır; `.claude/agents/*.md` frontmatter'ı ondan **üretilir**.
Eşleme:

| Sözleşme | Claude Code frontmatter |
|---|---|
| `identity.id` | `name` |
| `role.summary` + `capabilities[].description` | `description` (elle yazılmaz) |
| `tools[].name` | `tools` |
| izin verilmeyen araçlar | `disallowedTools` |
| `dependencies.models.preferred` | `model` |
| `mission` + `workflow.steps` | gövde metni |
| `x-host.claude-code.*` | doğrudan (renk, skills vb.) |

Türetme sırasında iki gerçek boşluk çıktı. İkisi de düzeltilmedi, **yazıldı**:

**B1 — kapısız `Bash`.** `kod-gozden-gecirici` bugün `Bash`'i onaysız
kullanıyor (paket var mı diye `npm view`, `git diff`). Sözleşmeye çevrilince
`scope: execute` + `risk: high` oldu ve şema `requires_human_approval: true`'yu
zorunlu kıldı. Kabul edilen sonuç: **bu ajan gece koşusunda `Bash` kullanamaz**;
kullanması gerekirse `ONAY_BEKLIYOR`'a düşer ve karar sabaha kalır. Daraltılmış
bir araç tanımı (`npm view` ve `curl -o /dev/null` dışında hiçbir şey, `risk: low`)
bu kısıtı kaldırır; Faz 4'ün Tool Registry maddesine bırakıldı.

**B2 — ev sahibinde kapsam zayıflar.** Frontmatter `tools: ["Write"]` diyebilir,
"yalnızca şu glob'a yaz" diyemez. `permissions.filesystem.write` sözleşmede
kalır ve dışa aktarıcı bunu ajan metnindeki bir sınır cümlesine çevirir — yani
ev sahibi katmanında kapsam bir **temenniye** dönüşür. Gerçek zorlama Permission
Manager'dadır; Claude Code'da bugün karşılığı yoktur. Bilinen ve kayıtlı
zayıflık.

---

## 7. Faz 4'e devredilenler

- **Dar araç tanımı** (B1): Tool Registry maddesi. `Bash` gibi tek kelimelik
  araç adlarının izin kararı için fazla kaba olması genel bir problem.
- **Ev sahibi dışa aktarıcı**: sözleşme → `.md` üreteci. Bu maddede yalnızca
  eşleme tablosu yazıldı, kod yazılmadı (K1: kod ADR serisinden sonra).
- **`draft` ajanların test koşumu**: kayıt defterine giren ama seçilemeyen
  ajanın nasıl denendiği Faz 4 "Repository / folder structure" işi.

---

## 8. Dürüstlük

- **Bu belge yeni araştırma kanıtı üretmedi.** Kaynağı blueprint, Faz 2'nin iki
  belgesi ve ADR-000; bu turda hiçbir klona girilmedi, hiçbir `dosya:satır`
  yeniden doğrulanmadı. Alıntıların güvenilirliği altındaki katmanların denetim
  durumuna eşittir.
- **Doğrulanan tek şey şemanın kendisidir**, ve o gerçekten doğrulandı:
  iki örnek sözleşme geçti, on iki bozma denemesi reddedildi, çıkış kodu 0.
  Şemanın **doğru kuralları** zorladığı ise bir tasarım iddiasıdır, test değil —
  kuralların kendisi `docs/03-ANTI-PATTERNLER.md` §6'dan geliyor ve oradaki
  kanıt zinciri bu belgede yeniden sınanmadı.
- **`identity.status` alanının kanıtı diğerlerinden zayıf.** Beş kuralın her
  biri iki dallı K2 ölçütünü geçmiş anti-pattern'lere bağlı; `status` ise yol
  haritasının "kayıt → … → arşiv" cümlesinden ve arşivin makine-okur karşılığının
  olmamasından türedi. Ekosistemde ölçülmüş bir yinelenen desene bağlanmadı.
- **Doğrulayıcı bir JSON Schema uygulaması değildir.** Bu depodaki alt kümeyi
  destekler; `oneOf`, `anyOf`, `dependentRequired` gibi anahtar kelimeler
  yazılırsa hata verir. Bilinçli sınır: sessizce geçmektense durmak.
- **Kapsam dışı bırakılan:** `contracts/task.schema.json` ve
  `contracts/message.schema.json` bu maddede yazılmadı — yol haritası ikisini de
  "Orchestration Architecture" maddesine bağlamış. Bu belge onlara yalnızca
  atıfta bulunuyor.
