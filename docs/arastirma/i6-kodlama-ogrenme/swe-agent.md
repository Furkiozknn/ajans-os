# SWE-agent

## Kimlik
repo: SWE-agent/SWE-agent · yıldız: 20274 · watcher: 113 · son push: 2026-09-07T22:17:28Z · lisans: MIT · dil: Python
canlılık: geçti (son push ≤90 gün, arşivlenmemiş, OSI lisans MIT)

Not: README.md üst kısmı (`README.md:19-20`) projenin geliştirme çabasının artık
kardeş proje `mini-swe-agent`'a kaydığını belirtiyor — canlılık testi geçse de
bu depo bakım moduna yakın olabilir.

## Çözdüğü problem
Bir GitHub issue'sunu veya serbest metin bir problem tanımını girdi alıp, bir
hedef kod deposunu (Docker/Modal gibi izole bir "deployment" içinde) inceleyip
düzenleyerek bir yama (patch/PR) üretme problemini çözüyor — orijinal olarak
SWE-bench değerlendirmesi için tasarlanmış otonom "yazılım mühendisi" ajanı.

## Mimari
`sweagent/run/run_single.py` bir `SWEEnv` (ortam) ve bir `AbstractAgent`
kurar; ortam SWE-ReX kütüphanesi (`swerex`) üzerinden bir Docker/Modal
deployment'ı ayağa kaldırır (`sweagent/environment/swe_env.py:27-28`:
`deployment: DeploymentConfig = Field(default_factory=lambda:
DockerDeploymentConfig(image="python:3.11", ...))`). Ajan, model + tool
handler + history processor bileşenlerinden oluşuyor
(`sweagent/agent/agents.py:245-246` config tipine göre `DefaultAgent` ya da
`RetryAgent` üretiyor).

## Klasör yapısı
- `sweagent/agent/` — ajan döngüsü (`agents.py`), model sarmalayıcı
  (`models.py`), problem tanımı (`problem_statement.py`), history işleme.
- `sweagent/run/` — CLI giriş noktaları (`run_single.py`, `run_batch.py`,
  `run_shell.py`) ve run-seviyeli hook'lar (`run/hooks/open_pr.py`,
  `apply_patch.py`).
- `sweagent/tools/` — araç sözleşmesi motoru: `bundle.py` (bundle
  yükleme/doğrulama), `tools.py` (ToolHandler), `commands.py`, `parsing.py`.
- kök `tools/` — her biri kendi klasöründe `config.yaml` + `bin/` script'i
  olan araç "bundle"ları (`tools/submit`, `tools/edit_anthropic`, ...).
- `sweagent/environment/` — `swe_env.py` (deployment yaşam döngüsü),
  `repo.py` (`LocalRepoConfig`, `GithubRepoConfig` — hedef repoyu deployment'a
  kopyalama/klonlama).

## Ajan tasarımı
Ana döngü `sweagent/agent/agents.py:1265-1293` (`DefaultAgent.run`):
```
step_output = StepOutput()
while not step_output.done:
    step_output = self.step()
    self.save_trajectory()
```
Sabit bir adım (step) sayacı **yok** — döngü yalnızca `step_output.done`
bayrağıyla kesiliyor. Pratikteki sınır maliyet/çağrı tabanlı:
`sweagent/agent/models.py:73-78` — `per_instance_cost_limit: float = 3.0`
(varsayılan $3), `total_cost_limit: float = 0.0` (kapalı),
`per_instance_call_limit: int = 0` (kapalı). Aşım kontrolü
`sweagent/agent/models.py:660-670`de: cost aşılırsa
`InstanceCostLimitExceededError`/`CostLimitExceededError`, çağrı sayısı
aşılırsa `InstanceCallLimitExceededError` fırlatılıyor
(`sweagent/exceptions.py:31-44`). Çıkış ayrıca şu yollardan da olabilir:
- `submit` aracı çağrısı → `sweagent/agent/agents.py:899-902`
  (`step.exit_status = "submitted"`).
- Ardışık komut zaman aşımı: `sweagent/agent/agents.py:969-971`
  (`self._n_consecutive_timeouts >= self.tools.config.max_consecutive_execution_timeouts`
  → `"Exiting agent due to too many consecutive execution timeouts"`).
- Toplam yürütme süresi aşımı: `sweagent/agent/agents.py:1018`
  (`if self._total_execution_time > self.tools.config.total_execution_timeout`).
- Format/blocklist/bash-sözdizim hatalarının tekrarı:
  `sweagent/agent/agents.py:1211-1216` (`"exit_format"`).

## Orkestrasyon / iş akışı modeli
Tek-ajan, adım-tabanlı ReAct benzeri döngü (LLM → bash/tool komutu →
gözlem). Çoklu deneme desteği `RetryAgent` (`sweagent/agent/agents.py:257`)
üzerinden var: aynı problem için birden çok deneme yapıp bir "chooser" veya
"score" retry-loop ile en iyi denemeyi seçiyor
(`sweagent/agent/agents.py:301,379-428`, `retry_loop.cost_limit` toplam
bütçeyi denemeler arasında paylaştırıyor — satır 307-310, 336). Batch modu
(`sweagent/run/run_batch.py`) çoklu instance'ı paralel worker'larla koşturuyor;
`human`/`human_thought` modeliyle paralel çalışma engelleniyor
(`sweagent/run/run_batch.py:163-164`).

## Durum ve bellek
Bellek yönetimi `sweagent/agent/history_processors.py`'de tanımlı
sınıflarla yapılıyor: `LastNObservations` (satır 85, son N gözlemi tutup
gerisini budama), `ClosedWindowHistoryProcessor` (satır 215, "pencere" tabanlı
görüntüleme araçlarında eski pencere içeriğini gizleme),
`CacheControlHistoryProcessor` (satır 261, prompt-cache noktaları ekleme),
`RemoveRegex` (satır 305). Kalıcı durum yok — her instance için bağımsız bir
trajectory dosyasına yazılıyor (`self.save_trajectory()`,
`sweagent/agent/agents.py:1284`).

## Hata yönetimi
- **Retry (model çağrısı seviyesinde):** `tenacity.RetryError` yakalanıyor,
  `sweagent/agent/agents.py:1187-1189` — üstel bekleme parametreleri
  `min_wait`/`max_wait` `sweagent/agent/models.py:60-63`de tanımlı.
- **Timeout (komut seviyesinde):** `CommandTimeoutError` yakalanıyor,
  ardışık sayaç `_n_consecutive_timeouts` artıyor
  (`sweagent/agent/agents.py:965-989`), `max_consecutive_execution_timeouts`
  aşılırsa oturum kesin sonlandırılıyor.
- **Bütçe aşımı:** `CostLimitExceededError`/`TotalCostLimitExceededError`
  yakalanıp otomatik "submission" ile çıkış yapılıyor
  (`sweagent/agent/agents.py:1180-1182`, `handle_error_with_autosubmission`
  tanımı satır 1076).
- **Ortam hatası:** `SwerexException` yakalanıp `"exit_environment_error"`
  ile temiz çıkış (`sweagent/agent/agents.py:1193-1198`).
- **Bilinmeyen hata:** genel `except Exception` yakalanıp
  `"exit_error"` ile otomatik teslim (satır 1204-1209) — yani sınıflandırılmamış
  hatalarda bile ajan çökmüyor, elindeki en son yamayı teslim edip çıkıyor.

## Genişletilebilirlik
Araç sözleşmesi Python değil **YAML bundle**: her bundle bir klasör,
içinde `config.yaml` (araç adı/imza/docstring/argümanlar,
`sweagent/tools/bundle.py:14-17` `BundleConfig`) ve `bin/` altında
çalıştırılabilir bir script (`tools/edit_anthropic/bin/str_replace_editor`
gibi). Yeni bir araç eklemek için dokunulması gereken yer sayısı **2**:
(1) yeni `tools/<isim>/config.yaml` + `bin/<script>` (yeni klasör, mevcut
dosya değil), (2) agent yaml'ında `agent.tools.bundles` listesine bir satır
(`config/default.yaml:41-44`, örn. `- path: tools/edit_anthropic`). Çekirdek
Python koduna dokunmaya gerek yok.

## Güçlü yönler (kanıtlı)
- Çıkış koşulları tek bir yerde toplanmış ve kapsamlı: bütçe, çağrı sayısı,
  ardışık timeout, toplam süre, format hatası tekrarı, submit — hepsi
  `sweagent/agent/agents.py:1062-1216` içindeki `forward_with_handling`'de.
- Hata durumunda bile "sessiz çökme" yok; her istisna sınıfı ayrı yakalanıp
  otomatik teslim/temiz çıkışla sonlandırılıyor (`handle_error_with_autosubmission`,
  satır 1076-1216).
- Araç ekleme gerçekten düşük sürtünmeli: config.yaml + script + tek satır
  kayıt (`sweagent/tools/bundle.py`, `config/default.yaml:41-44`).
- Yürütme, hedef repodan izole bir deployment (varsayılan Docker container,
  `sweagent/environment/swe_env.py:27-28`) içinde oluyor; ajanın kendi
  kaynak koduna erişimi mimari olarak ayrılmış (bkz. K7/kendi kodu bölümü).

## Zayıf yönler (kanıtlı)
- Sabit bir adım sayısı sınırı yok; tek koruma dolar bazlı maliyet limiti
  (`per_instance_cost_limit=3.0`, `sweagent/agent/models.py:73-76`) ve
  `per_instance_call_limit=0` (kapalı) — yanlış yapılandırılmış bir modelle
  (ör. limitler sıfırlanmış) döngü teorik olarak çok uzayabilir.
- `open_pr` hook'u (`sweagent/run/hooks/open_pr.py:24-`) etkinleştirildiğinde
  gerçek bir GitHub branch'i push edip PR açıyor; kodda hiçbir onay/dry-run
  sorgusu yok (`_dry_run` parametresi var ama çağrı yerinde kullanılmıyor,
  satır 143-148). Kod içinde `# NOTE / THE IMPLEMENTATION DETAILS HERE WILL
  CHANGE SOON!` uyarısı var (satır 19-20) — bu yolun kararlı olmadığının
  proje içi kanıtı.
- README projenin geliştirme odağının `mini-swe-agent`'a kaydığını söylüyor
  (`README.md:19-20`) — bu depo aktif ana hat olmayabilir.

## K7 sınaması (insan kapısı)
**Yok.** `grep -rn "confirm\|approval\|human\|interactive"` taraması
(`sweagent/agent`, `sweagent/run`, `sweagent/tools`, `sweagent/environment`,
`tools`) onay/insan-kapısı mekanizması döndürmedi. Bulunan "human" eşleşmeleri
bir *onay noktası* değil, isteğe bağlı bir **model türü**: `human`/
`human_thought` (`sweagent/agent/models.py:237,250`) kullanıcının LLM
yerine kendisinin komut yazdığı bir hata ayıklama modu
(`sweagent/agent/extra/shell_agent.py:31-46`, Ctrl+D ile açılıp kapanıyor).
Varsayılan otomatik akışta (`config/default.yaml`, gerçek bir API modeliyle)
hiçbir adımda kullanıcı onayı beklenmiyor — döngü, model + araç + ortam
üçgeninde tamamen otonom çalışıyor ve `open_pr` etkinleştirilirse gerçek bir
dış etkiye (PR açma) kadar onaysız gidiyor.

## Puan (1–5)
olgunluk: 4 · mimari netlik: 4 · genişletilebilirlik: 4 · güvenilirlik ilkelleri: 3 · gözlemlenebilirlik: 3 · güvenlik duruşu: 2

## Alınacak fikir
Bundle deseni (klasör = config.yaml + bin/script, tek satır kayıt) — yeni
araç eklemenin çekirdek koda dokunmadan, iki dosya + bir config satırıyla
mümkün olması, ADR-000'ın genişletilebilirlik hedefi için doğrudan
uygulanabilir bir kalıp. Ayrıca `handle_error_with_autosubmission` deseni
(her istisna sınıfını ayrı yakalayıp elde ne varsa onunla temiz çıkış) hata
yönetimi ilkesi olarak alınabilir.

## Alınmayacak
`open_pr` hook'unun onaysız, dry-run'ı fiilen çalışmayan tasarımı — ADR-000
K7 (insan kapısı) ilkesiyle doğrudan çelişiyor; dışarı açılan bir eylem
(PR açma) hiçbir onay adımı olmadan varsayılan config'e kolayca eklenebilir
bir hook olarak duruyor. Sabit adım sayısı yerine yalnızca dolar bütçesine
güvenmek de alınmamalı — bütçe yanlış ayarlanırsa döngü sınırsız uzayabilir.

## Dürüstlük
`sweagent/inspector/`, `sweagent/utils/`, `tests/`, `docs/`, `trajectories/`,
`assets/` klasörlerine hiç girilmedi (kapsam dışı bırakıldı). `config/`
altında yalnızca `default.yaml` incelendi; diğer ~10 yaml (`bash_only.yaml`,
`coding_challenge.yaml`, `sweagent_0_7/` vb.) okunmadı. `tools/` altındaki
~15 bundle'dan yalnızca `submit` ve `edit_anthropic` örneklendi, diğerleri
(`search`, `forfeit`, `windowed*`, `web_browser`, `image_tools`,
`multilingual_setup`, `diff_state`, `filemap`) açılmadı — "yeni araç kaç
dosyaya dokunur" cevabı bu iki örnekten genellenmiştir. `RetryAgent`/
`ChooserRetryLoop`/`ScoreRetryLoop`'un iç mantığı (`sweagent/agent/extra/`
altında olması muhtemel) satır satır izlenmedi, yalnızca çağrı noktaları
görüldü. `sweagent/run/run.py` diye ayrı bir dosya bulunamadı (yalnızca
`run_single.py`, `run_batch.py` vb. var); "run.py" referansı görev
talimatındaki varsayımdı, gerçek dosya adları farklı. Ajanın "kendi kodunu
değiştirme" sorusu doğrudan negatif kanıtla değil, mimari ayrımla
(deployment hedef repoyu izole bir kapta çalıştırıyor, SWE-agent kaynağı
host'ta kalıyor — `sweagent/environment/repo.py:109-182`) dolaylı olarak
yanıtlandı; kodda "SWE-agent kendi kaynağını asla değiştirmez" diyen açık
bir guard aranmadı ve bulunmadı.
