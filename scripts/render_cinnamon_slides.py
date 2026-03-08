#!/usr/bin/env python3

import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

WIDTH = 1080
HEIGHT = 1920
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"


def load_font(font_path: str, size: int):
    try:
        return ImageFont.truetype(font_path, size=size)
    except Exception:
        return ImageFont.load_default()


def multiline(draw: ImageDraw.ImageDraw, text: str, font, max_width: int):
    words = text.split()
    lines = []
    current = []
    for word in words:
      candidate = " ".join(current + [word]).strip()
      if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
          current.append(word)
      else:
          if current:
              lines.append(" ".join(current))
          current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def draw_lines(draw, lines, font, fill, x, y, spacing):
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font)
        y = bbox[3] + spacing
    return y


def render_slide(scene: dict, output_path: Path):
    base = Image.open(scene["source"]).convert("RGB")
    fitted = ImageOps.fit(base, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS)
    canvas = fitted.copy().convert("RGBA")

    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle((0, 0, WIDTH, HEIGHT), fill=(0, 0, 0, 55))
    overlay_draw.rounded_rectangle((56, 110, 1024, 420), radius=36, fill=(0, 0, 0, 128))
    overlay_draw.rounded_rectangle((56, 1505, 1024, 1800), radius=36, fill=(18, 18, 18, 148))
    canvas = Image.alpha_composite(canvas, overlay)

    draw = ImageDraw.Draw(canvas)
    headline_font = load_font(FONT_BOLD, 82)
    body_font = load_font(FONT_REGULAR, 42)
    cta_font = load_font(FONT_BOLD, 54)
    accent_font = load_font(FONT_REGULAR, 34)

    headline_lines = multiline(draw, scene["headline"], headline_font, 900)
    body_lines = multiline(draw, scene["subline"], body_font, 900)

    cursor_y = 165
    cursor_y = draw_lines(draw, headline_lines, headline_font, (255, 255, 255), 84, cursor_y, 10)
    draw_lines(draw, body_lines, body_font, (243, 243, 243), 84, cursor_y + 22, 10)

    draw.text((84, 1565), "Fresh at BreadHub", font=accent_font, fill=(249, 196, 107))
    draw.text((84, 1630), "Try the cinnamon line today", font=cta_font, fill=(255, 255, 255))

    canvas.convert("RGB").save(output_path, quality=95)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_cinnamon_slides.py <scenes.json>")

    config_path = Path(sys.argv[1])
    payload = json.loads(config_path.read_text())
    output_dir = Path(payload["outputDir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, scene in enumerate(payload["scenes"]):
        target = output_dir / f"slide-{index + 1:02d}.jpg"
        render_slide(scene, target)
        print(str(target))


if __name__ == "__main__":
    main()
