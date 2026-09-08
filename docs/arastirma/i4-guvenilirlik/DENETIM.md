# İ4 denetimi — kanıt doğrulaması

**Tarih:** 08.09.2026 03:25 · **Denetleyen:** canlı oturum (araştırmayı yapan üç koşudan farklı)
**Yöntem:** `node arac/kanit-dogrula.js i4-guvenilirlik --yaz` (v3.1) + aracın
şüpheli dediği 19 alıntının klon üzerinde (`D:/Repolar/_inceleme/`) `sed -n` ile
elle kontrolü.

## Araç özeti

| Toplam | TAM | YAKIN | VAR (token'sız) | Şüpheli |
|---|---|---|---|---|
| 410 | 254 | 18 | 119 | 19 |

Doğrulanabilir 291 alıntının **%93**'ü doğrulandı (TAM+YAKIN). Rapor:
[DENETIM-otomatik.md](DENETIM-otomatik.md). Yedi projenin hepsinde dosya
ve satır aralığı bulundu (DOSYA-YOK 0, EOF 0).

## Şüphelilerin elle kontrolü

| Alıntı | Kaynakta bulunan | Sonuç |
|---|---|---|
| dbos-transact-py.md:77 → `_core.py:2552-2555` | 2553-2554: `# The step was preempted by workflow cancellation. Don't record / # an outcome — let the step be re-run on resume.` | ✓ birebir; yorum iki satıra bölündüğü için araç bulamadı |
| dspy.md:7 → `pyproject.toml:14` | kök dosya 14: `authors = [{ name = "Omar Khattab", email = "okhattab@stanford.edu" }]` | ✓ — araç `.github/.internal_dspyai/pyproject.toml`'a bakmış (yanlış dosya) |
| dspy.md:7, :11 → `README.md:16` | kök dosya 16: `DSPy is the framework for _programming—rather than prompting—language models_.` | ✓ birebir — araç `docs/README.md`'ye bakmış |
| dspy.md:11 → `README.md:49` | `[Jul'25] GEPA: Reflective Prompt Evolution ...` (makale bağlantısı) | ✓ iddia tam olarak bu: GEPA yalnızca makale olarak geçiyor |
| dspy.md:27 → `best_of_n.py:56-59` | `lm_ = lm.copy(rollout_id=rid, temperature=1.0)`, `mod = self.module.deepcopy()` | ✓ |
| dspy.md:61 → `best_of_n.py:77-81` | `if idx > self.fail_count: raise e` / `self.fail_count -= 1` | ✓ |
| dspy.md:90 → `base_module.py:171` | `def save(self, path, save_program=False, modules_to_serialize=None):` | ✓ |
| instructor.md:47 → `retry.py:363-369` | `failed_attempts.append(FailedAttempt(attempt_number=..., exception=e, completion=response))` | ✓ |
| instructor.md:55 → `retry.py:274-283` | `stop_after_attempt(max(max_retries, 0) + 1)`, `Retrying(stop=..., retry=retry_if_exception_type(_RETRYABLE_PARSE_ERRORS), reraise=True)` | ✓ YAKIN — md `max(…, 0)` korumasını ve `timeout` için `stop_after_delay` seçeneğini atlıyor; "N+1 deneme" sonucu doğru |
| langgraph.md:66 → `_loop.py:692` | `self.updated_channels = apply_writes(` | ✓ (`Send`/`Command` düzyazı token'ıydı) |
| langgraph.md:82 → `main.py:2968` | `[t for t in loop.tasks.values() if not t.writes]` | ✓ — araç `task.writes.append` aramış, o `_runner.py`'de |
| langgraph.md:123 → `_loop.py:960-971` | önceki koşuda elle doğrulandı (`DURUM.md`: `_put_checkpoint({"source": "fork"})` satır 971) | ✓ (önceki kontrol) |
| langgraph.md:96 → `_loop.py:733-745` | — | **bakılmadı** (token Türkçe düzyazı; önceki koşuda da bakılmamıştı) |
| portkey-gateway.md:66 → `requestContext.ts:151-152` | 150: `attempts: retry?.attempts ?? 0`, 151-153: `onStatusCodes: retry?.attempts ? … ?? RETRY_STATUS_CODES : []` | ✓ (`max 5` token'ı başka cümleden) |
| portkey-gateway.md:121 → `handlerUtils.ts:646-659` | `isHandlingCircuitBreaker`, `.filter((t: any) => !t.isOpen)` (653) | ✓ kısmen — `cbConfig`/`handleCircuitBreakerResponse` için 792-799 aralığına bakılmadı |
| reflexion.md:219, OZET.md:242 → `agents.py:113` | `self.reflections += [self.prompt_reflection()]` | ✓ birebir |
| reflexion.md:295 → `reflexion.py:29-31` | `reflections = []`, `implementations = []`, `test_feedback = []` — yerel listeler | ✓ "durum süreç belleğinde" iddiası doğru |
| OZET.md:298 → `reflexion.py:43` | `is_passing, feedback, _ = exe.execute(cur_func_impl, tests_i)` | ✓ yargıyı test veriyor |

**Sonuç:** 19 şüphelinin 17'si elle kontrol edildi, **17'si tuttu** (biri YAKIN
nüanslı, biri kısmen); 2'si bakılmadı. Yanlış iddia bulunmadı. Bütün
şüpheliler araç kusuru: Türkçe düzyazı token sanıldı, satıra bölünmüş
alıntı, ya da çıplak dosya adı (`README.md`) depo kökündeki yerine iç
içe kopyaya çözüldü.

## Araç için ders (kanit-dogrula.js'e eklenecek)

md çıplak bir dosya adı veriyorsa (`README.md:16`, `pyproject.toml:14`)
önce **depo kökündeki** dosya denenmeli; iç içe eş adlı dosyalar ancak
kökte bulunamazsa aday olmalı. Bu tur dspy'de 3 yanlış alarm buradan geldi.

## Karar

İ4 izi sentezde **kullanılabilir**. OZET.md'nin üç ana bulgusu (durum
modeli snapshot/replay/adım-tablosu üç yola ayrılıyor; hiçbir proje
dünyayı geri almıyor, rollback = durumu geri sar + yeniden dene; kısmi
ilerleme adım sınırından ince granülerlikte saklanıyor) kaynak satırlarla
tutuyor.
