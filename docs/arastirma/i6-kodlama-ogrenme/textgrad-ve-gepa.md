# Kendini optimize eden sistemler (TextGrad, GEPA)

Bu dosya, "kendini optimize eden sistem" iddiasını iki somut kod tabanında sınıyor: optimize edilen nesnenin gerçekte ne olduğu (metin mi, kod mu), optimizasyon sinyalinin kaynağı (sayısal metrik mi, LLM'in ürettiği doğal dil geri bildirim mi), ve — ADR-000'ın K7 sorusu için kritik olan — kabul edilen bir değişikliğin insan onayı olmadan otomatik olarak devreye girip girmediği. Her iddia, klon köküne göreceli bir `dosya:satır` alıntısına bağlanmıştır.

### TextGrad

#### Kimlik
`zou-group/textgrad`: 3718 yıldız, 26 watcher, son push 2025-07-25, MIT lisans, Python, arşivlenmemiş. Bugün 2026-09-08; son push'tan bu yana ~410 gün geçmiş. Canlılık kuralı (son push ≤ 90 gün) sağlanmıyor: **TextGrad tarihî referans** olarak değerlendirilmelidir, aktif bakımlı bir üretim aracı olarak değil.

#### Çözdüğü problem
LLM tabanlı programlardaki (prompt, ara yanıt, kod parçası gibi) metin değişkenlerini, PyTorch'un otograd sistemine benzer bir hesaplama grafiği üzerinden, bir "backward engine" LLM'in ürettiği doğal dil eleştirisini gradyan olarak kullanarak iyileştirmek. Paket `setup.py`'de `name="textgrad", version="0.1.8"` olarak tanımlı (`setup.py:10-11`).

#### Mimari
Dört ana parça: `Variable` (değer + rol açıklaması + biriken gradyanlar, `textgrad/variable.py:11`), `Function`/`autograd` operatörleri (ileri geçişte LLM çağrısı yapıp geriye "gradyan" üreten `LLMCall`, `textgrad/autograd/llm_ops.py:21`), `Optimizer` soyut sınıfı ve somut `TextualGradientDescent` (`textgrad/optimizer/optimizer.py:48,81`), ve `TextLoss`/`Module` tabanlı kayıp fonksiyonları (`textgrad/loss.py:9`). Backward LLM motoru `SingletonBackwardEngine` ile tek örnek olarak tutulur (`textgrad/config.py`).

#### Klasör yapısı (incelenen alt küme)
`textgrad/variable.py`, `textgrad/loss.py`, `textgrad/config.py`, `textgrad/optimizer/{optimizer.py, optimizer_prompts.py, guidance_optimizer.py}`, `textgrad/autograd/{function.py, llm_ops.py, llm_backward_prompts.py}`, `textgrad/__init__.py`, `setup.py`. `engine/`, `tasks/`, `prompts.py`, `model.py`, `defaults.py`, `utils/` kapsam dışı bırakıldı (bkz. Dürüstlük).

#### Ajan tasarımı
Bir "ajan" kavramı yok. Optimize edilen birim düz bir Python nesnesi: `Variable(value=..., role_description=..., requires_grad=...)` (`textgrad/variable.py:12-19`), değeri metin (prompt/çıktı) veya bytes (görsel) olabilir. Çoklu-ajan orkestrasyonu, araç kullanımı ya da otonom karar döngüsü yok — kütüphane yalnızca "metin gradyanı" hesaplayan bir otograd katmanı.

#### Orkestrasyon / iş akışı modeli
İçsel bir döngü/orkestratör yok; PyTorch'a benzer şekilde kullanıcı kodu döngüyü manuel sürer: `loss.backward()` → `optimizer.step()` → `optimizer.zero_grad()`. `TextualGradientDescent.step()` her parametre için tek seferde çalışır ve döngüyü tekrar tekrar çağırmak kullanıcının sorumluluğundadır (`textgrad/optimizer/optimizer.py:168-190`).

#### Durum ve bellek
`Variable.gradients` bir `Set[Variable]` olarak biriken doğal dil geri bildirimlerini tutar (`textgrad/variable.py:71`). Optimizer tarafında isteğe bağlı geçmiş gradyan hafızası `self.gradient_memory_dict = defaultdict(list)` ile tutulur (`textgrad/optimizer/optimizer.py` — `TextualGradientDescent.__init__` içinde `gradient_memory_dict` ataması, sınıf gövdesi `optimizer.py:81-135`) ve momentum varyantında `self.momentum_storage = [[] for _ in range(len(parameters))]` ile son N adımın değer+eleştiri çifti saklanır (`textgrad/optimizer/optimizer.py:216-217`). Kalıcı disk durumu veya checkpoint/resume mekanizması yok.

#### Hata yönetimi
`TextualGradientDescent.step()` optimizer LLM'in yanıtını `<IMPROVED_VARIABLE>` etiketleriyle parse eder; etiket bulunamazsa `IndexError` yakalanıp daha açıklayıcı bir mesajla yeniden fırlatılır (`textgrad/optimizer/optimizer.py:180-184`). Retry, backoff veya zarif düşüş (graceful degradation) yok — akış burada durur.

#### Genişletilebilirlik
`Optimizer(ABC)` alt sınıflanarak yeni optimizasyon stratejileri eklenebilir (`TextualGradientDescent`, `TextualGradientDescentwithMomentum`, `guidance_optimizer.py` — `textgrad/optimizer/optimizer.py:48,81,196`). `Function` tabanlı yeni otograd operatörleri de aynı şekilde eklenebilir (`textgrad/autograd/function.py`).

#### Güçlü yönler (kanıtlı)
- "Doğal dil gradyanı" fikri net ve küçük bir kod yüzeyinde uygulanmış: `gradient_value = backward_engine(backward_prompt, system_prompt=BACKWARD_SYSTEM_PROMPT)` (`textgrad/autograd/llm_ops.py:149`), bu değer doğrudan bir `Variable` olarak modele geri besleniyor (`textgrad/autograd/llm_ops.py:152`).
- Tanıdık PyTorch-benzeri API (`.backward()`, `.step()`, `.zero_grad()`) öğrenme eğrisini düşürüyor.

#### Zayıf yönler (kanıtlı)
- Hiçbir kabul/ret, doğrulama seti veya geri alma mekanizması kodda yok: `grep -rn "revert|best_|accept|reject|threshold|validation"` `textgrad/*.py`, `optimizer/*.py`, `autograd/*.py` üzerinde eşleşme bulmadı (bkz. arama komutu çıktısı — yalnızca alakasız `accepts` kelimesi eşleşti, `textgrad/autograd/multimodal_ops.py:64`).
- `step()` üretilen yeni metni koşulsuz uygular: `parameter.set_value(new_value)` (`textgrad/optimizer/optimizer.py:186`), öncesinde hiçbir skor karşılaştırması yapılmaz.
- Proje 410+ gündür güncellenmiyor, sürüm hâlâ `0.1.8` (1.0 öncesi).

#### Puan (1-5)
- olgunluk: 2
- mimari netlik: 4
- genişletilebilirlik: 4
- güvenilirlik ilkelleri: 1
- gözlemlenebilirlik: 3
- güvenlik duruşu: 1

#### Alınacak fikir
"Değişken + biriken doğal dil gradyanı" soyutlaması (`Variable.gradients`, `textgrad/variable.py:71`) — LLM geri bildirimini birinci sınıf, birikebilir bir nesne olarak modellemek, hata ayıklamayı ve geri bildirim zincirini izlemeyi kolaylaştırıyor.

#### Alınmayacak
`optimizer.step()`'in üretilen metni hiçbir sayısal doğrulama veya eşik kontrolünden geçirmeden doğrudan `set_value` ile üzerine yazması (`textgrad/optimizer/optimizer.py:186`) — kötü bir optimizasyon adımını engelleyecek veya geri alacak hiçbir mekanizma yok.

---

### GEPA

#### Kimlik
`gepa-ai/gepa`: 6463 yıldız, 25 watcher, son push 2026-09-08 (bugün), MIT lisans, Python/Jupyter, arşivlenmemiş. Canlılık kuralını (son push ≤ 90 gün + arşivlenmemiş + OSI lisans) **geçiyor**.

#### Çözdüğü problem
Çok bileşenli AI sistemlerinin (agent pipeline'ları, DSPy programları, RAG sistemleri vb.) metin bileşenlerini — talimat/prompt metinlerini — reflective (yansıtıcı) mutasyon ve Pareto-tabanlı seçilimle evrimsel olarak optimize etmek. Paket `pyproject.toml`'da `name="gepa"`, `version="0.1.4"` (`pyproject.toml:9,11`) — henüz 1.0 öncesi ama aktif geliştirmede.

#### Mimari
`GEPAEngine` ana döngüyü yürütür (`src/gepa/core/engine.py:113`), `GEPAState` tüm adayları ve Pareto cephesini tutar (`src/gepa/core/state.py:217`), `GEPAAdapter` bir `Protocol` olarak kullanıcı sistemiyle GEPA arasındaki tek entegrasyon noktasıdır (`src/gepa/core/adapter.py:83`), `ReflectiveMutationProposer` yeni aday metinleri önerir (`src/gepa/proposer/reflective_mutation/reflective_mutation.py:44`), `AcceptanceCriterion` kabul/ret kararını verir (`src/gepa/strategies/acceptance.py`). Giriş noktası `optimize(seed_candidate: dict[str, str], ...)` fonksiyonu (`src/gepa/api.py:46-47`).

#### Klasör yapısı (incelenen alt küme)
`src/gepa/core/{engine.py, state.py, adapter.py, callbacks.py, data_loader.py, result.py}`, `src/gepa/proposer/{base.py, merge.py, reflective_mutation/{base.py, combee.py, reflection_lm.py, reflective_mutation.py}}`, `src/gepa/strategies/{acceptance.py, batch_sampler.py, candidate_selector.py, component_selector.py, eval_policy.py, instruction_proposal.py, proposal_sampling.py, proposal_selection.py}`, `src/gepa/adapters/` (yalnızca dosya/dizin adları: `anymaths_adapter`, `confidence_adapter`, `default_adapter`, `dspy_adapter`, `dspy_full_program_adapter`, `generic_rag_adapter`, `langchain_adapter`, `mcp_adapter`, `optimize_anything_adapter`, `terminal_bench_adapter`), `src/gepa/api.py`, `pyproject.toml`. `tests/`, `docs/`, `examples/`, `*.ipynb`, `benchmarks/` ve adapter alt klasörlerinin içi kapsam dışı bırakıldı.

#### Ajan tasarımı
Optimize edilen "candidate" bir `dict[str, str]`: bileşen adı → bileşen metni (`src/gepa/api.py:47`; `GEPAAdapter` docstring'inde "candidate: Dict[str, str] mapping a named component ... to its corresponding text", `src/gepa/core/adapter.py:126`). GEPA kendisi bir ajan çerçevesi değil — kullanıcı kendi ajan/pipeline'ını `GEPAAdapter.evaluate()` içinde çalıştırır (`src/gepa/core/adapter.py:145-165`); GEPA yalnızca bu pipeline'ın prompt bileşenlerini dıştan optimize eden bir meta katmandır.

#### Orkestrasyon / iş akışı modeli
`GEPAEngine.run()` (`src/gepa/core/engine.py:714`) kütüphanenin kendi içinde sürdürdüğü kapalı bir döngüdür (TextGrad'ın aksine dışarıdan manuel sürülmez): Pareto cephesinden bir aday seç (`strategies/candidate_selector.py`) → minibatch üzerinde değerlendir → `make_reflective_dataset` ile yansıtıcı veri kümesi oluştur (`src/gepa/core/adapter.py:185`) → öğretmen LLM ile yeni metin öner (`propose_new_texts`, `src/gepa/core/adapter.py` — `ProposalFn` Protocol, satır 49) → minibatch'te tekrar değerlendir → `acceptance_criterion.should_accept` ile kabul/ret et (`src/gepa/core/engine.py:520-565`, `_report_rejected_proposal`) → kabul edilirse tam validation setinde değerlendirip Pareto cephesini güncelle (`_add_evaluated_program`, `src/gepa/core/engine.py:385-432`).

#### Durum ve bellek
`GEPAState` (`src/gepa/core/state.py:217`) her validation örneği için en iyi skoru (`pareto_front_valset: dict[DataId, float]`, `state.py:245`) ve o skora ulaşan program indekslerini (`program_at_pareto_front_valset: dict[DataId, set[ProgramIdx]]`, `state.py:246`) tutar; güncelleme yalnızca skor kesin olarak iyileştiğinde olur (`prev_score = self.pareto_front_valset.get(val_id, float("-inf")); if score > prev_score: ...`, `state.py:931-934`). Durum diskte JSON olarak saklanır (`GEPAState.save`, `state.py:405`) ve checkpoint/resume için adapter'a özel durum kalıcılığı desteklenir (`get_adapter_state`/`set_adapter_state`, `src/gepa/core/adapter.py:112-121`).

#### Hata yönetimi
`raise_on_exception: bool = True` parametresi hem `optimize()` girişinde hem motor kurucusunda mevcut (`src/gepa/api.py:96`, `src/gepa/core/engine.py:147`); varsayılan olarak proposer/evaluator hataları fırlatılır, yalnızca `False` verilip zaten ilerleme kaydedilmişse hata yutulup akış durur (`src/gepa/core/engine.py:1084-1087`). Adapter kontratı per-örnek hataları skorla (ör. 0.0) işaretlemeyi, yalnızca sistemik hataları raise etmeyi şart koşuyor ("Never raise for individual example failures", `src/gepa/core/adapter.py:138-146`).

#### Genişletilebilirlik
`GEPAAdapter` bir `Protocol` (`src/gepa/core/adapter.py:83`) olduğundan yapısal alt tipleme ile herhangi bir sistem entegre edilebilir; 9 hazır adaptör mevcut (dspy, langchain, mcp, terminal-bench, rag, vb. — yukarıdaki dosya adları). Aday seçim stratejisi (`ParetoCandidateSelector`, `CurrentBestCandidateSelector`, `EpsilonGreedyCandidateSelector`, `src/gepa/strategies/candidate_selector.py:10,27,35`) ve kabul kriteri (`StrictImprovementAcceptance`, `ImprovementOrEqualAcceptance`, `src/gepa/strategies/acceptance.py:41,54`) takas edilebilir stratejiler olarak tasarlanmış.

#### Güçlü yönler (kanıtlı)
- Kabul/ret sayısal skor toplamına bağlı ve kodda açık: `return new_sum > old_sum` (`src/gepa/strategies/acceptance.py:49`).
- Reddedilen adaylar state'e hiç girmiyor, yalnızca loglanıp bir callback event'i fırlatılıyor (`_report_rejected_proposal`, `src/gepa/core/engine.py:520-565`) — kötü mutasyon otomatik elenmiş oluyor.
- Pareto cephesi her validation örneği için ayrı en iyi skor tuttuğundan (`state.py:245-246`), tek bir global metrikte gerileme olsa bile niş iyileştirmeler kaybolmuyor.

#### Zayıf yönler (kanıtlı)
- İnsan onay adımı yok: `grep -rn "approval|confirm|human_in_the_loop|\bhuman\b|review|apply_patch|manual"` `core/`, `proposer/`, `strategies/`, `api.py` üzerinde yalnızca iki alakasız eşleşme buldu — `self.logger.log("Stop requested manually...")` (`src/gepa/core/engine.py:1273`, kullanıcının CLI'dan durdurma isteği, onay değil) ve bir yorum satırı "Save run log and candidates as human-readable JSON" (`src/gepa/core/state.py:447`, log biçimiyle ilgili, onay mekanizması değil).
- Sürüm hâlâ `0.1.4`, 1.0 öncesi (`pyproject.toml:11`).

#### Puan (1-5)
- olgunluk: 3
- mimari netlik: 4
- genişletilebilirlik: 5
- güvenilirlik ilkelleri: 3
- gözlemlenebilirlik: 4
- güvenlik duruşu: 2

#### Alınacak fikir
Sayısal accept/reject kapısı + per-örnek Pareto cephesi (`state.py:245-246,931-934`) — kötü bir mutasyonun state'e hiç girmeden otomatik elenmesi, TextGrad'da tamamen eksik olan bir güvenlik ilkesi.

#### Alınmayacak
Kabul kriterini geçen bir mutasyonun yine de hiçbir insan onayı olmadan doğrudan aday havuzuna ve üretim adayı olma yarışına girmesi (`_add_evaluated_program`, `src/gepa/core/engine.py:385-432`) — sayısal kapı var ama insan kapısı yok.

---

## TextGrad ile GEPA farkı
TextGrad, PyTorch-benzeri bir otograd soyutlamasıyla LLM-üretilmiş metin gradyanlarını kullanıcı kodunun manuel sürdüğü bir forward/backward/step döngüsünde hesaplar ve **hiçbir kabul/ret mekanizması olmadan** üretilen her gradyanı doğrudan uygular (`parameter.set_value(new_value)`, `textgrad/optimizer/optimizer.py:186`). GEPA ise kendi kapalı optimizasyon döngüsünü (`GEPAEngine.run()`, `src/gepa/core/engine.py:714`) yürütür, adayları bir Pareto cephesinde çoklu-örnek skorlarına göre tutar (`src/gepa/core/state.py:245-246`), mutasyonları sayısal minibatch skor karşılaştırmasıyla kabul/ret eder (`src/gepa/strategies/acceptance.py:49`) ve reddedilenler state'e hiç girmez. Özetle: TextGrad "gradyanı hesapla ve koşulsuz uygula", GEPA "mutasyon öner, minibatch'te dene, sayısal olarak kanıtlanırsa tut, kanıtlanmazsa at".

## ADR-000 K7 için bulgu
**Hayır.** İki sistemden hiçbiri, insan onayı olmadan kendi prompt'unu/politikasını değiştirip bunu üretimde güvenle çalıştırdığına dair kanıt sunmuyor — çünkü ikisi de zaten bir insan onay adımı içermiyor (bu K7'nin olumsuz kanıtı, olumlu kanıt değil). TextGrad'da `approval|confirm|human|review|apply` araması `textgrad/` (engine hariç) içinde hiçbir gerçek onay mekanizması bulamadı; `optimizer.step()` üretilen metni doğrudan `parameter.set_value(new_value)` ile uyguluyor (`textgrad/optimizer/optimizer.py:186`), öncesinde hiçbir doğrulama yok. GEPA'da da aynı arama (`core/`, `proposer/`, `strategies/`, `api.py` üzerinde) yalnızca bir CLI durdurma logu (`src/gepa/core/engine.py:1273`) ve bir log-biçimi yorumu (`src/gepa/core/state.py:447`) buldu — ikisi de onay mekanizması değil; `GEPAEngine` kabul edilen adayı otomatik olarak `state.update_state_with_new_program` ile aday havuzuna ekliyor (`_add_evaluated_program`, `src/gepa/core/engine.py:385-432`). Fark şu: GEPA'nın en azından otomatik, sayısal bir accept/reject kapısı var (`src/gepa/strategies/acceptance.py:49`) — kötü mutasyonu makine kendi kendine eleyebiliyor; TextGrad'da bu bile yok. Ama "insan onayı" ikisinde de yok, dolayısıyla "üretimde güvenle otomatik prompt değişikliği" iddiasını destekleyecek kanıt hiçbirinde bulunmuyor.

## Dürüstlük
- TextGrad'da `engine/`, `tests/`, `evaluation/`, `examples/`, `notebooks/`, `tasks/` dizinlerine ve `prompts.py`, `model.py`, `defaults.py`, `utils/` dosyalarına hiç bakılmadı — sağlayıcı adaptörleri ve örnek kullanım kodu kapsam dışı bırakıldı.
- GEPA'da `tests/`, `docs/`, `examples/`, `*.ipynb`, `benchmarks/` dizinlerine ve `adapters/` alt klasörlerinin içine hiç girilmedi — yalnızca dosya/dizin adları listelendi.
- GEPA'nın `oa/` (optimize_anything), `gskill/`, `logging/`, `visualization.py`, `gepa_launcher.py`, `image.py`, `gepa_utils.py` modülleri kapsam dışı bırakıldığı için detaylı incelenmedi; yalnızca dizin listesinden var oldukları biliniyor.
- `src/gepa/proposer/reflective_mutation/combee.py` (721 satır) ve `reflection_lm.py` (192 satır) içerikleri hiç açılmadı, yalnızca dosya listesinde ve `wc -l` çıktısında görüldü.
- `src/gepa/strategies/{batch_sampler.py, component_selector.py, eval_policy.py, proposal_sampling.py, proposal_selection.py}` ve `src/gepa/proposer/{base.py, merge.py}` içerikleri açılmadı.
- "Üretim mi araştırma kodu mu" değerlendirmesi yalnızca `pyproject.toml`/`setup.py` sürüm numaralarına (TextGrad 0.1.8, GEPA 0.1.4) ve dosya yapısına dayanıyor; CI/CD yapılandırması, PyPI indirme istatistikleri, sürüm geçmişi veya gerçek üretim kullanım kanıtı doğrulanmadı.
- GitHub kimlik verileri (yıldız, watcher, son push tarihi) görevde verildiği gibi kullanıldı, tekrar sorgulanmadı.
- Araç çağrısı tavanı (30) nedeniyle her iki projede de yalnızca en kritik dosyalara (`variable.py`, `optimizer.py`, `loss.py`, `config.py`, `llm_ops.py` / `engine.py`, `state.py`, `adapter.py`, `acceptance.py`, `instruction_proposal.py`, `candidate_selector.py`, `reflective_mutation.py`) odaklanıldı; dosyaların tamamı baştan sona okunmadı, yalnızca `grep -n` ile bulunan ilgili satırlar ve çevreleri incelendi.
