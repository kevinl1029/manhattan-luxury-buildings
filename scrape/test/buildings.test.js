import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadBuildings } from "../buildings.js";

const raw = JSON.parse(readFileSync(new URL("../../data/buildings.json", import.meta.url), "utf8"));
const HOOD_IDS = new Set([
  "bpc", "fidi", "tribeca", "chinatown", "twobridges", "soho", "nolita",
  "les", "gv", "wv", "ev", "chelsea", "flatiron", "gramercy",
]);

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isOptNum = (v) => v === null || isNum(v);
const isOptStr = (v) => v === null || typeof v === "string";

test("buildings.json has a non-empty buildings array", () => {
  assert.ok(Array.isArray(raw.buildings) && raw.buildings.length > 0);
});

test("every building has valid required fields", () => {
  for (const b of raw.buildings) {
    const at = ` (${b.name ?? JSON.stringify(b)})`;
    assert.equal(typeof b.name, "string", "name" + at);
    assert.ok(b.name.length > 0, "name non-empty" + at);
    assert.equal(typeof b.address, "string", "address" + at);
    assert.ok(HOOD_IDS.has(b.hood), `unknown hood "${b.hood}"` + at);
    assert.ok(isNum(b.lat) && b.lat > 40 && b.lat < 41, "lat" + at);
    assert.ok(isNum(b.lon) && b.lon > -75 && b.lon < -72, "lon" + at);
    assert.ok(isOptNum(b.units), "units" + at);
    assert.ok(isOptNum(b.floors), "floors" + at);
    assert.equal(typeof b.note, "string", "note" + at);
    assert.ok(Array.isArray(b.tags) && b.tags.every((t) => typeof t === "string"), "tags" + at);
    assert.ok(isOptStr(b.url), "url" + at);
  }
});

test("building names are unique", () => {
  const names = raw.buildings.map((b) => b.name);
  assert.equal(new Set(names).size, names.length);
});

test("loadBuildings maps JSON to the short-key shape consumers expect", () => {
  const B = loadBuildings();
  assert.equal(B.length, raw.buildings.length);
  for (const b of B) {
    assert.equal(typeof b.n, "string");
    assert.equal(typeof b.a, "string");
    assert.equal(typeof b.h, "string");
    assert.ok(isNum(b.lat) && isNum(b.lon));
    assert.ok(isOptNum(b.u) && isOptNum(b.f));
    assert.ok(Array.isArray(b.t));
    assert.ok(isOptStr(b.url));
  }
  const src = raw.buildings.find((b) => b.url);
  const mapped = B.find((b) => b.n === src.name);
  assert.equal(mapped.url, src.url);
  assert.equal(mapped.a, src.address);
  assert.equal(mapped.h, src.hood);
  assert.deepEqual(mapped.t, src.tags);
});
