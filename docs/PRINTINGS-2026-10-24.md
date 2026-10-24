# 表示版データと代替画像の確認

2026-10-24、選択規則 v2。英語は通常・非FOILの最古版、日本語は通常・非FOILの最新版を優先する。紙版のみを対象にし、同一Oracle IDから選択する。

優先言語内で、通常・非FOIL、通常のFOIL等、特殊仕様・非FOIL、特殊仕様のFOIL等の順に候補を作る。画像がない候補は表示用候補から除外し、優先言語の候補が尽きた場合はもう一方の言語を使う。通信失敗時にも次候補へ進み、実際の版・FOIL／プロモ等の仕様と代替理由を表示する。全候補が通信失敗した場合はカード名と失敗状態を残す。

## 再生成

- `python scripts/rebuild-printings.py --date 2026-10-24`
- 取得済みキャッシュから再生成する場合は `--offline` を追加。
- 取得キャッシュは `.printing-cache/` に保存し、公開・コミットしない。配信は候補を絞った `site/data/printings.json` のみ。画像ファイルは一括同梱しない。
- 1,015種類とも英語・日本語の通常・非FOIL版が存在することを確認。配信JSONは4,138,561 bytes、gzip 437,939 bytes。旧データに対するgzip増加は50,805 bytes。

## 検証

- Beast of Burden: ULG #122、Withered Wretch: LGN #86、Soul Collector: SCG #74。プロモ版ではなく通常版を実際のブラウザで確認。
- `node printing.test.mjs`: 全カード、上記3件、画像欠落、FOILのみ、別言語の代替理由を確認。
- `python scripts/test-printings.py`: 生成時の選択順・候補保持を確認。
- `python check_site.py` と既存検索テストで公開境界・検索等を確認。
- `python scripts/preview-printings.py --port 8769 --fail-normal-images` は通常版画像URLだけをローカルの404へ差し替える検証専用サーバー。配信データは変更しない。
- 上記サーバーで役畜の通常版候補の通信失敗後に7ED #287★へ切り替わり、「代替表示：FOIL版（画像取得失敗）」と表示されることを実ブラウザで確認。

日本語名補正とPWAはこの変更に含まない。スマートフォン実機での検証は別途行う。
