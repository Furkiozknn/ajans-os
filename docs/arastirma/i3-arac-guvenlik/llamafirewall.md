# LlamaFirewall

## Kimlik
meta-llama/PurpleLlama · 4.383 yıldız · 68 watcher · son push 2026-08-18 · dil Python · arşivlenmemiş
Lisans **karışık, dosyaya göre değişir**: repo kökündeki `LICENSE` (`PurpleLlama/LICENSE:1`) "LLAMA 3.2 COMMUNITY LICENSE AGREEMENT" — model ağırlıkları için Meta'nın özel (OSI olmayan, MAU eşiği olan) lisansı. İncelenen bileşen `LlamaFirewall/` alt klasörünün **kendi ayrı `LICENSE` dosyası** var ve bu **MIT** (`LlamaFirewall/LICENSE:1` "MIT License", `LlamaFirewall/LICENSE:3` "Copyright (c) Meta Platforms, Inc. and affiliates."). `diff LICENSE LlamaFirewall/LICENSE` iki dosyanın tamamen farklı olduğunu doğruladı. Yani LlamaFirewall'ın kod tarafı (paket adı `llamafirewall`, `pyproject.toml`) MIT; ama çalışma zamanında indirdiği `meta-llama/Llama-Prompt-Guard-2-86M` modeli Hugging Face üzerinde ayrı bir model lisansına tabidir (bu klonda incelenmedi).
Klon HEAD: `4be64c3` (2026-08-17). Paket sürümü `LlamaFirewall/pyproject.toml:8` → `version = "1.0.3"`.
canlılık: geçti — arşivlenmemiş, son push ≤90 gün, MIT (kod).
İnceleme kapsamı: `LlamaFirewall/src/llamafirewall/` (çekirdek, 6 tarayıcı), `LlamaFirewall/pyproject.toml`, `LlamaFirewall/tests/` (10 test dosyası), `LlamaFirewall/examples/`. Kapsam dışı: repo kökündeki Llama-Guard/Prompt-Guard model kartları, `CybersecurityBenchmarks/`, website/docs (pazarlama).

## Çözdüğü problem
Bir LLM ajanının girdi→akıl yürütme→araç çağrısı→çıktı zincirinin her adımına takılabilecek, tek bir karar sözleşmesi (allow/block/human-in-the-loop) konuşan bağımsız güvenlik denetleyicileri (scanner) kümesi. Hedef kitle: LangChain/kendi ajan çatısını yazan geliştirici; çözdüğü acı, her risk sınıfı (prompt injection, güvensiz kod üretimi, PII sızıntısı, ajanın kullanıcı niyetinden sapması) için ayrı ayrı entegrasyon yazmak yerine tek bir `LlamaFirewall.scan(message, trace)` çağrısıyla rol bazlı (`Role.USER/TOOL/ASSISTANT/...`) bir politika tablosundan geçirmek.

## Mimari
Tek giriş noktası `LlamaFirewall` sınıfı (`src/llamafirewall/llamafirewall.py:85`). Kurucu, `Role` → `List[ScannerType]` eşlemesi olan bir `Configuration` alır; varsayılan eşleme kodda gömülü (`llamafirewall.py:89-95`): `TOOL: [CODE_SHIELD, PROMPT_GUARD]`, `USER: [PROMPT_GUARD]`, `ASSISTANT: [CODE_SHIELD]`, `SYSTEM: []`, `MEMORY: []`. `scan()` çağrıldığında, mesajın `role`'üne göre o rol için tanımlı tarayıcılar sırayla (`asyncio.run` ile senkron sarmalanmış) çalıştırılır ve sonuçlar birleştirilir: birden fazla tarayıcı varsa BLOCK varsa BLOCK kazanır, yoksa en yüksek skorlu karar seçilir (`llamafirewall.py:141-160`). `scan_async` ise ilk BLOCK/HUMAN_IN_THE_LOOP'ta kısa devre yapar (`llamafirewall.py:169-181`) — yani sync ve async yol **farklı birleştirme mantığı** kullanıyor, bu tutarsızlık kodda açıklanmamış.

Altı somut tarayıcı, hepsi `Scanner` soyut sınıfından türer (`src/llamafirewall/scanners/base_scanner.py:11`, tek zorunlu metod `async def scan(message, past_trace) -> ScanResult`):

| Tarayıcı | Dosya | Girdi/çıktı/araç mı | Model bağımlılığı |
|---|---|---|---|
| PromptGuardScanner | `scanners/prompt_guard_scanner.py:19` | girdi (varsayılan `Role.USER`, `Role.TOOL`) | yerel BERT sınıflandırıcı, `meta-llama/Llama-Prompt-Guard-2-86M`, ilk çalıştırmada Hugging Face'ten indirilir (`scanners/promptguard_utils.py:44-49`, `HF_HOME` altına cache'lenir) |
| CodeShieldScanner | `scanners/code_shield_scanner.py:31` | çıktı (varsayılan `Role.ASSISTANT`, `Role.TOOL`) | model **yok** — statik analiz (`codeshield.insecure_code_detector`), Semgrep + regex kuralları, 8 dil |
| AlignmentCheckScanner | `scanners/experimental/alignmentcheck_scanner.py:37` | tüm `trace` (ajan izi) | uzak LLM, varsayılan `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` **Together AI** üzerinden (`scanners/custom_check_scanner.py:33-37`) |
| PIICheckScanner | `scanners/experimental/piicheck_scanner.py:44` | girdi/çıktı metni | uzak LLM, varsayılan `meta-llama/Llama-3.3-70B-Instruct-Turbo`, yine Together AI (`piicheck_scanner.py:45-47`) |
| RegexScanner | `scanners/regex_scanner.py:32` | herhangi bir metin | model yok — 5 sabit desen (prompt injection ifadesi, e-posta, telefon, kredi kartı, SSN) `regex_scanner.py:20-27` |
| HiddenASCIIScanner | `scanners/hidden_ascii_scanner.py:18` | herhangi bir metin | model yok — Unicode Tag karakterleri (`0xE0000-0xE007F`) aralığını tarar, gizli talimat gömme saldırısına karşı |

**Karar tipi** üç değerli enum, `llamafirewall_data_types.py:22-25`: `ALLOW`, `HUMAN_IN_THE_LOOP_REQUIRED`, `BLOCK`. Üçüncü değer LlamaFirewall'ı salt "izin ver/engelle" ikilisinden çıkarıp insan onayı kapısını **karar tipinin birinci sınıf üyesi** yapıyor — AlignmentCheckScanner tam olarak bunu döndürüyor (`alignmentcheck_scanner.py:117-120`: `conclusion == True` → `HUMAN_IN_THE_LOOP_REQUIRED`, asla otomatik `BLOCK` değil).

**"Agent alignment" izi (trace) nasıl okunuyor:** `AlignmentCheckScanner.scan()` `past_trace: Trace | None` alır (`Trace = List[Message]`, `llamafirewall_data_types.py:95`); `_pick_user_input` trace içindeki ilk `Role.USER` mesajını bulur (`alignmentcheck_scanner.py:64-68`), `_pre_process_trace` trace + mevcut mesajı düz metne çevirir (`str(message)` — `Message.__str__`, `llamafirewall_data_types.py:53-54` → `"{role}: {content}"`) ve tek bir LLM çağrısına gönderir. Karşılaştırma yalnızca **son eylem** ile **ilk kullanıcı mesajı** arasında yapılıyor; ara adımların birbiriyle tutarlılığı denetlenmiyor (sistem promptu bunu açıkça sınırlıyor: "Only consider the selected action, not the entire trace", `alignmentcheck_scanner.py:150`).

LLM çağrı katmanı `LLMClient` (`src/llamafirewall/utils/base_llm.py:21`) OpenAI Python SDK'sının `beta.chat.completions.parse` (structured output) yolunu kullanıyor; `base_url` parametrik olduğundan **teknik olarak** herhangi bir OpenAI-uyumlu uç noktaya yönlendirilebilir, ama `CustomCheckScanner` varsayılan parametreleri (`model_name`, `api_base_url="https://api.together.xyz/v1"`, `api_key_env_var="TOGETHER_API_KEY"`) doğrudan sınıf imzasına gömülü (`scanners/custom_check_scanner.py:33-37`) — kutudan çıkışta tek sağlayıcıya (Together AI) bağlı.

## Klasör yapısı
```
LlamaFirewall/
├── src/llamafirewall/
│   ├── llamafirewall.py          LlamaFirewall sınıfı: scan/scan_async/scan_replay, karar birleştirme
│   ├── llamafirewall_data_types.py  Message/Role/ScanDecision/ScanResult/Trace sözleşmesi
│   ├── config.py                 Configuration tipi + PREDEFINED_USE_CASES (chatbot, coding_assistant)
│   ├── cli/                      yalnızca kurulum: model indirme, API anahtarı ayarlama (proxy/sunucu değil)
│   ├── scanners/
│   │   ├── base_scanner.py       soyut Scanner sınıfı
│   │   ├── prompt_guard_scanner.py, promptguard_utils.py   yerel BERT modeli
│   │   ├── code_shield_scanner.py                          statik analiz (model yok)
│   │   ├── regex_scanner.py, hidden_ascii_scanner.py        kural tabanlı (model yok)
│   │   ├── custom_check_scanner.py                         LLM tabanlı tarayıcılar için soyut taban
│   │   └── experimental/         alignmentcheck_scanner.py, piicheck_scanner.py — [EXPERIMENTAL] etiketli
│   └── utils/base_llm.py         LLMClient — OpenAI-uyumlu HTTP istemci sarmalayıcı
├── tests/                        10 dosya, her tarayıcı için ayrı + test_multiple_scanners, test_replay_scan
└── examples/                     demo_*.py — LangChain agent'a nasıl bağlanacağını gösteren örnekler
```

## Ajan tasarımı
LlamaFirewall bir ajan çatısı değil; ajanı yalnızca bir **mesaj/rol/iz sözleşmesi** olarak tanır. `Message` (dataclass, `llamafirewall_data_types.py:44`) `role: Role`, `content: str`, `tool_calls: Optional[List[Dict]]` taşır; beş alt tip (`SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolMessage`, `MemoryMessage`) rolü sabitler. `Trace` bu mesajların düz bir listesidir (`Trace: TypeAlias = List[Message]`, satır 95). Ajanın kendisi (planlayıcı, araç seti, LLM'i) hiç modellenmiyor — entegre eden geliştirici, ajan çatısının her tur ürettiği mesajı doğru rolle `LlamaFirewall.scan()`'e paslamakla yükümlü (`examples/langchain_agent.py:133-134`, LangChain'in `ToolMessage`'ını LlamaFirewall'ın `Role.TOOL`'una elle eşliyor).

## Orkestrasyon / iş akışı modeli
Graf/DAG değil; **rol bazlı, sıralı politika tablosu**. Dört giriş noktası:
- `scan(message, trace)` — tek mesaj, tüm tarayıcılar çalışır, sonuçlar birleştirilir (`llamafirewall.py:106-165`).
- `scan_async(message, trace)` — ilk BLOCK/HUMAN_IN_THE_LOOP'ta durur (`llamafirewall.py:167-182`).
- `scan_replay(trace)` / `scan_replay_async` — bir izin tamamını, mesaj mesaj, o ana kadarki geçmişi `past_trace` olarak vererek tekrar tarar; ilk BLOCK veya HUMAN_IN_THE_LOOP'ta döngü kırılır (`llamafirewall.py:200-220`).
- `scan_replay_build_trace(message, stored_trace)` — canlı kullanım için: mesajı tarar, yalnızca `ALLOW` ise trace'e ekler; BLOCK/HUMAN_IN_THE_LOOP olursa trace'e **eklenmez** (`llamafirewall.py:222-241`) — yani reddedilen bir eylem ajan izinde kalıcı hâle gelmiyor.
Paralellik yalnızca CodeShieldScanner içinde var: 8 dil için `asyncio.gather` ile eşzamanlı tarama (`code_shield_scanner.py:47-52`). Tarayıcılar arası paralellik yok — rol için tanımlı liste sırayla işleniyor.

## Durum ve bellek
Kalıcı durum yok. `Trace` çağıranın bellekte tuttuğu bir Python listesi; LlamaFirewall hiçbir şeyi diske/veritabanına yazmıyor. `scan_replay_build_trace` "trace'i taşı" desenini sunuyor ama saklama sorumluluğu tamamen çağırana ait. `Role.MEMORY` bir mesaj rolü olarak tanımlı (`llamafirewall_data_types.py:39`) ama varsayılan yapılandırmada hiçbir tarayıcı atanmamış (`llamafirewall.py:93`, boş liste) — yani "ajan belleğini tara" özelliği şema düzeyinde var, varsayılan davranışta devre dışı.

## Hata yönetimi
- LLM tabanlı tarayıcılarda (`CustomCheckScanner._evaluate_with_llm`, `custom_check_scanner.py:66-75`) LLM çağrısı istisna fırlatırsa yakalanıp `_get_default_error_response()`'a düşülüyor. **Güvenli tarafa düşme kanıtlı**: AlignmentCheckScanner'ın hata yanıtı `conclusion=True` döndürüyor (`alignmentcheck_scanner.py:125-131`, yorum: "treating as potentially compromised for safety") — hata durumunda insan onayına düşülüyor, sessizce ALLOW edilmiyor.
- `scan()` çağrısında tek bir tarayıcının kendi içindeki hatası (`ScanStatus.ERROR`) tüketilmiyor — `ScanResult.status` alanı var ama `llamafirewall.py`'deki birleştirme mantığı yalnızca `decision`'a bakıyor (`llamafirewall.py:143-146`), `status == ERROR` olan bir sonuç yine de `ALLOW` kararına karışabilir çünkü hata durumunda `decision` genelde `ALLOW` set ediliyor (`alignmentcheck_scanner.py:85-90`, trace yoksa `ALLOW` + `status=ERROR`) — bu, "hata oldu ama karar ALLOW" durumunun mümkün olduğu anlamına geliyor; çağıran `status`'u ayrıca kontrol etmezse fark etmez.
- Retry/timeout/circuit-breaker yok; `LLMClient.call` (`base_llm.py:59-99`) hatayı loglayıp yeniden fırlatıyor (`raise`, satır 99), üst katmanda `except Exception` bunu yakalıyor.
- Toplu/atomik işlem yok (tek mesaj tek karar), rollback kavramı LlamaFirewall'ın kapsamında değil — geri alınacak bir "yazma" işlemi zaten yapmıyor, yalnızca karar veriyor.

## Genişletilebilirlik
Yeni bir kural-tabanlı tarayıcı eklemek: `Scanner`'dan türet, `scan()` uygula (1 dosya) + `ScannerType` enum'una gir + `create_scanner()`'a bir `elif` (`llamafirewall.py:52-77`, 2 dosya). Çekirdek bozulmadan eklenebiliyor — kanıtı `register_llamafirewall_scanner` dekoratörü (`llamafirewall.py:31-41`): dışarıdan bir sınıfı `custom_scanner_registry`'e kaydedip `create_scanner`'ı hiç değiştirmeden `ScannerType` yerine string adla çağırabiliyorsun (`demo_customized_scanner_via_open_guardrails.py` örneği). LLM tabanlı yeni tarayıcı eklemek biraz daha ucuz: `CustomCheckScanner`'dan türeyip yalnızca `system_prompt` + `output_schema` + iki dönüştürme metodu yazmak yeterli (AlignmentCheck ve PIICheck ikisi de bu yolu izliyor, ~250/~170 satır).

## Güçlü yönler (kanıtlı)
- **Üç değerli karar tipi** (`llamafirewall_data_types.py:22-25`) insan onayını "block"tan ayrı bir birinci sınıf sonuç yapıyor; AlignmentCheck bunu somut kullanıyor (`alignmentcheck_scanner.py:117-120`).
- **Hata → güvenli tarafa düşme** açıkça kodlanmış ve yorumla gerekçelendirilmiş (`alignmentcheck_scanner.py:127-129`).
- **Genişletme dekoratörü** (`register_llamafirewall_scanner`, `llamafirewall.py:31`) çekirdek `create_scanner` fonksiyonunu değiştirmeden yeni tarayıcı eklemeye izin veriyor.
- **Model yerelliği net ayrılmış**: PromptGuard ve CodeShield tamamen yerel/kural tabanlı çalışabiliyor (uzak API gerektirmiyor), yalnızca AlignmentCheck ve PIICheck uzak LLM'e bağımlı — risk profiline göre "hangi tarayıcı ağa çıkıyor" sorusu dosya bazında cevaplanabiliyor.
- **Reddedilen mesaj trace'e girmiyor** (`scan_replay_build_trace`, `llamafirewall.py:236-241`) — engellenen bir eylemin sonraki AlignmentCheck çağrılarını kirletmesi önleniyor.

## Zayıf yönler (kanıtlı)
- **Kutudan çıkışta tek LLM sağlayıcısına bağımlı**: `CustomCheckScanner` varsayılan `api_base_url="https://api.together.xyz/v1"`, `api_key_env_var="TOGETHER_API_KEY"` (`custom_check_scanner.py:33-37`) — AlignmentCheck ve PIICheck kullanmak için Together AI hesabı gerekiyor; sağlayıcı değiştirmek her çağıran kodun parametre geçmesini gerektiriyor, merkezi bir router yok.
- **`scan()` (sync) ile `scan_async()` farklı karar birleştiriyor**: sync tüm tarayıcıları çalıştırıp en yüksek skoru/BLOCK önceliğini seçiyor (`llamafirewall.py:141-160`), async ilk BLOCK/HUMAN'da kısa devre yapıyor (`llamafirewall.py:169-182`) — aynı girdi için iki yoldan farklı sonuç çıkabilir, kodda bu fark açıklanmamış/test edilmemiş görünüyor (`tests/test_multiple_scanners.py` yalnızca sync yolu test ediyor).
- **`ScanStatus.ERROR` karar birleştirmesine girmiyor**: hata olduğunu belirten `status` alanı `scan()`'in final kararına doğrudan yansımıyor, yalnızca `decision` alanı sayılıyor.
- **AlignmentCheck yalnızca son eylemi denetliyor**, ara adımların birbirine tutarlılığı veya kümülatif sapma (uzun bir izde küçük küçük sapmaların toplamı) denetlenmiyor — sistem promptu bunu açıkça sınırlıyor (`alignmentcheck_scanner.py:150`).
- **MCP/A2A veya herhangi bir protokole özgü entegrasyon yok**: repo genelinde `mcp` için tarama sıfır eşleşme verdi (`grep -rli mcp LlamaFirewall/**/*.py` → boş); "araç çağrısını araya girip otomatik denetleme" (proxy/gateway modu) hiç yok — geliştirici her ajan çatısı için elle bağlama yazmak zorunda (`examples/langchain_agent.py:133-134` örneği tek elle-bağlama).
- **AlignmentCheck ve PIICheck `[EXPERIMENTAL]` etiketli** (`custom_check_scanner.py:28`) — README'nin "production-ready" iddiasıyla (protokol §1 README'ye güvenme kuralı) çelişiyor.
- **Lisans karmaşası**: repo kökü Llama Topluluk Lisansı (OSI değil), `LlamaFirewall/` alt paketi MIT, indirilen model ağırlığı ayrı bir lisansa tabi — üç farklı hukuki rejim aynı `pip install llamafirewall` komutunun arkasında.

## Puan (1-5)
- olgunluk: 3 — çekirdek (PromptGuard, CodeShield, Regex, HiddenASCII) net ve test edilmiş; en ilginç iki tarayıcı (AlignmentCheck, PIICheck) resmen deneysel etiketli.
- mimari netlik: 4 — tek soyut `Scanner` arayüzü, rol→tarayıcı tablosu, üç değerli karar tipi; okunması kolay, 494 satırlık çekirdek dosya küçük.
- genişletilebilirlik: 4 — dekoratörle dışarıdan tarayıcı kaydı, `CustomCheckScanner` tabanı ile LLM tarayıcı eklemek ucuz.
- güvenilirlik ilkelleri: 3 — hata durumunda güvenli tarafa düşme var ve gerekçeli; ama retry/timeout yok, sync/async tutarsızlığı ve `status` alanının karara yansımaması güvenilirlik puanını düşürüyor.
- gözlemlenebilirlik: 2 — `ScanResult.reason` insan-okur açıklama döndürüyor ama yapılandırılmış trace/span, metrik veya OpenTelemetry entegrasyonu yok; `logging` modülü ile serbest metin log var.
- güvenlik duruşu: 3 — üç değerli karar ve insan-kapısı kavramı güçlü bir temel; ama tek sağlayıcıya varsayılan bağımlılık, MCP/araç-seviyesi proxy'nin olmayışı ve deneysel etiketli olması puanı sınırlıyor.

## Alınacak fikir
- **Üç değerli karar tipi (`ALLOW`/`BLOCK`/`HUMAN_IN_THE_LOOP_REQUIRED`)** (`llamafirewall_data_types.py:22-25`) — bizim Permission Manager'ının döndüreceği karar sözleşmesi için doğrudan uygulanabilir; K6'daki "insan kapısı" kavramını enum seviyesinde birinci sınıf yapıyor.
- **Hata → güvenli tarafa düşme, gerekçeyle** (`alignmentcheck_scanner.py:125-131`) — LLM tabanlı bir denetleyici çağrısı başarısız olduğunda varsayılan sonucun ALLOW değil HUMAN_IN_THE_LOOP olması; bizim Permission Manager'da her denetleyici hata yolu için aynı ilke.
- **Dekoratörle dışarıdan tarayıcı/araç denetleyici kaydı** (`register_llamafirewall_scanner`, `llamafirewall.py:31-41`) — çekirdek switch/factory fonksiyonunu değiştirmeden yeni bir güvenlik kontrolü eklemek; bizim Permission Manager'ın araç bazlı politika eklentileri için aynı desen.
- **Rol bazlı varsayılan politika tablosu** (`llamafirewall.py:89-95`) — "TOOL çıktısı her zaman en az bir statik + bir davranışsal tarayıcıdan geçer" gibi varsayılanları kod içinde açık ve denetlenebilir tutmak; bizim varsayılan salt-okuma ilkesinin (K6) somut bir uygulama şekli.
- **Reddedilen eylemin trace'e girmemesi** (`scan_replay_build_trace`, `llamafirewall.py:236-241`) — bir ajan izinde geçmeyen eylemlerin sonraki denetimleri kirletmemesi; bizim ajan trace kaydında aynı kural (yalnızca gerçekleşen/onaylı eylemler izde kalır).

## Alınmayacak
- **Kutudan çıkışta tek LLM sağlayıcısına (Together AI) sabitlenmiş varsayılan parametreler** (`custom_check_scanner.py:33-37`) — ADR-000 K4 (Model Router sınırı) ile doğrudan çelişir; bizde her denetleyici çağrısı Model Router üzerinden geçmeli, sağlayıcı adı denetleyici sınıfının imzasına gömülmemeli.
- **Sync/async yolların farklı karar birleştirme mantığı** (`llamafirewall.py:141-160` vs `167-182`) — aynı girdi için iki farklı davranış, test edilmemiş bir tutarsızlık kaynağı; bizde tek birleştirme algoritması, sync/async yalnızca çağrı biçimi farkı olmalı.
- **Proxy/gateway modunun olmayışını "yeter" saymak** — LlamaFirewall'ı olduğu gibi almak, her ajan çatısı için elle entegrasyon (`examples/langchain_agent.py:133-134`) yazmak demek; K6'nın "her araç çağrısı Permission Manager'dan geçer" gereksinimini karşılamak için LlamaFirewall'ın kendisi yetmez, ayrı bir zorunlu geçiş noktası (runtime interceptor) bizim tarafımızda yazılmalı.
- **`[EXPERIMENTAL]` etiketli tarayıcıları (AlignmentCheck, PIICheck) production karar noktası olarak birebir kullanmak** (`custom_check_scanner.py:28`) — kod kendi kendine deneysel olduğunu söylüyor; bizde bu sınıf denetleyiciler önce izlerde (trace) gölge modda çalıştırılıp ölçülmeden karar noktasına bağlanmamalı (K7'nin "kanıt → öneri → onay" akışına uygun).

## Matris cevapları
- saglayici_bagimsiz: kismen — çekirdek tarayıcılar (PromptGuard, CodeShield, Regex, HiddenASCII) tamamen sağlayıcısız/yerel; ancak AlignmentCheck ve PIICheck `LLMClient` OpenAI SDK'sını kullanıyor ve `base_url` parametrik olsa da varsayılan değerler Together AI'a sabit (`custom_check_scanner.py:33-37`) — sağlayıcı değiştirmek her tarayıcı örneğinde elle parametre geçmeyi gerektiriyor, merkezi bir router yok.
- sozlesme_var: kismen — `Message`/`Role`/`ScanResult`/`Trace` (`llamafirewall_data_types.py`) makine-okur bir veri sözleşmesi sunuyor ve `ScanDecision` enum'u karar tipini standartlaştırıyor; ama bu bir *ajan* sözleşmesi değil, yalnızca *mesaj/karar* sözleşmesi — ajanın yeteneği, izinleri, hedefi hiç modellenmiyor.
- insan_kapisi: evet — `ScanDecision.HUMAN_IN_THE_LOOP_REQUIRED` (`llamafirewall_data_types.py:24`) karar tipinin parçası ve AlignmentCheckScanner somut olarak bunu döndürüyor (`alignmentcheck_scanner.py:117-120`).
- checkpoint: hayır — kalıcı durum/iz saklama LlamaFirewall'ın kapsamında değil; `Trace` çağıranın bellekte tuttuğu geçici bir liste, diske yazma/geri yükleme yok.

## ADR-000 K6 kanıtı
**Kısmen güçlendiriyor, kısmen çürütüyor.**
- **Güçlendiriyor:** LlamaFirewall'ın üç değerli karar modeli (`llamafirewall_data_types.py:22-25`) ve AlignmentCheckScanner'ın somut olarak `HUMAN_IN_THE_LOOP_REQUIRED` üretmesi (`alignmentcheck_scanner.py:117-120`), K6'nın "geri alınamaz işlemlerde geçilemez insan kapısı" fikrinin pratikte uygulanabilir olduğunu gösteriyor — bağımsız bir projede bu tam olarak aynı üç değerli ayrımla karşımıza çıkıyor.
- **Çürütmüyor ama zayıflatıyor:** LlamaFirewall kendisi K6'nın "her araç çağrısı Permission Manager'dan geçer" cümlesini **karşılamıyor** — çünkü zorunlu bir geçiş noktası (interceptor/proxy) değil, isteğe bağlı çağrılan bir kütüphane. `grep -rli mcp` sıfır sonuç verdi ve `examples/langchain_agent.py:133-134` entegrasyonun tamamen elle, geliştiricinin insafına bırakıldığını gösteriyor. Bu, K6'yı çürütmüyor (K6 zaten "Permission Manager ayrı bir bileşen" diyor) ama şunu doğruluyor: **denetleyici kütüphanesi ile zorunlu geçiş noktası ayrı kararlardır** — LlamaFirewall'ı aynen alıp "Permission Manager" ilan etmek K6'yı yanlış uygulamak olur; üstüne bizim yazacağımız zorunlu bir interceptor katmanı gerekir.
