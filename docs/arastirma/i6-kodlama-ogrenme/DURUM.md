# İ6 Otonom kodlama ve öğrenme — DURUM (tamamlandı)
2026-09-08

## Bitenler

| Dosya | Proje(ler) | Tur |
|---|---|---|
| openhands.md | OpenHands (software-agent-sdk) | önceki tur |
| kendini-degistiren-sistemler.md | DGM, OpenEvolve | önceki tur |
| swe-agent.md | SWE-agent | bu tur |
| aider.md | Aider | bu tur |
| textgrad-ve-gepa.md | TextGrad, GEPA | bu tur |

Toplam: 5 analiz dosyası, 7 proje. Bu turda `OZET.md` (iz özeti, 7 bölüm + ADR-000 K7 kararı + Dürüstlük) ve bu `DURUM.md` yazıldı — sentez, yeni kod okuma yok.

## Kalanlar

- **Cline** (`cline/cline`) — klonlanmadı, bütçe yüzünden açılmadı. Sonraki tur için en yüksek değerli kalan aday: VSCode eklentisi olarak insan kapısı UI katmanında mı çekirdekte mi sorusu açık.
- **Resmî `DENETIM.md`** — ayrı bir koşuya bırakıldı. Otomatik denetim (`DENETIM-otomatik.md`) 8 şüpheli alıntı buldu (4'ü openhands.md'de: 2 DOSYA-YOK + 2 TOKEN-YOK; 4'ü textgrad-ve-gepa.md'de: hepsi TOKEN-YOK, gepa klonunda yanlış satır araması) — bunların elle doğrulanması gerekiyor.

## Sonraki turun bilmesi gerekenler

Hazır klonlar `D:/Repolar/_inceleme/` altında: `SWE-agent`, `textgrad`, `gepa`, `aider`, `dgm`, `openevolve`, `software-agent-sdk`, `OpenHands` — hepsi klonlu ve hazır, tekrar klonlamaya gerek yok. **Cline klonlu DEĞİL** — bir sonraki tur açılacaksa önce klon gerekiyor.

## K7 sonucu

İncelenen yedi projenin (OpenHands, DGM, OpenEvolve, SWE-agent, Aider, TextGrad, GEPA) hiçbiri "kendi kod/promptunu insan kapısız değiştirip bunu üretimde güvenle çalıştıran" üç koşulu (kendi hedefi + kapısız + üretim) birlikte sağlamıyor: yalnızca DGM kendi kodunu kapısız değiştiriyor ama açıkça araştırma/donmuş durumda ve yazarının kendi güvenlik itirafını taşıyor; geri kalan altısı zaten harici bir hedefi (repo, program, prompt bileşeni) değiştirdiği için soruya aday bile değil. En olgun/yaygın araç olan Aider bile insan onay kapısını varsayılan açık tutup kaldırmayı kullanıcının açık bayrak seçimine bağlıyor — bu da K7'yi zayıflatmak yerine güçlendiren bir gözlem. Sonuç: **K7 çürümedi, bu turda daha da güçlendi.**
