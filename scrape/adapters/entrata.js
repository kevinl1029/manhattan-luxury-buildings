import { clean, num } from "../normalize.js";

export default async function scrape({ fetchText, building, config }) {
  const { text } = await fetchText(config.url, { retries: 1, timeoutMs: 25000 });
  const sectionStart = text.indexOf('id="community-unit-listings"');
  const section = sectionStart >= 0 ? text.slice(sectionStart) : text;
  const listings = [];
  const cards = section.split('ant-card ant-card-bordered unit-item').slice(1);
  for (const card of cards) {
    const plain = card.replace(/<!-- -->/g, "");
    const desc = plain.match(/<div class="description">([\s\S]*?)<\/div>/)?.[1];
    if (!desc) continue;
    const text = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const beds = /studio/i.test(text) ? 0 : /(\d+(?:\.\d+)?)\s*[Bb]ed/.exec(text)?.[1];
    const baths = text.match(/(\d+(?:\.\d+)?)\s*bath/)?.[1];
    const sqft = text.match(/([\d,]+)\s*sqft/)?.[1];
    const price = plain.match(/unit-price[^>]*>\s*\$?([\d,]+)/)?.[1];
    const term = plain.match(/term-length">\s*\/?\s*([\d.]+)/)?.[1];
    const availDate = plain.match(/available-date">([^<]+)</)?.[1]?.trim();
    const when = plain.match(/available-when">([^<]+)/)?.[1]?.trim() || "";
    const raw = {
      unit: text,
      beds: beds !== undefined ? Number(beds) : null,
      baths: num(baths),
      sqft: num(sqft),
      price: num(price),
      availability: availDate || (/available/i.test(when) ? "Now" : null),
      url: config.url,
    };
    const listing = clean(raw, building, "entrata");
    if (listing) listings.push(listing);
  }
  return listings;
}
