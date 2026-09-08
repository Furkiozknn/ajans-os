# i4-guvenilirlik — otomatik kanıt doğrulaması (v3)

*07.09.2026 22:37:58 · 75.569 dosya, 48 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 238 | 173 | 14 | 40 | 11 | 0 | 0 |

Doğrulanabilir 198 alıntının **%94**'i doğrulandı (TAM+YAKIN). Şüpheli: **11**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| DURUM.md | 9 | 1 | 0 | 8 | 0 |
| dbos-transact-py.md | 67 | 50 | 6 | 9 | 2 |
| dspy.md | 31 | 21 | 1 | 4 | 5 |
| langgraph.md | 72 | 51 | 7 | 10 | 4 |
| temporal.md | 59 | 50 | 0 | 9 | 0 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `dbos-transact-py.md:50` → `dbos/_core.py:2571-2591` beklenen: `operation_outputs`, `RecordedResult` · bakılan: `dbos-transact-py/dbos/_core.py`
- **TOKEN-YOK** `dbos-transact-py.md:77` → `dbos/_core.py:2550-2553` beklenen: `Don't record an outcome — let the step be re-run on resume.` · bakılan: `dbos-transact-py/dbos/_core.py`
- **TOKEN-YOK** `dspy.md:7` → `pyproject.toml:14` beklenen: `the framework for _programming—rather than prompting—language models_`, `_programming`, `models_` · bakılan: `dspy/.github/.internal_dspyai/pyproject.toml`
- **TOKEN-YOK** `dspy.md:11` → `README.md:16-18` beklenen: `Refine`, `BestOfN`, `signature` · bakılan: `dspy/docs/README.md`
- **TOKEN-YOK** `dspy.md:27` → `dspy/predict/best_of_n.py:59-62` beklenen: `ReAct` · bakılan: `dspy/dspy/predict/best_of_n.py`
- **TOKEN-YOK** `dspy.md:61` → `dspy/predict/best_of_n.py:77-81` beklenen: `raises an error after the first failure` · bakılan: `dspy/dspy/predict/best_of_n.py`
- **TOKEN-YOK** `dspy.md:90` → `base_module.py:171` beklenen: `Evaluate`, `Refine` · bakılan: `dspy/dspy/primitives/base_module.py`
- **TOKEN-YOK** `langgraph.md:66` → `_loop.py:692` beklenen: `Send`, `Command` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `langgraph.md:82` → `main.py:2968` beklenen: `task.writes.append`, `append` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/main.py`
- **TOKEN-YOK** `langgraph.md:96` → `_loop.py:733-745` beklenen: `checkpoint=tam superstep sonu` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `langgraph.md:123` → `_loop.py:960-971` beklenen: `birden fazla alternatifi paralel dene` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
