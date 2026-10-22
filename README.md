# ATLANTIS クローズドテスト版

旧枠モダンのカード検索、掲載デッキ検索、大会案内、ブラウザ内のマイデッキ、MOテキスト取込・書出しを備えた静的Webアプリです。`site/` がGitHub Pagesへそのまま配信されます。サーバー、利用者アカウント、書込APIはありません。

## テスト版の範囲

- カード集合はOldframe Colosseumの旧枠モダン1,015種類に照合済みです。
- 掲載デッキ8件と大会案内2件は**架空のサンプル**です。実績、開催告知、申込先として使わないでください。
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

1. このフォルダの内容で新しいGitHubリポジトリを作成し、`main` にpushします。公開リポジトリが最も単純です。リポジトリ名は任意です。全リンクは相対パスなので、`https://OWNER.github.io/REPO/` 形式で動きます。
2. GitHubの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. **Actions → Deploy ATLANTIS closed test → Run workflow** を実行します。自動配信はしません。検査が通った実行だけがPagesへ配信されます。
4. Actionsの`deploy`結果に表示されるURLで、トップ・カード検索・MO画面・再読込後の保存件数を確認します。

新しいリポジトリとPagesのURLが決まったら、テスターにはそのURLを共有します。URLを知る人以外を技術的に遮断する構成ではありません。アクセス制限が必要になった場合は認証付きの配信先へ移します。

## 元サイトからの保存データ

元サイトの「マイデッキ」は「バックアップを書き出す」からJSONを書き出し、新しいURLの「マイデッキ」で読み込めます。MO画面の保存は別領域です。MO用の保存済みデッキは元サイトで1件ずつ `Export MO` し、新しいURLで `Import MO` できます。未保存の `My Storage` は先に元サイトでMO用デッキとして保存してください。カード画像や印刷版の表示設定は新しいURLで再取得されます。

## 開発元

この配信用リポジトリは、ATLANTISの検証用Site checkoutから生成した公開可能な静的ファイルのみを含みます。編集用原稿、取得ログ、Sites固有設定は含みません。元の生成入口は `package-mvp.py` です。
