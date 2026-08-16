from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output" / "imagegen" / "aws-load-test-blog-thumbnail.png"
OUTPUT = ROOT / "output" / "imagegen" / "aws-load-test-blog-thumbnail-v2.png"

image = Image.open(SOURCE).convert("RGBA")
overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

font_bold = r"C:\Windows\Fonts\malgunbd.ttf"
font_regular = r"C:\Windows\Fonts\malgun.ttf"
title = ImageFont.truetype(font_bold, 78)
subtitle = ImageFont.truetype(font_bold, 38)
label = ImageFont.truetype(font_regular, 25)

x, y = 92, 300
draw.rounded_rectangle((70, 255, 780, 610), radius=26, fill=(3, 16, 46, 190), outline=(52, 211, 235, 80), width=2)
draw.text((x, y), "AWS 부하 테스트", font=title, fill=(242, 249, 255, 255), stroke_width=2, stroke_fill=(3, 16, 46, 255))
draw.text((x, y + 112), "50명 요청에서 503 오류", font=subtitle, fill=(255, 124, 124, 255))
draw.text((x, y + 180), "Lambda Throttles 원인 분석", font=label, fill=(125, 230, 255, 255))

Image.alpha_composite(image, overlay).convert("RGB").save(OUTPUT, quality=95)
print(OUTPUT)
