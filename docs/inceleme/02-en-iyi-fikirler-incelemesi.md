# En iyi fikirler ve desenler — bağımsız inceleme

**Tarih:** 08.09.2026 09:20 · **İnceleyen:** canlı oturum (belgeyi üreten koşudan farklı)
**Konu:** `docs/02-EN-IYI-FIKIRLER.md` (koşu 2b1283f, 13 dk, 4,78 USD; 794 satır, 13 desen + 7 aday + 1 kendi arızamız)

## Kanıt zinciri iddiası doğru mu

Belge "yeni kanıt üretmez, her alıntı iz özetinden gelir" diyor. Mekanik
kontrol (`iz-izle.js`): belgedeki **88 farklı `dosya:satır` alıntısının 88'i**
`docs/arastirma/**` belgelerinde birebir aynı satır numarasıyla geçiyor.
Uydurulmuş ya da kaydırılmış alıntı yok.

Klonlarda örnekleme (D1'in kanıt tablosu): `BaseCheckpointSaver`
`checkpoint/base/__init__.py:177` ✓, `run_state.py:1776` `to_json` ✓,
`crew.py:432` `from_checkpoint` ✓ (yol `lib/crewai/src/crewai/crew.py`),
`_core.py:2551` ✓, GEPA `state.py:405` `save` ✓, OpenHands
`event_store.py:34` `EventLog` ✓, `DGM_outer.py:326-331` jsonl append ✓;
`letta_agent_v3.py:1218` klonda dosya yok (İ2 özetinden geliyor) — bakılmadı.

## Özet tablo ile gövde tutuyor mu

- D1: tabloda 12 proje / 4 iz; gövdede sayıldı: İ1 5 + İ4 2 yeni + İ6 4 + İ2 1
  = **12**, izler İ1/İ2/İ4/İ6 = **4** ✓.
- D3, D4, D7, D8, D11, D13: kaba ad sayımı tabloyla uyumlu (8, 7, 5, 4, 4, 3).
- D2, D5, D6, D9, D10, D12: kaba sayım tablodan düşük çıktı; sayım sabit bir
  ad listesiyle yapıldığından liste dışı depoları görmüyor — **doğrulanamadı**,
  yanlış demek değil. Elle sayım sonraki incelemeye.
- K2 dört maddesi 13 desenin hepsinde tablo olarak var; 7 aday için "neden
  geçemedi" gerekçesi yazılı; iki adayın iz özetlerinin "alınmalı" önerisine
  rağmen elendiği açıkça söylenmiş — ölçütün gerçekten elediğinin kanıtı.

## Dikkat çeken noktalar (Faz 3'e taşınacak)

1. D12 "varsayılan kapalı" tek izden (İ3) geliyor, kanıtı 3 proje + kendi
   arızamız; belge bunu dürüstçe "1 iz" olarak işaretlemiş. Faz 3'te güvenlik
   ADR'si bunu tek başına dayanak yapmamalı; İ5/İ6'da karşı örnek aranmalı.
2. D1'de "adım-sonucu tablosu" seçimi İ4 Ö1'e dayanıyor; İ4 denetiminde
   `_loop.py:733-745` ve `main.py:2968` elle doğrulandı, güvenilir.
3. A1 (izin sürüme bağlama) İ3 denetiminde "K6 için kritik" diye işaretlenmişti;
   burada aday listesinde. Faz 3 güvenlik ADR'sinde yeniden ele alınmalı.

## Karar

Belge Faz 2'nin sonraki adımı ("anti-pattern'ler") ve Faz 3 için
**kullanılabilir**. Kanıt zinciri sağlam; açık iş yalnızca altı desenin
proje sayımının elle doğrulanması.
