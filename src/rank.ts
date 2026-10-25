export interface Rank {
  letter: "S" | "A" | "B" | "C" | "D" | "E";
  title: string;
}

/** 一致率の区切り。name は「Bogor県」のように県で終わる。 */
export function resultRank(percent: number, name: string): Rank {
  if (percent >= 98) return { letter: "S", title: `${name}のカブパテン王` };
  if (percent >= 90) return { letter: "A", title: `${name}に詳しい` };
  if (percent >= 60) return { letter: "B", title: `${name}は合格` };
  if (percent >= 55) return { letter: "C", title: `${name}はあと少し` };
  if (percent >= 35) return { letter: "D", title: `${name}はまだ遠い` };
  return { letter: "E", title: "振り出し" };
}

export function cheer(percent: number): string {
  if (percent >= 98) return "描き切った。";
  if (percent >= 90) return "かなり近い。";
  if (percent >= 60) return "合格ライン。";
  if (percent >= 55) return "惜しい。";
  return "次の県で。";
}
