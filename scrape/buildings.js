import { readFileSync } from "node:fs";

export function loadBuildings() {
  const raw = JSON.parse(readFileSync(new URL("../data/buildings.json", import.meta.url), "utf8"));
  return raw.buildings.map((b) => ({
    n: b.name,
    a: b.address,
    h: b.hood,
    lat: b.lat,
    lon: b.lon,
    u: b.units,
    f: b.floors,
    note: b.note,
    t: b.tags,
    url: b.url,
  }));
}
