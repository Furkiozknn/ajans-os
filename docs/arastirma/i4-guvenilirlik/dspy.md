# DSPy

## Kimlik

repo: stanfordnlp/dspy · yıldız 37.834 · watcher 215 · son push 2026-09-05 · lisans MIT · dil Python · arşivlenmemiş · canlılık: **geçti**

Paket adı `dspy`, sürüm `3.3.1` (`pyproject.toml:11`), yazar Omar Khattab / Stanford (`pyproject.toml:14`). README kendini şöyle tanımlıyor: "the framework for _programming—rather than prompting—language models_" (`README.md:16`).

## Çözdüğü problem

DSPy, LLM tabanlı programları elle prompt yazmak yerine bildirimsel (declarative) Python modülleri ve "signature"lar olarak yazmayı, sonra bunları optimizerlarla otomatik olarak ayarlamayi hedefliyor (`README.md:16`, `README.md:18` "DSPy stands for Declarative Self-improving Python"); optimizer adlari (MIPRO, GEPA, BetterTogether) README'de listelenmiyor, yalnizca GEPA bir makale baglantisi olarak geciyor (`README.md:49`). İ4 kapsamında beni ilgilendiren kısmı: çıktı kalitesini artırmak için çoklu-örnekleme + isteğe bağlı öz-eleştiri (`Refine`, `BestOfN`) ve adaptör düzeyinde parse-hatası kurtarma sağlıyor.

## Mimari

Üç katman var: (1) `Signature`ler (girdi/çıktı şeması), (2) `Module`ler (`dspy/primitives/module.py`) — `Predict`, `ChainOfThought`, `Refine`, `BestOfN` gibi, hepsi `Module` temel sınıfından türüyor, (3) `Adapter`ler (`dspy/adapters/`) — signature+demo+input'u LM mesaj formatına çevirip çıktıyı geri parse ediyor. `Module.__call__` (`dspy/primitives/module.py:92-108`) çağrıyı `with_callbacks` dekoratörüyle sarmalıyor ve `forward()`'a yönlendiriyor; doğrudan `forward()` çağrısı `__getattribute__` içinde uyarı veriyor (`dspy/primitives/module.py` sonundaki `__getattribute__` override, dosyanın son ~15 satırı).

## Klasör yapısı

- `dspy/predict/` — modül tipleri: `predict.py`, `refine.py`, `best_of_n.py`, `retry.py` (devre dışı), `parallel.py`, `multi_chain_comparison.py`, `react.py` vb.
- `dspy/primitives/` — `module.py` (taban `Module`/`ProgramMeta`), `base_module.py` (parametre gezinme, `save`/`load`), `example.py`, `prediction.py`.
- `dspy/adapters/` — `base.py`, `chat_adapter.py`, `json_adapter.py`, `two_step_adapter.py`, `xml_adapter.py`, `baml_adapter.py`.
- `dspy/evaluate/` — `evaluate.py` (paralel değerlendirme motoru), `metrics.py` (EM/F1 gibi klasik metrikler), `auto_evaluation.py` (LLM-yargıç sinyalleri).
- `dspy/utils/` — `parallelizer.py` (thread havuzu + `max_errors`), `callback.py` (`BaseCallback` gözlemlenebilirlik kancası), `caching.py` (disk cache dizini), `exceptions.py` (yapılandırılmış hata hiyerarşisi).

## Ajan tasarımı

DSPy'de "ajan" kavramı yok; en yakın karşılığı `Module` kompozisyonu. `Refine`/`BestOfN` bir modülü sarmalayan **meta-modüller**: içeride sarmalanan modülü N kez, farklı `rollout_id` ve `temperature=1.0` ile çalıştırıyorlar (`dspy/predict/refine.py:106-109`, `dspy/predict/best_of_n.py:56-59`). Kendi başlarına planlama/araç-çağırma yapmıyorlar; bu iş `ReAct` gibi ayrı modüllerde (bakılmadı, kapsam dışı).

## Orkestrasyon / iş akışı modeli

**`Refine` tam akışı** (`dspy/predict/refine.py:98-177`):
1. `forward(**kwargs)` içinde `rollout_ids = [start + i for i in range(self.N)]` (satır 101) — N deneme, her biri farklı `rollout_id`.
2. Her denemede `lm_ = lm.copy(rollout_id=rid, temperature=1.0)` (satır 107) — evet, **sıcaklık her zaman 1.0'a sabitleniyor**, orijinal LM ayarı ne olursa olsun.
3. `mod = self.module.deepcopy()` ile modülün taze bir kopyası çalıştırılıyor (satır 108-109).
4. İlk denemede `advice` yoksa modül doğrudan çağrılıyor (satır 117-118); sonraki denemelerde `WrapperAdapter` ile `inputs["hint_"] = advice...` enjekte edilip signature'a `hint_` adlı yeni bir `InputField` ekleniyor (satır 121-126) — yani geri bildirim gerçekten **prompt'a bir girdi alanı olarak** giriyor, sadece örnek seçimi değil.
5. `reward = self.reward_fn(kwargs, outputs)` hesaplanıyor (satır 137); `reward > best_reward` ise `best_pred/best_trace/best_reward` güncelleniyor (satır 139-140) — yani en iyi bulunan `best_pred` döndürülüyor, **son deneme değil**.
6. `threshold` aşılırsa döngü hemen kırılıyor (`reward >= self.threshold: break`, satır 142-143); son deneme (`idx == self.N-1`) ise de kırılıyor (satır 145-146) — eşik altındaysa geri bildirim üretimi atlanıyor.
7. Eşik geçilmediyse **`OfferFeedback` adlı bir `Signature`** (satır 15-38, aynı dosyada tanımlı) `dspy.Predict(OfferFeedback)` ile çağrılıyor (satır 167); bu çağrı programın kodunu, modül tanımlarını, çalışma izini (`trajectory`), ödül kodunu ve `reward_value`'yu girdi olarak alıp her modül için `advice` (dict) üretiyor.
8. Bu `advice`, bir sonraki denemede `hint_` alanı olarak geri besleniyor (adım 4). **Bu gerçek bir reflection mekanizması**: LM'e kendi geçmiş hatasını gösterip somut talimat üretmesini istiyor, salt "birden çok örnek al en iyisini seç" değil — ama `OfferFeedback` de ayrı bir LM çağrısı (`dspy.Predict`), yani ekstra maliyetli.

**`BestOfN` farkı**: `dspy/predict/best_of_n.py:37-83` içinde `advice`/`OfferFeedback`/`WrapperAdapter` **hiç yok**; döngü sadece `mod(**kwargs)` çağırıp ödülü kıyaslıyor (satır 57-72). Ayıran satır tam olarak `refine.py:117-130`'daki `WrapperAdapter` + `advice` bloğu — `best_of_n.py`'de bu blok yok. Yani fark saf örnekleme+seçim (`BestOfN`) ile örnekleme+seçim+LLM-üretimli-geri-bildirim (`Refine`) arasında.

## Durum ve bellek

- **Program çalışması sırasında** durum, thread-local `dspy.settings.trace` listesinde tutuluyor (`refine.py:116,132,175-176`); kalıcı değil.
- **Kalıcı durum**, `dspy/primitives/base_module.py` üzerinden `save()`/`load()` (satır 171, 254) ve `dump_state()`/`load_state()` (satır 156, 159) ile sağlanıyor — ama bu, **optimize edilmiş programın ağırlıkları/demoları** (few-shot örnekler, talimatlar) için; bir çalışmanın ara durumu değil.
- **Cache**: `dspy/utils/caching.py:4-5` `DSPY_CACHEDIR` (varsayılan `~/.dspy_cache`) tanımlıyor; bu, LM çağrılarını önbelleğe alıp aynı girdi tekrar geldiğinde API'ye gitmeden yanıt döndürüyor (litellm/diskcache tabanlı — dosya sadece dizin yönetimini yapıyor, önbellekleme mantığının kendisine bakılmadı).

## Hata yönetimi

Bu, kanıtın en yoğun olduğu bölüm.

**1) `Refine` içinde deneme patlarsa (`fail_count`)** — `dspy/predict/refine.py:170-174`:
```
except Exception as e:
    print(f"Refine: Attempt failed with rollout id {rid}: {e}")
    if idx > self.fail_count:
        raise e
    self.fail_count -= 1
```
`fail_count` varsayılan olarak `N`'e eşitleniyor (`refine.py:91`, `fail_count or N`). Yani varsayılanda hemen hemen tüm denemeler patlasa bile devam edilebiliyor (çünkü `idx > self.fail_count` koşulu `fail_count` her seferinde bir azaldığı için giderek sıkılaşıyor). Kullanıcı `fail_count=1` verirse ilk hatada durur (bu davranış `docs/docs/tutorials/output_refinement/best-of-n-and-refine.md`'de "raises an error after the first failure" olarak da doğrulanıyor). `BestOfN` tarafında aynı desen birebir aynı satırlarla tekrarlanıyor: `dspy/predict/best_of_n.py:77-81`.

**2) Modül düzeyinde retry/fallback (`Assert`/`Suggest`'in mirası)** — `dspy/predict/retry.py` **tamamen yorum satırına alınmış**, dosyanın tamamı (60 satır) `#` ile başlıyor; hiçbir çalışan kod yok. İçindeki yorumlanmış `Retry` sınıfı eski `backtrack_to`/`backtrack_to_args` mekanizmasına (satır 58-59'daki yorumlar) atıfta bulunuyor ama bu artık `dspy.settings`'te de yok — `dspy/__init__.py` içinde `Assert`, `Suggest`, `Retry` adları hiç geçmiyor (grep sıfır sonuç döndürdü), yani **kamuya açık API'den tamamen kaldırılmışlar**, sadece ölü kod kalıntısı duruyor. `docs/docs/learn/programming/7-assertions.md:3` şunu diyor: "Assertions are deprecated and NOT supported. Please use the `dspy.Refine` module instead. (or dspy.Suggest)." — bu cümle kendi içinde çelişkili (Suggest'i de öneriyor ama Suggest de kaldırılmış), muhtemelen güncellenmemiş kalıntı metin. `docs/docs/tutorials/output_refinement/best-of-n-and-refine.md` sonunda net: "`BestOfN` and `Refine` are the replacements for `dspy.Suggest` and `dspy.Assert` as of DSPy 2.6." **Kaldırma gerekçesi** (neden backtracking mekanizması emekliye ayrıldı) ne kodda ne de baktığım dokümanlarda açıkça yazılı değil — **bulamadım**. Bu, kendi başına bir sinyal: bir öz-düzeltme/backtracking mekanizması, dokümante edilmiş bir gerekçe olmadan sessizce API'den çıkarılmış ve yerini daha basit "N kez dene + ödül fonksiyonuyla seç" desenine bırakmış.

**3) Adaptörde parse hatası → fallback**: `ChatAdapter`, varsayılan olarak hata durumunda `JSONAdapter`'a düşüyor:
- `dspy/adapters/chat_adapter.py:39` (docstring: "Provides automatic fallback to JSONAdapter if the chat format fails"), `:47` (`use_json_adapter_fallback: bool = True` parametresi), `:56` ("if True, when an error occurs (except ContextWindowExceededError), the adapter will retry using JSONAdapter"), `:69-73` (`_make_json_adapter_fallback` — yeni bir `JSONAdapter` örneği kurar).
- Fiili fallback: `:87-95` (`__call__`) — `except Exception as e:` yakalanır, `isinstance(e, LMError) or isinstance(self, JSONAdapter) or not self.use_json_adapter_fallback` ise orijinal hata yeniden fırlatılır, aksi halde `self._make_json_adapter_fallback()(...)` ile JSON modunda tekrar denenir. Aynı desen `async` sürümde `:107-115`.
- `JSONAdapter` tarafında da benzer bir güvenlik ağı var: yapılandırılmış-çıktı (`response_format`) şema kurulumu başarısız olursa `except LMError: raise` (sağlayıcı hatası ise yayılsın) ama genel `except Exception:` durumunda düz `json_object` moduna geri düşülüyor (`dspy/adapters/json_adapter.py:86-90` ve `:113-117`).
- `dspy/adapters/base.py:169` içinde araç-çağrısı (`tool_calls`) varsa parse denemesi `except AdapterParseError: value = {}` ile yutuluyor (kısmi çıktıyı boş sözlükle devam ettiriyor); ama düz metin yanıtı boşsa `raise AdapterParseError(...)` (satır 179) ile sinyal veren yapılandırılmış bir hata (`dspy/utils/exceptions.py`'de tanımlı `AdapterParseError`, `DSPyError` alt sınıfı) fırlatılıyor.
- Hata sınıfı hiyerarşisi oldukça olgun: `dspy/utils/exceptions.py` içinde `DSPyError` → `LMError` → `LMTransportError/LMConfigurationError/LMProviderError(...)` gibi katmanlı, `retry_after`/`status`/`provider_code` gibi yapılandırılmış alanlar taşıyan bir hiyerarşi var; ayrıca `is_retryable_lm_error()` yardımcı fonksiyonu (`_RETRYABLE_LM_ERRORS = (LMRateLimitError, LMTimeoutError, LMServerError, LMTransportError)`) hangi hataların yeniden denenebilir sayıldığını işaretliyor. Bu, gerçek LM-seviyesi retry'ı (LiteLLM'e devredilmiş) DSPy'nin sınıflandırma katmanıyla ayırt ediyor.

**4) Toplu/paralel çalıştırmada hata bütçesi**: `dspy/utils/parallelizer.py:37` (`self.max_errors = settings.max_errors if max_errors is None else max_errors`), `:44-46` (`self.error_count = 0`, `self.error_lock`, `self.cancel_jobs` — thread-safe sayaç), `:65-66` (`self.error_count += 1; if self.error_count >= self.max_errors: ...` — iş iptal ediliyor). `dspy/evaluate/evaluate.py:64` (`class Evaluate`), `:79/94-95` (`max_errors` parametresi, `None` ise `dspy.settings.max_errors`'a devrediyor), `:168` (executor'a aktarımı), `:179`'da (`(dspy.Prediction(), self.failure_score) if r is None else r`) başarısız örnekler sessizce `failure_score` ile dolduruluyor, tüm koşu iptal olmuyor.

## Genişletilebilirlik

Adaptör katmanı (`ChatAdapter`/`JSONAdapter`/`XMLAdapter`/`BAMLAdapter`/`TwoStepAdapter`) LM-format uyumu için değiştirilebilir bir soyutlama; `BaseCallback` (`dspy/utils/callback.py:22`) LM/modül çağrılarına önce/sonra kancası takmaya izin veriyor (gözlemlenebilirlik için genişletme noktası). `Refine`/`BestOfN` herhangi bir `Module`'ü ve herhangi bir `reward_fn` callable'ını sarmalayabiliyor — reward fonksiyonu tarafı tamamen kullanıcıya bırakılmış (kodda doğrulama/şema zorlaması yok).

## Güçlü yönler (kanıtlı)

- `Refine`'daki `OfferFeedback` mekanizması gerçek bir LLM-üretimli, yapılandırılmış geri bildirim: programın kodu, modül tanımları, çalışma izi ve ödül birlikte bir LM çağrısına veriliyor ve çıktı sonraki denemeye somut bir `hint_` alanı olarak enjekte ediliyor (`refine.py:15-38, 117-167`) — bu, sadece "en iyisini seç" değil, modele kendi hatasını gösterip düzeltme talimatı üretme.
- Adaptör fallback zinciri (`ChatAdapter → JSONAdapter`) ve yapılandırılmış hata hiyerarşisi (`exceptions.py`) olgun ve iyi belgelenmiş; hangi hata türünün yeniden deneneceği (`is_retryable_lm_error`) açıkça kodlanmış.
- `Evaluate` ve `ParallelExecutor`, tek bir örneğin başarısızlığını tüm koşuyu düşürmeden `max_errors` bütçesiyle yönetiyor (`evaluate.py:168-179`, `parallelizer.py:37-66`).
- LLM-yargıç metrikleri (`SemanticF1`, `CompleteAndGrounded`) `dspy/evaluate/auto_evaluation.py`'de birinci sınıf vatandaş; hem klasik EM/F1 hem LLM-tabanlı değerlendirme aynı pakette.

## Zayıf yönler (kanıtlı)

- `Refine` her denemede `temperature=1.0`'a **sabitleniyor** (`refine.py:107`) — kullanıcı orijinal LM'de düşük sıcaklık istese bile bu göz ardı ediliyor; deterministik/düşük-varyans senaryolarda sürpriz olabilir.
- Eski backtracking mekanizması (`Assert`/`Suggest`) hiçbir gerekçe belgesi bırakmadan API'den sessizce kaldırılmış, sadece tamamen yorum satırına alınmış ölü kod (`retry.py`, 60 satırın tamamı) kalıntı olarak duruyor — bakım borcu ve "neden çalışmadı" sorusuna dair iz yok.
- `fail_count` varsayılan davranışı kafa karıştırıcı: `fail_count = fail_count or N`, sonra döngüde her hata `self.fail_count -= 1` ile azaltılıyor ve `idx > self.fail_count` ile karşılaştırılıyor (`refine.py:91,172-174`) — bu iki değişkenin (sabit sayaç limiti ile azalan kalan hak) karışımı, davranışı ilk bakışta tahmin etmeyi zorlaştırıyor.
- Program çalışması yarıda kesilirse (örn. işlem çöker) devam/resume mekanizması **yok**; `save()`/`load()` sadece derlenmiş programın durumunu (demo/talimat) kaydediyor (`base_module.py:171,254`), bir `Evaluate` veya `Refine` koşusunun ara durumu hiçbir yerde checkpoint'lenmiyor. Diskcache tabanlı LM-çağrı önbelleği (`caching.py`) tekrar çalıştırmada aynı girdiler için API'ye gitmeyi engeller ama bu, "kaldığı yerden devam" değil, sadece "tekrar hesaplama"yı ucuzlatan bir yan etki.
- `OfferFeedback` çağrısı ekstra bir LM isteği demek (`refine.py:167`) — `Refine`'ın maliyeti `BestOfN`'e göre daha yüksek; bu maliyet farkı kod içinde hiçbir yerde ölçülüp raporlanmıyor.

## Puan (1–5)

- olgunluk: 4 — 3.3.1 sürümü, geniş adaptör/hata hiyerarşisi, aktif commit geçmişi (2026-09-05) olgun bir proje gösteriyor.
- mimari netlik: 4 — Signature/Module/Adapter üçlü ayrımı nettir, `Refine` vs `BestOfN` farkı tek bir kod bloğuna (WrapperAdapter+advice) indirgeniyor.
- genişletilebilirlik: 4 — adaptörler, callback'ler ve `reward_fn` callable'ı genişletme noktaları net ve doküman örnekleriyle destekli.
- güvenilirlik ilkelleri: 3 — `fail_count`/`max_errors`/adaptör fallback var, ama backtracking (Assert/Suggest) mirası gerekçesiz kaldırılmış ve `Refine`'ın ara durumu kalıcı değil.
- gözlemlenebilirlik: 3 — `BaseCallback` kancası ve yapılandırılmış hata sınıfları iyi, ama `Refine` içindeki hata mesajı sadece `print()` ile stdout'a yazılıyor (`refine.py:171`), loglama çerçevesine bağlı değil.
- güvenlik duruşu: 3 — `.pkl` yükleme/kaydetme fonksiyonları açıkça "arbitrary code execution" uyarısı veriyor ve varsayılan olarak pickle yüklemeyi reddediyor (`base_module.py`'deki `save`/`load`, `allow_pickle=False` varsayılanı) — bilinçli bir tasarım, ama yine de kullanıcı `allow_pickle=True` derse risk tamamen kullanıcıya devrediliyor.

## Alınacak fikir

`Refine`'daki `WrapperAdapter` + `OfferFeedback` deseni: bir modülün başarısız denemesinden sonra, "programın kodu + çalışma izi + ödül fonksiyonu kodu + eşik" bilgisini ayrı bir LM çağrısına vererek somut, modül-bazlı düzeltme talimatı üretip bunu bir sonraki denemenin girdisine yeni bir alan (`hint_`) olarak eklemek — bu, ajans-os'taki eleştirmen/öz-düzeltme rolü için doğrudan uygulanabilir bir şablon: eleştirmen çıktısı serbest metin değil, sonraki çağrının **girdi şemasına eklenen bir alan** olmalı.

## Alınmayacak

`temperature=1.0`'a sabitleme ve backtracking mekanizmasını (Assert/Suggest) gerekçesiz, sessizce kaldırıp yorum satırı halinde ölü kod bırakma pratiği — ajans-os'ta kaldırılan bir mekanizma varsa gerekçesi ADR olarak yazılmalı, kod yorum satırına gömülmemeli.

---
`saglayici_bagimsiz`: evet — adaptör katmanı (ChatAdapter/JSONAdapter/vb.) ve LiteLLM tabanlı `LM` sınıfı sağlayıcıdan bağımsız çalışıyor (`dspy/adapters/chat_adapter.py`, `pyproject.toml:34` litellm bağımlılığı).
`sozlesme_var`: kismen — `Signature` girdi/çıktı şemasını zorluyor ama `reward_fn`/`hint_` gibi geri bildirim kanalları serbest formatlı callable/string, şema zorlaması yok.
`insan_kapisi`: hayir — kodda incelenen kısımlarda (Refine/BestOfN/Evaluate/adaptörler) insan onayı bekleyen bir kapı mekanizmasına rastlanmadı.
`checkpoint`: hayir — `save()`/`load()` sadece derlenmiş program durumunu (demo/talimat) kalıcılaştırıyor; bir `Refine`/`Evaluate` koşusunun ara durumu için resume mekanizması yok, sadece LM-çağrı önbelleği (`caching.py`) var.
