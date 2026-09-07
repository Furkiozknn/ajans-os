# i4-guvenilirlik — otomatik kanıt doğrulaması (v3)

*07.09.2026 22:13:43 · 75.550 dosya, 48 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 131 | 101 | 7 | 19 | 4 | 0 | 0 |

Doğrulanabilir 112 alıntının **%96**'i doğrulandı (TAM+YAKIN). Şüpheli: **4**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| langgraph.md | 72 | 51 | 7 | 10 | 4 |
| temporal.md | 59 | 50 | 0 | 9 | 0 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `langgraph.md:66` → `_loop.py:687` beklenen: `Send`, `Command` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `langgraph.md:82` → `main.py:2968` beklenen: `task.writes.append`, `append` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/main.py`
- **TOKEN-YOK** `langgraph.md:96` → `_loop.py:733-745` beklenen: `checkpoint=tam superstep sonu` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
- **TOKEN-YOK** `langgraph.md:123` → `_loop.py:960-971` beklenen: `birden fazla alternatifi paralel dene` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/_loop.py`
