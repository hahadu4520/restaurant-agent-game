from pathlib import Path

root = Path(__file__).resolve().parent
source = root / "src"
html = (source / "shell.html").read_text(encoding="utf-8-sig")
for name in ("scene", "game"):
    javascript = (source / f"{name}.js").read_text(encoding="utf-8-sig")
    html = html.replace(f"__{name.upper()}__", javascript, 1)
(root / "index.html").write_text(html, encoding="utf-8", newline="\n")
