# ATLANTIS クローズドテスト版

現行の要件・実装状況・引継ぎは [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) を参照してください。
次回の変更候補・未実装・反映済みの整理は [docs/NEXT-UPDATE.md](docs/NEXT-UPDATE.md) を参照してください（2026-10-31更新）。

旧枠モダンのカード検索、掲載デッキ検索、大会案内、ブラウザ内のマイデッキ、MOテキスト取込・書出しを備えた静的Webアプリです。`site/` がGitHub Pagesへそのまま配信されます。サーバー、利用者アカウント、書込APIはありません。

外観と画面導線は「ATLANTIS デザイン仕様書 v1.4」に合わせています。ホームには Navigation、Featured Decks、Information を配置し、主要メニューは Decks、Cards、Events、My Decks です。Cards の検索結果からMain／Side／Maybeへ直接追加できます。PCは検索と編集を並べ、モバイルは編集モーダルで切り替えます。保存済みデッキは表示モーダルを開き、Edit Deckから編集します。

フォントは共通の `site/typography.css` で管理します。英語見出し・ボタン・タブは **Iceberg**、日本語見出し・解説・記事本文は **Shippori Mincho（しっぽり明朝）**、検索・デッキエディタ等の実用UIは **Zen Kaku Gothic New** です。数値・補助データは必要に応じて等幅書体を使用します。3書体はSIL Open Font License 1.1のもと、WOFF2と許諾文を `site/fonts/` に同梱し、外部フォントサービスへの通信なしで表示します。

## テスト版の範囲

- カード集合は旧枠モダンのカード集合1,015種類を収録しています。
- 掲載デッキ48件は、提供された `deckIndex_review.xlsx` の戦績欄が入力されているリストです。戦績空欄の59件と既存のサンプル8件は掲載していません。カード明細40件と同梱テキスト8件をカード集合・枚数・英語書出しと照合済みです。大会の正式案内は未掲載です。データに残る大会サンプル2件は画面に表示しません。
- マイデッキと下書きはIndexedDBです。旧localStorageは初回に引き継ぎ、MO専用画面との互換コピーとして維持します。MO画面の別IndexedDBは保持します。端末やブラウザ間で自動同期されません。サイトのドメインが変わっても保存内容は自動移行されません。
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

`main` に修正を反映すると **Check ATLANTIS site** が自動で検査します。手動で配信する場合はGitHubの **Actions → Deploy ATLANTIS closed test → Run workflow** を選びます。現在は対象ファイルのmainへの変更で、検証成功後に自動配信します。手動起動も利用できます。配信完了後、Actionsの`deploy`結果に表示されるURLでトップ・カード検索・MO画面を確認してください。

テスターにはWebアプリのURLを共有します。URLを知る人以外を技術的に遮断する構成ではありません。アクセス制限が必要になった場合は認証付きの配信先へ移します。

## 元サイトからの保存データ

元サイトの「マイデッキ」は「バックアップを書き出す」からJSONを書き出し、新しいURLの「マイデッキ」で読み込めます。MO画面の保存は別領域です。MO用の保存済みデッキは元サイトで1件ずつ `Export MO` し、新しいURLで `Import MO` できます。未保存の `My Storage` は先に元サイトでMO用デッキとして保存してください。カード画像や印刷版の表示設定は新しいURLで再取得されます。

## 開発元

この配信用リポジトリは、ATLANTISの検証用Site checkoutから生成した公開可能な静的ファイルのみを含みます。編集用原稿、取得ログ、Sites固有設定は含みません。元の生成入口は `package-mvp.py` です。

## 掲載データの更新

[単一HTMLのJSONエディター](tools/atlantis-editor.html)を保存して手元で開きます。[掲載・検証・停止・復元の手順](docs/PUBLISHING.md)と[正式リリース準備表](docs/RELEASE-CHECKLIST.md)を参照してください。対象の変更をmainへ反映すると、検証成功後にPagesへ自動配信します。
