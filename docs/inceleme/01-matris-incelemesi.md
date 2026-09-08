# Karşılaştırma matrisi — bağımsız inceleme

**Tarih:** 08.09.2026 08:50 · **İnceleyen:** canlı oturum (matrisi üreten koşudan farklı)
**Konu:** `docs/01-KARSILASTIRMA-MATRISI.md` + `docs/01-matris.json` (koşu: 96e411f, 12,4 dk, 4,94 USD)

## Yorumun sayıları tabloyla tutuyor mu

Yorum bölümündeki her sayı tablodan yeniden sayıldı:

| İddia | Tablodan sayım | Sonuç |
|---|---|---|
| Güvenlik: puanlanan 37 projenin 17'si ≤2 | 40 − 3 (`—`: portkey, temporal, langfuse) = 37; ≤2 olan 17 | ✓ |
| İnsan kapısı: 20 hayır, 9 evet | istatistik tablosu 9 / 7 / 20 / 4 | ✓ |
| Checkpoint 14 / 14 | 14 evet, 14 hayır | ✓ |
| Olgunlukta 5 alan sekiz proje | CrewAI, LangGraph, OpenAI SDK, A2A, MCP, dbos, litellm, aider | ✓ |
| Güvenilirlikte tek 5: temporal | başka 5 yok | ✓ |
| Genişletilebilirlik 5: LangGraph, OpenAI SDK, Strands, graphrag, GEPA | satırlar aynı | ✓ |
| Gözlemde 5 yok, 4 alan dokuz | istatistik tablosu dokuz ad | ✓ |
| Güvenlik 4 alan altı projenin üçü güvenlik amaçlı | OpenAI SDK, ai-workflow-engine, A2A, microsandbox, mcp-vet, OTel semconv → üçü (A2A, microsandbox, mcp-vet) | ✓ |
| RouteLLM sözleşme evet / sağlayıcı bağımsız hayır; temporal tek eksen | satırlar aynı | ✓ |

Protokol §6.2'nin sabit sütunlarının hepsi var; §6.3 JSON üretildi; §6.4 yorum
üç başlıkla (liderler, boşluklar, çelişkiler) bir sayfa sınırında.

## Bulunan veri boşlukları ve yapılan düzeltmeler

Sekiz satırda `★` boştu; araştırma turları bu depolar için ağ sorgusu
yapmamıştı. İncelemede `gh api repos/<repo>` ile ölçülüp **iz özetlerine**
(kaynak tablolara) yazıldı, matris yeniden üretildi (araç dokunmadan):

| Proje | ★ | Son push | Not |
|---|---|---|---|
| langfuse/langfuse | 34.319 | 2026-09-07 | — |
| open-telemetry/semantic-conventions | 643 | 2026-09-03 | genai alt dizini bu depoda |
| BerriAI/litellm | 58.252 | 2026-09-07 | — |
| lm-sys/RouteLLM | 5.462 | 2024-08-10 | tarihî referans, değişmedi |
| Furkiozknn/nvidia-nim-mcp, model-comparison-harness | 0 | — | kullanıcı depoları |
| meta-llama/PurpleLlama | 4.385 | 2026-08-18 | i3 satırında `— / — / —` idi; lisans "karışık" olarak yazıldı; "geçti" hükmü artık tarihle destekli |
| 567-labs/instructor | 13.840 | 2026-09-07 | "ölçülmedi" yerine değer |

Bu düzeltmeler puanları değiştirmedi; yalnızca kimlik hücreleri.

## Kalan boşluklar (bilinçli, sentezde dikkat)

- `dil` sütunu i2–i6'da boş: iz özet tabloları dil taşımıyor. Sentez için
  kritik değil; istenirse kimlik satırlarından çekilebilir (araca küçük ek).
- Puanlarda `—` olan hücreler (temporal, microsandbox, portkey, langfuse
  güvenlik) **incelenmedi** demektir, sıfır değil — yorum bunu doğru okuyor
  ("temporal tek eksende lider").
- `saglayici_bagimsiz` 5 ve `insan_kapisi` 4 boş satır: i5/i6 özetlerinde
  gerekçeli; yorum bunları veri boşluğu olarak işaretlemiş.

## Karar

Matris ve yorumu Faz 2'nin sonraki adımları ("en iyi fikirler",
"anti-pattern'ler") için **kullanılabilir**. İki uyarı: (1) kullanıcının
depoları (mcp-vet, ai-workflow-engine, nvidia-nim-mcp, model-comparison-harness)
yorumun da dediği gibi tasarım örneği olarak alınabilir, kanıt olarak
alınamaz; (2) `—` puanlı satırlar sıralamaya sokulmamalı.
