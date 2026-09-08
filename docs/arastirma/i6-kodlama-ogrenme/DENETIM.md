# İ6 denetimi — kanıt doğrulaması

**Tarih:** 08.09.2026 08:25 · **Denetleyen:** canlı oturum (araştırmayı yapan iki koşudan farklı)
**Yöntem:** `node arac/kanit-dogrula.js i6-kodlama-ogrenme --yaz` (v3.1) + aracın
şüpheli dediği 10 alıntının tamamının klonlar üzerinde (`D:/Repolar/_inceleme/`)
`sed -n` / `grep -rn` ile elle kontrolü.

## Araç özeti

| Toplam | TAM | YAKIN | VAR (token'sız) | Şüpheli |
|---|---|---|---|---|
| 250 | 133 | 15 | 92 | 10 (8 TOKEN-YOK + 2 DOSYA-YOK) |

Doğrulanabilir 158 alıntının **%94**'ü doğrulandı (TAM+YAKIN). Rapor:
[DENETIM-otomatik.md](DENETIM-otomatik.md).

## Şüphelilerin elle kontrolü

| Alıntı | Kaynakta bulunan | Sonuç |
|---|---|---|
| OZET.md:63 → DGM `README.md:88` | "This repository involves executing untrusted, model-generated code. We strongly advise users to be aware of the associated safety risks…" | ✓ birebir — araç `openevolve/examples/algotune/README.md`'ye bakmış (çıplak README kusuru, üçüncü kez) |
| OZET.md:63 → OpenEvolve "yalnızca `multiprocessing`" | `openevolve/process_parallel.py:7` `import multiprocessing as mp`, `:11` `ProcessPoolExecutor`; `evaluator.py`'de değil | ✓ iddia doğru, dosya adı yanlıştı — **düzeltildi** |
| OZET.md:71 → GEPA `acceptance.py:49` | `def should_accept(self, proposal, state)`: `new_sum > old_sum` | ✓ (DGM token'ları başka depoya aitti) |
| openhands.md:48 → `…/security/confirmation_policy.py:9` | `software-agent-sdk/openhands-sdk/openhands/sdk/security/confirmation_policy.py:9` `class ConfirmationPolicyBase(DiscriminatedUnionMixin, ABC)` | ✓ — md yolu `…` ile kısaltmış, araç çözememiş |
| openhands.md:50 → `…/local.py:17` | `…/sdk/workspace/local.py:17` `class LocalWorkspace(BaseWorkspace)` | ✓ |
| openhands.md:113 → `state.py:344` | `…/sdk/conversation/state.py:343-345` replay/dal açıklaması ("A linear append replays only the new tail — O(k)") | ✓ — araç gepa'nın `state.py`'sine bakmıştı |
| openhands.md:137 → `agent.py:1059-1062` | `…/sdk/agent/agent.py:1060-1062` `if any(state.confirmation_policy.should_confirm(risk) for risk in risks): state.execution_status = WAITING_FOR_CONFIRMATION` | ✓ birebir — araç dapr-agents'ın `agent.py`'sine bakmıştı; `NeverConfirm` token'ı `confirmation_policy.py:35-41`'e ait |
| textgrad-ve-gepa.md:68 → `state.py:217`, `adapter.py:83`, `reflective_mutation.py:44` | `class GEPAState` 217, `class GEPAAdapter(Protocol[...])` 83, `class ReflectiveMutationProposer` 44; `GEPAEngine` `engine.py:113`; `AcceptanceCriterion` `acceptance.py:11` | ✓ hepsi — tek cümledeki beş sınıf adını araç yanlış dosyalarla eşlemiş |
| textgrad-ve-gepa.md:117 → `state.py:447` | `# Save run log and candidates as human-readable JSON` — durum onaysız diske yazılıyor | ✓ |

**Sonuç:** 10 şüphelinin **10'u elle kontrol edildi, 10'u tuttu**; birinde
dosya adı yanlıştı (OZET.md:63), düzeltildi. **Yanlış iddia bulunmadı.**

## Araç için dersler (kanit-dogrula.js) — birikmiş açık işler

1. Çıplak `README.md` önce depo kökünde aranmalı (İ4, İ5, İ6'da aynı kusur).
2. `…/dosya.py` biçiminde kısaltılmış yollar için depo içinde ada göre arama.
3. Tek satırda birden çok dosya:satır varsa token'ları **en yakın** alıntıya
   bağla (şu an satırdaki tüm token'lar her alıntıya uygulanıyor; OpenHands
   ve GEPA satırlarındaki 6 yanlış alarm buradan).
4. Aynı izde iki klon (OpenHands + software-agent-sdk) varsa md'nin
   "repo bölünmesi" notundaki ikinci köke de bak.

## Karar

İ6 izi sentezde **kullanılabilir**. Ana bulgular (kendini değiştiren
sistemlerde otomatik kabul kapısı "geçerli mi" ile "eşiği aştı mı" ayrımına
dayanmalı; hiçbir proje insan onayı olmadan üretimde kendini değiştirdiğini
kanıtlamıyor — K7'nin olumsuz kanıtı; OpenHands SDK'nın onay politikası
kapatılabilir bir kapı) kaynak satırlarla tutuyor.
