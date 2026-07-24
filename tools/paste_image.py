#!/usr/bin/env python3
"""Paste a clipboard image into the lab-guide site and wire up the <img> tag.

This is an authoring helper for the static HTML lab guide under ``docs/``.
It reads an image from the system clipboard (a screenshot, or an image file
copied in the file explorer), saves it into the per-section image folder
``docs/assets/images/<section>/``, and — unless ``--no-insert`` is given —
auto-inserts a ready ``<figure><img></figure>`` block into that section's
HTML page.

The "project section" is auto-detected: by default the most recently modified
``*.html`` file in ``docs/`` is treated as the page you are working on, so you
never have to type an image path by hand. Override with ``--section`` or
``--file``.

Examples
--------
    # Detect the section automatically, save + insert the pasted image:
    python tools/paste_image.py

    # Target a specific section, add a caption:
    python tools/paste_image.py --section prepare-lab --caption "CML dashboard"

    # Just save the file and print the snippet, do not edit any HTML:
    python tools/paste_image.py --no-insert

    # List the sections the tool knows about:
    python tools/paste_image.py --list

Requires Pillow:  pip install -r tools/requirements.txt
"""
from __future__ import annotations

import argparse
import io
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = REPO_ROOT / "docs"
APP_JS = DOCS_DIR / "assets" / "app.js"
# Images live under docs/assets/images/<section>/ so the relative src used from
# a page in docs/ is simply  assets/images/<section>/<file>.
IMAGES_ROOT = DOCS_DIR / "assets" / "images"
IMG_SRC_PREFIX = "assets/images"

# Auto-insert marker: if a page contains this comment, images are inserted just
# before it; otherwise they are appended at the end of the page content.
PASTE_MARKER = "<!-- paste-image -->"


# --------------------------------------------------------------------------- #
# Section discovery
# --------------------------------------------------------------------------- #
def load_sections() -> dict[str, str]:
    """Return {slug: title} parsed from the PAGES array in docs/assets/app.js.

    Falls back to scanning docs/*.html if app.js cannot be read, so the tool
    still works if the nav script is renamed.
    """
    sections: dict[str, str] = {}
    if APP_JS.exists():
        text = APP_JS.read_text(encoding="utf-8", errors="replace")
        # Match entries like: { file: "prepare-lab.html", num: "2", title: "Prepare the Lab", ... }
        for m in re.finditer(
            r'file:\s*"([^"]+?)\.html".*?title:\s*"([^"]*)"', text
        ):
            slug, title = m.group(1), m.group(2)
            sections[slug] = title
    if not sections and DOCS_DIR.exists():
        for html in sorted(DOCS_DIR.glob("*.html")):
            sections[html.stem] = html.stem
    return sections


def detect_section(sections: dict[str, str]) -> str | None:
    """Auto-detect the section = most recently modified docs/*.html file."""
    if not DOCS_DIR.exists():
        return None
    html_files = [p for p in DOCS_DIR.glob("*.html") if p.stem in sections] or list(
        DOCS_DIR.glob("*.html")
    )
    if not html_files:
        return None
    newest = max(html_files, key=lambda p: p.stat().st_mtime)
    return newest.stem


# --------------------------------------------------------------------------- #
# Clipboard
# --------------------------------------------------------------------------- #
def grab_clipboard_image():
    """Return a PIL.Image from the clipboard, or None if there isn't one.

    Handles both a raw bitmap (a screenshot) and a file copied in the OS file
    manager. On Linux, falls back to wl-paste / xclip when Pillow returns None.
    """
    try:
        from PIL import Image, ImageGrab
    except ImportError:
        sys.exit(
            "Pillow is required. Install it with:\n"
            "    pip install -r tools/requirements.txt"
        )

    try:
        data = ImageGrab.grabclipboard()
    except Exception:
        data = None

    if isinstance(data, list):  # a list of file paths was copied
        for name in data:
            try:
                return Image.open(name)
            except Exception:
                continue
        return None
    if data is not None:
        return data  # already a PIL.Image

    # Linux fallback: Pillow's grabclipboard has limited X11/Wayland support.
    if sys.platform.startswith("linux"):
        for cmd in (["wl-paste", "-t", "image/png"], ["xclip", "-selection", "clipboard", "-t", "image/png", "-o"]):
            try:
                out = subprocess.run(cmd, capture_output=True, timeout=5)
            except (FileNotFoundError, subprocess.SubprocessError):
                continue
            if out.returncode == 0 and out.stdout:
                try:
                    return Image.open(io.BytesIO(out.stdout))
                except Exception:
                    continue
    return None


# --------------------------------------------------------------------------- #
# Saving
# --------------------------------------------------------------------------- #
def next_filename(folder: Path, section: str, explicit: str | None) -> str:
    """Pick an output filename, auto-incrementing <section>-NN.png by default."""
    if explicit:
        name = explicit
        if not re.search(r"\.(png|jpg|jpeg|gif|webp)$", name, re.IGNORECASE):
            name += ".png"
        return name
    existing = {p.name for p in folder.glob(f"{section}-*.png")}
    n = 1
    while f"{section}-{n:02d}.png" in existing:
        n += 1
    return f"{section}-{n:02d}.png"


def save_image(image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fmt = "PNG"
    if path.suffix.lower() in (".jpg", ".jpeg"):
        fmt = "JPEG"
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
    elif path.suffix.lower() == ".webp":
        fmt = "WEBP"
    elif path.suffix.lower() == ".gif":
        fmt = "GIF"
    image.save(path, fmt)


# --------------------------------------------------------------------------- #
# HTML insertion
# --------------------------------------------------------------------------- #
def build_figure(src: str, alt: str, caption: str | None, indent: str = "        ") -> str:
    lines = [f'{indent}<figure class="figure">',
             f'{indent}  <img src="{src}" alt="{alt}" loading="lazy">']
    if caption:
        lines.append(f"{indent}  <figcaption>{caption}</figcaption>")
    lines.append(f"{indent}</figure>")
    return "\n".join(lines)


def insert_into_html(html_path: Path, figure_block: str) -> bool:
    """Insert figure_block into the page. Returns True if the file was changed."""
    text = html_path.read_text(encoding="utf-8")

    # 1) Preferred: just before an explicit <!-- paste-image --> marker.
    idx = text.find(PASTE_MARKER)
    if idx != -1:
        line_start = text.rfind("\n", 0, idx) + 1
        new_text = text[:line_start] + figure_block + "\n" + text[line_start:]
        html_path.write_text(new_text, encoding="utf-8")
        return True

    # 2) Otherwise: just before the pager nav (end of page content).
    m = re.search(r'[ \t]*<nav[^>]*id="pager-mount"', text)
    if m is None:
        # 3) Last resort: before the closing </main>.
        m = re.search(r"[ \t]*</main>", text)
    if m is None:
        return False

    line_start = text.rfind("\n", 0, m.start()) + 1
    new_text = text[:line_start] + figure_block + "\n\n" + text[line_start:]
    html_path.write_text(new_text, encoding="utf-8")
    return True


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main() -> int:
    sections = load_sections()

    parser = argparse.ArgumentParser(
        description="Paste a clipboard image into the lab-guide site.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--section", help="Section slug, e.g. prepare-lab (default: auto-detect).")
    parser.add_argument("--file", help="Path to the section .html file (overrides --section).")
    parser.add_argument("--name", help="Output filename (default: <section>-NN.png).")
    parser.add_argument("--caption", help="Optional <figcaption> text.")
    parser.add_argument("--alt", help="Image alt text (default: derived from caption/section).")
    parser.add_argument("--no-insert", action="store_true", help="Save the image but do not edit any HTML.")
    parser.add_argument("--list", action="store_true", help="List known sections and exit.")
    args = parser.parse_args()

    if args.list:
        print("Known sections:")
        for slug, title in sections.items():
            print(f"  {slug:<18} {title}")
        return 0

    # Resolve the target section / html file.
    if args.file:
        html_path = Path(args.file)
        if not html_path.is_absolute():
            html_path = (Path.cwd() / html_path).resolve()
        if not html_path.exists():
            html_path = DOCS_DIR / Path(args.file).name
        section = html_path.stem
    else:
        section = args.section or detect_section(sections)
        if not section:
            print("Could not determine a section. Use --section or --file.", file=sys.stderr)
            return 2
        html_path = DOCS_DIR / f"{section}.html"

    if section not in sections:
        print(f"Warning: '{section}' is not a known section. Known: {', '.join(sections)}",
              file=sys.stderr)

    # Grab the clipboard image.
    image = grab_clipboard_image()
    if image is None:
        print(
            "No image found on the clipboard.\n"
            "Take a screenshot (or copy an image file) and run this again.",
            file=sys.stderr,
        )
        return 1

    # Save it.
    folder = IMAGES_ROOT / section
    filename = next_filename(folder, section, args.name)
    out_path = folder / filename
    save_image(image, out_path)

    rel_src = f"{IMG_SRC_PREFIX}/{section}/{filename}"
    alt = args.alt or args.caption or f"{sections.get(section, section)} screenshot"
    rel_saved = out_path.relative_to(REPO_ROOT).as_posix()
    print(f"Saved image  -> {rel_saved}  ({image.width}x{image.height})")

    figure_block = build_figure(rel_src, alt, args.caption)

    # Insert into the HTML unless suppressed.
    if args.no_insert:
        print("\nSnippet (not inserted; --no-insert):\n")
        print(figure_block)
    elif not html_path.exists():
        print(f"\nHTML page not found ({html_path.name}); snippet not inserted:\n")
        print(figure_block)
    else:
        if insert_into_html(html_path, figure_block):
            print(f"Inserted <img> -> {html_path.relative_to(REPO_ROOT).as_posix()}")
            marker_hint = "" if PASTE_MARKER in html_path.read_text(encoding="utf-8") else \
                f"\nTip: add '{PASTE_MARKER}' where you want images to land."
            print(f"Relative src   -> {rel_src}{marker_hint}")
        else:
            print("Could not find an insertion point; snippet below:\n")
            print(figure_block)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
