# Kendini değiştiren sistemler (DGM, OpenEvolve)

Bu doküman ADR-000'daki K7 ilkesini ("insan kapısız kendini-değiştirme
üretimde güvenle çalışıyor mu?") iki somut açık kaynak sistem üzerinden
sınar: Darwin Gödel Machine (DGM) ve OpenEvolve.

---

### Darwin Gödel Machine (DGM)

#### Kimlik
repo: `jennyzzt/dgm` · yıldız: 2287 · watcher: 50 · son push: 2025-08-13 ·
lisans: Apache-2.0 · dil: Python · haftalık indirme: yok (PyPI paketi değil,
araştırma reposu)
canlılık: **geçemedi — tarihî referans**. Kural son push ≤ 90 gün istiyor;
bugün (2026-09-08) ile son push arasında ~13 ay var. Repo arşivlenmemiş ve
lisans OSI onaylı ama güncellik kriterini karşılamıyor.

#### Çözdüğü problem
Sakana AI'nin arXiv 2505.22954 makalesinin referans uygulaması: bir kodlama
ajanının kendi kaynak kodunu (agent tanımını) yineleyerek düzenleyip her
değişikliği SWE-bench/Polyglot benchmark'larında ölçerek "kendi kendini
iyileştiren" bir popülasyon (arşiv) biriktirmesi. `README.md:14`: "a novel
self-improving system that iteratively modifies its own code (thereby also
improving its ability to modify its own codebase) and empirically validates
each change using coding benchmarks."

#### Mimari
`DGM_outer.py` dış döngüyü yürütür (kaç nesil, kaç ebeveyn seçilecek);
her nesilde `self_improve_step.py:self_improve()` (satır 223) bir Docker
konteyneri içinde ebeveyn commit'in koduna geçmiş yamaları uygular, ajana
(`coding_agent.py`) kendi kod tabanını (`/dgm` dizini) düzenleme görevi
verir, çıkan yamayı (`model_patch.diff`) konteynerden ana makineye kopyalar
(`self_improve_step.py:364-365`), sonra bu yeni "çocuk" ajanı SWE-bench/
Polyglot alt kümesinde çalıştırıp (`run_harness_swe` / `run_harness_polyglot`,
satır 125 ve 180) puanlar. `llm_withtools.py` LLM'in araç çağrılarını
(`bash`, `edit`) yönetir; `tools/` altında ajanın kullanabildiği araçlar
tanımlıdır.

#### Klasör yapısı (incelenen alt küme)
```
dgm/
├── DGM_outer.py         # dış evrim döngüsü: nesil, ebeveyn seçimi, arşiv güncelleme
├── self_improve_step.py # tek bir kendini-değiştirme denemesi (konteyner + yama + değerlendirme)
├── coding_agent.py       # ajanın kendisi (self_improve=True/False modları)
├── llm_withtools.py      # LLM araç-çağrısı protokolü (Claude/OpenAI/diğer format dönüşümü)
├── prompts/              # self_improvement_prompt.py, diagnose_improvement_prompt.py
├── tools/                # bash.py, edit.py — ajanın erişebildiği eylemler
└── analysis/             # visualize_archive.py — arşiv/nesil grafikleri, hallucination skoru
```

#### Ajan tasarımı
Ajan `coding_agent.py`'de bir sınıf olarak tanımlı; `self_improve=True`
bayrağıyla çağrıldığında `instance_id='dgm'` olur ve hedef, bir SWE görevini
çözmek değil, kendi deposunu (`/dgm`) düzenlemektir (`coding_agent.py:75-84`).
Araç sözleşmesi `tools/` altında `bash.py` ve `edit.py` ile sınırlı; LLM
sağlayıcı-bağımsız bir "tool_use" protokolüyle çağrılıyor
(`llm_withtools.py:16-23,67-106`).

#### Orkestrasyon / iş akışı modeli
Nesil tabanlı, popülasyon/arşiv modeli (genetik programlamaya yakın, grafik
değil). `DGM_outer.py:choose_selfimproves()` (satır 50) her nesilde arşivden
ebeveyn(ler) seçer (yöntemler: `random`, skor-ağırlıklı, `children_count`
cezalı, `best`); `ThreadPoolExecutor` ile `selfimprove_workers` kadar deneme
paralel yürütülür (`DGM_outer.py:280-299`), her denemeye 1.5 saatlik timeout
konur (satır 300-306).

#### Durum ve bellek
Arşiv, diskte `output_dir` altındaki commit klasörleri + `metadata.json`
olarak kalıcı; `DGM_outer.py:initialize_run()` (satır 15) önceki bir
çalıştırmadan (`prevrun_dir`) `archive` ve `generation` sayacını
`dgm_metadata.jsonl`'den yükleyip devam edebiliyor (satır 21-25). Her
nesil sonunda `generation`, `archive`, `children`, `children_compiled`
alanları `dgm_metadata.jsonl`'e satır satır (append) yazılıyor
(`DGM_outer.py:326-331`) — yani checkpoint/nesil kaydı var.

#### Hata yönetimi
- **Otomatik kapı, insan yok**: `is_compiled_self_improve()`
  (`utils/evo_utils.py:96-126`) bir denemenin arşive aday olup olamayacağını
  saf metrik kontrolüyle karar verir: `overall_performance` sözlüğünde
  gerekli anahtarlar var mı, en az bir boş-olmayan yama üretilmiş mi, ve
  değerlendirilen görev sayısı beklenenle eşleşiyor mu. `DGM_outer.py:316`
  bunu `filter_compiled()` ile her nesil sonunda çağırıyor;
  `README.md` ve kod tabanında `human`, `approval`, `manual review` gibi bir
  onay adımı **yok** (repo genelinde bu terimler için grep boş döndü).
- **Geri alma / seçim**: Kötü bir mutasyon arşive hiç girmiyor — sadece
  `is_compiled_self_improve` testini geçen çocuklar `update_archive()`
  (`DGM_outer.py:174-190`) ile arşive eklenir; `keep_all` modunda hepsi
  eklenir, `keep_better` modunda (repo kodunda `get_full_eval_threshold`,
  satır 192-215) sadece eşiği aşanlar kalır. Elenen denemenin dosyaları
  diskte kalır ama bir sonraki neslin ebeveyn havuzuna girmez — bu "silme"
  değil "seçilmeme" şeklinde bir rollback.
- **İzolasyon**: Kendi kodunu değiştirme denemesi `self_improve_step.py`
  içinde bir Docker konteyneri içinde çalışıyor (`copy_to_container`,
  `container.exec_run`, satır 296-305), host'a doğrudan dokunmuyor.
- **Timeout**: `future.result(timeout=1.5*60*60)` (DGM_outer.py:301-306) —
  aşırı uzayan bir deneme atılıp loglanıyor, döngü durmuyor.

#### Genişletilebilirlik
Yeni bir seçim stratejisi eklemek `choose_selfimproves()`'a bir `elif` dalı;
yeni bir araç eklemek `tools/`'a bir dosya + `load_all_tools()` kaydı kadar
küçük. Çekirdek döngü (`DGM_outer.py`) bozulmadan genişletiliyor.

#### Güçlü yönler (kanıtlı)
- Tamamen otomatik, ölçülebilir kabul kapısı (`is_compiled_self_improve`,
  `get_full_eval_threshold`) — insan darboğazı yok, ama kapı gerçek ve kodda
  yazılı.
- Nesil/arşiv geçmişi diskte kalıcı, sürdürülebilir (`dgm_metadata.jsonl`).
- Kendi ürettiği çıktıda halüsine edilmiş araç kullanımını ayrı bir metrik
  olarak izliyor: `analysis/visualize_archive.py:70`
  `def get_hallucination_score(dgm_dir, node_id, metadata_name="metadata.json")`
  ve satır 81 `halluc_perf = metadata.get("hallucination_performance", {})`
  — yani "ajan var olmayan bir aracı çağırdı" durumu ayrı skorlanıp
  arşiv görselleştirmesinde ayrı bir eksen olarak çiziliyor
  (satır 345, `score_func=get_hallucination_score`).

#### Zayıf yönler (kanıtlı)
- Güvenlik uyarısı açık ve ciddi: `README.md:88`
  "> This repository involves executing untrusted, model-generated code. We
  strongly advise users to be aware of the associated safety risks. While it
  is highly unlikely that such code will perform overtly malicious actions
  under our current settings and with the models we use, it may still
  behave destructively due to limitations in model capability or
  alignment. By using this repository, you acknowledge and accept these
  risks."
- Bu, yazarların kendi ağzından "kendi kodunu insan onayı olmadan değiştiren
  bir sistem, öngörülemeyen şekilde yıkıcı davranabilir" itirafıdır.
- Otomatik kapı yalnızca "çalıştı mı / kaç görev çözüldü" ölçüyor;
  kod kalitesi, güvenlik, yan etki denetimi yok — yani ödül hackleme'ye karşı
  yapısal bir savunma yok, sadece halüsinasyon *izleniyor*, engellenmiyor.
- Son push 13 ay önce; bakım/canlılık açısından donmuş.

#### Puan (1-5)
olgunluk: 2 · mimari netlik: 4 · genişletilebilirlik: 3 · güvenilirlik
ilkelleri: 2 (otomatik kapı var ama insan onayı da içerik/güvenlik denetimi
de yok) · gözlemlenebilirlik: 3 (hallucination skoru, arşiv grafiği) ·
güvenlik duruşu: 2 (Docker izolasyonu var, ama yazarın kendi uyarısı riski
kabul ediyor)

#### Alınacak fikir
- Otomatik kabul kapısını "geçti/geçmedi" + eşik (`get_full_eval_threshold`)
  ikilisi olarak ayırmak — bizim ajan sözleşmemizde bir değişikliğin arşive
  girmesi için hem "derlendi" hem "eşiği geçti" testini ayrı fonksiyonlarda
  tutmak, tek bir "başarılı" bayrağına indirgememek.
- Halüsinasyon/araç-hatası oranını arşiv geçmişinde ayrı bir zaman serisi
  olarak tutmak (`hallucination_performance` deseni) — sadece nihai skor
  değil, "ajan var olmayan şey mi çağırdı" da izlenmeli.

#### Alınmayacak
- İnsan onayı olmadan kendi kaynak kodunu üretimde değiştirme — yazarların
  kendi güvenlik uyarısı (`README.md:88`) bunun bir araştırma varsayımı
  olduğunu, üretim için kabul edilebilir bir varsayım olmadığını açıkça
  söylüyor.
- Docker-içi izolasyonu "yeterli güvenlik" sayma — konteyner kaçışı/yan
  etki senaryoları README'de zaten "unlikely ama mümkün" deniyor.

---

### OpenEvolve

#### Kimlik
repo: `codelion/openevolve` · yıldız: 7332 · watcher: 58 · son push:
2026-07-18 · lisans: Apache-2.0 · dil: Python · PyPI paketi: `openevolve`
v0.3.2 (`openevolve/_version.py:3`)
canlılık: **geçti**. Son push bugünden (2026-09-08) ~52 gün önce, ≤90 gün
kuralını karşılıyor; arşivlenmemiş; Apache-2.0 OSI onaylı.

#### Çözdüğü problem
AlphaEvolve tarzı, LLM güdümlü evrimsel kod optimizasyonu: kullanıcının
verdiği **hedef bir program dosyasını** (kendi ajan kodunu değil) tekrar
tekrar LLM'e diff önerisi yazdırıp değerlendirme fonksiyonuyla puanlayarak
iyileştirmek. README kendini "the most advanced open-source evolutionary
coding agent" olarak tanımlıyor.

#### Mimari
`openevolve/controller.py` giriş noktası: `initial_program_path` alır
(satır 44), `self.initial_program_code = self._load_initial_program()`
(satır 97) ile **kullanıcının belirttiği dosyayı** yükler — bu OpenEvolve'un
kendi paket kodu değildir. `database.py` MAP-Elites + ada (island) tabanlı
popülasyonu tutar (satır 119-120: "The database implements a combination of
MAP-Elites algorithm and island-based population model to maintain diversity
during evolution."). `evaluator.py` her aday programı (opsiyonel olarak
kademeli/`cascade`) çalıştırıp metrik üretir. `process_parallel.py`
`multiprocessing` (satır 7) ile aday değerlendirmelerini paralel yürütür.

#### Klasör yapısı (incelenen alt küme)
```
openevolve/openevolve/
├── controller.py    # ana döngü: initial_program yükle, evrim döngüsünü sür, checkpoint al
├── database.py       # MAP-Elites ızgarası + adalar (islands) + genel arşiv
├── evaluator.py       # aday programı çalıştır, cascade/timeout/retry yönetimi
├── process_parallel.py # multiprocessing ile paralel değerlendirme
├── config.py          # diff_based_evolution, feature_dimensions, cascade_thresholds vb.
└── utils/code_utils.py # apply_diff / extract_diffs — SEARCH/REPLACE yama uygulama
configs/                # örnek yapılandırma dosyaları
```

#### Ajan tasarımı
Klasik anlamda çok-ajanlı bir sözleşme yok; "ajan" tek bir LLM çağrı
döngüsü + değerlendirme fonksiyonu. Girdi/çıktı sözleşmesi `config.py` ile
ifade ediliyor (`diff_based_evolution: bool = True`, satır 436) — LLM'den
tam dosya yeniden yazımı değil, `<<<<<<< SEARCH ... ======= ... >>>>>>>
REPLACE` biçiminde diff istenir ve `utils/code_utils.py:40`
`def apply_diff(...)` bunu orijinal koda uygular. Yani **mutasyona uğrayan
şey her zaman hedef programın metni**, OpenEvolve'un kendi `controller.py`/
`database.py` kodu değil.

#### Orkestrasyon / iş akışı modeli
Nesil yok, sürekli iterasyon + ada (island) modeli: `database.py:144-160`
her adanın kendi popülasyonunu (`self.islands`), kendi nesil sayacını
(`island_generations`) ve en iyi programını tutar; periyodik göç
(migration) ile adalar arası çeşitlilik korunur. Paralellik
`process_parallel.py`'de `multiprocessing` ile taşınıyor.

#### Durum ve bellek
`controller.py:_save_checkpoint()` (satır 422) ve `_load_checkpoint()`
(satır 479) ile popülasyon periyodik olarak diske yazılıp
kaldığı yerden devam edebiliyor — DGM'nin `dgm_metadata.jsonl`'ine karşılık
gelen mekanizma. `database.py:57` her `Program` nesnesinde `generation: int
= 0` alanı var; yani her aday hangi nesilde üretildiği bilgisiyle saklanıyor.

#### Hata yönetimi
- **Otomatik kapı**: Kabul tamamen `evaluator.py`'den gelen metrik
  karşılaştırmasına dayanıyor. `database.py:292`
  `should_replace = self._is_better(program, self.programs[existing_program_id])`
  — yeni aday, işgal ettiği MAP-Elites hücresindeki mevcut programdan daha
  iyi değilse **hücreye hiç girmiyor**, mevcut program yerinde kalıyor. Bu,
  kötü bir mutasyonun otomatik olarak elenmesi/rollback'idir; insan onayı
  yok (repo kodunda `approval`/`human review` terimi geçmiyor).
- **Hata/timeout izolasyonu**: `evaluator.py:265`
  `return {"error": 0.0, "timeout": True}` — zaman aşımına uğrayan veya
  hata fırlatan bir aday, döngüyü çökertmek yerine en kötü skorla
  (`error: 0.0`) işaretlenip elenir (satır 154-294'te `max_retries` kadar
  yeniden denenip son çare bu). `evaluator.py:360` civarında `cascade`
  değerlendirme aşamalı çalışıyor: `stage1` başarısızsa `stage2`'ye hiç
  geçilmiyor (satır 400-431), yani ucuz/hızlı bir ön elemeden geçmeyen aday
  pahalı teste sokulmuyor.
- **Kısmi insan-etkileşimi ama mutasyon onayı değil**: `controller.py:191`
  `_setup_manual_mode_queue()` — `config.llm.manual_mode=True` ise LLM
  çağrıları bir kuyruğa yazılıp insan tarafından elle yanıtlanabiliyor
  (API anahtarı olmadan kullanım senaryosu). Bu bir "üretilen kodu insan
  onaylıyor" kapısı **değil**; LLM'in kendisini insan taklit etmesi. K7
  açısından ilgisiz bir yalıtım.
- **Geri alma**: MAP-Elites hücre mantığı gereği daha iyi olmayan mutasyon
  hiç kalıcı hâle gelmiyor; ayrıca `_save_checkpoint`/`_load_checkpoint`
  sayesinde tüm popülasyon bir önceki checkpoint'e döndürülebilir.

#### Genişletilebilirlik
Yeni bir özellik boyutu (`feature_dimensions`) veya `cascade_thresholds`
eklemek `config.py`'de bir alan; yeni bir değerlendirme aşaması
`evaluator.py`'de `evaluate_stageN` fonksiyonu eklemek kadar küçük. Çekirdek
`controller.py`/`database.py` dokunulmadan genişliyor.

#### Güçlü yönler (kanıtlı)
- Kabul kapısı hem skor karşılaştırmalı (`_is_better`) hem kademeli
  (`cascade_evaluation`) hem de hata/timeout durumunda güvenli varsayılan
  (`error: 0.0`) veriyor — üç katmanlı otomatik savunma.
- Checkpoint mekanizması (`_save_checkpoint`/`_load_checkpoint`) ve
  `Program.generation` alanı ile tam sürüm/nesil izlenebilirliği var.
- PyPI'da yayınlı, sürüm numaralı (`0.3.2`), aktif bakımda (52 gün önce
  push) — DGM'den farklı olarak hâlâ canlı bir proje.

#### Zayıf yönler (kanıtlı)
- **Kendi kodunu değiştirmiyor.** İncelenen kod OpenEvolve'un kendi paket
  dosyalarını (`controller.py`, `database.py` vb.) hiçbir yerde mutasyona
  sokmuyor; mutasyona uğrayan her zaman `initial_program_path` ile verilen
  **harici** dosyadır (`controller.py:97`). Bu, DGM'nin iddia ettiği
  "kendi kodunu değiştirme" (self-referential self-modification) ile aynı
  kategori değil — K7'nin sorduğu "insan kapısız **kendini**-değiştirme"
  sorusuna OpenEvolve doğrudan cevap veremez, çünkü kendini değiştirmiyor.
- Sürüm hâlâ `0.x` (pre-1.0) — API/davranış kararlılığı garanti edilmiyor.
- Ödül hackleme / sürüklenme konusunda kodda veya README'de açık bir uyarı
  cümlesi bulunamadı (aranan terimler: "reward hack", "hallucinat",
  "exploit", "cheat", "gaming" — `openevolve/` kök dosyalarında ve
  README'de eşleşme yok); yani bu risk ele alınmıyor ya da belgelenmiyor.

#### Puan (1-5)
olgunluk: 3 · mimari netlik: 4 · genişletilebilirlik: 4 · güvenilirlik
ilkelleri: 3 (otomatik kapı + checkpoint var, insan onayı yok ama zaten
kendi kodunu değiştirmediği için risk yüzeyi DGM'den küçük) ·
gözlemlenebilirlik: 3 (nesil/ada logları) · güvenlik duruşu: 2 (evaluator
keyfi kod çalıştırıyor, izolasyon `multiprocessing` düzeyinde, konteyner/
sandbox uyarısı kod içinde bulunamadı)

#### Alınacak fikir
- MAP-Elites hücre-bazlı kabul mantığı (`_is_better` + hücre karşılaştırması)
  — bizim ajan sözleşmemizde "yalnızca mevcut en iyisinden daha iyiyse kabul
  et" ilkesini tek bir fonksiyonda somutlaştırmak.
- Kademeli değerlendirme (`cascade_evaluation`, ucuz filtre önce) — pahalı
  benchmark'ları sadece ucuz ön testi geçen adaylara çalıştırmak, maliyet
  disiplini için doğrudan uygulanabilir.
- Timeout/hata durumunda döngüyü çökertmek yerine en kötü skorla işaretleyip
  devam etme deseni (`{"error": 0.0, "timeout": True}`).

#### Alınmayacak
- "Kendini değiştiren sistem" olarak referans gösterme — kanıt kendi paket
  kodunu değil, kullanıcı tarafından verilen harici bir programı evrimleş-
  tirdiğini gösteriyor; K7 tartışmasında DGM ile aynı kefeye konmamalı.
- `manual_mode` kuyruğunu bir "insan onay kapısı" sanma — bu yalnızca LLM
  çağrısını insan eliyle yanıtlamak için, üretilen kodu onaylamak için değil.

---

## ADR-000 K7 için bulgu

**Sistem gerçekten kendini mi değiştiriyor?** Sadece DGM evet der ve kanıtla
doğrulanır: `self_improve_step.py:self_improve()` (satır 223) ajanın kendi
deposunu (`/dgm`) bir Docker konteyneri içinde düzenleyip yamasını
(`model_patch.diff`) host'a geri kopyalar (satır 364-365) ve bu yama bir
sonraki neslin ebeveyni olur. OpenEvolve ise `controller.py:97`'de
kanıtlandığı gibi **kendi paket kodunu değil, kullanıcının verdiği harici bir
programı** evrimleştirir — K7'nin "kendini-değiştirme" tanımına girmiyor,
bu yüzden K7 sınaması için DGM tek geçerli aday.

**Kapı**: Her iki sistemde de kapı tamamen otomatik ve benchmark/metrik
tabanlı — hiçbirinde insan onayı yok. DGM'de `utils/evo_utils.py:96`
`is_compiled_self_improve()` + `DGM_outer.py:174` `update_archive()`;
OpenEvolve'da `database.py:292` `self._is_better(...)`. Repo genelinde
`human`/`approval`/`manual review` taraması (DGM README ve kök dosyaları)
hiçbir eşleşme vermedi.

**Geri alma/sürümleme**: Her ikisinde de var — DGM'de nesil bazlı
`dgm_metadata.jsonl` + arşiv listesi (`DGM_outer.py:326-331`); OpenEvolve'da
`_save_checkpoint`/`_load_checkpoint` (`controller.py:422,479`) +
`Program.generation` alanı (`database.py:57`). Kötü mutasyon DGM'de arşive
hiç girmeyerek, OpenEvolve'da MAP-Elites hücresini ele geçirememe yoluyla
elenir — ikisi de "silme" değil "seçilmeme".

**Sürüklenme/ödül hackleme kanıtı**: Yalnızca DGM'de var — halüsine
edilmiş araç kullanımı ayrı bir metrik olarak izleniyor
(`analysis/visualize_archive.py:70,81`, `hallucination_performance`
anahtarı) ve yazarlar açık bir güvenlik itirafı yazmış
(`README.md:88`, "may still behave destructively due to limitations in
model capability or alignment"). OpenEvolve'da böyle bir uyarı veya izleme
bulunamadı.

**Üretim mi araştırma mı**: DGM açıkça araştırma — arXiv makalesinin
referans kodu, son push 13 ay önce (canlılık kuralını geçemiyor,
**tarihî referans**), zorunlu Docker izolasyonu ve doğrudan "safety risks"
uyarısıyla dağıtılıyor. OpenEvolve canlı ve PyPI'da paketlenmiş
(`v0.3.2`, hâlâ 0.x) ama kendi kodunu değiştirmediği için K7'nin sorduğu
riskli senaryoyu hiç yaşamıyor — düşük risk, ama bu K7'yi doğrulamıyor,
soruyu es geçiyor.

**Sonuç**: İncelenen iki sistemden yalnızca biri (DGM) gerçek anlamda
"insan kapısız kendini-değiştirme" yapıyor ve bu sistemin kendi belgeleri
(`README.md:88`) bunu üretimde güvenle çalışan bir şey değil, kabul edilmiş
bir risk olarak tanımlıyor; üstelik repo 13 aydır güncellenmemiş durumda.
OpenEvolve ise otomatik-kapılı ve üretimde/aktif bakımda olsa da kendi
kodunu değil harici bir hedefi değiştirdiği için K7'yi sınamıyor bile.
Dolayısıyla **K7 çürümedi, güçlendi**: "insan kapısız kendini-değiştirmenin
üretimde güvenle çalıştığı tek bir örnek" hâlâ bulunamadı — tek aday (DGM)
hem canlılık testini geçemiyor hem de kendi yazarlarınca "risk kabul
ediyorum" diyerek dağıtılıyor.
