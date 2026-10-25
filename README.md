# カブパテン王

インドネシアの県（kabupaten）で、30秒で陸の県境をなぞるブラウザゲーム。画面で選べるのはジャワ島、スマトラ島、カリマンタン、スラウェシ島、ヌサ。州ごとの地図は残してあり、`src/groups.ts` の `USE_ISLAND_SELECT` を false にすると州の一覧に戻る。マルクはデータだけ残し、画面には出さない。

遊び方の正本は [docs/PLAN.md](docs/PLAN.md)。県境王のプログラム、文章、画像は使っていない。境界は geoBoundaries（CC BY）、標高は SRTM（パブリックドメイン）で、画面に出典を書く。

## 公開ページ

https://sadaoikebe.github.io/kabupaten-ou/

コードの置き場は https://github.com/sadaoikebe/kabupaten-ou です。

## ローカルで遊ぶ

```
.\play.ps1
```

表示された URL をブラウザで開く。30 秒で、出た県の県境をなぞる。海岸線は描かなくてよい。
