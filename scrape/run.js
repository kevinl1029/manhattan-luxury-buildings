import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fetchText } from "./fetch.js";
import rose from "./adapters/rose.js";
import related from "./adapters/related.js";
import rockrose from "./adapters/rockrose.js";
import jonah from "./adapters/jonah.js";
import rentcafe from "./adapters/rentcafe.js";
import stonehenge from "./adapters/stonehenge.js";
import entrata from "./adapters/entrata.js";
import generic from "./adapters/generic.js";

const ADAPTERS = {
  rose,
  related,
  rockrose,
  jonah,
  rentcafe,
  stonehenge,
  entrata,
  wordpress: generic,
  generic,
  jsonld: generic,
};

const ROCKROSE_SLUGS = {
  "The Archive": "the-archive",
  "110 Horatio Street": "110-horatio-street",
};

function deriveConfig(entry) {
  const origin = entry.url ? new URL(entry.url).origin : null;
  const slugMatch = origin && entry.url.match(/securecafe\.com\/onlineleasing\/([^/]+)/);
  const floorplans = entry.availabilityUrls.find((u) => /floorplans|floor-plans/i.test(u));
  return {
    url: entry.availabilityUrls[0] || entry.url,
    origin,
    slug: slugMatch?.[1] || null,
    floorplansUrl: floorplans || (origin ? `${origin}/floorplans/` : null),
    propertyCode: entry.hints.find((h) => h.startsWith("rentcafe-code:"))?.slice("rentcafe-code:".length),
    rockroseSlug: ROCKROSE_SLUGS[entry.name],
  };
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  mkdirSync("data", { recursive: true });
  const sources = JSON.parse(readFileSync("data/sources.json", "utf8"));
  const results = [];
  const allListings = [];

  for (const entry of sources.buildings) {
    if (!entry.adapter || entry.adapter === "none" || entry.fetch?.status !== "ok") {
      results.push({ name: entry.name, adapter: entry.adapter, status: "skipped", count: 0 });
      continue;
    }
    const adapter = ADAPTERS[entry.adapter];
    if (!adapter) {
      results.push({ name: entry.name, adapter: entry.adapter, status: "skipped", count: 0 });
      continue;
    }
    const config = deriveConfig(entry);
    const started = Date.now();
    try {
      const listings = await Promise.race([
        adapter({
          fetchText,
          building: entry,
          config: { ...config, slug: config.slug || (entry.adapter === "rockrose" ? config.rockroseSlug : null) },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${Date.now() - started}ms`)), 45000)),
      ]);
      const unique = [];
      const seen = new Set();
      for (const l of listings) {
        const key = `${l.unit ?? ""}|${l.price ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(l);
      }
      allListings.push(...unique);
      results.push({ name: entry.name, adapter: entry.adapter, status: "ok", count: unique.length });
      console.log(`ok        ${entry.adapter.padEnd(10)} ${entry.name}  (${unique.length})`);
    } catch (err) {
      results.push({
        name: entry.name,
        adapter: entry.adapter,
        status: "error",
        count: 0,
        error: String(err.message || err).slice(0, 300),
      });
      console.log(`error     ${entry.adapter.padEnd(10)} ${entry.name}  (${String(err.message || err).slice(0, 80)})`);
    }
  }

  const generatedAt = new Date().toISOString();
  const byBuilding = {};
  for (const l of allListings) {
    byBuilding[l.building] = (byBuilding[l.building] || 0) + 1;
  }

  writeFileSync(
    "data/listings.json",
    JSON.stringify({ generatedAt, count: allListings.length, byBuilding, listings: allListings }, null, 2) + "\n"
  );

  const historyPath = "data/history.jsonl";
  const today = dayKey();
  const historyRows = [];
  if (existsSync(historyPath)) {
    for (const line of readFileSync(historyPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.d >= today) continue;
        if (row.d < new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)) continue;
        historyRows.push(row);
      } catch {}
    }
  }
  const historySeen = new Set(historyRows.map((r) => `${r.d}|${r.b}|${r.u}`));
  for (const l of allListings) {
    if (l.price === null || !l.unit) continue;
    const key = `${today}|${l.building}|${l.unit}`;
    if (historySeen.has(key)) continue;
    historySeen.add(key);
    historyRows.push({ d: today, b: l.building, u: l.unit, p: l.price });
  }
  writeFileSync(historyPath, historyRows.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const prevByUnit = {};
  for (const row of historyRows) {
    if (row.d >= today) continue;
    (prevByUnit[`${row.b}|${row.u}`] ||= []).push(row.p);
  }
  for (const l of allListings) {
    if (l.price === null || !l.unit) continue;
    const prev = prevByUnit[`${l.building}|${l.unit}`];
    if (!prev?.length) continue;
    const prevMax = Math.max(...prev);
    if (prevMax > l.price && prevMax - l.price >= 100 && (prevMax - l.price) / prevMax >= 0.01) {
      l.dropFrom = prevMax;
    }
  }

  writeFileSync(
    "data/meta.json",
    JSON.stringify({ lastRun: generatedAt, generatedAt, totalListings: allListings.length, byAdapter: {} }, null, 2) + "\n"
  );

  const byAdapter = {};
  for (const r of results) byAdapter[r.adapter] = (byAdapter[r.adapter] || 0) + 1;
  writeFileSync("data/run-report.json", JSON.stringify({ generatedAt, byAdapter, buildings: results }, null, 2) + "\n");

  const ok = results.filter((r) => r.status === "ok" && r.count > 0).length;
  console.log(`\n${allListings.length} listings across ${ok} buildings (${results.length} attempted)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
