"""Offline checks for the exact public GitHub Pages directory."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
EXPECTED = {
    ".nojekyll", "index.html", "mo-storage.html", "style.css", "museum.css", "atlantis-logo.svg",
    "mo-theme.css", "favicon.svg", "app.mjs", "core.mjs", "workbench.mjs", "deck-store.mjs", "japanese-names.mjs", "publishing.mjs", "autocomplete.mjs", "presentation.css", "version.json", "data/results.json",
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
    assert "大会結果のあるデッキリストを掲載しています。大会の正式案内は未掲載です。" in home
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
    assert printings["meta"]["ruleVersion"] == 2
    for record in printings["cards"].values():
        assert record["en"]["candidates"] or record["ja"]["candidates"]
        for lang in ("en", "ja"):
            for printing in [record[lang]["target"], *record[lang]["candidates"]]:
                if printing:
                    assert isinstance(printing["regular"], bool)
                    assert isinstance(printing["promo"], bool)
                    assert isinstance(printing["finishes"], list)
    card_map = {c["id"]: c for c in cards["cards"]}
    assert len({d["id"] for d in decks}) == len(decks)
    for deck in decks:
        assert deck.get("sample") is False
        assert all(deck.get(k) for k in ("event", "venue", "result", "author", "source", "sourceDeckId"))
        assert deck["hero"] in ids
        assert sum(x["qty"] for x in deck["main"]) >= 60
        assert sum(x["qty"] for x in deck["side"]) <= 15
        for zone in ("main", "side"):
            assert len({x["id"] for x in deck[zone]}) == len(deck[zone])
            assert all(x["id"] in ids and isinstance(x["qty"], int) and x["qty"] > 0 for x in deck[zone])
        expected = "\n".join(f'{x["qty"]} {card_map[x["id"]]["name"]}' for x in deck["main"])
        expected += "\n\nSideboard\n" + "\n".join(f'{x["qty"]} {card_map[x["id"]]["name"]}' for x in deck["side"]) + "\n"
        assert deck["englishText"] == expected, deck["id"]
    assert all(x.get("id") and x.get("name") for x in decks)
    assert all(x.get("id") and x.get("title") for x in events)
    print("ATLANTIS Pages package: 1,015 cards, tournament-result decks, safe file boundary, relative links OK")


if __name__ == "__main__":
    main()
