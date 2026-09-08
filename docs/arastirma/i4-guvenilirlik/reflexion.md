# Reflexion (NeurIPS 2023)

## Kimlik

repo: `noahshinn/reflexion` · lisans: **MIT** (`LICENSE:1`, "Copyright (c) 2023 Noah Shinn") ·
dil: Python · yıldız: 3.262 (7 Eylül 2026'da `DURUM.md` için ölçülmüştü; bu turda
yeniden ölçülmedi) · son commit: **2025-01-13** (yerel klonda
`git log -1 --date=short` → `218cf0ef 2025-01-13`).

**canlılık: tarihî referans.** Son commit üzerinden ~600 gün geçmiş; protokol §1'in
canlılık eşiğini geçmiyor. Bu dosya "aday proje" değil, **fikrin kökeni** olarak
yazıldı: dspy'nin `Refine`'ı ve instructor'ın doğrulama-geri-besleme döngüsü bu
makalenin türevleri, ve ikisi de kökteki mekanizmanın yalnızca bir parçasını
taşıyor. Ayrımı görmek için asıl kaynağa bakmak gerekti.

Bu bir **araştırma deposu**, kütüphane değil: paketlenmiş bir API'si yok, `pip install`
edilmiyor, her benchmark (HotPotQA / programlama / ALFWorld / WebShop) kendi
`*_runs/` klasöründe kendi kopyasını taşıyor.

## Çözdüğü problem

Bir dil modeli görevi başarısız yaptığında, ağırlıklarını güncellemeden (RL yok,
fine-tune yok) bir sonraki denemede daha iyi yapmasını sağlamak. Makalenin tezi:
başarısızlığın **sözlü bir eleştirisini** üretip bunu bir sonraki denemenin
bağlamına koymak, gradyan güncellemesinin yerini tutan bir "sözel pekiştirmeli
öğrenme" sinyalidir. Hedef kitle: ajan araştırmacıları; üretim kullanıcısı değil.

## Mimari

Üç ayrı rol, üçü de aynı LLM'e giden farklı prompt'lar:

```
  Actor  ──üretir──>  çıktı (kod / cevap / eylem dizisi)
                          │
                          v
  Evaluator ──ölçer──> ikili sinyal (testler geçti mi / cevap doğru mu)
                          │  başarısızsa
                          v
  Self-Reflection ──yazar──> birkaç cümlelik sözlü eleştiri
                          │
                          v
              reflections listesine EKLENİR (biriken bellek)
                          │
                          └──> bir sonraki denemenin prompt'una enjekte edilir
```

Kritik nokta — **Evaluator ayrı bir LLM değil.** Programlama izinde değerlendirici
gerçek bir çalıştırıcı: `exe.execute(cur_func_impl, tests_i)` birim testleri
çalıştırıp `is_passing, feedback` döndürüyor (`programming_runs/reflexion.py:43`),
son doğrulama ise gizli test kümesiyle `exe.evaluate(..., timeout=10)`
(`programming_runs/reflexion.py:48-49`). HotPotQA izinde değerlendirici
`is_correct()` — altın cevapla karşılaştırma. Yani **eleştirmen LLM, yargıç
değil**: yargı deterministik bir kaynaktan (test / altın cevap) geliyor, LLM
yalnızca "neden başarısız oldum"u yazıyor.

Rol dosyaları:
- Actor + reflection üretimi: `programming_runs/generators/py_generate.py`,
  ortak gövde `programming_runs/generators/generator_utils.py`
- Ana döngü: `programming_runs/reflexion.py`
- Muhakeme izi (HotPotQA): `hotpotqa_runs/agents.py`, prompt'lar
  `hotpotqa_runs/prompts.py`

## Klasör yapısı

```
reflexion/
├── programming_runs/          # HumanEval / LeetCode — kod üretimi izi
│   ├── reflexion.py           # ana döngü (101 satır, tüm mekanizma burada)
│   ├── simple.py              # reflection'sız temel çizgi (karşılaştırma için)
│   ├── immediate_reflexion.py # varyant: her adımda yansıma
│   ├── generators/            # Actor + Self-Reflection prompt'ları
│   │   ├── py_generate.py     # Python prompt sabitleri + few-shot örnekler
│   │   ├── generator_utils.py # prompt montajı (208 satır)
│   │   └── model.py, factory.py
│   ├── executors/             # Evaluator: birim testi çalıştırıcı
│   └── human-eval/, benchmarks/
├── hotpotqa_runs/             # muhakeme izi — biriken yansıma belleği burada
│   ├── agents.py              # CoTAgent + ReactReflectAgent, reflect()
│   ├── prompts.py             # REFLECTION_HEADER ve prompt şablonları
│   └── fewshots.py, notebooks/
├── alfworld_runs/, webshop_runs/   # karar-verme izleri
└── figures/
```

## Ajan tasarımı

Ajan sözleşmesi **yok**. İki farklı biçim var ve ikisi birbirine benzemiyor:

- Programlama izinde ajan diye bir nesne bile yok — `run_reflexion()` fonksiyonu
  ve üç fabrika (`executor_factory` / `generator_factory` / `model_factory`,
  `programming_runs/reflexion.py:18-20`). Rol = hangi prompt sabitinin
  kullanıldığı.
- HotPotQA izinde ajan bir sınıf: `CoTAgent` (`hotpotqa_runs/agents.py:36`) ve
  `ReactReflectAgent`. Yetenek/izin/araç bildirimi yok; araç kümesi
  `environment.py` içinde sabit (Wikipedia arama).

Strateji bir enum ile seçiliyor — bu enum aslında makalenin ablasyon çalışması:
`ReflexionStrategy` (`hotpotqa_runs/agents.py:23-33`) → `NONE` (yansıma yok),
`LAST_ATTEMPT` (yalnızca önceki denemenin ham izi bağlama konur),
`REFLEXION` (sözlü eleştiri üretilir ve biriktirilir),
`LAST_ATTEMPT_AND_REFLEXION` (ikisi birden).

## Orkestrasyon / iş akışı modeli

Graf yok, DAG yok, dinamik plan yok. **İç içe iki `while` döngüsü**
(`programming_runs/reflexion.py:33` dış, `:57` iç):

- Dış döngü `pass_at_k` kadar **bağımsız yeniden başlangıç** — her turda testler
  yeniden üretiliyor, `cur_func_impl` sıfırdan yazılıyor (`:37-40`). Bu bir
  "temiz sayfa" retry'ı.
- İç döngü `max_iters` kadar **yansımalı iyileştirme** — önceki uygulama, test
  çıktısı ve yansıma birlikte prompt'a verilip yeni uygulama isteniyor (`:59-71`).

Paralellik yok; tek iş parçacığı, sıralı. Erken çıkış var: testler geçince gizli
test kümesi çalıştırılıp döngü kırılıyor (`:47-52`).

## Durum ve bellek

**İzin ilgi çekici tarafı burada.** İki farklı bellek davranışı yan yana duruyor:

- **Kısa süreli (scratchpad) her denemede sıfırlanır.** `ReactReflectAgent.run()`
  önce `reflect()` çağırıp sonra `ReactAgent.run(self, reset)` ile scratchpad'i
  temizliyor (`hotpotqa_runs/agents.py:292-295`). `CoTAgent.run()`'da aynı sıra:
  `self.reflect(...)` → `self.reset()` → `self.step()` (`agents.py:73-79`).
  Sıra önemli: **yansıma reset'ten önce üretiliyor**, çünkü girdisi silinecek olan
  scratchpad'in kendisi.
- **Uzun süreli yansıma listesi birikir.** `self.reflections: List[str] = []`
  (`agents.py:67`) ve `REFLEXION` stratejisinde `self.reflections += [self.prompt_reflection()]`
  (`agents.py:113`) — yani **liste sıfırlanmıyor, üstüne ekleniyor**; her yeni
  deneme öncekilerin *tümünü* görüyor. `LAST_ATTEMPT` stratejisinde ise
  `self.reflections = [self.scratchpad]` (`agents.py:110`) — atama, ekleme değil:
  bellek yok, yalnızca son iz.

Bu ayrım deponun kendi ablasyonu: biriken bellek (`+=`) ile tek-adımlık bağlam
(`=`) arasındaki fark tek bir operatör.

Yansımalar prompt'a nasıl giriyor: `format_reflections(self.reflections)` bir
başlıkla birleştiriyor (`agents.py:114`), başlık metni
`hotpotqa_runs/prompts.py:113`:

> "You have attempted to answer following question before and failed. The
> following reflection(s) give a plan to avoid failing to answer the question in
> the same way you did previously. Use them to improve your strategy of correctly
> answering the given question."

Programlama izinde bellek **süreç içi ve kalıcı değil**: `reflections`,
`implementations`, `test_feedback` üç yerel liste (`programming_runs/reflexion.py:29-31`),
görev bitince JSONL'e *log olarak* yazılıyor (`:93-98`,
`write_jsonl(log_path, [item], append=True)`). Bu bir checkpoint değil — geri
yüklenmiyor, yalnızca deney kaydı. Kaba bir devam mekanizması var:
`enumerate_resume(dataset, log_path)` (`:26`) log'da zaten işlenmiş **görevleri**
atlıyor; ama görev *içindeki* ilerleme kaybolur, yarım kalan görev baştan başlar.

**Checkpoint yok, rollback yok, kalıcı durum deposu yok.**

## Hata yönetimi

- **Retry:** iki katmanlı ve ikisi de sabit sayıda — `max_iters` (yansımalı) ve
  `pass_at_k` (temiz sayfa). Backoff yok, jitter yok, üstel bekleme yok; aranan
  dosyalarda (`reflexion.py`, `generator_utils.py`) hiçbir `sleep`/`backoff`
  çağrısı bulunamadı.
- **Timeout:** tek bir yerde ve LLM'e değil, **değerlendiriciye** uygulanıyor:
  `exe.evaluate(..., timeout=10)` (`programming_runs/reflexion.py:49, :83`) —
  yani sonsuz döngüye giren üretilmiş kod deneyi kilitlemiyor. LLM çağrısının
  kendisi için zaman aşımı aranan dosyalarda bulunamadı.
- **Fallback:** yok. Model başarısız olursa alternatif model/sağlayıcıya geçiş
  mekanizması yok (`model_factory` tek model seçiyor, `reflexion.py:20`).
- **Rollback:** yok — ve burada dikkat çekici olan şu: **geri alınacak bir şey de
  yok.** Reflexion'ın tüm yan etkisi bir sandbox'ta test çalıştırmak; dış dünyaya
  dokunmuyor. Bu, İ4'ün "rollback gerçekten geri alıyor mu" sorusunun bir sınır
  koşulu: yan etkisi olmayan bir sistemde rollback = durumu at, yeniden dene.
- **İnsan onayı:** yok, hiçbir kapı yok.
- **Sözleşme kontrolü:** `assert isinstance(cur_func_impl, str)`
  (`reflexion.py:42, :73`) — üretecin dönüş tipi için tek savunma. Üretilen kod
  bozuksa yakalayan yer testler.
- **Bozuk strateji:** tanımsız strateji `NotImplementedError` fırlatıyor
  (`agents.py:120`, `agents.py:312`) — sessizce yanlış davranmıyor.

## Genişletilebilirlik

Zayıf, ve bu bir araştırma deposu için beklenen. Yeni dil eklemek fabrika
üzerinden mümkün (`generator_factory` / `executor_factory`,
`programming_runs/reflexion.py:18-19`; `generators/py_generate.py` ve
`rs_generate.py` iki mevcut örnek) ama her yeni dil **kendi prompt sabitleri
setini** kopyalamak demek — `py_generate.py` içinde `PY_SELF_REFLECTION_*`,
`PY_REFLEXION_*` ve few-shot bloklarının tamamı elle yazılmış (`:12-255`).
Prompt'lar koddan ayrılmamış: modül düzeyi string sabitleri.

Daha ağır sorun: dört benchmark izi (`programming_runs`, `hotpotqa_runs`,
`alfworld_runs`, `webshop_runs`) ortak bir çekirdek paylaşmıyor. Aynı fikir dört
kez, dört farklı biçimde uygulanmış. Yeni bir görev tipi = beşinci kopya.

## Güçlü yönler (kanıtlı)

- **Değerlendirici deterministik, eleştirmen LLM.** Yargı testten geliyor
  (`exe.execute` → `is_passing`, `reflexion.py:43`), LLM yalnızca açıklama
  yazıyor. "LLM kendi çıktısına not versin" tuzağına düşmüyor — bu ayrım, bugün
  LLM-as-judge kuran çoğu sistemden daha temiz.
- **İki katmanlı retry ayrımı net ve gerekçeli.** Yansımalı iyileştirme (aynı
  gövdeyi düzelt) ile temiz sayfa (`pass_at_k`, baştan yaz) farklı döngüler
  (`:33` vs `:57`). Yansıma bir yerel minimuma saplandığında ikinci katman
  kurtarıyor.
- **Ablasyon kodun içinde.** `ReflexionStrategy` enum'u (`agents.py:23-33`)
  "yansıma gerçekten işe yarıyor mu, yoksa sadece önceki izi bağlama koymak mı
  yetiyor" sorusunu kodda çalıştırılabilir kılıyor. Bir mekanizmayı savunmanın
  dürüst yolu.
- **Yansıma prompt'u geleceğe yazılmış.** "You will need this as a hint when you
  try again later" (`py_generate.py:12, :151`) — eleştiriyi *bir sonraki denemeye
  talimat* olarak biçimlendiriyor, geçmişin analizi olarak değil. Küçük ama
  önemli fark.
- **Değerlendiriciye zaman aşımı konmuş** (`timeout=10`), üretilmiş kodun
  deneyi kilitlemesi engellenmiş.

## Zayıf yönler (kanıtlı)

- **Kalıcılık yok.** Tüm durum süreç belleğinde (`reflexion.py:29-31`); süreç
  ölürse o görevin tüm yansıma birikimi gider. `enumerate_resume` yalnızca
  görev granülerliğinde (`:26`).
- **Sınırsız bağlam büyümesi.** `self.reflections += [...]` (`agents.py:113`) hiç
  budanmıyor, özetlenmiyor, sınırlanmıyor. Aranan dosyalarda token bütçesi veya
  pencere yönetimi bulunamadı. Uzun koşuda bağlam penceresi dolar.
- **Maliyet/gecikme sayacı yok.** `max_iters × pass_at_k` en kötü durumda kaç LLM
  çağrısı ettiğini ölçen bir sayaç aranan dosyalarda bulunamadı.
- **Dört ayrı kopya**, ortak çekirdek yok (yukarıda).
- **Tek sağlayıcıya bağlı.** `AnyOpenAILLM` varsayılan olarak sınıf imzasında
  gömülü (`hotpotqa_runs/agents.py:45`, `:278`).
- **Bakım durmuş** (son commit 2025-01-13). Üretimde kullanılacak bir kod
  tabanı değil, makalenin yeniden üretim paketi.

## Puan (1–5)

| Eksen | Puan | Gerekçe |
|---|---|---|
| Olgunluk | **2** | Araştırma deposu; paket yok, test yok, bakım durmuş (son commit 2025-01-13). |
| Mimari netlik | **3** | Ana döngü 101 satırda okunaklı (`reflexion.py`), ama aynı fikir dört benchmark'ta dört kez kopyalanmış. |
| Genişletilebilirlik | **2** | Fabrika deseni var ama yeni dil = tüm prompt sabitlerini kopyalamak (`py_generate.py:12-255`). |
| Güvenilirlik ilkelleri | **2** | İki katmanlı retry ve değerlendirici timeout'u var; checkpoint, kalıcılık, fallback, backoff yok. |
| Gözlemlenebilirlik | **2** | JSONL'e her görevin yansıma/uygulama/test geçmişi yazılıyor (`:93-98`) — denetlenebilir ama metrik, iz, maliyet sayacı yok. |
| Güvenlik duruşu | **1** | Üretilmiş kod `exe.execute` ile çalıştırılıyor; sandbox/izin katmanı aranan dosyalarda bulunamadı. Tek koruma `timeout=10`. |

## Alınacak fikir

- **Değerlendirici ile eleştirmeni ayır; yargıyı deterministik kaynağa bağla.**
  Reflexion'da geçti/kaldı kararını test veriyor (`reflexion.py:43`), LLM sadece
  "neden" yazıyor. Bizde `Evaluator` (deterministik: test, şema doğrulaması,
  çıkış kodu) ile `Critic` (LLM: sözlü açıklama) ayrı bileşenler olmalı ve
  **Critic'in oyu geçme kararına girmemeli**. Faz 3 `04-DEGERLENDIRME.md`
  maddesinin çekirdeği bu.
- **Eleştiriyi geçmişin analizi değil, geleceğin talimatı olarak yaz.** Prompt
  metni "you will need this as a hint when you try again later"
  (`py_generate.py:12`). Critic sözleşmemizin çıktı alanı "hata raporu" değil
  "bir sonraki denemeye talimat" olarak tanımlanmalı.
- **İki katmanlı retry: düzelt vs. baştan yaz.** İç döngü bağlamı taşıyarak
  düzeltir (`:57-90`), dış döngü temiz sayfa açar (`:33-91`). Recovery Manager'da
  bu iki mod ayrı ayrı yapılandırılabilir olmalı — yansımalı retry yerel minimuma
  saplanabilir, bunun çıkışı yeni deneme değil **sıfırlanmış** deneme.
- **Yansıma üretimi durum sıfırlanmadan önce çalışmalı.** `reflect()` → `reset()`
  sırası (`agents.py:76-78`, `:292-295`) tesadüf değil: eleştirinin girdisi
  silinecek olan çalışma durumudur. Bizim checkpoint/temizlik akışımızda "hata
  anındaki bağlamdan öğrenme çıkar, sonra bağlamı at" adımı bu sırayla yazılmalı.
- **Ablasyonu koda göm.** `ReflexionStrategy` enum'u gibi, kendi
  öz-düzeltme katmanımızın kapatılabilir olması ("bu mekanizma olmadan ne
  oluyor") ADR-000 K2'nin "ölçülebilir fayda" ölçütünü doğrulamanın tek dürüst
  yolu.

## Alınmayacak

- **Sınırsız biriken yansıma listesi** (`agents.py:113`, `+=`, hiç budama yok) —
  bağlam penceresini doldurur ve maliyeti denemeyle doğrusal büyütür. Bizde
  yansıma belleği sayı veya token ile sınırlanmalı, eskisi özetlenmeli. İ2
  izindeki bellek katmanı kararına bağlanır.
- **Süreç belleğinde tutulan ilerleme** (`reflexion.py:29-31`) — LangGraph'ın
  `put_writes()` ve DBOS'un `operation_outputs` tablosuyla karşılaştırıldığında
  bu bir gerileme. Yansıma da checkpoint'in parçası olarak kalıcı yazılmalı.
- **Prompt'ların modül sabiti olarak koda gömülmesi** (`py_generate.py:12-255`) —
  her yeni görev tipi kopyala-yapıştır demek. Prompt'lar sözleşmenin veri alanı
  olmalı, kodun içinde değil.
- **Sandbox'sız kod çalıştırma** — `exe.execute` üretilmiş kodu tek korumayla
  (`timeout=10`) koşuyor. İ3 izinde microsandbox/E2B için toplanan kanıt bunun
  yerine geçer.

---

## Matris cevapları

- `saglayici_bagimsiz`: **hayır** — `AnyOpenAILLM` sınıf imzalarında varsayılan
  değer olarak gömülü (`hotpotqa_runs/agents.py:45`, `:278`); soyut bir model
  arayüzü yok. Programlama izindeki `model_factory`
  (`programming_runs/reflexion.py:20`) birkaç modeli seçebiliyor ama sağlayıcı
  soyutlaması değil, ad eşlemesi.
- `sozlesme_var`: **hayır** — ajan için yetenek/girdi-çıktı/izin şeması yok; tek
  tip kontrolü `assert isinstance(cur_func_impl, str)` (`reflexion.py:42`).
- `insan_kapisi`: **hayır** — aranan dosyalarda hiçbir onay/duraklama noktası
  bulunamadı.
- `checkpoint`: **hayır** — durum süreç belleğinde (`reflexion.py:29-31`); JSONL
  yazımı (`:93-98`) yalnızca deney log'u, geri yüklenmiyor. Tek devam
  mekanizması görev granülerliğinde atlama (`enumerate_resume`, `:26`).
