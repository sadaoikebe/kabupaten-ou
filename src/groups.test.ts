import assert from "node:assert/strict";
import test from "node:test";
import { ISLANDS, PROVINCE_CHOICES, PROVINCE_FILES, USE_ISLAND_SELECT, activeChoices, provinceIdsFor } from "./groups.ts";

test("画面の選択は5つの島", () => {
  assert.equal(USE_ISLAND_SELECT, true);
  assert.deepEqual(
    activeChoices().map((choice) => choice.id),
    ["jawa", "sumatera", "kalimantan", "sulawesi", "nusa"],
  );
  assert.deepEqual(provinceIdsFor("jawa"), [
    "banten",
    "jakarta",
    "jawa-barat",
    "jawa-tengah",
    "yogyakarta",
    "jawa-timur",
  ]);
});

test("マルクはデータに残り、島には入らない", () => {
  assert.equal(PROVINCE_FILES.maluku, "maluku.json");
  assert.equal(PROVINCE_FILES["maluku-utara"], "malut.json");
  const shown = new Set(ISLANDS.flatMap((island) => island.provinces));
  assert.equal(shown.has("maluku"), false);
  assert.equal(shown.has("maluku-utara"), false);
  assert.equal(
    PROVINCE_CHOICES.some((choice) => choice.id === "maluku" || choice.id === "maluku-utara"),
    true,
  );
});

test("州はどれか一つの島に入る", () => {
  const seen = new Map<string, string>();
  for (const island of ISLANDS) {
    for (const id of island.provinces) {
      assert.ok(PROVINCE_FILES[id], id);
      assert.equal(seen.has(id), false, id);
      seen.set(id, island.id);
    }
  }
  const left = PROVINCE_CHOICES.map((choice) => choice.id).filter((id) => !seen.has(id));
  assert.deepEqual(left, ["maluku-utara", "maluku"]);
  assert.equal(Object.keys(PROVINCE_FILES).length, PROVINCE_CHOICES.length);
});
