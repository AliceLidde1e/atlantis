"""Offline checks for the exact public GitHub Pages directory."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
EXPECTED = {
    ".nojekyll", "index.html", "mo-storage.html", "style.css", "museum.css", "atlantis-logo.svg",
    "mo-theme.css", "favicon.svg", "app.mjs", "core.mjs",
    "site-bridge.mjs", "site-bridge-ui.mjs", "data/cards.json",
    "data/printings.json", "data/decks.json", "data/events.json",
    "typography.css", "fonts/iceberg/iceberg-400.woff2", "fonts/iceberg/OFL.txt",
    "fonts/shipporimincho/shipporimincho-400.woff2",
    "fonts/shipporimincho/shipporimincho-600.woff2", "fonts/shipporimincho/OFL.txt",
    "fonts/zenkakugothicnew/zenkakugothicnew-400.woff2",
    "fonts/zenkakugothicnew/zenkakugothicnew-700.woff2", "fonts/zenkakugothicnew/OFL.txt",
}


def main():
    actual = {p.relative_to(SITE).as_posix() for p in SITE.rglob("*") if p.is_file()}
    assert actual == EXPECTED, f"Unexpected public files: {actual ^ EXPECTED}"
    assert not any(p.is_symlink() for p in SITE.rglob("*"))
    home = (SITE / "index.html").read_text(encoding="utf-8")
    mo = (SITE / "mo-storage.html").read_text(encoding="utf-8")
    for name in ("museum.css", "atlantis-logo.svg", "favicon.svg", "mo-storage.html"):
        assert name in home
    for label in ("Featured Decks", "Information", "Getting Started", "My Storage", "Decks", "Cards", "Events", "My Decks"):
        assert label in home
    for name in ("mo-theme.css", "favicon.svg", "index.html#pool"):
        assert name in mo
    assert home.count('name="robots" content="noindex,nofollow"') == 1
    assert mo.count('name="robots" content="noindex,nofollow"') == 1
    assert "掲載デッキはサンプルです。大会の正式案内は未掲載です。" in home
    typography = (SITE / "typography.css").read_text(encoding="utf-8")
    assert all('href="typography.css"' in page for page in (home, mo))
    for font_ref in (name for name in EXPECTED if name.endswith(".woff2")):
        assert font_ref in typography
        assert (SITE / font_ref).read_bytes()[:4] == b"wOF2"
    for license_ref in (name for name in EXPECTED if name.endswith("OFL.txt")):
        assert "SIL OPEN FONT LICENSE" in (SITE / license_ref).read_text(encoding="utf-8")
    cards = json.loads((SITE / "data/cards.json").read_text(encoding="utf-8"))
    printings = json.loads((SITE / "data/printings.json").read_text(encoding="utf-8"))
    decks = json.loads((SITE / "data/decks.json").read_text(encoding="utf-8"))
    events = json.loads((SITE / "data/events.json").read_text(encoding="utf-8"))
    ids = {c["id"] for c in cards["cards"]}
    assert len(ids) == len(cards["cards"]) == 1015
    assert ids == set(printings["cards"])
    assert all(x.get("sample") is True for x in decks + events)
    assert all(x.get("id") and x.get("name") for x in decks)
    assert all(x.get("id") and x.get("title") for x in events)
    print("ATLANTIS Pages package: 1,015 cards, labeled samples, safe file boundary, relative links OK")


if __name__ == "__main__":
    main()
