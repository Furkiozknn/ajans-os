# Aider

## Kimlik
Aider-AI/aider · 48.825 yıldız · 266 watcher · son push 2026-05-22 · lisans Apache-2.0 · dil Python · haftalık indirme (PyPI): doğrulanmadı
canlılık: tarihî referans (son push 2026-05-22, bugün 2026-09-08 → ~108 gün, 90 günlük eşiği aşıyor; arşivlenmemiş, lisans OSI onaylı Apache-2.0)

## Çözdüğü problem
Terminalde çalışan bir "AI çift programlama" aracı: kullanıcının doğal dil isteğini alıp LLM'e gönderiyor, LLM'in ürettiği kod değişikliklerini repodaki dosyalara uyguluyor, otomatik git commit atıyor ve isteğe bağlı lint/test geri beslemesiyle kendi hatasını düzeltmeye çalışıyor (`aider/coders/base_coder.py`).

## Mimari
Tek bir soyut `Coder` sınıfı (`aider/coders/base_coder.py`) üzerine kurulu; alt sınıflar sadece "LLM çıktısını nasıl ayrıştırıp uyguluyorum" (edit format) sorusuna cevap veriyor: `EditBlockCoder` (`aider/coders/editblock_coder.py:15`, `edit_format = "diff"`), `UnifiedDiffCoder` (`aider/coders/udiff_coder.py:46`, `edit_format = "udiff"`), `WholeFileCoder` (`aider/coders/wholefile_coder.py:10`, `edit_format = "whole"`). Her alt sınıf sadece `get_edits()` / `apply_edits()` metotlarını override ediyor; mesaj döngüsü, commit, lint/test tetikleme hep `base_coder.py`'de merkezi.

## Klasör yapısı
- `aider/coders/` — `base_coder.py` (ana döngü, mesajlaşma, commit tetikleme) + her edit format için ayrı dosya.
- `aider/repomap.py` — bağlam için "repo haritası" üretimi (tree-sitter tabanlı statik analiz + PageRank).
- `aider/repo.py` — git sarmalayıcı (`GitRepo` sınıfı, `aider/repo.py:52`), commit/attribution mantığı.
- `aider/models.py` — LLM sağlayıcı soyutlaması (`Model` sınıfı, `aider/models.py:329`), litellm üzerinden tamamlama.
- `aider/io.py` — terminal G/Ç, kullanıcı onayı (`confirm_ask`, `aider/io.py:807`).
- `aider/linter.py` — dil bazlı lint komutlarını çalıştırma (`Linter` sınıfı, `aider/linter.py:21`).
- `aider/exceptions.py` — litellm istisnalarının retry/mesaj tablosu (`EXCEPTIONS`, `aider/exceptions.py:14`).

## Ajan tasarımı
Tek ajan, çok-kip: kullanıcı "edit format" seçer (diff/udiff/whole), her format kendi prompt setiyle (`EditBlockPrompts`, `UnifiedDiffPrompts`) çalışır ama aynı `Coder.run_one()` orkestrasyonundan geçer (`aider/coders/base_coder.py:924`). Çoklu-ajan mimarisi yok; "ajan" tek bir konuşma+düzenleme döngüsü.

## Orkestrasyon / iş akışı modeli
Ana döngü `run()` → `run_one()` → `send_message()` (`aider/coders/base_coder.py:876,924,1419`). `run_one()` içinde bir `while message:` döngüsü var (`aider/coders/base_coder.py:933-944`): LLM cevabı alınır, `apply_updates()` çağrılır, hata olursa `self.reflected_message` set edilir ve döngü aynı `Coder` içinde LLM'e otomatik geri gönderilir — `max_reflections = 3` sınırıyla (`aider/coders/base_coder.py:100-101,939-940`). Bu, tek-turlu değil, sınırlı-döngülü bir kendini-düzeltme akışı.

## Durum ve bellek
Oturum içi bellek: `cur_messages`, `done_messages` gibi mesaj listeleri `Coder` nesnesinde tutuluyor; kalıcı "öğrenme" yok. `RepoMap` bir SQLite tabanlı `tags_cache` tutuyor (`aider/repomap.py:67` `load_tags_cache`, `:217-224`) ama bu sadece performans için ayrıştırma sonuçlarının önbelleklenmesi — model ağırlığı ya da tercih öğrenmesi değil.

## Hata yönetimi
- LLM sağlayıcı hataları: `aider/exceptions.py` içinde `ExInfo(name, retry: bool, description)` tablosu — hangi istisnanın yeniden denenebilir olduğunu (`retry=True/False`) ve kullanıcıya gösterilecek açıklamayı merkezi olarak tanımlıyor (`aider/exceptions.py:14-53`).
- Edit format ayrıştırma hatası: `EditBlockCoder.get_edits()` "might raise ValueError for malformed ORIG/UPD blocks" yorumuyla açıkça belirtiliyor (`aider/coders/editblock_coder.py:24`); `UnifiedDiffCoder.apply_edits()` eşleşmeyen hunk'ları `errors` listesine toplayıp `raise ValueError(errors)` ile geri veriyor (`aider/coders/udiff_coder.py:69-120`, özellikle 119-120).
- Bu `ValueError` `base_coder.py:apply_updates()` içinde yakalanıyor: `self.num_malformed_responses += 1`, hata mesajı `self.reflected_message = str(err)` olarak LLM'e geri gönderiliyor (`aider/coders/base_coder.py:2305-2316`) — yukarıdaki reflection döngüsü ile birleşerek otomatik yeniden deneme sağlıyor (üst sınır yine `max_reflections=3`).

## Genişletilebilirlik
Yeni edit format eklemek `Coder` alt sınıfı + `edit_format` string sabiti + `get_edits`/`apply_edits` override etmekle sınırlı (bkz. üç mevcut örnek). Yeni LLM sağlayıcı eklemek `aider/models.py` üzerinden litellm'in desteklediği her modeli kapsıyor; `Model.send_completion()` (`aider/models.py:985`) tek bir litellm çağrı noktası.

## Güçlü yönler (kanıtlı)
- Net, sınırlı reflection döngüsü: `max_reflections = 3` ile sonsuz döngü riski koda gömülü olarak engellenmiş (`aider/coders/base_coder.py:100-101,939-940`).
- Lint/test geri beslemesi kullanıcı onayına bağlı otomatik düzeltme tetikliyor: `ok = self.io.confirm_ask("Attempt to fix lint errors?")` başarısız ise `self.reflected_message = lint_errors` (`aider/coders/base_coder.py:1604-1607`), aynısı test hataları için (`:1620-1623`).
- Commit attribution mantığı çok ayrıntılı belgelenmiş ve kod içinde docstring ile açıklanmış (`aider/repo.py:131-198`).

## Zayıf yönler (kanıtlı)
- `/undo` mekanizması incelenen dosyalarda (`aider/repo.py`) bulunamadı — grep `undo` sadece `aider_edits` kelimesiyle eşleşti, ayrı bir `undo`/geri alma fonksiyonu yok; komut muhtemelen kapsam dışı `aider/commands.py` içinde tanımlı (doğrulanmadı, kapsam sınırı gereği bakılmadı).
- `RepoMap.get_ranked_tags()` `networkx.pagerank` çağrısını sarmalayan hata yakalama var (`aider/repomap.py:382-388` `self.tags_cache_error`) ama pagerank'in kendisi büyük/döngüsüz graf gibi patolojik durumlarda ne kadar dayanıklı, kanıtlanmadı.
- Tek ajan mimarisi: paralel/çoklu-ajan orkestrasyon yok, tüm iş tek `Coder.run_one()` çağrısında seri işleniyor.

## K7 sınaması (insan kapısı)
Evet, insan kapısı var ve varsayılan olarak açık. `confirm_ask()` (`aider/io.py:807-822`) her soru için `(Y)es/(N)o` istemi üretiyor; `self.yes is True` olmadıkça (yani `--yes-always` verilmedikçe) kullanıcıdan gerçek girdi bekliyor (`aider/io.py:862-864`: `if self.yes is True: res = "n" if explicit_yes_required else "y"`). Kapıyı kaldıran bayrak açıkça mevcut: `--yes-always` (`aider/args.py:760-765`, `action="store_true"`, varsayılan `None`).

`confirm_ask` çağrı noktaları `base_coder.py` içinde en az 8 kritik karar noktasını kapsıyor: lint hatası düzeltmeye çalış mı (`:1604`), test hatası düzeltmeye çalış mı (`:1620`), yeni dosya oluştur mu (`:2207`), önerilen shell komutunu çalıştır mı (`:2456,2479` civarı) ve genel "Try to proceed anyway?" (`:1415`). Yani Aider varsayılan modda değişikliği **diske yazmadan önce** değil ama lint/test-tetiklemeli **ek LLM turlarından önce** ve dosya oluşturma gibi geri dönüşü zor işlemlerden önce onay soruyor; `--yes-always` bu onayların tamamını otomatik "evet"e çeviriyor (K7 açısından: kapı var, varsayılan açık, bayrakla tamamen kaldırılabilir — kaldırma niyeti kullanıcı tarafından açık bayrak seçimiyle ifade edilmek zorunda).

## Puan (1–5)
olgunluk 5 · mimari netlik 4 · genişletilebilirlik 4 · güvenilirlik ilkelleri 3 · gözlemlenebilirlik 2 · güvenlik duruşu 3

## Alınacak fikir
Sınırlı-sayıda otomatik reflection döngüsü (`max_reflections=3`) + hata mesajının ham haliyle LLM'e geri verilmesi (`self.reflected_message = str(err)`) basit ama etkili bir kendini-düzeltme deseni; ajans-os'taki kod-yazan ajanlar için bire bir uygulanabilir bir üst sınır + geri besleme şablonu.

## Alınmayacak
Tek dev-dosya (`base_coder.py`) içinde onlarca sorumluluğun (mesajlaşma, commit, lint, test, shell komutları, dosya yönetimi) birikmesi — genişletilebilirlik için sınıf küçük tutulmalıydı; ajans-os'ta orkestrasyon mantığını tek bir dev sınıfa yığmamak gerekir.

## Dürüstlük
`aider/commands.py` (özellikle `/undo` komutunun gerçek implementasyonu), `aider/main.py`, `aider/coders/*_prompts.py` dosyalarının tam içeriği, PyPI haftalık indirme sayısı ve pagerank/tree-sitter performansının büyük repolardaki gerçek davranışı incelenmedi — kapsam sınırı gereği bakılmadı. `--yes-always` dışında onayı kaldıran başka bayrak (`--no-auto-commit` vb. tam liste) taranmadı, sadece `args.py` içinde tek bir grep ile bulunan satır kanıt olarak kullanıldı.
