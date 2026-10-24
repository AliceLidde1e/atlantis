"""Local QA server. Optional fault injection never modifies public files."""
import argparse
import functools
import http.server
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'site'
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8768)
parser.add_argument('--fail-normal-images',action='store_true')
args=parser.parse_args()

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if args.fail_normal_images and self.path.split('?')[0]=='/data/printings.json':
            data=json.loads((ROOT/'data/printings.json').read_text(encoding='utf-8'))
            for record in data['cards'].values():
                for lang in ('en','ja'):
                    for print in [record[lang]['target'],*record[lang]['candidates']]:
                        if print and print['regular'] and 'nonfoil' in print['finishes']:
                            print['image']=f'/__failed_images/{print["id"]}.jpg'
                            print['art']=print['image']
            body=json.dumps(data).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        else:super().do_GET()

http.server.ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(Handler,directory=str(ROOT))).serve_forever()
