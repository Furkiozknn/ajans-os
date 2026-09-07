# i2-bellek — otomatik kanıt doğrulaması (v3)

*07.09.2026 12:29:36 · 58.805 dosya, 32 depo · araç: arac/kanit-dogrula.js*

## Özet

| Toplam | TAM | YAKIN | VAR | TOKEN-YOK ⚠️ | EOF ⚠️ | DOSYA-YOK ⚠️ |
|---|---|---|---|---|---|---|
| 384 | 227 | 23 | 122 | 12 | 0 | 0 |

Doğrulanabilir 262 alıntının **%95**'i doğrulandı (TAM+YAKIN). Şüpheli: **12**. Araç karar vermez; şüpheliler elle bakılır.

## Dosya bazında

| Dosya | Toplam | TAM | YAKIN | VAR | ⚠️ |
|---|---|---|---|---|---|
| OZET.md | 30 | 7 | 2 | 20 | 1 |
| cognee.md | 37 | 26 | 4 | 6 | 1 |
| graphiti.md | 49 | 42 | 2 | 5 | 0 |
| graphrag.md | 17 | 14 | 0 | 1 | 2 |
| letta.md | 28 | 14 | 4 | 8 | 2 |
| lightrag.md | 61 | 24 | 4 | 31 | 2 |
| llamaindex.md | 66 | 50 | 2 | 13 | 1 |
| mem0.md | 96 | 50 | 5 | 38 | 3 |

## Şüpheli alıntılar (elle bak)

- **TOKEN-YOK** `OZET.md:96` → `main.py:2113-2122` beklenen: `expiration_date` · bakılan: `langgraph/libs/langgraph/langgraph/pregel/main.py`
- **TOKEN-YOK** `cognee.md:54` → `upsert_nodes.py:19` beklenen: `DataPoint.id_for`, `id_for` · bakılan: `cognee/cognee/modules/graph/methods/upsert_nodes.py`
- **TOKEN-YOK** `graphrag.md:56` → `config/models/local_search_config.py:46` beklenen: `data_max_tokens=12_000`, `data_max_tokens`, `12_000` · bakılan: `graphrag/packages/graphrag/graphrag/config/models/local_search_config.py`
- **TOKEN-YOK** `graphrag.md:61` → `cli/index.py:115` beklenen: `connection_string`, `container_name`, `organization` · bakılan: `graphrag/packages/graphrag/graphrag/cli/index.py`
- **TOKEN-YOK** `letta.md:64` → `letta/errors.py:48` beklenen: `ApprovalRequestMessage` · bakılan: `letta@origin/archive/letta/errors.py`
- **TOKEN-YOK** `letta.md:66` → `block_manager.py:275` beklenen: `delete_agent_passage_by_id_async`, `delete_all_messages_for_agent_async` · bakılan: `letta@origin/archive/letta/services/block_manager.py`
- **TOKEN-YOK** `lightrag.md:23` → `prompt.py:145` beklenen: `gleaning` · bakılan: `LightRAG/lightrag/prompt.py`
- **TOKEN-YOK** `lightrag.md:81` → `prompt.py:127` beklenen: `gleaning` · bakılan: `LightRAG/lightrag/prompt.py`
- **TOKEN-YOK** `llamaindex.md:117` → `fact.py:144-147` beklenen: `VectorMemoryBlock` · bakılan: `llama_index/llama-index-core/llama_index/core/memory/memory_blocks/fact.py`
- **TOKEN-YOK** `mem0.md:92` → `telemetry.py:32` beklenen: `process_telemetry_filters` · bakılan: `mem0/cli/python/src/mem0_cli/telemetry.py`
- **TOKEN-YOK** `mem0.md:128` → `prompts.py:472` beklenen: `Ali vegan`, `Ali et yiyor` · bakılan: `mem0/mem0/configs/prompts.py`
- **TOKEN-YOK** `mem0.md:132` → `main.py:2113-2122` beklenen: `history.old_memory`, `old_memory` · bakılan: `mem0/mem0/memory/main.py`
