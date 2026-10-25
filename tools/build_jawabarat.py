"""地方ごとに、県データと色別標高図を作る。

なぞる線は、隣の県・市と接する陸の境界だけ。海岸線は入れない。
出題は県（kabupaten）だけ。市と貯水池は隣の境界に使う。
西・東・北カリマンタンと東ヌサトゥンガラは、隣国側が標高で陸のとき国境もなぞる線に入れる。
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DIST = ROOT / "data" / "dist"
META = ROOT / "data" / "meta"
GEOJSON = RAW / "geoBoundaries-IDN-ADM2.geojson"
SOURCE_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
    "releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2.geojson"
)

# 標高図は県の外も少し入れる。州の形そのものは線で教えない。
# 陸境の無い離島は画面の外。
REGIONS = [
    {
        "id": "jawa-barat",
        "label": "西ジャワから出題",
        "file": "jawabarat",
        "west": 106.22,
        "south": -7.97,
        "east": 108.99,
        "north": -5.77,
        "names": {
            "Bandung",
            "Bandung Barat",
            "Bekasi",
            "Bogor",
            "Ciamis",
            "Cianjur",
            "Cirebon",
            "Garut",
            "Indramayu",
            "Karawang",
            "Kuningan",
            "Majalengka",
            "Pangandaran",
            "Purwakarta",
            "Subang",
            "Sukabumi",
            "Sumedang",
            "Tasikmalaya",
        },
    },
    {
        "id": "jawa-tengah",
        "label": "中央ジャワから出題",
        "file": "jawatengah",
        "west": 108.38,
        "south": -8.39,
        "east": 111.87,
        "north": -6.20,
        "names": {
            "Banjarnegara",
            "Banyumas",
            "Batang",
            "Blora",
            "Boyolali",
            "Brebes",
            "Cilacap",
            "Demak",
            "Grobogan",
            "Jepara",
            "Karanganyar",
            "Kebumen",
            "Kendal",
            "Klaten",
            "Kudus",
            "Magelang",
            "Pati",
            "Pekalongan",
            "Pemalang",
            "Purbalingga",
            "Purworejo",
            "Rembang",
            "Semarang",
            "Sragen",
            "Sukoharjo",
            "Tegal",
            "Temanggung",
            "Wonogiri",
            "Wonosobo",
        },
    },
    {
        "id": "jawa-timur",
        "label": "東ジャワから出題",
        "file": "jawatimur",
        "west": 110.72,
        "south": -8.96,
        "east": 114.79,
        "north": -6.57,
        "names": {
            "Bangkalan",
            "Banyuwangi",
            "Blitar",
            "Bojonegoro",
            "Bondowoso",
            "Gresik",
            "Jember",
            "Jombang",
            "Kediri",
            "Lamongan",
            "Lumajang",
            "Madiun",
            "Magetan",
            "Malang",
            "Mojokerto",
            "Nganjuk",
            "Ngawi",
            "Pacitan",
            "Pamekasan",
            "Pasuruan",
            "Ponorogo",
            "Probolinggo",
            "Sampang",
            "Sidoarjo",
            "Situbondo",
            "Sumenep",
            "Trenggalek",
            "Tuban",
            "Tulungagung",
        },
    },
    {
        "id": "lampung",
        "label": "ランプンから出題",
        "file": "lampung",
        "west": 103.39,
        "south": -6.16,
        "east": 106.10,
        "north": -3.54,
        "names": {
            "Lampung Barat",
            "Lampung Selatan",
            "Lampung Tengah",
            "Lampung Timur",
            "Lampung Utara",
            "Mesuji",
            "Pesawaran",
            "Pesisir Barat",
            "Pringsewu",
            "Tanggamus",
            "Tulang Bawang Barat",
            "Tulangbawang",
            "Way Kanan",
        },
    },
    {
        "id": "sumatera-selatan",
        "label": "南スマトラから出題",
        "file": "sumsel",
        "west": 101.89,
        "south": -5.11,
        "east": 106.28,
        "north": -1.45,
        "names": {
            "Banyu Asin",
            "Empat Lawang",
            "Lahat",
            "Muara Enim",
            "Musi Banyuasin",
            "Musi Rawas",
            "Musi Rawas Utara",
            "Ogan Ilir",
            "Ogan Komering Ilir",
            "Ogan Komering Ulu",
            "Ogan Komering Ulu Selatan",
            "Ogan Komering Ulu Timur",
            "Penukal Abab Lematang Ilir",
        },
    },
    {
        "id": "bangka-belitung",
        "label": "バンカ・ブリトゥンから出題",
        "file": "babel",
        "west": 104.93,
        "south": -3.60,
        "east": 108.90,
        "north": -1.32,
        "names": {
            "Bangka",
            "Bangka Barat",
            "Bangka Selatan",
            "Bangka Tengah",
            "Belitung",
            "Belitung Timur",
        },
    },
    {
        "id": "bengkulu",
        "label": "ベンクルから出題",
        "file": "bengkulu",
        "west": 100.84,
        "south": -5.11,
        "east": 103.94,
        "north": -2.10,
        "names": {
            "Bengkulu Selatan",
            "Bengkulu Tengah",
            "Bengkulu Utara",
            "Kaur",
            "Kepahiang",
            "Lebong",
            "Mukomuko",
            "Rejang Lebong",
            "Seluma",
        },
    },
    {
        "id": "kalimantan-barat",
        "label": "西カリマンタンから出題",
        "file": "kalbar",
        "west": 108.66,
        "south": -3.22,
        "east": 114.40,
        "north": 2.26,
        # 出力は約 120m/px。タイルは 3 点に 1 点で、全面を読むより軽い。
        "px": 900,
        "stride": 3,
        # サラワクとの陸境はインドネシアの県データに隣がいない。この地方だけ標高で補う。
        "foreign_land": True,
        "names": {
            "Bengkayang",
            "Kapuas Hulu",
            "Kayong Utara",
            "Ketapang",
            "Kubu Raya",
            "Landak",
            "Melawi",
            "Mempawah",
            "Sambas",
            "Sanggau",
            "Sekadau",
            "Sintang",
        },
    },
    {
        "id": "kalimantan-tengah",
        "label": "中部カリマンタンから出題",
        "file": "kalteng",
        "west": 110.55,
        "south": -3.72,
        "east": 116.03,
        "north": 0.96,
        "px": 900,
        "stride": 3,
        "names": {
            "Barito Selatan",
            "Barito Timur",
            "Barito Utara",
            "Gunung Mas",
            "Kapuas",
            "Katingan",
            "Kotawaringin Barat",
            "Kotawaringin Timur",
            "Lamandau",
            "Murung Raya",
            "Pulang Pisau",
            "Seruyan",
            "Sukamara",
        },
    },
    {
        "id": "jambi",
        "label": "ジャンビから出題",
        "file": "jambi",
        "west": 100.95,
        "south": -2.95,
        "east": 104.68,
        "north": -0.55,
        "names": {
            "Batang Hari",
            "Bungo",
            "Kerinci",
            "Merangin",
            "Muaro Jambi",
            "Sarolangun",
            "Tanjung Jabung Barat",
            "Tanjung Jabung Timur",
            "Tebo",
        },
    },
    {
        "id": "kepulauan-riau",
        "label": "リアウ諸島から出題",
        "file": "kepri",
        "west": 103.11,
        "south": -1.03,
        "east": 108.60,
        "north": 4.45,
        "px": 900,
        "stride": 3,
        "names": {
            "Bintan",
            "Karimun",
            "Kepulauan Anambas",
            "Lingga",
            "Natuna",
        },
    },
    {
        "id": "sumatera-barat",
        "label": "西スマトラから出題",
        "file": "sumbar",
        "west": 98.42,
        "south": -2.66,
        "east": 102.07,
        "north": 1.09,
        "names": {
            "Agam",
            "Dharmasraya",
            "Kepulauan Mentawai",
            "Lima Puluh Kota",
            "Padang Pariaman",
            "Pasaman",
            "Pasaman Barat",
            "Pesisir Selatan",
            "Sijunjung",
            "Solok",
            "Solok Selatan",
            "Tanah Datar",
        },
    },
    {
        "id": "riau",
        "label": "リアウから出題",
        "file": "riau",
        "west": 99.84,
        "south": -1.30,
        "east": 103.99,
        "north": 3.06,
        "names": {
            "Bengkalis",
            "Indragiri Hilir",
            "Indragiri Hulu",
            "Kampar",
            "Kepulauan Meranti",
            "Kuantan Singingi",
            "Pelalawan",
            "Rokan Hilir",
            "Rokan Hulu",
            "Siak",
        },
    },
    {
        "id": "bali",
        "label": "バリから出題",
        "file": "bali",
        "west": 114.25,
        "south": -9.03,
        "east": 115.89,
        "north": -7.88,
        "names": {
            "Badung",
            "Bangli",
            "Buleleng",
            "Gianyar",
            "Jembrana",
            "Karang Asem",
            "Klungkung",
            "Tabanan",
        },
    },
    {
        "id": "kalimantan-selatan",
        "label": "南カリマンタンから出題",
        "file": "kalsel",
        "west": 114.17,
        "south": -4.36,
        "east": 116.74,
        "north": -1.14,
        "names": {
            "Balangan",
            "Banjar",
            "Barito Kuala",
            "Hulu Sungai Selatan",
            "Hulu Sungai Tengah",
            "Hulu Sungai Utara",
            "Kota Baru",
            "Tabalong",
            "Tanah Bumbu",
            "Tanah Laut",
            "Tapin",
        },
    },
    {
        "id": "nusa-tenggara-barat",
        "label": "西ヌサトゥンガラから出題",
        "file": "ntb",
        "west": 115.64,
        "south": -9.29,
        "east": 119.52,
        "north": -7.92,
        "names": {
            "Bima",
            "Dompu",
            "Lombok Barat",
            "Lombok Tengah",
            "Lombok Timur",
            "Lombok Utara",
            "Sumbawa",
            "Sumbawa Barat",
        },
    },
    {
        "id": "sumatera-utara",
        "label": "北スマトラから出題",
        "file": "sumut",
        "west": 96.88,
        "south": 0.05,
        "east": 100.61,
        "north": 4.48,
        "names": {
            "Asahan",
            "Batu Bara",
            "Dairi",
            "Deli Serdang",
            "Humbang Hasundutan",
            "Karo",
            "Labuhan Batu",
            "Labuhan Batu Selatan",
            "Labuhan Batu Utara",
            "Langkat",
            "Mandailing Natal",
            "Nias",
            "Nias Barat",
            "Nias Selatan",
            "Nias Utara",
            "Padang Lawas",
            "Padang Lawas Utara",
            "Pakpak Bharat",
            "Samosir",
            "Serdang Bedagai",
            "Simalungun",
            "Tapanuli Selatan",
            "Tapanuli Tengah",
            "Tapanuli Utara",
            "Toba Samosir",
        },
    },
    {
        "id": "kalimantan-timur",
        "label": "東カリマンタンから出題",
        "file": "kaltim",
        "west": 113.66,
        "south": -2.59,
        "east": 119.17,
        "north": 2.81,
        # 出力は約 120m/px。タイルは 3 点に 1 点で、全面を読むより軽い。
        "px": 900,
        "stride": 3,
        # サバ・サラワクとの陸境はインドネシアの県データに隣がいない。標高で補う。
        "foreign_land": True,
        "names": {
            "Berau",
            "Kutai Barat",
            "Kutai Kartanegara",
            "Kutai Timur",
            "Mahakam Hulu",
            "Paser",
            "Penajam Paser Utara",
        },
    },
    {
        "id": "sulawesi-selatan",
        "label": "南スラウェシから出題",
        "file": "sulsel",
        "west": 118.77,
        "south": -7.05,
        "east": 121.97,
        "north": -1.72,
        "names": {
            "Bantaeng",
            "Barru",
            "Bone",
            "Bulukumba",
            "Enrekang",
            "Gowa",
            "Jeneponto",
            "Kepulauan Selayar",
            "Luwu",
            "Luwu Timur",
            "Luwu Utara",
            "Maros",
            "Pangkajene Dan Kepulauan",
            "Pinrang",
            "Sidenreng Rappang",
            "Sinjai",
            "Soppeng",
            "Takalar",
            "Tana Toraja",
            "Toraja Utara",
            "Wajo",
        },
    },
    {
        "id": "kalimantan-utara",
        "label": "北カリマンタンから出題",
        "file": "kaltara",
        "west": 114.41,
        "south": 0.86,
        "east": 118.17,
        "north": 4.59,
        # サバ・サラワクとの陸境はインドネシアの県データに隣がいない。標高で補う。
        "foreign_land": True,
        "names": {
            "Bulungan",
            "Malinau",
            "Nunukan",
            "Tana Tidung",
        },
    },
    {
        "id": "sulawesi-barat",
        "label": "西スラウェシから出題",
        "file": "sulbar",
        "west": 118.58,
        "south": -3.75,
        "east": 120.06,
        "north": -0.67,
        "names": {
            "Majene",
            "Mamasa",
            "Mamuju",
            "Mamuju Tengah",
            "Mamuju Utara",
            "Polewali Mandar",
        },
    },
    {
        "id": "aceh",
        "label": "アチェから出題",
        "file": "aceh",
        "west": 94.83,
        "south": 1.85,
        "east": 98.47,
        "north": 5.93,
        "names": {
            "Aceh Barat",
            "Aceh Barat Daya",
            "Aceh Besar",
            "Aceh Jaya",
            "Aceh Selatan",
            "Aceh Singkil",
            "Aceh Tamiang",
            "Aceh Tengah",
            "Aceh Tenggara",
            "Aceh Timur",
            "Aceh Utara",
            "Bener Meriah",
            "Bireuen",
            "Gayo Lues",
            "Nagan Raya",
            "Pidie",
            "Pidie Jaya",
            "Simeulue",
        },
    },
    {
        "id": "nusa-tenggara-timur",
        "label": "東ヌサトゥンガラから出題",
        "file": "ntt",
        "west": 118.75,
        "south": -11.19,
        "east": 125.37,
        "north": -7.88,
        # 出力は約 120m/px。タイルは 3 点に 1 点で、全面を読むより軽い。
        "px": 900,
        "stride": 3,
        # 東ティモールとの陸境はインドネシアの県データに隣がいない。標高で補う。
        "foreign_land": True,
        "names": {
            "Alor",
            "Belu",
            "Ende",
            "Flores Timur",
            "Kupang",
            "Lembata",
            "Malaka",
            "Manggarai",
            "Manggarai Barat",
            "Manggarai Timur",
            "Nagekeo",
            "Ngada",
            "Rote Ndao",
            "Sabu Raijua",
            "Sikka",
            "Sumba Barat",
            "Sumba Barat Daya",
            "Sumba Tengah",
            "Sumba Timur",
            "Timor Tengah Selatan",
            "Timor Tengah Utara",
        },
    },
    {
        "id": "sulawesi-tengah",
        "label": "中部スラウェシから出題",
        "file": "sulteng",
        "west": 119.43,
        "south": -3.57,
        "east": 124.36,
        "north": 1.56,
        # 出力は約 120m/px。タイルは 3 点に 1 点で、全面を読むより軽い。
        "px": 900,
        "stride": 3,
        "names": {
            "Banggai",
            "Banggai Kepulauan",
            "Banggai Laut",
            "Buol",
            "Donggala",
            "Morowali",
            "Morowali Utara",
            "Parigi Moutong",
            "Poso",
            "Sigi",
            "Tojo Una-Una",
            "Toli-Toli",
        },
    },
    {
        "id": "sulawesi-tenggara",
        "label": "南東スラウェシから出題",
        "file": "sultra",
        "west": 120.68,
        "south": -6.39,
        "east": 124.19,
        "north": -2.60,
        "names": {
            "Bombana",
            "Buton",
            "Buton Selatan",
            "Buton Tengah",
            "Buton Utara",
            "Kolaka",
            "Kolaka Timur",
            "Kolaka Utara",
            "Konawe",
            "Konawe Kepulauan",
            "Konawe Selatan",
            "Konawe Utara",
            "Muna",
            "Muna Barat",
            "Wakatobi",
        },
    },
    {
        "id": "gorontalo",
        "label": "ゴロンタロから出題",
        "file": "gorontalo",
        "west": 120.98,
        "south": 0.13,
        "east": 123.73,
        "north": 1.22,
        "names": {
            "Boalemo",
            "Bone Bolango",
            "Gorontalo",
            "Gorontalo Utara",
            "Pohuwato",
        },
    },
    {
        "id": "sulawesi-utara",
        "label": "北スラウェシから出題",
        "file": "sulut",
        "west": 122.93,
        "south": 0.11,
        "east": 127.34,
        "north": 4.99,
        # 出力は約 120m/px。タイルは 3 点に 1 点で、全面を読むより軽い。
        "px": 900,
        "stride": 3,
        "names": {
            "Bolaang Mongondow",
            "Bolaang Mongondow Selatan",
            "Bolaang Mongondow Timur",
            "Bolaang Mongondow Utara",
            "Kepulauan Sangihe",
            "Kepulauan Talaud",
            "Minahasa",
            "Minahasa Selatan",
            "Minahasa Tenggara",
            "Minahasa Utara",
            "Siau Tagulandang Biaro",
        },
    },
    {
        "id": "maluku-utara",
        "label": "北マルクから出題",
        "file": "malut",
        "west": 124.10,
        "south": -2.66,
        "east": 129.08,
        "north": 2.83,
        # 出力は約 120m/px。タイルは 3 点に 1 点で、全面を読むより軽い。
        "px": 900,
        "stride": 3,
        "names": {
            "Halmahera Barat",
            "Halmahera Selatan",
            "Halmahera Tengah",
            "Halmahera Timur",
            "Halmahera Utara",
            "Kepulauan Sula",
            "Pulau Morotai",
            "Pulau Taliabu",
        },
    },
    {
        "id": "maluku",
        "label": "マルクから出題",
        "file": "maluku",
        "west": 125.54,
        "south": -8.27,
        "east": 135.09,
        "north": -2.55,
        # 出力は約 120m/px。島が東西に広いので、タイルは 3 点に 1 点。
        "px": 900,
        "stride": 3,
        "names": {
            "Buru",
            "Buru Selatan",
            "Kepulauan Aru",
            "Maluku Barat Daya",
            "Maluku Tengah",
            "Maluku Tenggara",
            "Maluku Tenggara Barat",
            "Seram Bagian Barat",
            "Seram Bagian Timur",
        },
    },
    {
        "id": "banten",
        "label": "バンテンから出題",
        "file": "banten",
        "west": 104.92,
        "south": -7.20,
        "east": 106.90,
        "north": -5.63,
        "names": {
            "Lebak",
            "Pandeglang",
            "Serang",
            "Tangerang",
        },
    },
    {
        "id": "jakarta",
        "label": "ジャカルタから出題",
        "file": "jakarta",
        "west": 106.21,
        "south": -6.16,
        "east": 107.03,
        "north": -5.02,
        "names": {
            "Kepulauan Seribu",
        },
    },
    {
        "id": "yogyakarta",
        "label": "ジョグジャカルタから出題",
        "file": "yogyakarta",
        "west": 109.82,
        "south": -8.38,
        "east": 111.01,
        "north": -7.36,
        "names": {
            "Bantul",
            "Gunung Kidul",
            "Kulon Progo",
            "Sleman",
        },
    },
]
NEAR_DEG = 0.007  # 約 780 m。簡略化でずれた共有境界を陸境とみなす。


def rdp(points: list[list[float]], eps: float) -> list[list[float]]:
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        ax, ay = points[start]
        bx, by = points[end]
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        best_i = -1
        best = eps * eps
        for i in range(start + 1, end):
            px, py = points[i]
            if denom == 0:
                dist = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
                qx, qy = ax + t * dx, ay + t * dy
                dist = (px - qx) ** 2 + (py - qy) ** 2
            if dist > best:
                best = dist
                best_i = i
        if best_i >= 0:
            keep[best_i] = True
            stack.append((start, best_i))
            stack.append((best_i, end))
    return [p for p, flag in zip(points, keep) if flag]


def simplify_ring(ring: list[list[float]]) -> list[list[float]]:
    if len(ring) > 6000:
        step = max(1, len(ring) // 5000)
        ring = ring[::step]
        if ring[0] != ring[-1]:
            ring = ring + [ring[0]]
    if len(ring) < 4:
        return ring
    body = rdp(ring, 0.0012)
    if body[0] != body[-1]:
        body = body + [body[0]]
    return [[round(x, 5), round(y, 5)] for x, y in body]


def iter_rings(geometry: dict):
    gtype = geometry["type"]
    coords = geometry["coordinates"]
    if gtype == "Polygon":
        yield from coords
    elif gtype == "MultiPolygon":
        for poly in coords:
            yield from poly


def iter_polygons(geometry: dict):
    gtype = geometry["type"]
    coords = geometry["coordinates"]
    if gtype == "Polygon":
        yield coords
    elif gtype == "MultiPolygon":
        yield from coords


def ring_bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def geom_bbox(geometry: dict):
    minx = miny = 999.0
    maxx = maxy = -999.0
    for ring in iter_rings(geometry):
        for x, y in ring:
            minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
    return minx, miny, maxx, maxy


def overlaps(a, b, pad=0.0):
    return not (a[2] < b[0] - pad or b[2] < a[0] - pad or a[3] < b[1] - pad or b[3] < a[1] - pad)


def shoelace(ring):
    area = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def ring_length_km(ring):
    total = 0.0
    for i in range(len(ring) - 1):
        lon1, lat1 = ring[i]
        lon2, lat2 = ring[i + 1]
        mx = (lon2 - lon1) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2))
        my = (lat2 - lat1) * 110.57
        total += math.hypot(mx, my)
    return total


def open_seq(ring):
    if len(ring) >= 2 and ring[0] == ring[-1]:
        return ring[:-1]
    return ring


class EdgeIndex:
    def __init__(self):
        self.cell = 0.02
        self.grid: dict[tuple[int, int], list] = {}

    def add_ring(self, ring, owner):
        seq = open_seq(ring)
        n = len(seq)
        if n < 3:
            return
        for i in range(n):
            a = seq[i]
            b = seq[(i + 1) % n]
            edge = (a[0], a[1], b[0], b[1], owner)
            x0, x1 = sorted((a[0], b[0]))
            y0, y1 = sorted((a[1], b[1]))
            for ix in range(math.floor(x0 / self.cell), math.floor(x1 / self.cell) + 1):
                for iy in range(math.floor(y0 / self.cell), math.floor(y1 / self.cell) + 1):
                    self.grid.setdefault((ix, iy), []).append(edge)

    def near_other(self, a, b, owner) -> bool:
        for t in (0.2, 0.5, 0.8):
            px = a[0] + (b[0] - a[0]) * t
            py = a[1] + (b[1] - a[1]) * t
            ix = math.floor(px / self.cell)
            iy = math.floor(py / self.cell)
            best = NEAR_DEG * NEAR_DEG
            found = False
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for edge in self.grid.get((ix + dx, iy + dy), ()):
                        if edge[4] == owner:
                            continue
                        dist = point_seg_sq(px, py, edge[0], edge[1], edge[2], edge[3])
                        if dist < best:
                            best = dist
                            found = True
            if found and best <= NEAR_DEG * NEAR_DEG:
                return True
        return False


def point_seg_sq(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    if denom == 0:
        return (px - ax) ** 2 + (py - ay) ** 2
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    qx, qy = ax + t * dx, ay + t * dy
    return (px - qx) ** 2 + (py - qy) ** 2


def border_runs(ring, is_border=None, flags=None):
    seq = open_seq(ring)
    n = len(seq)
    if n < 3:
        return []
    if flags is None:
        flags = [is_border(seq[i], seq[(i + 1) % n]) for i in range(n)]
    if not any(flags):
        return []
    if all(flags):
        line = seq + [seq[0]]
        return [line] if ring_length_km(line) >= 1.5 else []
    start = flags.index(False)
    lines = []
    i = 0
    while i < n:
        idx = (start + i) % n
        if not flags[idx]:
            i += 1
            continue
        run = [seq[idx]]
        while i < n and flags[(start + i) % n]:
            nxt = seq[(start + i + 1) % n]
            run.append(nxt)
            i += 1
        if ring_length_km(run) >= 1.5:
            lines.append(run)
    return lines


def mercator_y(lat):
    lat = np.clip(lat, -85.05112878, 85.05112878)
    s = np.sin(np.radians(lat))
    return 0.5 - np.log((1 + s) / (1 - s)) / (4 * np.pi)


def load_hgt(path: Path) -> np.ndarray:
    with gzip.open(path, "rb") as fh:
        raw = fh.read()
    side = int(round((len(raw) // 2) ** 0.5))
    return np.frombuffer(raw, dtype=">i2").reshape((side, side))


def tile_name(lat_sw: int, lon_sw: int) -> str:
    # skadi は南西角。南緯は S06、赤道から北は N00。abs だけだと北緯が S になる。
    ns = f"N{lat_sw:02d}" if lat_sw >= 0 else f"S{abs(lat_sw):02d}"
    ew = f"E{lon_sw:03d}" if lon_sw >= 0 else f"W{abs(lon_sw):03d}"
    return ns + ew


_TILES: dict[tuple[str, int], np.ndarray | None] = {}


def load_tile(lat_sw: int, lon_sw: int, stride: int = 1) -> np.ndarray | None:
    name = tile_name(lat_sw, lon_sw)
    key = (name, stride)
    if key in _TILES:
        return _TILES[key]
    path = RAW / "srtm" / f"{name}.hgt.gz"
    if not path.exists() or path.stat().st_size < 1000:
        _TILES[key] = None
        return None
    arr = load_hgt(path)
    if stride > 1:
        if (arr.shape[0] - 1) % stride != 0:
            raise SystemExit(f"{name} side {arr.shape[0]} is not divisible by stride {stride}")
        arr = np.ascontiguousarray(arr[::stride, ::stride])
    _TILES[key] = arr
    return arr


def sample_elev(lon: float, lat: float, stride: int) -> int | None:
    lat_sw = math.floor(lat)
    lon_sw = math.floor(lon)
    arr = load_tile(lat_sw, lon_sw, stride)
    if arr is None:
        return None
    side = arr.shape[0]
    step = side - 1
    row = int(round((lat_sw + 1 - lat) * step))
    col = int(round((lon - lon_sw) * step))
    if row < 0 or col < 0 or row >= side or col >= side:
        return None
    value = int(arr[row, col])
    if value < -500:
        return None
    return value


def add_foreign_land(flags: list[bool], seq, stride: int) -> None:
    """共有県界が無い辺のうち、外側 2 点がどちらも陸地なら国境にする。海岸は海なので残らない。"""
    n = len(seq)
    if n < 3 or all(flags):
        return
    pts = np.asarray(seq, dtype=np.float64)
    nxt = np.roll(pts, -1, axis=0)
    delta = nxt - pts
    length = np.hypot(delta[:, 0], delta[:, 1])
    need = np.array([not flag for flag in flags], dtype=bool) & (length > 0)
    if not np.any(need):
        return
    nx = np.zeros(n, dtype=np.float64)
    ny = np.zeros(n, dtype=np.float64)
    nx[length > 0] = -delta[length > 0, 1] / length[length > 0]
    ny[length > 0] = delta[length > 0, 0] / length[length > 0]
    mid = (pts + nxt) / 2
    y1 = pts[None, :, 1]
    y2 = nxt[None, :, 1]
    x1 = pts[None, :, 0]
    x2 = nxt[None, :, 0]

    def inside(lons, lats):
        y = lats[:, None]
        x = lons[:, None]
        cond = (y1 > y) != (y2 > y)
        denom = np.where(y2 != y1, y2 - y1, 1.0)
        xcross = (x2 - x1) * (y - y1) / denom + x1
        return np.count_nonzero(cond & (x < xcross), axis=1) % 2 == 1

    alive = need.copy()
    for dist in (0.02, 0.045):
        offset = np.stack((nx, ny), axis=1) * dist
        plus = mid + offset
        minus = mid - offset
        in_plus = inside(plus[:, 0], plus[:, 1])
        in_minus = inside(minus[:, 0], minus[:, 1])
        outward = np.where(in_plus[:, None], minus, plus)
        alive &= in_plus != in_minus
        if not np.any(alive):
            return
        for i in np.flatnonzero(alive):
            elev = sample_elev(float(outward[i, 0]), float(outward[i, 1]), stride)
            if elev is None or elev < 8:
                alive[i] = False
    for i in np.flatnonzero(alive):
        flags[i] = True


def build_mosaic(west: float, south: float, east: float, north: float, stride: int = 1):
    lon0 = math.floor(west)
    lon1 = math.floor(east - 1e-9)
    lat0 = math.floor(south)
    lat1 = math.floor(north - 1e-9)
    tiles = []
    for lat_sw in range(lat0, lat1 + 1):
        for lon_sw in range(lon0, lon1 + 1):
            arr = load_tile(lat_sw, lon_sw, stride)
            if arr is None:
                raise SystemExit(f"missing terrain tile {tile_name(lat_sw, lon_sw)}")
            tiles.append((lat_sw, lon_sw, arr))
    side = tiles[0][2].shape[0]
    step = side - 1
    nlat = lat1 - lat0 + 1
    nlon = lon1 - lon0 + 1
    mosaic = np.full((nlat * step + 1, nlon * step + 1), -32768, dtype=np.int16)
    north_edge = lat1 + 1
    for lat_sw, lon_sw, arr in tiles:
        row0 = int(round((north_edge - (lat_sw + 1)) * step))
        col0 = int(round((lon_sw - lon0) * step))
        mosaic[row0 : row0 + arr.shape[0], col0 : col0 + arr.shape[1]] = arr
    _TILES.clear()
    return mosaic, north_edge, lon0, step


def render_relief(region: dict):
    west, south, east, north = region["west"], region["south"], region["east"], region["north"]
    print("relief: load SRTM", region["id"])
    stride = int(region.get("stride", 1))
    mosaic, north0, west0, step = build_mosaic(west, south, east, north, stride)
    px = float(region.get("px", 1300))
    width = max(800, int(round(px * (east - west))))
    mx0 = (west + 180) / 360
    mx1 = (east + 180) / 360
    my0 = float(mercator_y(north))
    my1 = float(mercator_y(south))
    height = int(round(width * (my1 - my0) / (mx1 - mx0)))
    print(f"relief: {width}x{height}")
    xs = (np.arange(width) + 0.5) / width
    ys = (np.arange(height) + 0.5) / height
    mx = mx0 + xs * (mx1 - mx0)
    my = my0 + ys * (my1 - my0)
    lons = mx * 360 - 180
    t = np.exp((0.5 - my) * 4 * np.pi)
    lats = np.degrees(np.arcsin(np.clip((t - 1) / (t + 1), -1, 1)))
    rows = (north0 - lats[:, None]) * step
    cols = (lons[None, :] - west0) * step
    r0 = np.floor(rows).astype(np.int32)
    c0 = np.floor(cols).astype(np.int32)
    r0 = np.clip(r0, 0, mosaic.shape[0] - 2)
    c0 = np.clip(c0, 0, mosaic.shape[1] - 2)
    dr = (rows - r0).astype(np.float32)
    dc = (cols - c0).astype(np.float32)
    v00 = mosaic[r0, c0].astype(np.float32)
    v01 = mosaic[r0, c0 + 1].astype(np.float32)
    v10 = mosaic[r0 + 1, c0].astype(np.float32)
    v11 = mosaic[r0 + 1, c0 + 1].astype(np.float32)
    void = -500
    w00 = (v00 > void).astype(np.float32)
    w01 = (v01 > void).astype(np.float32)
    w10 = (v10 > void).astype(np.float32)
    w11 = (v11 > void).astype(np.float32)
    b00 = (1 - dr) * (1 - dc)
    b01 = (1 - dr) * dc
    b10 = dr * (1 - dc)
    b11 = dr * dc
    weight = b00 * w00 + b01 * w01 + b10 * w10 + b11 * w11
    elev = (
        b00 * np.where(w00 > 0, v00, 0)
        + b01 * np.where(w01 > 0, v01, 0)
        + b10 * np.where(w10 > 0, v10, 0)
        + b11 * np.where(w11 > 0, v11, 0)
    ) / np.maximum(weight, 1e-6)
    # この SRTM は海を void ではなく負の標高で持つ。0m 未満は海の色にする。
    ocean = (weight < 0.45) | (elev < 0)
    dy_m = abs(float(lats[0] - lats[min(1, len(lats) - 1)])) * 110540
    dx_m = abs(float(lons[min(1, len(lons) - 1)] - lons[0])) * 111320 * math.cos(
        math.radians((south + north) / 2)
    )
    gy, gx = np.gradient(np.where(ocean, 0, elev), dy_m, dx_m)
    slope = np.arctan(np.sqrt(gx * gx + gy * gy))
    aspect = np.arctan2(-gx, gy)
    zenith = math.radians(45)
    azimuth = math.radians(315)
    shade = np.cos(zenith) * np.cos(slope) + np.sin(zenith) * np.sin(slope) * np.cos(
        azimuth - aspect
    )
    shade = np.clip(shade, 0, 1)
    rgb = np.zeros((*elev.shape, 3), dtype=np.float32)
    bands = [
        (0, 100, (0xC5, 0xD6, 0x8A)),
        (100, 400, (0xA3, 0xC1, 0x6A)),
        (400, 1000, (0xD4, 0xB4, 0x6A)),
        (1000, 2000, (0xB0, 0x78, 0x48)),
        (2000, 3000, (0x8C, 0x62, 0x52)),
        (3000, 9000, (0xF2, 0xF0, 0xEA)),
    ]
    land = ~ocean
    for lo, hi, color in bands:
        mask = land & (elev >= lo) & (elev < hi)
        rgb[mask] = color
    light = 0.62 + 0.38 * shade
    rgb[land] *= light[land, None]
    rgb[ocean] = (0xD7, 0xE3, 0xE4)
    image = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    DIST.mkdir(parents=True, exist_ok=True)
    out = DIST / f"{region['file']}.webp"
    image.save(out, "WEBP", quality=82, method=4)
    print("relief:", out, out.stat().st_size)
    return width, height


def simplify_feature(feature: dict):
    box = geom_bbox(feature["geometry"])
    polygons = []
    for poly in iter_polygons(feature["geometry"]):
        rings = [simplify_ring([[x, y] for x, y in ring]) for ring in poly]
        rings = [ring for ring in rings if len(ring) >= 4 and shoelace(ring) > 1e-5]
        if not rings:
            continue
        outer = shoelace(rings[0])
        rings = [rings[0]] + [ring for ring in rings[1:] if shoelace(ring) > outer * 0.002]
        if rings:
            polygons.append(rings)
    if not polygons:
        return None
    return {
        "id": feature["properties"]["shapeID"],
        "name": feature["properties"]["shapeName"],
        "polygons": polygons,
        "bbox": box,
    }


def build_region(region: dict, prepared_all: list[dict]):
    window = (
        region["west"] - 0.4,
        region["south"] - 0.4,
        region["east"] + 0.4,
        region["north"] + 0.4,
    )
    prepared = [unit for unit in prepared_all if overlaps(unit["bbox"], window)]
    print(region["id"], "nearby units", len(prepared))
    index = EdgeIndex()
    for unit in prepared:
        for poly in unit["polygons"]:
            for ring in poly:
                index.add_ring(ring, unit["id"])

    wanted = region["names"]
    foreign = bool(region.get("foreign_land"))
    stride = int(region.get("stride", 1))
    units = []
    for unit in prepared:
        if unit["name"] not in wanted:
            continue

        borders = []
        owner = unit["id"]
        for poly in unit["polygons"]:
            for ring_i, ring in enumerate(poly):
                seq = open_seq(ring)
                nseg = len(seq)
                if nseg < 3:
                    continue
                flags = [index.near_other(seq[i], seq[(i + 1) % nseg], owner) for i in range(nseg)]
                # 他地方は共有県界だけ。この地方の外周だけ、海は標高が足りず落ちる。
                if foreign and ring_i == 0:
                    add_foreign_land(flags, seq, stride)
                borders.extend(border_runs(ring, flags=flags))
        border_km = sum(ring_length_km(line) for line in borders)
        perim = sum(ring_length_km(ring) for poly in unit["polygons"] for ring in poly)
        island = border_km < 8
        if island:
            largest = max(
                (ring for poly in unit["polygons"] for ring in poly[:1]),
                key=shoelace,
            )
            borders = [largest]
            border_km = ring_length_km(largest)
        outer = max((poly[0] for poly in unit["polygons"]), key=shoelace)
        sx = sum(p[0] for p in outer) / len(outer)
        sy = sum(p[1] for p in outer) / len(outer)
        units.append(
            {
                "id": unit["id"],
                "name": f"{unit['name']}県",
                "island": island,
                "label": [round(sx, 5), round(sy, 5)],
                "polygons": unit["polygons"],
                "borders": borders,
            }
        )
        print(f"{unit['name']:16} border {border_km:6.0f} km  perimeter {perim:6.0f} km  island={island}")

    units.sort(key=lambda item: item["name"])
    missing = wanted - {item["name"][:-1] for item in units}
    if missing:
        raise SystemExit(f"{region['id']} missing {missing}")
    width, height = render_relief(region)
    payload = {
        "regionId": region["id"],
        "regionLabel": region["label"],
        "frame": {
            "west": region["west"],
            "south": region["south"],
            "east": region["east"],
            "north": region["north"],
            "width": width,
            "height": height,
        },
        "image": f"{region['file']}.webp",
        "units": units,
    }
    out = DIST / f"{region['file']}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("json", out, out.stat().st_size, "units", len(units))


def main():
    chosen = sys.argv[1:]
    regions = [region for region in REGIONS if not chosen or region["id"] in chosen]
    if chosen and len(regions) != len(set(chosen)):
        known = ", ".join(region["id"] for region in REGIONS)
        raise SystemExit(f"unknown region {chosen}; known: {known}")
    print("load", GEOJSON)
    data = json.loads(GEOJSON.read_text(encoding="utf-8"))
    digest = hashlib.sha256(GEOJSON.read_bytes()).hexdigest()
    windows = [
        (region["west"] - 0.4, region["south"] - 0.4, region["east"] + 0.4, region["north"] + 0.4)
        for region in regions
    ]
    prepared_all = []
    for feature in data["features"]:
        box = geom_bbox(feature["geometry"])
        if not any(overlaps(box, window) for window in windows):
            continue
        prepared = simplify_feature(feature)
        if prepared:
            prepared_all.append(prepared)
    print("prepared", len(prepared_all))
    DIST.mkdir(parents=True, exist_ok=True)
    META.mkdir(parents=True, exist_ok=True)
    for region in regions:
        build_region(region, prepared_all)
    sources = {
        "boundary": {
            "url": SOURCE_URL,
            "sha256": digest,
            "boundaryId": "IDN-ADM2-22746128",
            "year": 2020,
            "projectLicense": "CC BY 4.0",
            "projectUrl": "https://www.geoboundaries.org/",
            "sourceLicense": "CC BY 3.0 IGO",
            "sourceUrl": "https://data.humdata.org/dataset/indonesia-administrative-boundary-polygons-lines-and-places-levels-0-4b",
            "attribution": "geoBoundaries; Badan Pusat Statistik (BPS), World Food Programme, OCHA ROAP",
            "note": "リングは簡略化した",
        },
        "relief": {
            "source": "SRTM via Mapzen/Tilezen Terrain Tiles skadi",
            "url": "https://registry.opendata.aws/terrain-tiles/",
            "license": "public domain",
            "attribution": "SRTM data courtesy of the U.S. Geological Survey",
            "note": "色分けと陰影はこのプロジェクトの加工。NASADEM ではない",
        },
        "regions": [region["id"] for region in REGIONS],
    }
    (META / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
