# 掲載・JSON編集・自動公開の運用

更新日：2026-10-25。対象はGitHub Pages版ATLANTIS。

## 入力と受け渡し

1. リポジトリの `tools/atlantis-editor.html` を保存し、手元のブラウザで開く。単一HTMLで、編集・検証・書き出しに外部通信やインストールは不要。
2. 公開中と同じ版の `site/data/events.json`、`results.json`、`decks.json`、`cards.json` を読み込む。空の状態から既存ファイルを置き換えない。編集前のJSONは別に保管する。
3. イベント案内・大会結果・公開デッキを編集する。デッキのMOテキストを変更したら「MOテキストを反映」を押す。辞書にないカードは推測せず修正する。
4. 全データを検証する。日時は日本時間で入力する。大会結果は通算勝敗だけを入力し、上位公開枠内のデッキIDだけを指定する。
5. 変更したすべてのJSONを書き出して運営へ渡す。1ファイルだけ保存しても他ファイルの未保存表示は消えない。ブラウザを閉じると未書き出しの編集は失われる。
6. 運営が公開名・出典・掲載許諾・公開対象を確認してから、以下の手順で取り込む。内部の連絡先・許諾記録はHTML、JSON、公開Git履歴へ入れない。

エディター自体はGitHubへ送信しない。受け渡されたJSONを管理者または作業を依頼されたGPTがリポジトリへ反映する。一般閲覧者のMy Decksを自動で公開する機能はない。

## 公開データの形式

| ファイル | 内容・必須項目 |
| --- | --- |
| `events.json` | 配列。`id`, `title`, `sample`。実イベントは `start`, `end`（タイムゾーン付き日時・開始＜終了）, `venue`, `format` も必須。`address`, `fee`, `description`, `rules`, `entryUrl`, `entryLabel`, `entryNote` は案内用。申込URLは認証情報のないHTTPS。未設定なら申込ボタンなし |
| `results.json` | 配列。`id`, `title`, `date`（実在するYYYY-MM-DD）, `venue`, `source`, `players`（正整数）, `topCut`（1〜参加人数）, `standings`（空でない配列）。`eventId` は対応する正式イベントがある場合に指定。架空の結果は公開しない |
| `standings` の行 | `rank`, `player`, `wins`, `losses`, `draws`, `deckId`。勝敗は0以上の整数。順位は1〜参加人数。タイ順位は許可し、同一公開名の重複行は不可。`deckId` は上位枠内だけ。未公開なら空文字。大会名・会場・公開プレイヤー名は参照先のデッキと一致させる |
| `decks.json` | 既存形式を維持。公開名・大会名・会場・入賞表記・出典・出典ID・英語テキスト等が必須。`main`, `side` は `{id: Oracle ID, qty: 正整数}` の配列。同一ゾーン内の重複IDは不可。メイン60枚以上、サイド15枚以下。英語テキストはID・枚数・順序と完全一致。`hero` は辞書内の代表カード。`sample:false` |
| `cards.json` | 配布済みカード辞書。エディターは参照だけに使い、カード集合を編集・書き出ししない |

既存デッキの未知の追加項目は読み込み・書き出しで保持する。Notesの入力欄は設けない。旧Notesの互換データは削除しない。

参加人数・通算勝敗・開催日が資料にない場合は補完しない。現在の48デッキは、既存の大会名・会場・入賞表記をEventsの「掲載済みデッキの入賞記録」に表示する。`results.json` に正式な通算成績を登録すると成績表を表示し、その表から参照したデッキを既存記録欄へ重複表示しない。

## 検証して取り込む

リポジトリのルートで実行する。例の `incoming/` は受け渡しファイル置き場で、`site/` の外に用意する。未指定のファイルは現在の内容を維持する。

```text
node scripts/update-publishing.mjs --events incoming/events.json --results incoming/results.json --decks incoming/decks.json
```

まず検証と変更件数を確認する。この段階では配信ファイルを変更しない。内容が正しければ同じ指定へ `--apply` を追加する。

```text
node scripts/update-publishing.mjs --events incoming/events.json --results incoming/results.json --decks incoming/decks.json --apply
```

適用前の3ファイルを `.publishing-backups/` に保存する。このフォルダーはGit管理・Pages配信の対象外。適用時のファイル置換で失敗した場合は元の内容へ戻す。

適用後は変更差分を確認し、以下を実行する。

```text
node scripts/apply-japanese-names.mjs
node scripts/validate-publishing.mjs
node scripts/build-editor.mjs --check
node scripts/check-editor.mjs
node publishing.test.mjs
node japanese-names.test.mjs
node printing.test.mjs
node search.test.mjs
python check_site.py
```

エディター内と公開前のデータ検証は `site/publishing.mjs` を共有する。検証を変更した場合は `node scripts/build-editor.mjs` で単一HTMLへ埋め込み直す。CIは埋め込みの不一致も検出する。

## 公開・停止・復元

- 検証済みの変更を `main` へ反映すると、`Deploy ATLANTIS closed test` が自動実行される。サイト、ツール、検証スクリプト、テスト、ワークフローの変更が対象。資料だけの変更では再配信しない。手動起動も残す。
- Actions内で名称補正、データ検証、エディター検証、既存検査を実行する。失敗した場合はPages配信へ進まない。成功後も公開URLでEvents・対象デッキ・カード検索を確認する。
- 掲載停止は対象レコードを入力JSONから取り除く。結果から参照されているデッキを停止する場合は、成績の `deckId` を空にするなど、参照も合わせて調整する。公開済みの内容を変更する手順であり、Git履歴からの完全削除にはならない。
- 復元は適用時に表示されたバックアップを指定し、まず検証する。`--apply` を付けるとローカルの配信データへ戻る。その後コミット・pushし、配信成功とUIを確認する。

```text
node scripts/update-publishing.mjs --restore .publishing-backups/実際のバックアップ名
node scripts/update-publishing.mjs --restore .publishing-backups/実際のバックアップ名 --apply
```

古いコミットへ戻す場合も、現在のデータ検証・日本語名補正を残す。ワークフロー全体を古い版で上書きしない。エディターを `site/` へ置いたり、下書きJSON・内部原稿を追加したりしない。

## 確認記録

`node scripts/rehearse-publishing.mjs` は一時フォルダーで、適用前の確認→48件から47件への掲載停止→バックアップから48件への復元→不正更新の拒否を確認する。2026-10-25に成功。公開データの48件は変更していない。

実ブラウザでは、ローカル専用の架空成績で通算成績表示・上位デッキへの移動を確認した。架空データを公開JSONへ入れない。エディターのファイル選択をブラウザ自動操作するには拡張機能側の権限が必要だったため、自動操作では入力フォームを確認し、JSON取込・既存48件・書出し判定はエディターの実際のスクリプトを使う自動検証で確認した。
