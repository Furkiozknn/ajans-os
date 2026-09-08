# i5-gozlem-ekonomi — otomatik kanıt doğrulaması (v3)

*08.09.2026 03:41:45 · 94.824 dosya, 55 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 201 | 98 | 10 | 84 | 9 | 0 | 0 |

Doğrulanabilir 117 alıntının **%92**'i doğrulandı (TAM+YAKIN). Şüpheli: **9**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| langfuse.md | 42 | 31 | 2 | 9 | 0 |
| model-comparison-harness.md | 65 | 19 | 2 | 40 | 4 |
| nvidia-nim-mcp.md | 28 | 9 | 2 | 15 | 2 |
| otel-genai-semconv.md | 66 | 39 | 4 | 20 | 3 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `model-comparison-harness.md:13` → `pyproject.toml:6` beklenen: `license={ text=\` · bakılan: `model-comparison-harness/pyproject.toml`
- **TOKEN-YOK** `model-comparison-harness.md:72` → `backends.py:39-48` beklenen: `async run(params) -> dict` · bakılan: `model-comparison-harness/src/model_comparison_harness/backends.py`
- **TOKEN-YOK** `model-comparison-harness.md:119` → `grading.py:117-120` beklenen: `"judge returned unparseable output: ..."`, `judge returned unparseable output: ...` · bakılan: `model-comparison-harness/src/model_comparison_harness/grading.py`
- **TOKEN-YOK** `model-comparison-harness.md:231` → `grading.py:71-72` beklenen: `HttpBackend` · bakılan: `model-comparison-harness/src/model_comparison_harness/grading.py`
- **TOKEN-YOK** `nvidia-nim-mcp.md:148` → `nvidia_image.py:612` beklenen: `ekliyor (` · bakılan: `nvidia-nim-mcp/nvidia_image.py`
- **TOKEN-YOK** `nvidia-nim-mcp.md:187` → `nvidia_image.py:148` beklenen: `usage` · bakılan: `nvidia-nim-mcp/nvidia_image.py`
- **TOKEN-YOK** `otel-genai-semconv.md:7` → `docs/gen-ai/README.md:10` beklenen: `` ve `docs/gen-ai/README.md:10` ``, `README` · bakılan: `semantic-conventions/docs/gen-ai/README.md`
- **TOKEN-YOK** `otel-genai-semconv.md:36` → `spans-deprecated.yaml:612-614` beklenen: `"MCP tool executions may also be traced by the corresponding MCP instrumentation"`, `MCP tool executions may also be traced by the corresponding MCP instrumentation` · bakılan: `semantic-conventions/model/gen-ai/deprecated/spans-deprecated.yaml`
- **TOKEN-YOK** `otel-genai-semconv.md:44` → `registry-deprecated.yaml:686` beklenen: `grubunda` · bakılan: `semantic-conventions/model/gen-ai/deprecated/registry-deprecated.yaml`
