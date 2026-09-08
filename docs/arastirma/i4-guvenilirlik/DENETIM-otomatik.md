# i4-guvenilirlik — otomatik kanıt doğrulaması (v3)

*08.09.2026 03:19:31 · 75.611 dosya, 48 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 410 | 254 | 18 | 119 | 19 | 0 | 0 |

Doğrulanabilir 291 alıntının **%93**'i doğrulandı (TAM+YAKIN). Şüpheli: **19**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| DURUM.md | 9 | 1 | 0 | 8 | 0 |
| OZET.md | 40 | 7 | 1 | 30 | 2 |
| dbos-transact-py.md | 68 | 52 | 5 | 10 | 1 |
| dspy.md | 33 | 22 | 1 | 4 | 6 |
| instructor.md | 50 | 30 | 3 | 15 | 2 |
| langgraph.md | 72 | 51 | 7 | 10 | 4 |
| portkey-gateway.md | 42 | 29 | 0 | 11 | 2 |
| reflexion.md | 37 | 12 | 1 | 22 | 2 |
| temporal.md | 59 | 50 | 0 | 9 | 0 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `OZET.md:242` → `agents.py:113` beklenen: `self.reflections +=[...]` · bakılan: `reflexion/hotpotqa_runs/agents.py`
- **TOKEN-YOK** `OZET.md:298` → `programming_runs/reflexion.py:43` beklenen: `reask_handler`, `reward_fn` · bakılan: `reflexion/programming_runs/reflexion.py`
- **TOKEN-YOK** `dbos-transact-py.md:77` → `dbos/_core.py:2552-2555` beklenen: `Don't record an outcome — let the step be re-run on resume.` · bakılan: `dbos-transact-py/dbos/_core.py`
- **TOKEN-YOK** `dspy.md:7` → `pyproject.toml:14` beklenen: `the framework for _programming—rather than prompting—language models_`, `_programming`, `models_` · bakılan: `dspy/.github/.internal_dspyai/pyproject.toml`
- **TOKEN-YOK** `dspy.md:11` → `README.md:16` beklenen: `signature` · bakılan: `dspy/docs/README.md`
- **TOKEN-YOK** `dspy.md:11` → `README.md:49` beklenen: `Refine`, `BestOfN` · bakılan: `dspy/docs/README.md`
- **TOKEN-YOK** `dspy.md:27` → `dspy/predict/best_of_n.py:56-59` beklenen: `ReAct` · bakılan: `dspy/dspy/predict/best_of_n.py`
- **TOKEN-YOK** `dspy.md:61` → `dspy/predict/best_of_n.py:77-81` beklenen: `raises an error after the first failure` · bakılan: `dspy/dspy/predict/best_of_n.py`
- **TOKEN-YOK** `dspy.md:90` → `base_module.py:171` beklenen: `Evaluate`, `Refine` · bakılan: `dspy/dspy/primitives/base_module.py`
- **TOKEN-YOK** `instructor.md:47` → `instructor/v2/core/retry.py:363-369` beklenen: `checkpoint` · bakılan: `instructor/instructor/v2/core/retry.py`
- **TOKEN-YOK** `instructor.md:55` → `instructor/v2/core/retry.py:274-283` beklenen: `kurulur (`, `). Yani` · bakılan: `instructor/instructor/v2/core/retry.py`
- **TOKEN-YOK** `langgraph.md:66` → `_loop.py:692` beklenen: `Send`, `Command` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `langgraph.md:82` → `main.py:2968` beklenen: `task.writes.append`, `append` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/main.py`
- **TOKEN-YOK** `langgraph.md:96` → `_loop.py:733-745` beklenen: `checkpoint=tam superstep sonu` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `langgraph.md:123` → `_loop.py:960-971` beklenen: `birden fazla alternatifi paralel dene` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `portkey-gateway.md:66` → `requestContext.ts:151-152` beklenen: `max 5` · bakılan: `portkey-gateway/src/handlers/services/requestContext.ts`
- **TOKEN-YOK** `portkey-gateway.md:121` → `handlerUtils.ts:646-659` beklenen: `cbConfig`, `handleCircuitBreakerResponse` · bakılan: `portkey-gateway/src/handlers/handlerUtils.ts`
- **TOKEN-YOK** `reflexion.md:219` → `agents.py:113` beklenen: `self.reflections +=[...]` · bakılan: `reflexion/hotpotqa_runs/agents.py`
- **TOKEN-YOK** `reflexion.md:295` → `reflexion.py:29-31` beklenen: `checkpoint` · bakılan: `reflexion/programming_runs/reflexion.py`
