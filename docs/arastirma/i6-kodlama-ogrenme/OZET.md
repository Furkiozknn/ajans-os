# İ6 Otonom kodlama ve öğrenme — iz özeti

## 1. İncelenen projeler

| Proje | Kategori | Yıldız | Son push | Lisans | Canlılık | Olgunluk | Mimari netlik | Genişletilebilirlik | Güvenilirlik ilkelleri | Gözlemlenebilirlik | Güvenlik duruşu | Kanıt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OpenHands/software-agent-sdk | kodlama ajanı SDK + sunucu | 1.066 | 2026-09-07 | MIT | geçti | 4 | 3 | 4 | 4 | 3 | 3 | [openhands](openhands.md) |
| jennyzzt/dgm | kendini değiştiren ajan (araştırma) | 2287 | 2025-08-13 | Apache-2.0 | tarihî referans (geçemedi, son push ~13 ay önce) | 2 | 4 | 3 | 2 | 3 | 2 | [kendini-degistiren-sistemler](kendini-degistiren-sistemler.md) |
| codelion/openevolve | evrimsel kod optimizasyonu (harici hedef) | 7332 | 2026-07-18 | Apache-2.0 | geçti | 3 | 4 | 4 | 3 | 3 | 2 | [kendini-degistiren-sistemler](kendini-degistiren-sistemler.md) |
| SWE-agent/SWE-agent | otonom yazılım mühendisi ajanı | 20274 | 2026-09-07 | MIT | geçti | 4 | 4 | 4 | 3 | 3 | 2 | [swe-agent](swe-agent.md) |
| Aider-AI/aider | AI çift-programlama CLI | 48.825 | 2026-05-22 | Apache-2.0 | tarihî referans (~108 gün) | 5 | 4 | 4 | 3 | 2 | 3 | [aider](aider.md) |
| zou-group/textgrad | metin-gradyan otograd optimizasyonu | 3718 | 2025-07-25 | MIT | tarihî referans (~410 gün) | 2 | 4 | 4 | 1 | 3 | 1 | [textgrad-ve-gepa](textgrad-ve-gepa.md) |
| gepa-ai/gepa | reflective prompt evrimi (Pareto) | 6463 | 2026-09-08 | MIT | geçti | 3 | 4 | 5 | 3 | 4 | 2 | [textgrad-ve-gepa](textgrad-ve-gepa.md) |

Puanlar analiz dosyalarının "Puan" bölümlerinden birebir alındı; uydurulmadı. Proje/Yıldız/Son push kimlik satırlarından alındı; OpenHands için iki repo var (frontend All-Hands-AI/OpenHands 86.693 yıldız, backend OpenHands/software-agent-sdk 1.066 yıldız) — `openhands.md` bunu "gerçek analiz hedefi" olarak işaretlediği için backend kullanıldı.

### Sağlayıcı bağımsızlığı / sözleşme / insan kapısı / checkpoint

| Proje | saglayici_bagimsiz | sozlesme_var | insan_kapisi | checkpoint |
|---|---|---|---|---|
| OpenHands/software-agent-sdk | — | evet | kısmen | evet |
| jennyzzt/dgm | evet | kısmen | hayır | evet |
| codelion/openevolve | — | kısmen | hayır | evet |
| SWE-agent/SWE-agent | — | evet | hayır | hayır |
| Aider-AI/aider | evet | kısmen | evet | — |
| zou-group/textgrad | — | — | hayır | hayır |
| gepa-ai/gepa | — | evet | hayır | evet |

Gerekçeler (kısmen ve beklenmedik değerler):
- **OpenHands insan_kapisi = kısmen**: `ConfirmationPolicy` risk-eşikli onay uygulayabiliyor ama `NeverConfirm` politikasıyla tamamen kapatılabiliyor (`openhands.md:96,135`).
- **DGM sozlesme_var = kısmen**: araç sözleşmesi yalnızca `tools/bash.py` ve `tools/edit.py` ile sınırlı, biçimsel bir şema/spec tanımı yok — sabit iki araçlık bir sözleşme (`kendini-degistiren-sistemler.md:56-57`).
- **OpenEvolve sozlesme_var = kısmen**: "klasik anlamda çok-ajanlı bir sözleşme yok" diye açıkça belirtiliyor; bunun yerine `config.py` üzerinden tipli (`diff_based_evolution: bool`) dar bir girdi/çıktı sözleşmesi var (`kendini-degistiren-sistemler.md:199-200`).
- **Aider sozlesme_var = kısmen**: `Coder` alt sınıfı + `edit_format` sabiti + `get_edits`/`apply_edits` override deseni bir arayüz sözleşmesi sayılabilir ama biçimsel şema değil (`aider.md:37`).
- **Aider checkpoint = —**: dosya açıkça "kalıcı 'öğrenme' yok" diyor, durum yalnızca oturum içi `cur_messages`/`done_messages` listelerinde tutuluyor (`aider.md:29`); git commit geçmişi örtük bir geri dönüş noktası sağlayabilir ama bu doküman checkpoint/resume olarak tanımlamıyor, bu yüzden kanıtsız `—` bırakıldı.
- **TextGrad saglayici_bagimsiz / sozlesme_var = —**: sağlayıcı adaptörleri ve `model.py`/`defaults.py` kapsam dışı bırakıldığı açıkça belirtiliyor (`textgrad-ve-gepa.md:120`), sözleşme konusunda da doğrudan kanıt yok.
- **SWE-agent / OpenEvolve / GEPA saglayici_bagimsiz = —**: kanıt dosyalarında litellm/çoklu-sağlayıcı desteğine dair açık bir ifade bulunamadı (yalnızca DGM ve Aider için bu açıkça belgelenmiş).

## 2. Yinelenen desenler

**Desen A — otomatik kabul kapısı "geçerli mi" ve "yeterince iyi mi" iki ayrı testten geçiyor, hiçbiri tek bir "başarılı" bayrağına indirgenmiyor.**
Üç bağımsız proje bunu ayrı ayrı üretmiş:
- DGM: `is_compiled_self_improve()` (`utils/evo_utils.py:96-126`) yalnızca "derlendi mi / boş olmayan yama var mı" testini yapıyor; ayrı bir eşik fonksiyonu `get_full_eval_threshold` (`DGM_outer.py:192-215`) "yeterince iyi mi"yi ölçüyor.
- OpenEvolve: `database.py:292` `should_replace = self._is_better(program, self.programs[existing_program_id])` — aday hücresindeki mevcut programdan daha iyi değilse hücreye hiç girmiyor.
- GEPA: `src/gepa/strategies/acceptance.py:49` `return new_sum > old_sum` — minibatch skor karşılaştırması, reddedilen aday `_report_rejected_proposal` (`src/gepa/core/engine.py:520-565`) ile state'e hiç girmeden loglanıyor.
Karşıt kanıt: TextGrad bu deseni tamamen atlıyor — `optimizer.step()` üretilen metni hiçbir karşılaştırma yapmadan `parameter.set_value(new_value)` ile doğrudan uyguluyor (`textgrad/optimizer/optimizer.py:186`).

**Desen B — hata durumunda döngü sessiz çökmüyor; her istisna sınıfı ayrı yakalanıp otomatik/güvenli bir çıkışla sonlandırılıyor.**
- SWE-agent: `handle_error_with_autosubmission` (`sweagent/agent/agents.py:1076-1216`) bütçe aşımı, ardışık timeout, ortam hatası ve sınıflandırılmamış `except Exception`'ı bile ayrı yakalayıp elindeki son yamayla otomatik teslim ediyor.
- Aider: malformed edit `ValueError` `apply_updates()` içinde yakalanıp (`aider/coders/base_coder.py:2305-2316`) ham hata metni `self.reflected_message` olarak LLM'e geri gönderiliyor, üst sınır `max_reflections=3` (`base_coder.py:100-101,939-940`).
- OpenEvolve: zaman aşımına uğrayan/hata veren aday döngüyü çökertmek yerine en kötü skorla işaretleniyor — `evaluator.py:265` `return {"error": 0.0, "timeout": True}`.
- DGM: aşırı uzayan bir deneme atılıp loglanıyor ama nesil döngüsü durmuyor — `future.result(timeout=1.5*60*60)` (`DGM_outer.py:301-306`).

**Desen C — event-sourced / append-only kalıcı durum + kaldığı yerden devam etme, dört bağımsız projede aynı temel fikir farklı formatlarla tekrarlanıyor.**
- OpenHands: `EventLog` (`conversation/event_store.py:34`) her olayı ayrı dosyaya yazıyor; `ConversationState.append_event` yorum satırında "append replays only the new tail — O(k)" diyerek artımlı replay'i belgeliyor (`state.py:344`); `base_state.json`'dan resume somut (`local_conversation.py:321,332,388`).
- DGM: her nesil sonunda `generation`/`archive`/`children` alanları `dgm_metadata.jsonl`'e satır satır (append) yazılıyor (`DGM_outer.py:326-331`); `initialize_run()` önceki çalıştırmadan (`prevrun_dir`) devam edebiliyor (satır 21-25).
- OpenEvolve: `controller.py:_save_checkpoint()` (satır 422) / `_load_checkpoint()` (satır 479) ile popülasyon periyodik olarak diske yazılıp kaldığı yerden devam ediyor; her `Program` nesnesi `generation: int` alanı taşıyor (`database.py:57`).
- GEPA: `GEPAState.save` (`src/gepa/core/state.py:405`) durumu JSON olarak diske yazıyor, adapter'a özel durum kalıcılığı `get_adapter_state`/`set_adapter_state` (`src/gepa/core/adapter.py:112-121`) ile destekleniyor.

**Desen D — yeni ajan/araç eklemek çekirdek koda dokunmadan, "bir dosya + bir kayıt satırı" seviyesine indirilmiş.**
- OpenHands: subagent eklemek tek bir Markdown dosyası + `register_agent_if_absent` kaydı (`openhands-tools/openhands/tools/preset/default.py:141-166`), Python koduna dokunulmuyor.
- SWE-agent: yeni araç `tools/<isim>/config.yaml` + `bin/<script>` klasörü + `config/default.yaml:41-44`'te tek satır kayıt — 2 dokunma noktası (`sweagent/tools/bundle.py:14-17`).
- Aider: yeni edit format `Coder` alt sınıfı + `edit_format` string sabiti + `get_edits`/`apply_edits` override (üç mevcut örnek: `editblock_coder.py:15`, `udiff_coder.py:46`, `wholefile_coder.py:10`).

## 3. Ayrışan yaklaşımlar

Aynı problem — "üretilen değişikliği kabul et ya da reddet" — yedi projede yedi farklı çözümle karşılanıyor:

| Proje | Kabul mekanizması | Hangi koşulda doğru |
|---|---|---|
| DGM | otomatik metrik eşiği (derlendi + `get_full_eval_threshold`) | araştırma ortamı, Docker izolasyonu var, insan darboğazı istenmiyor, yazar riski kabul ediyor |
| OpenEvolve | MAP-Elites hücre karşılaştırması (`_is_better`) | hedef programın iyi tanımlı, hızlı hesaplanabilir bir metriği varsa |
| GEPA | minibatch skor karşılaştırması (`new_sum > old_sum`) | prompt/bileşen optimizasyonu, ölçülebilir görev metriği mevcutsa |
| TextGrad | yok — koşulsuz uygula | yalnızca insanın canlı izlediği hızlı deneysel iterasyon; üretimde savunulamaz |
| Aider | insan onayı (`confirm_ask`), `--yes-always` ile kapatılabilir | insan döngüde kalmak istiyorsa varsayılan; tam otomasyon isteniyorsa açık opt-out |
| SWE-agent | yok (yalnızca bütçe/timeout/format-tekrarı sınırları) | tek seferlik issue→PR akışı, insan PR'ı sonradan gözden geçirir varsayımıyla |
| OpenHands | pluggable `ConfirmationPolicy` (Always/Never/risk-eşikli) | riske göre ayarlanabilir onay isteniyorsa; ama `NeverConfirm` ile tamamen kapatılabiliyor |

## 4. Anti-pattern'ler

**AP1 — "İnsan kapısı var" görünümü, tek bayrak/tek config değeriyle tamamen kaldırılabiliyor.**
Aider `--yes-always` (`aider/args.py:760-765`, `action="store_true"`) ve OpenHands `NeverConfirm` (`security/confirmation_policy.py:35-41`) aynı deseni bağımsız olarak tekrarlıyor: varsayılan kapı kullanıcı tercihiyle sıfıra indirilebiliyor, kod tabanında "bu asla kapatılamaz" diyen ayrı bir sabit sınır yok.

**AP2 — otomatik kapı yalnızca "çalıştı mı / skor arttı mı" ölçüyor, güvenlik veya yan etki denetlemiyor.**
DGM'nin `is_compiled_self_improve()` (`utils/evo_utils.py:96-126`) kod kalitesi/güvenlik kontrolü içermiyor — yazarın kendi itirafı (`README.md:88`) bunu doğruluyor. OpenEvolve'da da aday kodu izolasyonsuz çalıştırılıyor (yalnızca `process_parallel.py:7` `multiprocessing`, sandbox yok — adres denetimde düzeltildi); repo genelinde "reward hack/exploit" uyarısı bulunamadı (kendini-degistiren-sistemler.md).

**AP3 — dışarı açılan bir eylem (PR açma, dosya üzerine koşulsuz yazma) onaysız varsayılan yolda mümkün.**
SWE-agent'ın `open_pr` hook'u gerçek bir GitHub branch'i push edip PR açıyor, kodda onay/dry-run sorgusu yok (`_dry_run` parametresi tanımlı ama kullanılmıyor, `sweagent/run/hooks/open_pr.py:143-148`); kod içinde "THE IMPLEMENTATION DETAILS HERE WILL CHANGE SOON!" uyarısı bile var (satır 19-20). TextGrad'ın `parameter.set_value(new_value)` (`optimizer.py:186`) hiçbir doğrulama olmadan üretilen metni kalıcı hale getirmesi aynı ailede.

## 5. Bizim için öneri

1. **Otonom görev kuyruğumuz (`gorevler/`) için event-sourced kayıt + türetilmiş durum modeli benimsenmeli.** Kanıt: OpenHands `EventLog` (append-only, `event_store.py:34`) + tail-replay (`state.py:344`) süreç çökse bile kaldığı yerden devam ettiriyor — bizim headless çalıştırmalarımızın yarıda kesilme riskine doğrudan cevap.
2. **Bir "otomatik kabul kapısı" kurulacaksa, "geçerli mi" ve "eşiği aştı mı" iki ayrı fonksiyonda tutulmalı, tek bir "başarılı" bayrağına indirgenmemeli.** Kanıt: DGM `is_compiled_self_improve` + `get_full_eval_threshold` ayrımı, GEPA `acceptance.py:49`.
3. **Kod-yazan ajanlarımızda sınırlı-sayıda otomatik kendini-düzeltme döngüsü + ham hata mesajını modele geri verme deseni doğrudan uygulanmalı.** Kanıt: Aider `max_reflections=3` + `self.reflected_message = str(err)` (`base_coder.py:100-101,2305-2316`) — sonsuz döngü riskini koda gömüyor.
4. **CLAUDE.md'nin "dışarı açılan işlemler onay ister" kuralı, tek bir config bayrağıyla kapatılamayacak şekilde koda gömülmeli** — AP1'in tam tersi. Aider (`--yes-always`) ve OpenHands (`NeverConfirm`) örnekleri, "kapı var" görünümünün pratikte tek satırla sıfırlanabildiğini gösteriyor; bizim sabit sınırlarımız (raporlar/ONAY-BEKLEYENLER.md akışı) config'ten bağımsız, koşulsuz bir dal olarak kalmalı.
5. **Yeni araç/alt-görev eklemeyi "bir dosya + bir kayıt satırı" seviyesine indiren bundle/preset deseni benimsenmeli.** Kanıt: SWE-agent'ın `config.yaml`+`bin/script` bundle'ı (`sweagent/tools/bundle.py:14-17`) ve OpenHands'in subagent `.md` dosyası + `register_agent_if_absent` (`preset/default.py:141-166`) — çekirdek koda dokunmadan genişleme.

## 6. Açık sorular

- Cline'ın insan-onay kapısının UI katmanında mı çekirdekte mi olduğu bu turda cevaplanmadı (klonlanmadı) — sonraki tur için en yüksek değerli aday.
- OpenHands (jsonl per-event dosya), DGM (jsonl append) ve OpenEvolve (checkpoint dosyası) üç farklı kalıcılık formatı kullanıyor; bizim tek-makine ölçeğimize hangisinin uyduğu sentez fazında karar verilecek.
- Bir otomatik kabul kapısı kurulursa eşiği kimin/nasıl belirleyeceği (görev dosyası mı, sabit protokol mü) bu izde cevaplanmadı.
- "Kendi promptunu/CLAUDE.md'sini değiştirme" sorusu ajans-os'un kendi headless döngüsüne nasıl uygulanacak — bu izin incelediği projelerin hiçbiri bizim mimarimizle birebir örtüşmüyor, sentezde ayrıca ele alınmalı.

## 7. İncelenmeyenler

- **Cline** (`cline/cline`, 67.650 yıldız, Apache-2.0, son push 2026-09-08, canlı) — klonlanmadı, bütçe yüzünden açılmadı. Odak sorusu açık kaldı: VSCode eklentisi olarak insan kapısı (her araç çağrısında onay) UI katmanında mı yoksa çekirdekte mi? Sonraki tur için en yüksek değerli kalan aday.
- **Claude Code'un kendi alt-ajan modeli** — kapalı kaynak, protokol §1 canlılık kuralı OSI lisans istiyor; kod okunamıyor. Bu makinedeki kullanım gözlemi (BILINEN-TUZAKLAR.md #15-#18) dolaylı kanıt sunuyor ama protokol anlamında analiz edilemez.
- **DSPy** — İ4'te zaten incelendi (`docs/arastirma/i4-guvenilirlik/dspy.md`); İ6'da tekrar açmak israf, matriste `iz: ["i4","i6"]` yeterli.
- **SWE-bench / Terminal-bench** (ölçüm harness'leri) — bu iz mimari araştırması; ölçüm tarafı İ5'te `model-comparison-harness.md` ile kısmen karşılandı.

## ADR-000 K7 kararı

Görev: *"insan kapısız kendini-değiştirmenin üretimde güvenle çalıştığı **tek bir** örnek var mı?"* Yedi proje üç eksende sınıflandırıldı:

| Proje | (a) kendi kod/prompt mu, harici hedef mi | (b) kapı | (c) üretim mi araştırma mı |
|---|---|---|---|
| OpenHands | harici (Local/DockerWorkspace) | var, ama `NeverConfirm` ile tamamen kapatılabiliyor | üretim (canlı) |
| DGM | **kendi kodu** (`/dgm` dizini) | yok, tamamen otomatik metrik | araştırma (tarihî referans, 13 ay donmuş, yazarın kendi güvenlik itirafı) |
| OpenEvolve | harici (`initial_program_path`) | yok, otomatik metrik (MAP-Elites) | canlı ama 0.x, kendi kodunu değiştirmediği için K7'yi sınamıyor |
| SWE-agent | harici (izole deployment) | yok (bütçe/timeout dışında); `open_pr` onaysız | canlı ama bakım odağı `mini-swe-agent`'a kaymış |
| Aider | harici (hedef repo) | **var, varsayılan açık**, `--yes-always` ile kaldırılabiliyor | tarihî referans (~108 gün) ama en olgun/yaygın araç (5/5) |
| TextGrad | harici (metin değişkeni) | yok — kabul/ret mekanizması bile yok | araştırma (tarihî referans, 410 gün donmuş) |
| GEPA | harici (prompt bileşeni) | yok (insan), otomatik sayısal kapı var | canlı, ama 0.1.4 pre-1.0 |

(a)+(b)+(c) üçlüsünü birlikte sağlayan — yani kendi kodunu/promptunu insan kapısız değiştirip bunu üretimde güvenle çalıştıran — **tek bir proje yok**. Yalnızca DGM (a)'yı sağlıyor ve (b)'yi (kapısızlık) taşıyor, ama (c)'de açıkça çöküyor: son push 13 ay önce, canlılık testini geçemiyor, ve yazarın kendi README'si (`README.md:88`) bunu kabul edilmiş bir risk olarak tanımlıyor. Geri kalan altı proje zaten harici bir hedefi değiştirdiği için (a)'yı sağlamıyor — K7'nin sorduğu soruya aday bile değiller.

Aider'ın `confirm_ask` kapısı K7'nin **lehine** bir gözlem: yedi projenin en olgun ve en yaygın kullanılanı (olgunluk 5/5, 48.825 yıldız) bile varsayılan olarak insan onayını açık tutuyor ve kapıyı kaldırmayı kullanıcının açık, bilinçli bayrak seçimine (`--yes-always`) bağlıyor — yani endüstri pratiğinde en olgun araç bile "onaysız varsayılan" tasarlamıyor; kaldırma her zaman istisna, norm değil.

**Sonuç:** K7 çürümedi, bu turda daha da güçlendi — incelenen yedi projenin hiçbirinde "kendi kod/promptunu insan kapısız değiştirip üretimde güvenle çalışan" tek bir örnek bulunamadı.

## Dürüstlük

Bu özet yalnızca 5 analiz dosyasına (openhands.md, kendini-degistiren-sistemler.md, swe-agent.md, aider.md, textgrad-ve-gepa.md) dayanıyor; hiçbir klona doğrudan girilmedi, yeni kanıt üretilmedi, yalnızca mevcut analiz dosyalarındaki alıntılar aktarıldı.

Otomatik denetim sonucu (`DENETIM-otomatik.md`, 08.09.2026 koşusu, 5 analiz dosyası): toplam 213 alıntı, doğrulanabilir 129 alıntının %94'ü tuttu (TAM+YAKIN), 8 şüpheli. Dosya bazında: aider.md 25 alıntı/0 şüpheli, kendini-degistiren-sistemler.md 32/0, openhands.md 64/4, swe-agent.md 31/0, textgrad-ve-gepa.md 61/4. Şüpheli 8'in tamamı elle bakılmadı — protokol §4 resmî `DENETIM.md`'yi ayrı bir koşuya bırakıyor. Şüphelilerin 4'ü `openhands.md`'de (2 DOSYA-YOK: `security/confirmation_policy.py`, `local.py`; 2 TOKEN-YOK), 4'ü `textgrad-ve-gepa.md`'de ve hepsi TOKEN-YOK türünde — aracın `gepa` klonunda yanlış satırda token araması.
