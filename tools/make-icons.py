# 장난감 상자 앱 아이콘(icons/*.png): 연보라 바탕에 🧸. Noto Color Emoji 폰트(OFL)로 그림
# 실행: python tools/make-icons.py [Noto Color Emoji 폰트 경로]   (Pillow 필요)
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
out = Path(__file__).resolve().parent.parent / 'icons'
font = ImageFont.truetype(sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109)  # 비트맵 폰트라 109 고정
glyph = Image.new('RGBA', (320, 320), (0, 0, 0, 0))
ImageDraw.Draw(glyph).text((160, 160), '🧸', font=font, embedded_color=True, anchor='mm')
l, t, r, b = glyph.getbbox()
glyph = glyph.crop((l - 4, t - 4, r + 4, b + 4))  # 가장자리가 확대 때 잘리지 않게 여백
BG = (236, 237, 253, 255)  # --accent-soft #ECEDFD

def icon(size, frac, rounded):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded: d.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=BG)
    else: d.rectangle((0, 0, size, size), fill=BG)
    w = round(size * frac); h = round(glyph.height * w / glyph.width)
    g = glyph.resize((w, h), Image.LANCZOS)
    img.alpha_composite(g, ((size - w) // 2, (size - h) // 2 + round(size * 0.01)))
    return img

for s in (192, 512):
    icon(s, 0.66, True).save(f'{out}/app-{s}.png')
    icon(s, 0.56, False).save(f'{out}/app-maskable-{s}.png')  # 마스커블: 가운데 80% 안에 들게
icon(180, 0.62, False).convert('RGB').save(f'{out}/apple-touch-icon.png')  # 아이폰은 모서리를 알아서 둥글게
