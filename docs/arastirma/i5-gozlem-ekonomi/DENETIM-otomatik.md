# i5-gozlem-ekonomi — otomatik kanıt doğrulaması (v3)

*08.09.2026 04:37:43 · 94.843 dosya, 55 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 304 | 158 | 17 | 105 | 21 | 0 | 3 |

Doğrulanabilir 199 alıntının **%88**'i doğrulandı (TAM+YAKIN). Şüpheli: **24**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| DURUM.md | 11 | 1 | 0 | 3 | 7 |
| langfuse.md | 42 | 31 | 2 | 9 | 0 |
| litellm-router.md | 46 | 26 | 6 | 7 | 7 |
| model-comparison-harness.md | 65 | 19 | 2 | 40 | 4 |
| nvidia-nim-mcp.md | 28 | 9 | 2 | 15 | 2 |
| otel-genai-semconv.md | 76 | 45 | 4 | 24 | 3 |
| routellm.md | 36 | 27 | 1 | 7 | 1 |

## Şüpheli alıntılar (elle bak)

- **DOSYA-YOK** `DURUM.md:76` → `semantic-conventions/CHANGELOG.md:118-122`
- **DOSYA-YOK** `DURUM.md:79` → `semantic-conventions/docs/gen-ai/gen-ai-spans.md:5`
- **DOSYA-YOK** `DURUM.md:160` → `model-comparison-harness/pyproject.toml:6` beklenen: `license={ text="MIT" }`
- **TOKEN-YOK** `DURUM.md:161` → `backends.py:39-48` beklenen: `async def run(self, params: ...) -> dict[str, Any]` · bakılan: `NeMo-Guardrails/nemoguardrails/library/hf_classifier/backends.py`
- **TOKEN-YOK** `DURUM.md:163` → `grading.py:117-120` beklenen: `"judge returned unparseable output: ..."`, `judge returned unparseable output: ...` · bakılan: `model-comparison-harness/src/model_comparison_harness/grading.py`
- **TOKEN-YOK** `DURUM.md:164` → `grading.py:71-72` beklenen: `HttpBackend` · bakılan: `model-comparison-harness/src/model_comparison_harness/grading.py`
- **TOKEN-YOK** `DURUM.md:166` → `nvidia_image.py:612` beklenen: `"(best-effort fallback verdict from {model}, ...)"`, `(best-effort fallback verdict from {model}, ...)` · bakılan: `nvidia-nim-mcp/nvidia_image.py`
- **TOKEN-YOK** `litellm-router.md:43` → `litellm/router_strategy/lowest_tpm_rpm_v2.py:434-436` beklenen: `f"{id}:{deployment_name}:tpm:{HH-MM}"`, `{id}:{deployment_name}:tpm:{HH-MM}` · bakılan: `litellm/litellm/router_strategy/lowest_tpm_rpm_v2.py`
- **TOKEN-YOK** `litellm-router.md:45` → `litellm/router_strategy/budget_limiter.py:341-375` beklenen: `deployment_spend:{id}:{duration}`, `tag_spend:{tag}:{duration}` · bakılan: `litellm/litellm/router_strategy/budget_limiter.py`
- **TOKEN-YOK** `litellm-router.md:56` → `litellm/router.py:1247-1271` beklenen: `if provider=="..."` · bakılan: `litellm/litellm/router.py`
- **TOKEN-YOK** `litellm-router.md:68` → `litellm/router_strategy/budget_limiter.py:5-8` beklenen: `_filter_out_deployments_above_budget` · bakılan: `litellm/litellm/router_strategy/budget_limiter.py`
- **TOKEN-YOK** `litellm-router.md:73` → `litellm/router.py:10323` beklenen: `%100 soyut` · bakılan: `litellm/litellm/router.py`
- **TOKEN-YOK** `litellm-router.md:85` → `litellm/router_strategy/budget_limiter.py:5-8` beklenen: `budget_limiter` · bakılan: `litellm/litellm/router_strategy/budget_limiter.py`
- **TOKEN-YOK** `litellm-router.md:97` → `litellm/router.py:1247-1271` beklenen: `model_info["id"]` · bakılan: `litellm/litellm/router.py`
- **TOKEN-YOK** `model-comparison-harness.md:13` → `pyproject.toml:6` beklenen: `license={ text=\` · bakılan: `model-comparison-harness/pyproject.toml`
- **TOKEN-YOK** `model-comparison-harness.md:72` → `backends.py:39-48` beklenen: `async run(params) -> dict` · bakılan: `model-comparison-harness/src/model_comparison_harness/backends.py`
- **TOKEN-YOK** `model-comparison-harness.md:119` → `grading.py:117-120` beklenen: `"judge returned unparseable output: ..."`, `judge returned unparseable output: ...` · bakılan: `model-comparison-harness/src/model_comparison_harness/grading.py`
- **TOKEN-YOK** `model-comparison-harness.md:231` → `grading.py:71-72` beklenen: `HttpBackend` · bakılan: `model-comparison-harness/src/model_comparison_harness/grading.py`
- **TOKEN-YOK** `nvidia-nim-mcp.md:148` → `nvidia_image.py:612` beklenen: `ekliyor (` · bakılan: `nvidia-nim-mcp/nvidia_image.py`
- **TOKEN-YOK** `nvidia-nim-mcp.md:187` → `nvidia_image.py:148` beklenen: `usage` · bakılan: `nvidia-nim-mcp/nvidia_image.py`
- **TOKEN-YOK** `otel-genai-semconv.md:7` → `docs/gen-ai/README.md:10` beklenen: `` ve `docs/gen-ai/README.md:10` ``, `README` · bakılan: `semantic-conventions/docs/gen-ai/README.md`
- **TOKEN-YOK** `otel-genai-semconv.md:36` → `spans-deprecated.yaml:612-614` beklenen: `"MCP tool executions may also be traced by the corresponding MCP instrumentation"`, `MCP tool executions may also be traced by the corresponding MCP instrumentation` · bakılan: `semantic-conventions/model/gen-ai/deprecated/spans-deprecated.yaml`
- **TOKEN-YOK** `otel-genai-semconv.md:44` → `registry-deprecated.yaml:686` beklenen: `grubunda` · bakılan: `semantic-conventions/model/gen-ai/deprecated/registry-deprecated.yaml`
- **TOKEN-YOK** `routellm.md:8` → `README.md:119` beklenen: `we focus on routing between 2 models: a stronger, more expensive model and a cheaper but weaker model` · bakılan: `RouteLLM/README.md`
