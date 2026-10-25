# 作り直し

遊ぶだけなら、リポジトリの `data/dist` で足りる。生データは要らない。

州の地図を作り直すときだけ、下の手順で生データを取り、`tools/build_jawabarat.py` を動かす。県境王のプログラムや素材は使わない。GADM と、geoBoundaries の ADM0 / ADM1（ODbL）は取らない。

## 県境

保存先は `data/raw/geoBoundaries-IDN-ADM2.geojson`。ビルドが読むのはこのファイルだけ。

取得元は `data/meta/sources.json` の `boundary.url`。2020 年、コミット `9469f09`、boundaryID `IDN-ADM2-22746128`。同じファイルの sha256 は `947cedc058888c0c2b2628071d289956c85fe279adb369dcf1327ce2236a5602`。

配布は CC BY 4.0、元データ（BPS / World Food Programme / OCHA ROAP）は CC BY 3.0 IGO。画面の出典表示は残す。

## 標高

保存先は `data/raw/srtm/`。ファイル名は南西角の1度タイルで、例は `S08E104.hgt.gz`。南緯は `S`、赤道から北は `N00` のように `N` を付ける。

公開元は [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) の SRTM（パブリックドメイン）。タイルの URL は次の形。

```
https://elevation-tiles-prod.s3.amazonaws.com/skadi/S08/S08E104.hgt.gz
```

`skadi/` の次は、ファイル名の先頭3文字。中身は gzip で、先頭が `1f 8b`、1000 バイト未満のファイルは壊れている。ビルドはタイルを取りに行かない。無い升は図の穴になる。必要な升は、`tools/build_jawabarat.py` のその州の `west` `south` `east` `north` に重なる整数度。

これは NASADEM ではない。画面には `SRTM data courtesy of the U.S. Geological Survey.` を残す。

## 依存

地図の生成は Python 3 と `numpy` と `Pillow`。この環境では Python 3.13、numpy 2.5、Pillow 13 で作った。

ゲームの実行は Node。PATH に無いときは `play.ps1` が `%LOCALAPPDATA%\node-v24.20.0-win-x64` を使う。依存パッケージは `npm install`（`play.ps1` が Vite の有無を見て実行する）。

## 州の地図を作る

プロジェクトのルートで、作り直す州の id を渡す。

```
python -u tools\build_jawabarat.py banten
```

id は `tools/build_jawabarat.py` の `REGIONS` にある。枠、県名、解像度（`px` と `stride`）、国境を標高で足す州（`foreign_land`）もそこにある。引数を付けないと、登録済みの州を全部作り直す。

出力は `data/dist/` の json と webp、それに `data/meta/sources.json`。`sources.json` の州一覧は、引数が一部でも登録済みの全部になる。

`data/raw/` は Git に入れない。

## 公開

`main` へ push すると、GitHub Actions がビルドして GitHub Pages に出す。ビルド時の公開パスは `/kabupaten-ou/`。ローカルの `.\play.ps1` は `http://localhost:5173/` のまま。

採点、称号、画面の文の正本は `src/score.ts`、`src/rank.ts`、`index.html`。
