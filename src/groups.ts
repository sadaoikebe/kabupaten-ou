// 画面の選択。true のとき島が5つ。false にすると、下の州ごとの一覧に戻る。
// 州の地図と県リストは data/dist に残してある。マルクは島の選択に入れない。
export const USE_ISLAND_SELECT = true;

export interface Choice {
  id: string;
  label: string;
}

export interface Island extends Choice {
  provinces: string[];
}

export const PROVINCE_FILES: Record<string, string> = {
  "jawa-barat": "jawabarat.json",
  "jawa-tengah": "jawatengah.json",
  "jawa-timur": "jawatimur.json",
  lampung: "lampung.json",
  "sumatera-selatan": "sumsel.json",
  "bangka-belitung": "babel.json",
  bengkulu: "bengkulu.json",
  "kalimantan-barat": "kalbar.json",
  "kalimantan-tengah": "kalteng.json",
  jambi: "jambi.json",
  "kepulauan-riau": "kepri.json",
  "sumatera-barat": "sumbar.json",
  riau: "riau.json",
  bali: "bali.json",
  "kalimantan-selatan": "kalsel.json",
  "nusa-tenggara-barat": "ntb.json",
  "sumatera-utara": "sumut.json",
  "kalimantan-timur": "kaltim.json",
  "sulawesi-selatan": "sulsel.json",
  "kalimantan-utara": "kaltara.json",
  "sulawesi-barat": "sulbar.json",
  aceh: "aceh.json",
  "nusa-tenggara-timur": "ntt.json",
  "sulawesi-tengah": "sulteng.json",
  "sulawesi-tenggara": "sultra.json",
  gorontalo: "gorontalo.json",
  "sulawesi-utara": "sulut.json",
  "maluku-utara": "malut.json",
  maluku: "maluku.json",
  banten: "banten.json",
  jakarta: "jakarta.json",
  yogyakarta: "yogyakarta.json",
};

export const PROVINCE_CHOICES: Choice[] = [
  { id: "jawa-barat", label: "西ジャワから出題" },
  { id: "jawa-tengah", label: "中央ジャワから出題" },
  { id: "jawa-timur", label: "東ジャワから出題" },
  { id: "lampung", label: "ランプンから出題" },
  { id: "sumatera-selatan", label: "南スマトラから出題" },
  { id: "bangka-belitung", label: "バンカ・ブリトゥンから出題" },
  { id: "bengkulu", label: "ベンクルから出題" },
  { id: "kalimantan-barat", label: "西カリマンタンから出題" },
  { id: "kalimantan-tengah", label: "中部カリマンタンから出題" },
  { id: "jambi", label: "ジャンビから出題" },
  { id: "kepulauan-riau", label: "リアウ諸島から出題" },
  { id: "sumatera-barat", label: "西スマトラから出題" },
  { id: "riau", label: "リアウから出題" },
  { id: "bali", label: "バリから出題" },
  { id: "kalimantan-selatan", label: "南カリマンタンから出題" },
  { id: "nusa-tenggara-barat", label: "西ヌサトゥンガラから出題" },
  { id: "sumatera-utara", label: "北スマトラから出題" },
  { id: "kalimantan-timur", label: "東カリマンタンから出題" },
  { id: "sulawesi-selatan", label: "南スラウェシから出題" },
  { id: "kalimantan-utara", label: "北カリマンタンから出題" },
  { id: "sulawesi-barat", label: "西スラウェシから出題" },
  { id: "aceh", label: "アチェから出題" },
  { id: "nusa-tenggara-timur", label: "東ヌサトゥンガラから出題" },
  { id: "sulawesi-tengah", label: "中部スラウェシから出題" },
  { id: "sulawesi-tenggara", label: "南東スラウェシから出題" },
  { id: "gorontalo", label: "ゴロンタロから出題" },
  { id: "sulawesi-utara", label: "北スラウェシから出題" },
  { id: "maluku-utara", label: "北マルクから出題" },
  { id: "maluku", label: "マルクから出題" },
  { id: "banten", label: "バンテンから出題" },
  { id: "jakarta", label: "ジャカルタから出題" },
  { id: "yogyakarta", label: "ジョグジャカルタから出題" },
];

export const ISLANDS: Island[] = [
  {
    id: "jawa",
    label: "ジャワ島から出題",
    provinces: ["banten", "jakarta", "jawa-barat", "jawa-tengah", "yogyakarta", "jawa-timur"],
  },
  {
    id: "sumatera",
    label: "スマトラ島から出題",
    // バンカ・ブリトゥンとリアウ諸島は本島の外。スマトラ側の出題に入れる。
    provinces: [
      "aceh",
      "sumatera-utara",
      "sumatera-barat",
      "riau",
      "kepulauan-riau",
      "jambi",
      "bengkulu",
      "sumatera-selatan",
      "bangka-belitung",
      "lampung",
    ],
  },
  {
    id: "kalimantan",
    label: "カリマンタンから出題",
    provinces: [
      "kalimantan-barat",
      "kalimantan-tengah",
      "kalimantan-selatan",
      "kalimantan-timur",
      "kalimantan-utara",
    ],
  },
  {
    id: "sulawesi",
    label: "スラウェシ島から出題",
    provinces: [
      "sulawesi-selatan",
      "sulawesi-barat",
      "sulawesi-tengah",
      "sulawesi-tenggara",
      "gorontalo",
      "sulawesi-utara",
    ],
  },
  {
    id: "nusa",
    label: "ヌサから出題",
    provinces: ["bali", "nusa-tenggara-barat", "nusa-tenggara-timur"],
  },
];

export function activeChoices(): Choice[] {
  return USE_ISLAND_SELECT ? ISLANDS : PROVINCE_CHOICES;
}

export function provinceIdsFor(choiceId: string): string[] {
  if (USE_ISLAND_SELECT) {
    const island = ISLANDS.find((item) => item.id === choiceId);
    if (!island) throw new Error("その地方はまだありません");
    return island.provinces;
  }
  if (!PROVINCE_FILES[choiceId]) throw new Error("その地方はまだありません");
  return [choiceId];
}

export function choiceLabel(choiceId: string): string {
  const choice = activeChoices().find((item) => item.id === choiceId);
  if (!choice) throw new Error("その地方はまだありません");
  return choice.label;
}
