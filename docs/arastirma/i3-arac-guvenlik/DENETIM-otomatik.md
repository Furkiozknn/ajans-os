# i3-arac-guvenlik — otomatik kanıt doğrulaması (v3)

*07.09.2026 17:51:13 · 71.871 dosya, 42 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 256 | 73 | 13 | 161 | 9 | 0 | 0 |

Doğrulanabilir 95 alıntının **%91**'i doğrulandı (TAM+YAKIN). Şüpheli: **9**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| OZET.md | 37 | 4 | 0 | 33 | 0 |
| a2a-spec.md | 36 | 3 | 0 | 31 | 2 |
| e2b.md | 30 | 21 | 0 | 7 | 2 |
| llamafirewall.md | 66 | 30 | 11 | 22 | 3 |
| mcp-scan.md | 21 | 2 | 1 | 18 | 0 |
| mcp-spec.md | 7 | 2 | 1 | 4 | 0 |
| mcp-vet.md | 39 | 8 | 0 | 29 | 2 |
| microsandbox.md | 20 | 3 | 0 | 17 | 0 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `a2a-spec.md:227` → `specification.md:1908-1913` beklenen: `a2a.proto:206-207`, `proto:206-207` · bakılan: `A2A/docs/specification.md`
- **TOKEN-YOK** `a2a-spec.md:256` → `specification.md:1921-1933` beklenen: `a2a.proto:206-207`, `proto:206-207` · bakılan: `A2A/docs/specification.md`
- **TOKEN-YOK** `e2b.md:9` → `README.md:20` beklenen: `firecracker`, `microvm`, `hypervisor` · bakılan: `E2B/packages/cli/README.md`
- **TOKEN-YOK** `e2b.md:59` → `sandbox_api.py:861-863` beklenen: `ValueError` · bakılan: `E2B/packages/python-sdk/e2b/sandbox/sandbox_api.py`
- **TOKEN-YOK** `llamafirewall.md:20` → `scanners/prompt_guard_scanner.py:19` beklenen: `Role.USER`, `USER`, `Role.TOOL`, `TOOL` · bakılan: `PurpleLlama/LlamaFirewall/src/llamafirewall/scanners/prompt_guard_scanner.py`
- **TOKEN-YOK** `llamafirewall.md:89` → `custom_check_scanner.py:28` beklenen: `production-ready` · bakılan: `PurpleLlama/LlamaFirewall/src/llamafirewall/scanners/custom_check_scanner.py`
- **TOKEN-YOK** `llamafirewall.md:110` → `examples/langchain_agent.py:133-134` beklenen: `yeter` · bakılan: `PurpleLlama/LlamaFirewall/examples/langchain_agent.py`
- **TOKEN-YOK** `mcp-vet.md:163` → `server.py:13` beklenen: `network.external`, `external`, `process.spawn`, `spawn` · bakılan: `mcp-vet/tests/fixtures/clean_server/server.py`
- **TOKEN-YOK** `mcp-vet.md:177` → `models.py:34-40` beklenen: `UNEXPLAINED` · bakılan: `mcp-vet/mcp_vet/models.py`
