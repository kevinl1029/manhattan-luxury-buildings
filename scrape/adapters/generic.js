import { clean, stripHtml, priceOf } from "../normalize.js";

function collectEntities(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectEntities(item, out);
    return out;
  }
  const type = Array.isArray(node["@type"]) ? node["@type"].join(",") : String(node["@type"] || "");
  if (/Apartment|FloorPlan|Offer|Accommodation|Residence/.test(type)) out.push(node);
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") collectEntities(v, out);
  }
  return out;
}

function parseJsonLd(text) {
  const out = [];
  const blocks = text.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const entity of collectEntities(data)) {
      const offers = Array.isArray(entity.offers) ? entity.offers : entity.offers ? [entity.offers] : [];
      const offer = offers.find((o) => o && typeof o === "object") || null;
      const price =
        entity.price ??
        entity.rent ??
        offer?.price ??
        offer?.rent ??
        null;
      const hasSize = entity.numberOfBedrooms != null || entity.numberOfBathroomsTotal != null || entity.floorSize?.value != null;
      if (price === null && !hasSize) continue;
      if (price === null && entity.name && !entity.itemOffered) continue;
      const availRaw = entity.availability ?? offer?.availability ?? null;
      const availability =
        typeof availRaw === "string"
          ? availRaw.replace(/^https:\/\/schema\.org\//, "").replace(/InStock/i, "Available")
          : availRaw
          ? "Available"
          : null;
      out.push({
        unit: entity.itemOffered?.name || entity.name || null,
        beds: entity.numberOfBedrooms ?? entity.numberOfRooms ?? null,
        baths: entity.numberOfBathroomsTotal ?? entity.numberOfBathrooms ?? null,
        sqft: entity.floorSize?.value ?? null,
        price: priceOf(String(price)),
        availability,
        url: entity.url || null,
      });
    }
  }
  return out;
}

function parseListingDivs(text) {
  const out = [];
  const chunks = text.split('id="listing"').slice(1);
  for (const chunk of chunks) {
    const unit = chunk.match(/apartment-number">\s*([^<]+)/)?.[1]?.trim();
    const info = chunk.match(/apartment-info">\s*<ul>\s*<li>([^<]+)</)?.[1]?.trim();
    const link = chunk.match(/href="([^"]+\.pdf[^"]*)"|href="(https?:\/\/[^"]+)"|href="(\/[^"]+)"/)?.[1] ?? chunk.match(/href="([^"]+)"/)?.[1];
    if (!unit) continue;
    const beds = /studio/i.test(info || "") ? 0 : (info || "").match(/(\d+(?:\.\d+)?)\s*[Bb]ed/)?.[1] ?? null;
    const baths = (info || "").match(/(\d+(?:\.\d+)?)\s*[Bb]ath/)?.[1];
    out.push({ unit, beds, baths, sqft: null, price: null, availability: null, url: link || null });
  }
  return out;
}

function parseUnitCards(text) {
  const out = [];
  const sparkRe = /<li class="unit row"[^>]*data-beds="([^"]*)"[^>]*data-baths="([^"]*)"[^>]*data-price="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of text.matchAll(sparkRe)) {
    const unit = m[4].match(/class="name">\s*([^<]+)/)?.[1]?.trim();
    const bedsRaw = m[1];
    const beds = /^\d+$/.test(bedsRaw) ? Number(bedsRaw) : /studio/i.test(bedsRaw) ? 0 : bedsRaw.match(/(\d+)/)?.[1] ?? null;
    const baths = m[2].match(/(\d+(?:\.\d+)?)/)?.[1] ?? null;
    if (!unit) continue;
    out.push({ unit, beds, baths, sqft: null, price: Number(m[3]) || null, availability: null, url: null });
  }
  if (out.length) return out;

  const cardRe = /<article[^>]*class="[^"]*node--type-unit[^"]*"[^>]*>([\s\S]*?)<\/article>|<div[^>]*class="[^"]*unit-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  for (const m of text.matchAll(cardRe)) {
    const html = m[1] || m[2] || "";
    const unit = stripHtml(html.match(/class="title"[^>]*>([\s\S]*?)</)?.[1] || "");
    const price = priceOf(html.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)</)?.[1] || "");
    const beds = html.match(/(\d+(?:\.\d+)?)\s*[Bb]ed/)?.[1];
    const baths = html.match(/(\d+(?:\.\d+)?)\s*[Bb]ath/)?.[1];
    if (!unit && price === null) continue;
    out.push({ unit: unit || null, beds, baths, sqft: null, price, availability: null, url: null });
  }
  return out;
}

export default async function scrape({ fetchText, building, config }) {
  const origin = config.origin;
  const candidates = [
    ...(config.availabilityUrl ? [config.availabilityUrl] : []),
    ...["/availability/", "/availabilities/", "/floorplans/", "/floor-plans/", "/residences/", "/units/", "/"],
  ].map((p) => (p.startsWith("http") ? p : `${origin}${p}`));

  const seen = new Set();
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    let text;
    try {
      ({ text } = await fetchText(url, { retries: 0, timeoutMs: 10000 }));
    } catch {
      continue;
    }
    const raw = [...parseListingDivs(text), ...parseUnitCards(text), ...parseJsonLd(text)];
    if (raw.length) {
      const listings = [];
      for (const r of raw) {
        const listing = clean(r, building, "generic");
        if (listing) listings.push(listing);
      }
      if (listings.length) return listings;
    }
  }
  return [];
}
