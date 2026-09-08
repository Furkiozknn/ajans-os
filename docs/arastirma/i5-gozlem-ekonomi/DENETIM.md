# İ5 denetimi — kanıt doğrulaması

**Tarih:** 08.09.2026 08:40 · **Denetleyen:** canlı oturum (araştırmayı yapan iki koşudan farklı)
**Yöntem:** `node arac/kanit-dogrula.js i5-gozlem-ekonomi --yaz` (v3.1) + aracın
şüpheli dediği 32 alıntının 24'ünün klon (`D:/Repolar/_inceleme/`) ve
kullanıcının yerel depoları (`D:/Repolar/model-comparison-harness`,
`D:/Repolar/nvidia-nim-mcp`) üzerinde `sed -n` / `grep -n` ile elle kontrolü.

## Araç özeti

| Toplam | TAM | YAKIN | VAR (token'sız) | Şüpheli |
|---|---|---|---|---|
| 324 | 164 | 17 | 111 | 32 (26 TOKEN-YOK + 6 DOSYA-YOK) |

Doğrulanabilir 213 alıntının **%85**'i doğrulandı (TAM+YAKIN). Rapor:
[DENETIM-otomatik.md](DENETIM-otomatik.md). Bu iz önceki izlerden düşük
çıktı; nedeni aşağıda: şüphelilerin çoğu araç sınırı, ikisi gerçek adres hatası.

## Şüphelilerin elle kontrolü

| Alıntı | Kaynakta bulunan | Sonuç |
|---|---|---|
| model-comparison-harness.md:231, DURUM.md:164 → `grading.py:71-72` | `key = os.environ.get(provider["env"])`; `class HttpBackend` 153 | ✓ |
| model-comparison-harness.md:72 → `backends.py:39-48` | `class Backend(ABC)` … `@abstractmethod async def run(self, params: dict) -> dict` | ✓ (md imzayı sadeleştirmiş) |
| model-comparison-harness.md:13 → `pyproject.toml:6` | `license = { text = "MIT" }` | ✓ birebir |
| model-comparison-harness.md:119 → `grading.py:117-120` | `reason=f"judge returned unparseable output: {content[:200]!r}"` | ✓ birebir |
| nvidia-nim-mcp.md:187, OZET.md:30 → `nvidia_image.py:148` | `return response.choices[0].message.content, response.model` — `usage` okunmuyor | ✓ |
| nvidia-nim-mcp.md:148, DURUM.md:166 → `nvidia_image.py:612` | `(best-effort fallback verdict from {model}, not the dedicated NVIDIA safety model)` | ✓ birebir |
| OZET.md:49 → `nvidia_image.py:669` | `async def check_provider_health()` | ✓ |
| OZET.md:51 → `similarity_weighted/utils.py:11` | `OPENAI_CLIENT = OpenAI()` | ✓ (`sw_ranking`/`causal_llm` düzyazı token'ıydı) |
| OZET.md:55 → `routers.py:235-236` | `MODEL_IDS[strong_model]`, `MODEL_IDS[weak_model]` — listede olmayan model `KeyError` | ✓ |
| OZET.md:31 → RouteLLM `README.md:14` | kök README 14: "reduce costs by up to **85%**" | ✓ — araç `benchmarks/README.md`'ye bakmış (İ4'teki aynı kusur) |
| routellm.md:8 → `README.md:119` | aynı paragraf: "we focus on routing between 2 models: a stronger, more expensive model and a cheaper but weaker model" | ✓ birebir |
| litellm-router.md:68, :85 → `budget_limiter.py:5-8` | docstring: "This is a filter, like tag-routing…" | ✓ birebir |
| litellm-router.md:43 → `lowest_tpm_rpm_v2.py:434-436` | anahtar formatı 440-441: `f"{id}:{deployment_name}:tpm:{current_minute}"` | ✓ YAKIN (4 satır kaymış) |
| litellm-router.md:97 → `router.py:1247-1271` | strateji dağıtım tablosu (`RoutingStrategy.*`) — olumsuz iddia ("provider adı kontrolü yok") bağlam olarak | ✓ VAR |
| otel-genai-semconv.md:36 → `spans-deprecated.yaml:612-614` | alıntı 616-617'de: "MCP tool executions may also be traced by the corresponding MCP instrumentation" | ✓ YAKIN |
| otel-genai-semconv.md:44 → `registry-deprecated.yaml:686` | 688: `id: gen_ai.agent.id` | ✓ (`grubunda` düzyazı) |
| OZET.md:20 → `langfuse.md:119` | md'de 117-118 (`usageDetails: z.record(...)`) | ✓ YAKIN — md→md atıf, araç çözemiyor; **düzeltildi** |
| OZET.md:22 → `nvidia-nim-mcp.md:118-121`, `:168-172` | aslında **kaynak dosya** satırları: `nvidia_image.py:118-121` `_build_chat_chain` `api_base`, `:168` `VISION_PROVIDERS` | ✓ iddia doğru, gösterim yanlış (md adı yerine kaynak dosya) — **düzeltildi** |
| OZET.md:56 → `nvidia-nim-mcp.md:148` | aynı gösterim hatası; kaynak `nvidia_image.py:148` | ✓ **düzeltildi** |
| OZET.md:49 → `cooldown_cache.py:105-106` | 105-106 `get_cooldown_cache_key` (önbellek anahtarı); filtre `cooldown_handlers.py:520` `_get_cooldown_deployments`, `router.py:146-150`'de kullanılıyor | ⚠ **iddia doğru, adres yanlış** — düzeltildi |
| litellm-router.md:45 → `budget_limiter.py:341-375` | `deployment_spend` 249, `tag_spend` 261-262, `provider_spend` 370; 341-375 `_get_or_set_budget_start_time` | ⚠ **kısmen yanlış adres** — düzeltildi |
| litellm-router.md:56, :73, :85; otel-genai-semconv.md:7; OZET.md:242 sınıfındaki düzyazı token'ları | — | **bakılmadı** (8 alıntı; token'lar Türkçe düzyazı ya da yukarıdakilerin tekrarı) |

**Sonuç:** 32 şüphelinin 24'ü elle kontrol edildi: 22'si tuttu (5'i YAKIN),
2'sinde iddia doğru ama **satır adresi yanlıştı** (cooldown filtresi, bütçe
anahtarları); 3 md→md atıfta gösterim hatası vardı. Beşi de belgede
düzeltildi. **Yanlış iddia bulunmadı.** 8 şüpheliye bakılmadı.

## Neden %85 (önceki izler %91–96)

1. İki proje kullanıcının kendi deposu; klon `_inceleme/` altında değil,
   `D:/Repolar/` altında. Araç bunları çözmüş ama düzyazı token'ları
   yakalayamamış.
2. OZET.md kardeş belgelere (`langfuse.md:119` gibi) satır numarasıyla atıf
   yapıyor; araç md→md atıfları çözmüyor (6 DOSYA-YOK'un tamamı).
3. Çıplak `README.md` yine iç içe kopyaya çözüldü (İ4'te not edilen kusur;
   araca hâlâ eklenmedi).

## Araç için dersler (kanit-dogrula.js)

- Çıplak dosya adını önce depo kökünde ara (İ4'te de yazıldı, açık iş).
- `xxx.md:N` biçimindeki atıfları aynı iz klasöründeki kardeş belgede ara.
- Kullanıcı depoları için `D:/Repolar/<ad>` köküne düşme.

## Karar

İ5 izi sentezde **kullanılabilir**. Üç ana bulgu (sağlık sinyali üretmek
yetmez, karara bağlanmalı; ekonomi verisi toplanıp atılıyor; model/fiyat
kataloğu opak ya da donmuş) kaynak satırlarla tutuyor. Düzeltilen beş adres
bu commit'te.
