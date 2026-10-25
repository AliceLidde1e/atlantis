"""Loopback-only preview; optional synthetic results never change public JSON."""
import argparse
import functools
import http.server
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8770)
parser.add_argument('--fixture-results', action='store_true')
args = parser.parse_args()
deck = json.loads((ROOT/'site/data/decks.json').read_text(encoding='utf-8'))[0]
deck.update(id='preview-deck', name='表示確認用デッキ', author='テストプレイヤー', event='表示確認用の架空大会', venue='テスト会場')
result = dict(id='preview-result', eventId='', title=deck['event'], venue=deck['venue'], date='2026-10-25', players=8, topCut=1,
              source='ローカル表示テスト専用・実績ではありません', standings=[dict(rank=1, player=deck['author'], wins=5, losses=1, draws=0, deckId=deck['id']),
              dict(rank=2, player='非公開デッキのテスト', wins=4, losses=1, draws=1, deckId='')])

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/editor.html':
            body = (ROOT/'tools/atlantis-editor.html').read_bytes()
            mime = 'text/html; charset=utf-8'
        elif args.fixture_results and path in ('/data/results.json', '/data/decks.json'):
            body = json.dumps([result] if path.endswith('results.json') else [deck], ensure_ascii=False).encode()
            mime = 'application/json; charset=utf-8'
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

http.server.ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(Handler, directory=str(ROOT/'site'))).serve_forever()
