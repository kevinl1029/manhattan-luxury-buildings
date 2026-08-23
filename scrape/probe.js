import { fetchText } from "./fetch.js";

const url = process.argv[2];
const sliceTerm = process.argv[3];
const { text, url: finalUrl } = await fetchText(url, { retries: 1, timeoutMs: 20000 });
console.log("FINAL:", finalUrl, "LEN:", text.length);
const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
console.log("TITLE:", title?.[1]?.trim().slice(0, 160));

if (sliceTerm) {
  const re = new RegExp(sliceTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let n = 0;
  for (const m of text.matchAll(re)) {
    if (n++ >= 3) break;
    console.log(`--- MATCH ${n} ---`);
    console.log(text.slice(Math.max(0, m.index - 500), m.index + 2800).replace(/\\n/g, " "));
  }
  process.exit(0);
}

const ld = [...text.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("LD+JSON BLOCKS:", ld.length);
for (const m of ld.slice(0, 2)) console.log("--- LD+JSON ---\n" + m[1].slice(0, 2500));

const rows = [...text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
console.log("TABLE ROWS:", rows.length);
if (rows.length) {
  console.log(rows.slice(0, 4).map((r) => r[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).join("\n"));
}

const unitEls = [...text.matchAll(/<[a-z][^>]*\bdata-(?:unit|price|rent|beds|baths|sqft|availability)[^>]*>/gi)].slice(0, 6);
console.log("DATA-ATTR ELEMENTS:", unitEls.length);
for (const e of unitEls) console.log("  " + e[0].slice(0, 220));

const body = text
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();
console.log("BODY TEXT (first 2000):\n" + body.slice(0, 2000));
