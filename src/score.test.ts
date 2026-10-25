import assert from "node:assert/strict";
import test from "node:test";
import { project } from "./project.ts";
import { resultRank } from "./rank.ts";
import { scoreDrawing } from "./score.ts";

function line(lon0: number, lat: number, lon1: number): number[][] {
  const n = 40;
  const points: number[][] = [];
  for (let i = 0; i <= n; i++) points.push(project(lon0 + ((lon1 - lon0) * i) / n, lat));
  return points;
}

test("同じ線はほぼ満点", () => {
  const border = line(107, -7, 107.4);
  const score = scoreDrawing([border], [{ points: border }]);
  assert.ok(score.percent >= 97, `percent ${score.percent}`);
  assert.equal(score.points, Math.round((score.percent / 100) * 100000));
});

test("空の回答は 0 点", () => {
  const border = line(107, -7, 107.4);
  const score = scoreDrawing([], [{ points: border }]);
  assert.equal(score.points, 0);
  assert.equal(score.percent, 0);
});

test("30km ずれた線は半分以下", () => {
  const border = line(107, -7, 107.4);
  const drawn = line(107, -6.73, 107.4);
  const score = scoreDrawing([drawn], [{ points: border }]);
  assert.ok(score.percent < 50, `percent ${score.percent}`);
});

test("5km ずれた線は途中の点", () => {
  const border = line(107, -7, 107.4);
  const drawn = line(107, -6.955, 107.4);
  const score = scoreDrawing([drawn], [{ points: border }]);
  assert.ok(score.percent > 0 && score.percent < 97, `percent ${score.percent}`);
});

test("ランクの区切り", () => {
  assert.equal(resultRank(98, "Bogor県").letter, "S");
  assert.equal(resultRank(98, "Bogor県").title, "Bogor県のカブパテン王");
  assert.equal(resultRank(90, "Bogor県").letter, "A");
  assert.equal(resultRank(60, "Bogor県").letter, "B");
  assert.equal(resultRank(55, "Bogor県").letter, "C");
  assert.equal(resultRank(35, "Bogor県").letter, "D");
  assert.equal(resultRank(34.9, "Bogor県").letter, "E");
  assert.equal(resultRank(34.9, "Bogor県").title, "振り出し");
});
