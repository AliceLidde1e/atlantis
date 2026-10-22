# ATLANTIS クローズドテスト版

旧枠モダンのカード検索、掲載デッキ検索、大会案内、ブラウザ内のマイデッキ、MOテキスト取込・書出しを備えた静的Webアプリです。`site/` がGitHub Pagesへそのまま配信されます。サーバー、利用者アカウント、書込APIはありません。

外観と画面導線は「ATLANTIS デザイン仕様書 v1.4」に合わせています。ホームには Navigation、Featured Decks、Information を配置し、主要メニューは Decks、Cards、Events、My Decks です。Cards の検索結果から画像を選ぶと詳細が開き、そこで My Storage の Main / Sideboard へ追加できます。幅639px以下の My Storage はカード名、画像、Main +、Side +、削除を一行に表示します。

英字には端末にインストールされた CgWoodBlock を優先します。Web配信用ファイルは同梱していないため、未インストールの端末では代替書体を表示します。

## テスト版の範囲

- カード集合は旧枠モダンのカード集合1,015種類を収録しています。
- 掲載デッキ8件は**架空のサンプル**です。実績や推奨構築として使わないでください。大会の正式案内は未掲載です。データに残る大会サンプル2件は画面に表示しません。
- マイデッキはブラウザのlocalStorage、MO画面の保存はIndexedDBです。端末やブラウザ間で自動同期されません。サイトのドメインが変わっても保存内容は自動移行されません。
- Scryfallへの検索とカード画像取得には通信が必要です。
- PagesのURLは公開アクセス可能です。`noindex`は検索エンジンへの依頼であり、閲覧制限ではありません。機密情報を掲載しないでください。

## 確認

```text
python check_site.py
node --check site/app.mjs
node --check site/core.mjs
node --check site/site-bridge.mjs
node --check site/site-bridge-ui.mjs
```

ローカル表示は `site/` を静的HTTPサーバーで配信して確認します。ファイルを直接開くとブラウザの制限でJSONを読めません。

## GitHub Pagesへの配信

- リポジトリ：<https://github.com/AliceLidde1e/atlantis>
- テスト用Webアプリ：<https://alicelidde1e.github.io/atlantis/>
- **Settings → Pages → Build and deployment → Source** は **GitHub Actions** に設定済みです。

今後、`main` に修正を反映すると **Check ATLANTIS site** が自動で検査します。検査結果が成功したら、GitHubの **Actions → Deploy ATLANTIS closed test → Run workflow** を選びます。配信は手動なので、修正を反映しただけでは公開ページは更新されません。配信完了後、Actionsの`deploy`結果に表示されるURLでトップ・カード検索・MO画面を確認してください。

テスターにはWebアプリのURLを共有します。URLを知る人以外を技術的に遮断する構成ではありません。アクセス制限が必要になった場合は認証付きの配信先へ移します。

## 元サイトからの保存データ

元サイトの「マイデッキ」は「バックアップを書き出す」からJSONを書き出し、新しいURLの「マイデッキ」で読み込めます。MO画面の保存は別領域です。MO用の保存済みデッキは元サイトで1件ずつ `Export MO` し、新しいURLで `Import MO` できます。未保存の `My Storage` は先に元サイトでMO用デッキとして保存してください。カード画像や印刷版の表示設定は新しいURLで再取得されます。

## 開発元

この配信用リポジトリは、ATLANTISの検証用Site checkoutから生成した公開可能な静的ファイルのみを含みます。編集用原稿、取得ログ、Sites固有設定は含みません。元の生成入口は `package-mvp.py` です。
