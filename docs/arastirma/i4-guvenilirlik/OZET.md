# İ4 — Güvenilirlik ve öz-düzeltme: iz özeti

*8 Eylül 2026. Yedi proje, iki turda incelendi (7 Eylül gecesi dört, 8 Eylül üç).
Kanıt doğrulaması: `DENETIM-otomatik.md`. Protokol §4 biçimi.*

İzin ana sorusu şuydu: **checkpoint durum modeli nasıl kurulur (immutable snapshot
mı, event log mu), ve "rollback" gerçekten geri alıyor mu yoksa "yeniden dene" mi?**
Yedi projenin ikisi de net cevap verdi ve cevap rahatsız edici: **hiçbiri gerçekten
geri almıyor.** Ayrıntı §3 ve §5'te.

---

## 1. İncelenen projeler

| Proje | Dosya | Yıldız | Son push | Lisans | Canlılık | Neden bu izde |
|---|---|---|---|---|---|---|
| langchain-ai/langgraph | [langgraph.md](langgraph.md) | 41.194 | 2026-09-06 | MIT | geçti | Checkpoint'in en olgun ajan-tarafı uygulaması |
| temporalio/sdk-python | [temporal.md](temporal.md) | 1.178 | 2026-09-05 | MIT | geçti | Event-log/replay yolunun referansı |
| dbos-inc/dbos-transact-py | [dbos-transact-py.md](dbos-transact-py.md) | 1.563 | 2026-09-04 | MIT | geçti | Üçüncü yol: kalıcı adım-sonucu tablosu |
| stanfordnlp/dspy | [dspy.md](dspy.md) | 37.834 | 2026-09-05 | MIT | geçti | Öz-düzeltme: `Refine` / `BestOfN`, ödül fonksiyonu |
| 567-labs/instructor | [instructor.md](instructor.md) | ölçülmedi | ölçülmedi | MIT | geçti (sürüm 1.16.1, aktif) | Doğrulama hatasını modele geri besleme |
| Portkey-AI/gateway | [portkey-gateway.md](portkey-gateway.md) | 12.922 | 2026-05-25 | MIT | **tarihî referans** (~105 gün) | Fallback zinciri, devre kesici iddiası |
| noahshinn/reflexion | [reflexion.md](reflexion.md) | 3.262 | 2025-01-13 | MIT | **tarihî referans** (~600 gün) | Öz-eleştiri fikrinin kökeni |

Yıldız/son-push değerleri 7 Eylül'de GitHub API'den ölçüldü; instructor'ınki bu
turda ölçülmedi ve uydurulmadı (kanıtı yerel klonda yok).

### Puanlar (protokol §3 rubriği)

| Proje | Olgunluk | Mimari netlik | Genişletilebilirlik | Güvenilirlik ilkelleri | Gözlemlenebilirlik | Güvenlik duruşu |
|---|---|---|---|---|---|---|
| langgraph | 5 | 4 | 4 | 4 | 3 | 3 |
| temporal | 4 | 4 | incelenmedi | 5 | incelenmedi | incelenmedi |
| dbos-transact-py | 5 | 4 | 3 | 4 | 4 | 3 |
| dspy | 4 | 4 | 4 | 3 | 3 | 3 |
| instructor | 4 | 3 | 4 | 3 | 3 | 3 |
| portkey-gateway | 4 | 4 | 3 | 3 | 3 | incelenmedi |
| reflexion | 2 | 3 | 2 | 2 | 2 | 1 |

"incelenmedi" gerçek bir değerdir: o eksen bu izin kapsamına alınmadı, sıfır puan
anlamına gelmez ve matris hesabına girmez.

### Sağlayıcı bağımsızlığı / sözleşme / insan kapısı / checkpoint

| Proje | saglayici_bagimsiz | sozlesme_var | insan_kapisi | checkpoint |
|---|---|---|---|---|
| langgraph | evet | kismen | evet | evet |
| temporal | evet | kismen | hayir | evet |
| dbos-transact-py | kismen | evet | kismen | evet |
| dspy | evet | kismen | hayir | hayir |
| instructor | evet | kismen | hayir | hayir |
| portkey-gateway | evet | kismen | hayir | hayir |
| reflexion | hayir | hayir | hayir | hayir |

Dikkat çeken: **insan kapısı yedi projeden yalnızca birinde birinci sınıf** (LangGraph
`interrupt()`, `langgraph/types.py:851`). Güvenilirlik literatürünün tamamı "makine kendini
toparlasın" üzerine kurulu; "insan devreye girsin" neredeyse hiç yok. ADR-000
K7'nin insan kapısı ısrarını bu iz **çürütmüyor ama desteklemiyor da** — desen
ekosistemde yaygın değil, bu bizim ayrışma noktamız olacak.

---

## 2. Yinelenen desenler (birden çok projede bağımsız ortaya çıkan)

En güçlü sinyaller. Her biri en az iki bağımsız projede, birbirinden habersiz
ortaya çıkmış.

### 2.1 Yargı deterministik kaynaktan gelir; LLM yalnızca açıklama yazar

**Üç projede bağımsız olarak, üç farklı biçimde.** Bu izin en güçlü bulgusu.

- **Reflexion:** geçti/kaldı kararını birim testleri veriyor
  (`programming_runs/reflexion.py:43`, `is_passing, feedback = exe.execute(...)`);
  LLM'e sorulan tek şey "neden başarısız oldun" (`py_generate.py:151`).
- **Instructor:** karar Pydantic'in `ValidationError`'ı — şema ya tutar ya tutmaz;
  LLM'in hata metnini görüp düzeltmesi isteniyor, hata olup olmadığına karar
  vermesi değil.
- **dspy:** `Refine` bir `reward_fn` callable'ı ve sayısal bir eşik alıyor; LLM
  çağrısı yalnızca `OfferFeedback` ile düzeltme talimatı üretmek için.

Üçü de aynı tuzaktan kaçınmış: **LLM'i kendi çıktısının yargıcı yapmamak.** LLM
eleştirmen (`Critic`), ama değerlendirici (`Evaluator`) değil. Bu ayrım bizim
Faz 3 `04-DEGERLENDIRME.md` maddesinin çekirdeği olmalı.

### 2.2 Eleştiri serbest metin değil, bir sonraki çağrının yapılandırılmış girdisi

Üç proje eleştiriyi "log'a yaz" değil, "prompt'a alan olarak ekle" biçiminde
çözmüş:

- dspy: `hint_` adında yeni bir **girdi alanı** olarak sinyatüre ekleniyor.
- instructor: `reask_handler(kwargs, response, exception)` `ValidationError` metnini
  tool-call'a bağlı bir mesaj olarak bir sonraki tura enjekte ediyor.
- Reflexion: `format_reflections()` sabit bir başlıkla birleştiriyor
  (`hotpotqa_runs/agents.py:114`; başlık `prompts.py:113`).

Reflexion'ın prompt'u bunun **nasıl** yazılacağını da gösteriyor: eleştiri geçmişin
analizi olarak değil, geleceğin talimatı olarak biçimlendiriliyor — "you will need
this as a hint when you try again later" (`py_generate.py:12`, `:151`).

### 2.3 Hata sınıflandırması: "denemekle düzelir mi?"

Kör retry'ın yanlış olduğu üç projede bağımsız keşfedilmiş, üç farklı yerde tutulmuş:

- **LangGraph** — statik liste: `default_retry_on()` (`_internal/_retry.py:1-29`)
  programlama hatalarını (`ValueError`, `TypeError`, `SyntaxError`…) retry
  **etmiyor**, ağ hatalarını ediyor.
- **Temporal** — hata nesnesinin kendisinde bayrak: `ApplicationError.non_retryable`
  (`temporalio/exceptions.py:132,159-166`).
- **Portkey** — config'te durum kodu listesi: `onStatusCodes`
  (`src/handlers/handlerUtils.ts:663-693`).

Üç farklı taşıyıcı (kod listesi / istisna alanı / yapılandırma), aynı fikir. Bizde
**hata nesnesinde taşınmalı** (Temporal'ın yolu): statik liste kütüphane
sınırlarında eskir, config kullanıcıya yük bindirir.

### 2.4 Adım sınırından ince granülerlik: kısmi ilerlemeyi kaybetmeme

- **LangGraph:** `put_writes()` her görev biter bitmez yazıyor
  (`_runner.py:608-611`); resume'de `[t for t in loop.tasks.values() if not t.writes]`
  filtresi yazması olan görevi atlıyor (`main.py:2968`).
- **Temporal:** aynı ihtiyacı aktivite **içinde** çözüyor — `heartbeat_details`
  (`_activity.py:583-594`), worker ölse bile yeni deneme kaldığı yerden başlar.

İkisi de "adım tamamlandı" bilgisini adım sınırından daha ince tutuyor. DBOS
bunu **yapmıyor** ve bedelini ödüyor: checkpoint granülerliği tam olarak adım
sınırı, 10.000 satır işleyen bir adım yarısında çökerse baştan başlar
(`dbos/_core.py:2551-2567`).

### 2.5 İki farklı retry modu: "düzelt" ile "temiz sayfa"

- **Reflexion:** iç döngü bağlamı taşıyarak düzeltir (`reflexion.py:57-90`), dış
  döngü `pass_at_k` ile sıfırdan yazar (`:33-91`). İkisi ayrı parametre.
- **Temporal:** aktivite retry'ı (ucuz, durumu koru) ile workflow retry'ı (pahalı,
  baştan) bilinçli olarak farklı (`client/_client.py:574-584`).

İkisi de aynı şeyi söylüyor: yansımalı/bağlamlı retry yerel minimuma saplanabilir;
çıkışı bir deneme daha değil, **sıfırlanmış** bir denemedir.

---

## 3. Ayrışan yaklaşımlar — aynı problemin farklı çözümleri

### 3.1 Durum modeli: üç yol, ve hiçbiri "doğru" değil

İzin ana sorusunun cevabı. Üç canlı proje aynı problemi üç zıt yolla çözüyor:

| Yol | Kim | Ne yazıyor | Bedeli | Kazancı |
|---|---|---|---|---|
| **Tam snapshot** | LangGraph | Her superstep sonunda tüm kanalların değeri (`checkpoint/base/__init__.py:93-124`) | Yazma hacmi; depolamada kanal-versiyon blob'larıyla azaltılıyor (`checkpoint-postgres/.../base.py:57-64`) | Herhangi bir noktaya doğrudan atlanabilir; zaman yolculuğu ucuz |
| **Event log + replay** | Temporal | Hiç snapshot yok; olay geçmişi yeniden oynatılıyor, tamamlanmış aktivitenin sonucu geçmişten okunup future'a enjekte ediliyor (`_workflow_instance.py:875-921`) | Kullanıcı koduna **determinizm yükümlülüğü** bindiriyor | Yazma ucuz; tam denetim izi bedava |
| **Adım-sonucu tablosu** | DBOS | Ne snapshot ne event log — yalnızca "hangi adım bitti, sonucu ne" (`operation_outputs`, PK = workflow_id+function_id) | Adım-altı ilerleme yok; workflow gövdesi recovery'de baştan çağrılıyor (yine determinizm varsayımı) | En ucuz: tek upsert + tek SELECT |

**Seçim kriteri** bu üç dosyadan çıkıyor: durum büyükse ve geçmişe atlamak
gerekiyorsa snapshot; denetim izi ve tam yeniden üretilebilirlik birincilse event
log; **yalnızca "bu adımı tekrar çalıştırmayayım" isteniyorsa adım-sonucu tablosu
yeter ve diğer ikisinden çok daha ucuzdur.**

Kritik uyarı: son iki yolun ikisi de kullanıcı koduna **sessiz bir determinizm
yükümlülüğü** bindiriyor. Temporal bunu açıkça söylüyor ve `NondeterminismError`
ile yakalamaya çalışıyor; DBOS bunu söylemiyor ve yalnızca adım *adı* değişirse
fark ediyor (`DBOSUnexpectedStepError`). Bir LLM ajanı doğası gereği deterministik
değildir — bu yüzden replay tabanlı modeller ajan orkestrasyonuna doğrudan
taşınamaz, ancak "LLM çağrısını bir adıma hapset, adımın kendisi deterministik
olmasın" biçiminde uyarlanabilir.

### 3.2 Checkpoint'i "ne zaman" yazmak

- **DBOS: adım bittikten sonra** (`_core.py:2551-2567`). Sonuç: adım gövdesi
  çalışıp DB yazması commit olmadan çökerse adım **yeniden çalışır** — yan etki
  iki kez olabilir. Bu, README'nin "exactly-once" iddiasını sıradan
  `@DBOS.step`ler için yanlışlar (bkz. §4.2).
- **LangGraph: her görev biter bitmez ayrıca** (`put_writes`, `_runner.py:608-611`),
  yani superstep sınırını beklemeden.
- **"Başladı" checkpoint'i hiçbirinde yok.** Üçünde de yalnızca "bitti, sonucu şu"
  kaydı var. Yani hiçbir sistem "bu adım başlamıştı, yarım kaldı" ayrımını
  yapamıyor — çökme sonrası "hiç başlamadı" ile "başladı, bitmedi" aynı görünüyor.
  Bu bizim tasarımımızda bilinçli bir karar noktası.

### 3.3 "Rollback" — üç projede de aslında yok

Bu izin en önemli negatif bulgusu, ve iddiayı üç bağımsız kanıt taşıyor:

- **LangGraph** zaman yolculuğunda eski checkpoint'i **silmiyor**, yeni bir dal
  açıyor (`_loop.py:960-971`, `{"source": "fork"}`; `CheckpointMetadata.parents`,
  `base/__init__.py:57-61`). Yan etki telafisi yok — depoda `grep -rn compensat`
  sıfır sonuç veriyor.
- **Temporal**'da telafi motorun değil geliştiricinin işi; saga deseni SDK'da
  yok (bu klonda sıfır saga/compensation kodu veya örneği).
- **DBOS**'ta da saga/compensation yok.
- **Portkey** stateless; geri alacak durum bile yok.
- **Reflexion**'da geri alınacak bir şey yok çünkü dış dünyaya hiç dokunmuyor —
  tek yan etkisi sandbox'ta test çalıştırmak.

**Sonuç: bu ekosistemde "rollback" = durumu geri sar + yeniden dene. Dünyayı geri
alma değil.** Bu tesadüf değil, bilinçli bir yakınsama: telafi mantığı domain'e
özgüdür ve genel bir motor bunu güvenle otomatikleştiremez. Temporal bunu açıkça
tasarım kararı olarak savunuyor.

### 3.4 Backoff: var olan ve olmayan

Ayrışma keskin ve altyapı/uygulama katmanı çizgisinde:

- **Var:** LangGraph (`initial_interval=0.5`, `backoff_factor=2.0`,
  `max_interval=128.0`, `jitter=True` — `langgraph/types.py:418-437`), Temporal (proto
  düzeyinde), Portkey (`async-retry` ile üstel; **jitter kapalı**).
- **Yok:** instructor (`tenacity.Retrying(stop=stop_after_attempt(N+1))`, `wait_*`
  hiç import edilmemiş), dspy, Reflexion.

Yani **ajan/LLM katmanındaki projelerin hiçbirinde backoff yok**, altyapı
katmanındakilerin hepsinde var. Bu bir olgunluk farkı, tasarım tercihi değil:
LLM sağlayıcıları 429 döndürür ve backoff'suz retry rate-limit'i kötüleştirir.

---

## 4. Anti-pattern'ler

### 4.1 Yarım bırakılmış özellik kancası

Portkey'de devre kesici alanları (`isOpen`, `cbConfig`, `handleCircuitBreakerResponse`)
kodda **okunuyor** (`src/handlers/handlerUtils.ts:646-659`, `:792-799`) ama repo
genelinde hiçbir yerde tanımlanmıyor veya set edilmiyor. Kod okuyan biri "devre
kesici var" sanıyor; OSS'te çalışan bir devre kesici yok, yalnızca kanca var.

**Kural:** bir özellik ya tam uygulanır ya hiç iskeleti bırakılmaz. Yarım kanca
yanlış güven verir — ve güvenilirlik bileşeninde yanlış güven, özelliğin hiç
olmamasından kötüdür.

### 4.2 Pazarlama dili ile kodun ayrışması

DBOS README'si "exactly-once" diyor (`README.md:139,151,163`); kod sıradan
`@DBOS.step` için at-least-once sağlıyor (`_core.py:2551-2567`). Gerçek
exactly-once yalnızca `@DBOS.transaction` (checkpoint DB yan etkisiyle aynı
transaction'da) ve dedup'lu mesajlaşma için geçerli. Bu ayrım README'de
yapılmıyor.

**Kural:** kendi belgemizde garanti ifadeleri kod seviyesinde kanıtlanabilir
olmalı. "Adım en az bir kez çalışır, sonucu tam bir kez kaydedilir" gibi dürüst
bir ifade, "exactly-once"tan uzun ama doğru.

### 4.3 Sınırsız biriken bağlam

Reflexion `self.reflections += [...]` (`agents.py:113`) — hiç budama, özetleme
veya sınır yok. Instructor'da mesaj listesi denemeler arasında aynı şekilde
büyüyor. İki projede de token bütçesi veya pencere yönetimi bulunamadı.

Uzun koşuda bağlam penceresi dolar ve maliyet deneme sayısıyla doğrusal büyür —
üstelik retry döngüsü içinde, yani tam da işlerin kötü gittiği anda.

### 4.4 Gerekçesiz kaldırılan mekanizma, yorum satırına gömülmüş ölü kod

dspy'de backtracking (`Assert`/`Suggest`) kaldırılmış, gerekçe kod yorumunda,
ölü kod duruyor. Bir mekanizma kaldırılıyorsa gerekçesi ADR olmalı — sonraki
okuyucu "bu neden yok" sorusuna kod arkeolojisi yapmadan cevap bulabilmeli.

### 4.5 Determinizm yükümlülüğünü sessizce kullanıcıya bindirmek

DBOS recovery'de workflow gövdesini baştan çağırıyor ve deterministik olduğunu
varsayıyor; ihlali yalnızca adım *adı* değişirse yakalıyor. Temporal aynı
varsayımı yapıyor ama açıkça söylüyor ve `NondeterminismError` ile yakalamaya
çalışıyor. İkisi arasındaki fark, ihlalin sessiz mi gürültülü mü başarısız
olduğu — ve bu fark üretimde her şeydir.

---

## 5. Bizim için öneri

**Ö1 — Checkpoint'i adım-sonucu tablosu olarak kur, snapshot olarak değil.**
DBOS'un `operation_outputs` deseni (PK = çalıştırma_id + adım_id) bize gereken
tek soruyu tek upsert ve tek SELECT ile cevaplıyor: "bu adım bu çalıştırmada
zaten tamamlandı mı?" LangGraph'ın tüm durumu snapshot'lama maliyetine gerek yok
çünkü bizim durumumuz (görev grafı + ajan çıktıları) zaten kalıcı dosyalarda.
**Ama** LangGraph'ın `put()` / `put_writes()` ayrımını al: superstep sonu durumu
ile görev bazlı ilerleme ayrı yazılmalı (§2.4).
*Kanıt:* `dbos/_core.py:2551-2567`, `checkpoint/base/__init__.py:278,301`,
`langgraph/pregel/main.py:2968`.

**Ö2 — "Rollback" kelimesini mimariye sokma. İki ayrı kavram var, ikisini de
kendi adıyla çağır.**
(a) *Durumu geri sarma* — checkpoint'ten okuyup yeniden başlama. Bunu yapacağız,
ucuz ve güvenli. (b) *Telafi (compensation)* — dünyada yapılmış bir şeyi geri
alma. Bunu genel bir motor olarak **yapmayacağız**; çünkü incelenen hiçbir olgun
sistem yapmıyor ve yapmama gerekçeleri sağlam (domain'e özgü). Bunun yerine:
geri alınamaz eylemler (araç çağrısı, dosya yazma, dış API) için ya
**idempotency-key** ya da **açık, elle yazılmış telafi adımı** zorunlu olsun.
Ayrıca LangGraph'ın fork deseni (§3.3) rollback'in yerine geçen daha iyi bir
birincil desen: eskiyi silme, yeni dal aç — hem denetlenebilir hem "birden fazla
alternatifi paralel dene" senaryosunu bedava veriyor.
*Kanıt:* `_loop.py:960-971`, `base/__init__.py:57-61`, Temporal'da sıfır saga kodu.

**Ö3 — Evaluator ile Critic ayrı bileşenler olsun; Critic'in oyu geçme kararına
girmesin.**
Evaluator deterministik kaynaklardan besleniyor: şema doğrulaması, test sonucu,
çıkış kodu, eşik. Critic bir LLM ve yalnızca **neden başarısız olduğunu ve bir
sonraki denemede ne yapılacağını** yazıyor. Critic'in çıktısı serbest metin
değil, bir sonraki çağrının **girdi şemasına eklenen bir alan** (§2.2). Bu, üç
bağımsız projede aynı biçimde ortaya çıkmış en güçlü desen — ve LLM-as-judge
tuzağının panzehiri.
*Kanıt:* Reflexion `programming_runs/reflexion.py:43` (yargıyı test veriyor); instructor `instructor/v2/core/retry.py` (`reask_handler` deseni); dspy `dspy/predict/refine.py` (`reward_fn` eşiği + `hint_` alanı).

**Ö4 — Retry katmanı hata sınıflandırmasını hata nesnesinden okusun; iki modu
ayrı yapılandırılabilir olsun.**
Her hata bir `retry_edilebilir` bayrağı taşısın (Temporal'ın yolu, §2.3) — statik
liste kütüphane sınırlarında eskir. Ve retry'ın iki modu ayrı ayarlansın (§2.5):
*düzelt* (bağlamı taşı, eleştiriyi ekle) ile *temiz sayfa* (durumu sıfırla,
baştan). Ağ çağrısı yapan her görev için retry varsayılan **açık** olsun —
LangGraph'ın opt-in modelini kopyalamayalım. Backoff + jitter varsayılan olsun:
ajan katmanı projelerinin hiçbirinde yok ve bu bir olgunluk eksiği, tercih değil
(§3.4).
*Kanıt:* `exceptions.py:132,159-166`, `_internal/_retry.py:1-29`,
`langgraph/types.py:418-437`, instructor'da `wait_*` importunun hiç olmaması.

**Ö5 — Uzun adımlar için adım-altı ilerleme mekanizması ayrı bir birincildir.**
Checkpoint granülerliği adım sınırı olursa, uzun bir ajan aracı (büyük dosya
işleme, çok adımlı arama) yarısında çökünce baştan başlar. Temporal'ın
`heartbeat_details`'i ve LangGraph'ın `put_writes`'ı aynı ihtiyacı iki farklı
katmanda çözüyor; DBOS çözmüyor ve bu onun kanıtlı eksiği. Bizde bu, retry ve
checkpoint'ten **bağımsız** üçüncü bir mekanizma olmalı.
*Kanıt:* `_activity.py:583-594`, `_runner.py:608-611`, `dbos/_core.py:2551-2567`.

---

## 6. Açık sorular (sentez aşamasında karara bağlanacak)

1. **"Başladı" checkpoint'i yazacak mıyız?** Üç projenin hiçbiri yazmıyor (§3.2);
   sonuç olarak "hiç başlamadı" ile "başladı, yarım kaldı" ayırt edilemiyor. Bizim
   ajanlarımız pahalı (LLM tokenı) ve yan etkili (dosya yazma) — bu ayrım bizde
   daha değerli olabilir. Bedeli: her adımda iki yazma.
2. **Determinizm yükümlülüğünü kabul edecek miyiz?** Adım-sonucu tablosu modeli,
   recovery'de workflow gövdesinin baştan çağrılmasını gerektiriyor; bu, gövdenin
   deterministik olmasını varsayar. Bir ajan orkestratöründe gövde "hangi ajana
   hangi görevi ver" kararını içeriyor ve bu karar LLM'e bağlıysa deterministik
   değil. Seçenekler: (a) planı bir kez üret ve checkpoint'e yaz, recovery'de
   yeniden üretme; (b) tüm plan üretimini kendisi bir adım yap. **(a) daha basit
   görünüyor ve Ö1 ile uyumlu** ama Faz 3'te karara bağlanmalı.
3. **İnsan kapısı ne zaman devreye girer?** Yedi projeden yalnızca LangGraph'ta
   birinci sınıf (`interrupt()`), ve orada bile bilinen bir kusuru var: onay
   sonrası düğüm **baştan** çalışıyor, yani onay öncesi yapılmış yan etkiler
   tekrarlanabiliyor (`langgraph/types.py:864`). Bizde onay kapısının yan etki sınırıyla
   ilişkisi tasarlanmalı — bu ADR-000 K7 ve İ3'ün `HUMAN_REQUIRED` kararıyla
   birleşiyor.
4. **Eleştiri belleği nasıl sınırlanacak?** §4.3'teki anti-pattern bizde de
   doğal olarak ortaya çıkar. Sayı sınırı mı, token bütçesi mi, eskilerin
   özetlenmesi mi? İ2 izindeki bellek katmanı kararına bağlanmalı.
5. **Devre kesici gerekli mi?** Portkey'de yok (§4.1), diğerlerinde hiç yok.
   Retry + fallback yeterli mi, yoksa bir sağlayıcı sürekli hata verirken onu
   geçici olarak devre dışı bırakmak gerekiyor mu? İ5 (gözlem/ekonomi) izinde
   maliyet verisiyle birlikte cevaplanmalı — şu an kanıtımız yok.

---

## 7. İncelenmeyenler ve nedeni

- **restatedev/restate** — canlı (son push 2026-09-07) ve event-log/journal durum
  modeli için çok uygun bir üçüncü örnek olurdu, ama lisansı OSI değil (GitHub API
  `NOASSERTION`, BUSL). Protokol §1 canlılık kuralı OSI lisansı şart koşuyor →
  **aday dışı**, bütçe nedeniyle değil kural nedeniyle.
- **microsoft/autogen** — son push 2026-04-15 (145 gün), canlılık kuralını
  geçmiyor; depo lisansı `CC-BY-4.0` görünüyor. Eleştirmen deseni için tarihî
  referans olarak açılabilirdi; §2.1'deki desen zaten üç bağımsız kanıtla
  desteklendiği için gerek görülmedi.
- **Self-Refine, LATS** — Reflexion'la aynı aileden. Reflexion kökü temsil ettiği
  ve §2.1/§2.2 desenleri üç projeden zaten doğrulandığı için, dördüncü bir örnek
  marjinal bilgi katardı. Bütçe daha değerli bir yere (üçüncü durum modeli, DBOS)
  harcandı.
- **Temporal'ın asıl durum motoru** — event history, replay kararı, non-determinism
  tespiti ve zamanlayıcılar **sunucu tarafındadır ve Go ile yazılmıştır**; bu
  klonda yok. `temporal.md` yalnızca Python SDK'sını (etkinleştirme/komut üretme
  katmanı) kapsıyor ve sunucu davranışı olarak yazılan her cümle proto veya SDK
  yorumuna dayandırılmış. Event-log modelinin *uygulanışını* görmek isteyen bir
  sonraki tur `temporalio/temporal` (Go) deposuna bakmalı.
- **LangGraph `create_react_agent` ve Functional API** — İ4 kapsamı dışı
  (orkestrasyon, İ1'in konusu).
- **instructor'ın yıldız/son-push sayıları** — yerel klonda kanıtı yok, GitHub
  API'ye bakılmadı; uydurmamak için "ölçülmedi" bırakıldı.

---

## Dürüstlük notu

Bu iz iki turda tamamlandı ve ilk tur bütçe duvarına çarptı. Kayırma kontrolü:
kullanıcının kendi depoları bu izde aday değildi, dolayısıyla kayırma riski yok.
Aksine iki proje **eleştiriyle** çıktı — DBOS'un README iddiası (§4.2) ve
Portkey'in yarım devre kesicisi (§4.1) — ve ikisi de anti-pattern listesine
girdi.

En zayıf halka: `temporal.md`'nin sunucu tarafını kapsamaması (§7). Event-log
modeli hakkındaki §3.1 satırı SDK'nın replay davranışından çıkarılmıştır,
motorun kendisinden değil. Bu, ilgili yerlerde açıkça işaretlendi.

Otomatik kanıt doğrulaması: [DENETIM-otomatik.md](DENETIM-otomatik.md).
Protokol §4'ün gerektirdiği elle `DENETIM.md` **ayrı bir koşuda** yazılacak.
