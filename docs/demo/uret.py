"""demo.json kaydından README GIF'ini (demo.gif) ve dikey klibi (terminal.mp4) çizer.

Kayıt docs/demo/kaydet.js'in gerçekten koştuğu komutların çıktısıdır; burada çıktıya tek
satır eklenmez, yalnız nasıl boyanacağı seçilir. Yalnızca geliştirme zamanı aracıdır
(Pillow + ffmpeg); depo ve testleri bağımlılıksız kalır.

    node docs/demo/kaydet.js                                  # komutları koşar -> demo.json
    uv run --with pillow docs/demo/uret.py gif docs/demo/demo.gif      # 960x540, README
    uv run --with pillow docs/demo/uret.py mp4 terminal.mp4            # 1080x1920, H.264, sessiz, yazısız

Görsel dil: FRK-OS klasik teması (sosyal/uret/tema.mjs): zemin #0e0d0b, krem #f1ece2,
sarı #ffc21a, camgöbeği #19d3e6, turuncu #ff7a1a, mercan #ff4d6d; yazı JetBrains Mono
(SIL OFL 1.1, fonts/). Boyama yalnızca satır türüne göre; metin değişmez. Kontrast
oranları (WCAG, zemin #0e0d0b üzerinde) `python uret.py kontrast` ile hesaplanır.

JetBrains Mono'da ✔ ✓ ✗ ℹ ﹣ yok (Node test raporcusu ve sema-dogrula kullanır); bu beş
karakter tek karelik hücre içinde çizgiyle çizilir, başka yazı tipi kullanılmaz.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
BG, FG, YEL, DIM = "#0e0d0b", "#f1ece2", "#ffc21a", "#9a958b"
CYAN, ORANGE, CORAL = "#19d3e6", "#ff7a1a", "#ff4d6d"
CIZGILI = set("✔✓✗ℹ﹣")  # JetBrains Mono'da olmayanlar


def luminance(hexrenk):
    r, g, b = (int(hexrenk[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def kontrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def adimlar():
    return json.loads((HERE / "demo.json").read_text(encoding="utf-8"))["adimlar"]


def tur(satir):
    """Satırın rengi için türü; metne dokunmaz."""
    s = satir.lstrip()
    if s.startswith(("✔", "ok ", "oldu ")) or "mutant oldu" in s or ": temiz" in s or re.match(r"\d+ gecti, 0 kaldi", s):
        return "gecti"
    if s.startswith("ℹ") or s.startswith("Atlananlar:") or s.startswith("Uctan uca bolum"):
        return "bilgi"
    if s.startswith(("﹣", "ATLANDI")) or "ATLANDI:" in s:
        return "atlandi"
    if s.startswith(("hata:", "✗")):
        return "hata"
    if s.startswith("Yardım:"):
        return "ipucu"
    return "cikti"


RENK = {"gecti": CYAN, "bilgi": DIM, "atlandi": ORANGE, "hata": CORAL, "ipucu": YEL, "cikti": FG, "komut": FG}


def zaman_cizelgesi(fps, temizle):
    """(satırlar, imleç) kareleri. Yazma ~40 karakter/sn; çıktı ~0,8 sn içinde satır satır açılır."""
    kareler, satirlar = [], []

    def bekle(sn, imlec=True):
        kareler.extend([(list(satirlar), imlec)] * max(1, round(sn * fps)))

    bekle(0.6, False)
    for k, a in enumerate(adimlar()):
        if temizle and k:
            satirlar.clear()
            bekle(0.2, False)
        metin = "$ " + a["komut"]
        satirlar.append(("", "komut"))
        adim = max(1, round(40 / fps))
        for j in range(0, len(metin) + 1, adim):
            satirlar[-1] = (metin[:j], "komut")
            kareler.append((list(satirlar), True))
        satirlar[-1] = (metin, "komut")
        bekle(0.4)
        cikti = a["cikti"].split("\n") if a["cikti"] else []
        grup = max(1, -(-len(cikti) // max(1, round(0.8 * fps))))  # kare başına satır
        for i in range(0, len(cikti), grup):
            satirlar.extend((ln, tur(ln)) for ln in cikti[i:i + grup])
            kareler.append((list(satirlar), True))
        satirlar.append((f"[çıkış {a['cikis']}]", "cikis0" if a["cikis"] == 0 else "hata"))
        bekle(1.7 + min(1.5, 0.1 * len(cikti)))
    bekle(1.0, False)
    return kareler


def sar(metin, sutun):
    """Uzun satır boşlukta kırılır, devam satırı 2 girintili (kelime ortasında kesmez)."""
    return textwrap.wrap(metin, sutun, subsequent_indent="  ", drop_whitespace=False,
                         break_long_words=True, break_on_hyphens=False, replace_whitespace=False) or [""]


def cizgili(d, ch, x, y, cw, kalinlik, ust, alt, renk):
    """Yazı tipinde olmayan karakteri hücre (x, y, cw genişlik; ust..alt büyük harf aralığı) içinde çizer."""
    h = alt - ust
    t, b = y + ust, y + alt
    if ch in "✔✓":
        d.line([(x + .12 * cw, t + .55 * h), (x + .40 * cw, t + .95 * h), (x + .90 * cw, t + .08 * h)],
               fill=renk, width=kalinlik, joint="curve")
    elif ch == "✗":
        d.line([(x + .15 * cw, t + .12 * h), (x + .85 * cw, t + .88 * h)], fill=renk, width=kalinlik)
        d.line([(x + .85 * cw, t + .12 * h), (x + .15 * cw, t + .88 * h)], fill=renk, width=kalinlik)
    elif ch == "ℹ":
        cx = x + cw / 2
        d.ellipse([x + .08 * cw, t, x + .92 * cw, b], outline=renk, width=max(1, kalinlik - 1))
        d.ellipse([cx - kalinlik / 2, t + .24 * h, cx + kalinlik / 2, t + .24 * h + kalinlik], fill=renk)
        d.line([(cx, t + .44 * h), (cx, t + .76 * h)], fill=renk, width=kalinlik)
    elif ch == "﹣":
        d.line([(x + .22 * cw, t + .55 * h), (x + .78 * cw, t + .55 * h)], fill=renk, width=kalinlik)


@lru_cache(maxsize=None)
def yazi_tipi(ad, punto):
    return ImageFont.truetype(str(HERE / "fonts" / ad), punto)


def cizim(satirlar, imlec, boyut_px, sutun, punto, baslik, ust_bosluk):
    w, h = boyut_px
    im = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(im)
    reg = yazi_tipi("JetBrainsMono-Regular.ttf", punto)
    bold = yazi_tipi("JetBrainsMono-Bold.ttf", punto)
    cw = reg.getlength("M")
    lh = int(punto * 1.45)
    pad = int(punto * 1.3)
    _, ust, _, alt = reg.getbbox("H")
    kalin = max(1, round(punto / 9))
    if baslik:
        d.text((pad, pad // 2), baslik, font=bold, fill=YEL)
    satir_listesi = []  # (metin, tur, ilk_parca_mi)
    for metin, t in satirlar:
        for n, parca in enumerate(sar(metin, sutun)):
            satir_listesi.append((parca, t, n == 0))
    kapasite = (h - ust_bosluk - pad) // lh
    satir_listesi = satir_listesi[-kapasite:]
    y = ust_bosluk
    son_x = pad
    for parca, t, ilk in satir_listesi:
        renk = RENK.get(t, DIM if t == "cikis0" else FG)
        yazi = bold if t == "komut" else reg
        x = pad
        segmentler = []  # (metin, renk)
        if t == "komut" and ilk and parca.startswith("$ "):
            segmentler = [("$ ", YEL), (parca[2:], FG)]
        else:
            segmentler = [(parca, renk)]
        for seg, r in segmentler:
            calisma = ""
            bas_x = x
            for ch in seg:
                if ch in CIZGILI:
                    if calisma:
                        d.text((bas_x, y), calisma, font=yazi, fill=r)
                    x_ch = x
                    cizgili(d, ch, x_ch, y, cw, kalin, ust, alt, r)
                    x += cw
                    calisma, bas_x = "", x
                else:
                    calisma += ch
                    x += cw
            if calisma:
                d.text((bas_x, y), calisma, font=yazi, fill=r)
        son_x = x
        y += lh
    if imlec and satir_listesi:
        d.rectangle([son_x + 2, y - lh + 4, son_x + 2 + cw * .6, y - 6], fill=YEL)
    return im


def kontrast_raporu():
    for ad, renk in (("krem", FG), ("sarı", YEL), ("sönük", DIM), ("camgöbeği", CYAN), ("turuncu", ORANGE), ("mercan", CORAL)):
        print(f"{ad:10s} {renk}  {kontrast(renk, BG):5.2f}:1")


def main():
    if sys.argv[1] == "kontrast":
        return kontrast_raporu()
    tur_adi, cikti = sys.argv[1], Path(sys.argv[2]).resolve()
    if tur_adi == "gif":
        fps, boyut, sutun, punto, baslik, ust, temizle = 10, (960, 540), 83, 18, "ajans-os", 56, True
    else:
        fps, boyut, sutun, punto, baslik, ust, temizle = 15, (1080, 1920), 55, 30, "", 60, False
    kareler = zaman_cizelgesi(fps, temizle)
    onbellek = {}

    def kare(satirlar, imlec):
        anahtar = (tuple(satirlar), imlec)
        if anahtar not in onbellek:
            onbellek[anahtar] = cizim(satirlar, imlec, boyut, sutun, punto, baslik, ust)
        return onbellek[anahtar]

    if tur_adi == "gif":
        # Ardışık aynı kareleri tek karede topla; süreleri toplanır.
        secilen, sureler = [], []
        onceki = None
        for satirlar, imlec in kareler:
            anahtar = (tuple(satirlar), imlec)
            if anahtar == onceki:
                sureler[-1] += int(1000 / fps)
            else:
                secilen.append(kare(satirlar, imlec).convert("P", palette=Image.Palette.ADAPTIVE, colors=32))
                sureler.append(int(1000 / fps))
                onceki = anahtar
        # Poster kare: statik önizleme (bağlantı kartı, mobil) ilk kareyi gösterir. Boş açılış karesi
        # yerine son kare (kapının yeşil sonucu) 0,5 sn öne konur; döngüde son sahnenin bekleyişini uzatır.
        secilen.insert(0, secilen[-1])
        sureler.insert(0, 500)
        secilen[0].save(cikti, save_all=True, append_images=secilen[1:], duration=sureler, loop=0, optimize=True)
    else:
        tmp = Path(tempfile.mkdtemp())
        sayilan = {}
        for i, (satirlar, imlec) in enumerate(kareler):
            anahtar = (tuple(satirlar), imlec)
            yol = tmp / f"f{i:05d}.png"
            if anahtar in sayilan:
                shutil.copyfile(sayilan[anahtar], yol)
            else:
                kare(satirlar, imlec).save(yol)
                sayilan[anahtar] = yol
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(tmp / "f%05d.png"),
                        "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(cikti)],
                       check=True)
        shutil.rmtree(tmp, ignore_errors=True)
    print(cikti, f"{len(kareler) / fps:.1f} sn", f"{cikti.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
