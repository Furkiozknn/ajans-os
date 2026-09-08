# i6-kodlama-ogrenme — otomatik kanıt doğrulaması (v3)

*08.09.2026 08:20:57 · 102.690 dosya, 63 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 250 | 133 | 15 | 92 | 8 | 0 | 2 |

Doğrulanabilir 158 alıntının **%94**'i doğrulandı (TAM+YAKIN). Şüpheli: **10**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| DURUM.md | 0 | 0 | 0 | 0 | 0 |
| OZET.md | 37 | 26 | 1 | 8 | 2 |
| aider.md | 25 | 22 | 1 | 2 | 0 |
| kendini-degistiren-sistemler.md | 32 | 8 | 2 | 22 | 0 |
| openhands.md | 64 | 25 | 2 | 33 | 4 |
| swe-agent.md | 31 | 10 | 5 | 16 | 0 |
| textgrad-ve-gepa.md | 61 | 42 | 4 | 11 | 4 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `OZET.md:63` → `README.md:88` beklenen: `multiprocessing` · bakılan: `openevolve/examples/algotune/README.md`
- **TOKEN-YOK** `OZET.md:71` → `acceptance.py:49` beklenen: `is_compiled_self_improve`, `get_full_eval_threshold` · bakılan: `gepa/src/gepa/strategies/acceptance.py`
- **DOSYA-YOK** `openhands.md:48` → `.../security/confirmation_policy.py:9`
- **DOSYA-YOK** `openhands.md:50` → `.../local.py:17`
- **TOKEN-YOK** `openhands.md:113` → `state.py:344` beklenen: `LocalConversation` · bakılan: `gepa/src/gepa/core/state.py`
- **TOKEN-YOK** `openhands.md:137` → `agent.py:1059-1062` beklenen: `NeverConfirm` · bakılan: `dapr-agents/dapr_agents/workflow/runners/agent.py`
- **TOKEN-YOK** `textgrad-ve-gepa.md:68` → `src/gepa/core/state.py:217` beklenen: `GEPAAdapter`, `Protocol` · bakılan: `gepa/src/gepa/core/state.py`
- **TOKEN-YOK** `textgrad-ve-gepa.md:68` → `src/gepa/core/adapter.py:83` beklenen: `ReflectiveMutationProposer` · bakılan: `gepa/src/gepa/core/adapter.py`
- **TOKEN-YOK** `textgrad-ve-gepa.md:68` → `src/gepa/proposer/reflective_mutation/reflective_mutation.py:44` beklenen: `AcceptanceCriterion` · bakılan: `gepa/src/gepa/proposer/reflective_mutation/reflective_mutation.py`
- **TOKEN-YOK** `textgrad-ve-gepa.md:117` → `src/gepa/core/state.py:447` beklenen: `GEPAEngine` · bakılan: `gepa/src/gepa/core/state.py`
