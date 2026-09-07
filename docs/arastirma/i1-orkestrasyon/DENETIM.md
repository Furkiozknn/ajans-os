# İ1 denetimi — kanıt doğrulaması

**Tarih:** 2026-09-07 · **Denetleyen:** canlı oturum (gözetimsiz koşunun dışından)
**Yöntem:** OZET.md ve ai-workflow-engine.md'deki dosya:satır alıntıları,
`D:\Repolar\_inceleme\` altındaki gerçek klonlarda `sed`/`grep` ile
kontrol edildi. Tek satır alıntıda ±3 satır tolerans; aralık alıntıda
aralığın tamamı.

## Sonuç

| Sonuç | Adet | Örnek |
|---|---|---|
| Tam satırında doğru | 13 | `langgraph/.../checkpoint/base/__init__.py:177` → `class BaseCheckpointSaver` ✓; `openai-agents/.../tracing/processors.py:45` → `api.openai.com/v1/traces/ingest` ✓ |
| Verilen aralık içinde doğru | 2 | `dapr .../durable.py:1196-1288` → `wait_for_external_event` 2 eşleşme ✓; `crewai .../crew.py:995-1922` → sequential/hierarchical 21 eşleşme ✓ |
| İddia doğru, aralık dar | 1 | `dapr .../durable.py:3097-3106` "araç hatası → mesaj": davranış `run_tool` içinde ama ~3161-3175'te (`except Exception → error_msg → result → ToolMessage content`) |
| İddia doğru, satır kaymış | 1 | `dapr pyproject.toml:44` "Pre-Alpha" → gerçek satır 72 |
| **Uydurma / yanlış iddia** | **0** | — |

Ayrıca doğrulananlar: Mastra `@mastra/core` sürümü `1.65.0-alpha.7` ✓;
`mastra/ee/LICENSE` ve `packages/*/src/ee` alt ağaçları mevcut ✓;
kullanıcının `ai-workflow-engine` README'sinden yapılan iki alıntı
(166: "No retry policy per step…", 168: "There's no resume-from-where-it-failed…")
birebir ✓.

## Kalite değerlendirmesi

- **Kanıt kuralı tutmuş.** Her yapısal iddia koda bağlı; README'den değil
  kaynak dosyadan okunduğu belli (Pregel superstep, kanal birleştirme,
  `RunState` serileştirme gibi ancak kod okunarak yazılabilecek ayrıntılar).
- **Kayırma yok.** Kullanıcının deposu güvenilirlikte 1, olgunlukta 2
  aldı; güçlü yanı (güvenlik 4) da gerekçeli. Protokol §5 uygulanmış.
- **Dürüstlük bölümü var.** AutoGen'in canlılık eşiğini geçemediği,
  konsensüs mekanizmasının bulunamadığı, indirme sayılarının
  doğrulanmadığı açıkça yazılmış.
- **Yinelenen desen mantığı doğru kurulmuş.** D1–D6 "birden çok projede
  bağımsız" ölçütüyle seçilmiş; en güçlü sinyal (D1 checkpoint, 5/7
  proje) doğru öne çıkarılmış.
- **Sentez için kullanılabilir.** Açık sorular (§6) Faz 3 kararlarını
  doğrudan besleyecek biçimde yazılmış.

## Protokole geri besleme

Üç satır kayması aynı köke iniyor: araştırmacı satır numarasını bir kez
okuyup geniş bir mantıksal bloğa atfediyor. Düzeltme protokol §1'e
eklendi: *aralık veriliyorsa anahtar token aralığın içinde olmalı; tek
satır veriliyorsa ±3 satırda bulunabilmeli; satır numarası oynak
dosyalarda (pyproject, package.json) anahtar kelimeyi de yaz.*

## Karar

İ1 çıktısı **sentezde kullanılabilir**. Düzeltme gerekmiyor; satır
kaymaları iddiayı değiştirmiyor. Bu denetim biçimi her iz için
tekrarlanacak (protokol §4'e "DENETIM.md" adımı eklendi).
