"""Fetch print metadata; atomically rebuild the compact public printing snapshot.

Raw API responses stay in ignored .printing-cache/. No images are downloaded.
Use --offline after a complete fetch to verify/rebuild without network requests.
"""
import argparse
import datetime as dt
import gzip
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULE_VERSION = 2
FIELDS = ('id oracle_id lang released_at set collector_number promo variation full_art '
          'border_color frame_effects games layout oversized image_status image_uris '
          'card_faces scryfall_uri digital set_type finishes').split()


def eligible(card, today):
    return ('paper' in card.get('games', []) and card.get('lang') in ('en', 'ja')
            and not card.get('digital') and not card.get('oversized')
            and card.get('border_color') != 'gold'
            and card.get('set_type') not in ('memorabilia', 'token', 'minigame')
            and card.get('layout') not in ('token', 'double_faced_token', 'emblem', 'art_series')
            and card.get('released_at', '9999') <= today)


def regular(card):
    return (not card.get('promo') and card.get('set_type') != 'promo'
            and not card.get('variation') and not card.get('full_art')
            and card.get('border_color') != 'borderless' and card.get('layout') != 'reversible_card'
            and not set(card.get('frame_effects', [])) &
            {'extendedart', 'showcase', 'inverted', 'shatteredglass'})


def tier(card):
    # A normal printing that supports BOTH foil and nonfoil is still preferred.
    return (0 if regular(card) else 2) + (0 if 'nonfoil' in card.get('finishes', []) else 1)


def natural(value):
    return tuple((0, int(v)) if v.isdigit() else (1, v)
                 for v in re.split(r'(\d+)', value))


def rank(card, lang):
    date = int(card['released_at'].replace('-', ''))
    return (tier(card), date if lang == 'en' else -date,
            card['set'], natural(card['collector_number']), card['id'])


def compact(card):
    faces = card.get('card_faces', [])
    images = card.get('image_uris') or (faces[0].get('image_uris', {}) if faces else {})
    usable = card.get('image_status') != 'missing'
    return dict(id=card['id'], lang=card['lang'], released=card['released_at'],
                set=card['set'], number=card['collector_number'],
                image=images.get('normal', '') if usable else '',
                art=images.get('art_crop', '') if usable else '', url=card['scryfall_uri'],
                regular=regular(card), promo=bool(card.get('promo')),
                finishes=card.get('finishes', []))


def select(rows, lang, today):
    options = sorted((r for r in rows if r.get('lang') == lang and eligible(r, today)),
                     key=lambda r: rank(r, lang))
    # Keep the ideal target even if its image is unavailable, so the UI can explain fallback.
    target = compact(options[0]) if options else None
    images = [compact(r) for r in options if compact(r)['image']]
    candidates = images[:3]
    # Retain one relaxed choice when available, after the ordinary choices.
    relaxed = next((compact(r) for r in options if tier(r) > 0 and compact(r)['image']), None)
    if relaxed and all(r['id'] != relaxed['id'] for r in candidates):
        candidates.append(relaxed)
    return dict(target=target, candidates=candidates, count=len(options),
                status='available' if options else 'absent')


def request(url):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'AtlantisPrintingSnapshot/2.0', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=45) as response:
                data = json.load(response)
            time.sleep(.15)
            return data
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            time.sleep(2 ** attempt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--date', default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    args = parser.parse_args()
    cards = json.loads((ROOT/'site/data/cards.json').read_text(encoding='utf-8'))['cards']
    cache = ROOT/'.printing-cache'/args.date
    cache.mkdir(parents=True, exist_ok=True)
    all_rows = []
    for start in range(0, len(cards), 10):
        ids = [c['id'] for c in cards[start:start+10]]
        query = '('+' or '.join('oracleid:'+oid for oid in ids)+') (lang:en or lang:ja) game:paper'
        path = cache/f'{start:04}.json'
        if path.exists():
            saved = json.loads(path.read_text(encoding='utf-8'))
            assert saved['query'] == query and saved['complete']
            rows = saved['rows']
        else:
            if args.offline:
                raise RuntimeError('Missing complete cache: '+str(path))
            url = 'https://api.scryfall.com/cards/search?'+urllib.parse.urlencode(dict(
                q=query, unique='prints', include_multilingual='true', order='released'))
            rows = []
            while url:
                result = request(url)
                rows.extend({k: c[k] for k in FIELDS if k in c} for c in result['data'])
                url = result.get('next_page') if result.get('has_more') else None
            assert len(rows) == result['total_cards']
            temporary = path.with_suffix('.tmp')
            temporary.write_text(json.dumps(dict(query=query, rows=rows, complete=True),
                                            ensure_ascii=False), encoding='utf-8')
            temporary.replace(path)
        # Reversible specialty cards can have distinct Oracle IDs on their faces.
        # Only store a face under its matching Oracle ID; never use the other card's image.
        normalized = []
        for row in rows:
            if row.get('oracle_id') in ids:
                normalized.append(row)
            elif not row.get('oracle_id'):
                seen_faces = set()
                for face in row.get('card_faces', []):
                    if face.get('oracle_id') in ids and face['oracle_id'] not in seen_faces:
                        seen_faces.add(face['oracle_id'])
                        normalized.append({**row, 'oracle_id': face['oracle_id'],
                                           'image_uris': face.get('image_uris', {}),
                                           'card_faces': []})
            else:
                raise ValueError('Unexpected Oracle ID from search')
        assert all('finishes' in r for r in normalized)
        all_rows.extend(normalized)
        print(f'Print metadata: {min(start+10, len(cards))}/{len(cards)}; {len(all_rows)} printings', flush=True)
    grouped = {c['id']: [] for c in cards}
    for row in all_rows:
        grouped[row['oracle_id']].append(row)
    records = {oid: {lang: select(rows, lang, args.date) for lang in ('en', 'ja')}
               for oid, rows in grouped.items()}
    assert all(r['en']['candidates'] or r['ja']['candidates'] for r in records.values())
    output = dict(meta=dict(snapshotDate=args.date, fetchedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
                            ruleVersion=RULE_VERSION, count=len(records), candidateCount=len(all_rows),
                            complete=True, source='https://scryfall.com/docs/api/cards/search'), cards=records)
    raw = json.dumps(output, ensure_ascii=False, separators=(',', ':')).encode()
    dest = ROOT/'site/data/printings.json'
    dest.with_suffix('.tmp').write_bytes(raw)
    dest.with_suffix('.tmp').replace(dest)
    print(f'Complete: {len(records)} cards; {len(raw):,} bytes; gzip {len(gzip.compress(raw)):,} bytes', flush=True)


if __name__ == '__main__':
    main()

