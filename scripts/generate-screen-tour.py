"""Create the animated README preview from the screenshots in docs/images."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "docs" / "images"
OUTPUT = IMAGE_DIR / "screen-tour.gif"
IMAGE_NAMES = (
    "dashboard.PNG",
    "upload-validation.PNG",
    "closing-workspace.PNG",
    "storage-backup.PNG",
    "aws-files.PNG",
)
WIDTH = 1280


def main() -> None:
    frames = []
    for name in IMAGE_NAMES:
        with Image.open(IMAGE_DIR / name) as image:
            height = round(image.height * WIDTH / image.width)
            resized = image.convert("RGB").resize((WIDTH, height), Image.Resampling.LANCZOS)
            frames.append(resized.quantize(colors=128, method=Image.Quantize.MEDIANCUT))

    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=5000,
        loop=0,
        disposal=2,
        optimize=True,
    )
    print(f"Created {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
