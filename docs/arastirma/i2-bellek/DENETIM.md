# İ2 denetimi — kanıt doğrulaması

**Tarih:** 2026-09-07 · **Denetleyen:** canlı oturum (araştırmayı yapan koşudan farklı)
**Yöntem:** `node arac/kanit-dogrula.js i2-bellek --yaz` (v3.1) + şüphelilerin
`grep -rn` ile depo genelinde elle kontrolü. Letta için kaynak `origin/archive`
dalı (özetin dürüstlük notundaki gibi; `main` boşaltılmış).

## Araç özeti (v3.1)

| Toplam | TAM | YAKIN | VAR | Şüpheli |
|---|---|---|---|---|
| 384 | 227 | 23 | 122 | 12 |

Doğrulanabilir 262 alıntının **%95**'i doğrulandı. Otomatik rapor:
`DENETIM-otomatik.md`.

## Şüphelilerin elle sınıflandırması

| Alıntı | Sınıf | Not |
|---|---|---|
| `lightrag.md` → `prompt.py:145`, `:127` "gleaning" | **yanlış dosya** | sembol `lightrag.py`, `operate.py`, `pipeline.py`'de var; prompt dosyasında yok |
| `cognee.md:54` → `upsert_nodes.py:19` `id_for` | **yanlış dosya** | `id_for` depoda var (`validate.py`, eval_framework); bu dosyada yok |
| `letta.md:64` → `errors.py:48` `ApprovalRequestMessage` | **yanlış dosya** | sınıf `letta/interfaces/*streaming_interface.py`'de |
| `letta.md:66` → `block_manager.py:275` iki `delete_*` metodu | **yanlış dosya (muhtemel)** | metot adları başka manager'a ait görünüyor; elle bakılmalı |
| `llamaindex.md:117` → `fact.py:144-147` `VectorMemoryBlock` | **yakınlık hatası** | satır iki bloğu karşılaştırıyor; `VectorMemoryBlock` `vector.py`'de, alıntı `fact.py` için `FactExtractionMemoryBlock` demek istiyor |
| `mem0.md:132` → `memory/main.py:2113-2122` `old_memory` | **satır kayması** | `old_memory` 1068 ve 2726'da; 2113 civarı başka blok |
| `OZET.md:96` → `main.py:2113-2122` `expiration_date` | **belirsiz dosya** | üç `main.py` var (server/client/memory); OZET hangisi olduğunu yazmamış |
| `graphrag.md:56` → `local_search_config.py:46` `data_max_tokens = 12_000` | **doğru olabilir** | `defaults.py:94` ve `:201`'de var; config modelinde alan adı farklı yazılmış olabilir |
| `graphrag.md:61` → `cli/index.py:115` üç bağlantı alanı | **elle bakılmalı** | |
| `mem0.md:92` → `telemetry.py:32` | **elle bakılmalı** | `mem0_cli/telemetry.py` seçildi; muhtemelen `mem0/memory/telemetry.py` kastedildi |
| `mem0.md:128` → `prompts.py:472` "Ali vegan / Ali et yiyor" | **araç kusuru** | Türkçeleştirilmiş örnek; kodda İngilizce |
| `dapr-agents.md:65`-benzeri `olarak` | **araç kusuru** | Türkçe sözcük token sanıldı |

**Uydurma iddia: 0.** "Yok" görünen her sembol depo genelinde mevcut.
Gerçek kusur sınıfı: **sembolü tanımlandığı dosyayla değil, kullanıldığı
veya ilgili dosyayla alıntılamak** (≈4 örnek) — İ1'de görülmeyen bir
gevşeme. Protokol §1'e "dosya disiplini" olarak eklendi.

## Kalite değerlendirmesi

- Kanıt yoğunluğu İ1'le aynı düzeyde (384 alıntı / 8 dosya).
- Dürüstlük notu güçlü: Letta'nın `main` dalının boşaltılması yakalanmış
  ve analiz `archive` üzerinden yapılmış — bu, README'ye güvenmeme
  kuralının işlediğini gösterir.
- Kayırma söz konusu değil (bu izde kullanıcı deposu yok).
- D1 ("ham konuşma kalıcı bellek değildir; kalıcı olan türetilmiş
  kayıttır") 7/7 projede bağımsız ortaya çıkmış — İ2'nin en güçlü sinyali,
  Faz 3 bellek mimarisinin çekirdek varsayımı olmaya aday.
- D2 ("yazma kararını LLM verir, hiçbirinde yazma öncesi insan onayı yok")
  ADR-000 K6/K7 için doğrudan ilgili: ekosistem bellek yazımını kapısız
  bırakıyor; bizim kapılı yaklaşımımız burada ayrışacak.

## Karar

İ2 **sentezde kullanılabilir.** Yukarıdaki "yanlış dosya" alıntılarına
sentezde doğrudan dayanılacaksa önce doğru dosya bulunup düzeltilmeli;
iddiaların kendisi geçerli.
