import { test } from "node:test";
import assert from "node:assert/strict";
import rose from "../adapters/rose.js";
import related from "../adapters/related.js";
import rockrose from "../adapters/rockrose.js";
import jonah from "../adapters/jonah.js";
import entrata from "../adapters/entrata.js";
import stonehenge from "../adapters/stonehenge.js";
import generic from "../adapters/generic.js";

const building = (name) => ({ name, url: "https://example.com/" });
const stub = (html) => ({ fetchText: async () => ({ text: html, url: "https://example.com/" }) });

test("rose parses availability tables grouped by beds", async () => {
  const html = `
    <h2 data-beds='0' data-unittype='Apartment'>Studio</h2>
    <table data-beds='0' data-unittype='Apartment'>
      <tr><th>Unit</th><th></th><th>Terrace</th><th>Bedroom</th><th>Bathroom</th><th>Rent</th><th>Floorplan</th><th>Avail.</th><th>Photos</th></tr>
      <tr><td><a href="#">S-02F</a></td><td><a href="#u1">i</a></td><td>N/A</td><td>Studio</td><td>1 BA</td><td>$4,692</td><td>View</td><td>Immediate</td><td>photo</td></tr>
      <tr><td>S-09G</td><td></td><td>N/A</td><td>Studio</td><td>1 BA</td><td>$4,886</td><td>View</td><td>9/21/2026</td><td>photo</td></tr>
    </table>
    <table data-beds='2'>
      <tr><td>N-18C</td><td></td><td>N/A</td><td>2 BR</td><td>2 BA</td><td>$14,463 Net Effective Rent</td><td>View</td><td>10/7/2026</td><td>photo</td></tr>
    </table>`;
  const listings = await rose({ fetchText: stub(html).fetchText, building: building("Ruby Chelsea"), config: { url: "https://availability.rosenyc.com/x" } });
  assert.equal(listings.length, 3);
  assert.deepEqual(listings[0], {
    building: "Ruby Chelsea", unit: "S-02F", beds: 0, baths: 1, sqft: null, price: 4692,
    availability: "Immediate", source: "rose", url: "https://availability.rosenyc.com/x",
  });
  assert.equal(listings[1].availability, "9/21/2026");
  assert.equal(listings[2].beds, 2);
  assert.equal(listings[2].price, 14463);
});

test("related parses drupal-settings-json units", async () => {
  const html = `<script type="application/json" data-drupal-selector="drupal-settings-json">
    {"relatedData":{"relatedUnitsView":[
      {"name":"The Tate: Alcove Studio, 1 Bath","id":"27130","price":"5095","variant":"0.5bd 1.0ba","dimension6":"0.5","dimension7":"1.0","dimension9":"Now"},
      {"name":"The Tate: 1 Bedroom, 1 Bath","id":"27238","price":"7150","variant":"1.0bd 1.0ba","dimension6":"1.0","dimension7":"1.0","dimension9":"09/30"}
    ]}}</script>`;
  const listings = await related({ fetchText: stub(html).fetchText, building: building("The Tate"), config: { url: "https://www.relatedrentals.com/x" } });
  assert.equal(listings.length, 2);
  assert.equal(listings[0].beds, 0.5);
  assert.equal(listings[0].baths, 1);
  assert.equal(listings[0].price, 5095);
  assert.equal(listings[1].availability, "09/30");
});

test("rockrose parses grid cards filtered by building slug", async () => {
  const html = `
    <li class='col-xs-12 col-s-6 col-m-4 col-l-4 col-xl-3 grid-item my17' data-price='5745.00' data-id='43389' data-neighborhood='["west-village"]' data-building='["110-horatio-street"]' data-size='["studio-0"]'>
      <div class="grid-card__listing-card ">
        <span class='address'>#202</span>
        <ul><li class='price'> $5,745</li><li class='size'> Studio, 1 Bath</li></ul>
        <a href="https://rockrose.com/listing/202-4/" class="uppercase">View</a>
      </div>
    </li>
    <li class='col-xs-12 col-s-6 col-m-4 col-l-4 col-xl-3 grid-item my17' data-price='5050.00' data-id='16244' data-building='["the-archive"]' data-size='["1-bedroom-1"]'>
      <div class="grid-card__listing-card ">
        <span class='address'>#PH-18</span>
        <ul><li class='price'> $5,050</li><li class='size'> 1 Bedroom, 1 Bath</li></ul>
      </div>
    </li>`;
  const listings = await rockrose({ fetchText: stub(html).fetchText, building: building("110 Horatio Street"), config: { url: "https://rockrose.com/availabilities/", slug: "110-horatio-street" } });
  assert.equal(listings.length, 1);
  assert.equal(listings[0].unit, "#202");
  assert.equal(listings[0].beds, 0);
  assert.equal(listings[0].price, 5745);
});

test("jonah parses structured units JSON", async () => {
  const html = `<script>window.state = {"units":[
    {"apartment_number":"07N","permalink":"/floorplans/unit-abc123/","bedrooms":"1","bathrooms":"1","square_feet":"662","rent_min":"5765","available_display":"Available Now"},
    {"apartment_number":"03S","permalink":"/floorplans/unit-def456/","bedrooms":"2","bathrooms":"2","square_feet":"1031","rent_min":"8415","available_display":"Available Sep 10"}
  ]}</script>`;
  const listings = await jonah({ fetchText: stub(html).fetchText, building: building("The Rollins"), config: { origin: "https://therollinsnyc.com", floorplansUrl: "https://therollinsnyc.com/floorplans/" } });
  assert.equal(listings.length, 2);
  assert.equal(listings[0].unit, "07N");
  assert.equal(listings[0].beds, 1);
  assert.equal(listings[0].sqft, 662);
  assert.equal(listings[0].price, 5765);
  assert.equal(listings[0].availability, "Available Now");
  assert.equal(listings[1].url, "https://therollinsnyc.com/floorplans/unit-def456/");
});

test("entrata parses unit-item cards", async () => {
  const html = `<section id="community-unit-listings">
    <div class="ant-card ant-card-bordered unit-item">
      <div class="description">Studio<!-- --> • <!-- -->1<!-- --> bath<!-- --> • <!-- -->564<!-- --> sqft</div>
      <span class="unit-price font-weight-bold">$<!-- -->4,012</span>
      <div class="available-when">Available<span> starting</span></div><div class="available-date">Oct 20</div>
    </div>
    <div class="ant-card ant-card-bordered unit-item">
      <div class="description">1<!-- --> bed<!-- --> • <!-- -->1<!-- --> bath<!-- --> • <!-- -->702<!-- --> sqft</div>
      <span class="unit-price font-weight-bold">$<!-- -->6,704</span>
      <div class="available-when">Available<span> now</span></div><div class="available-date"></div>
    </div>
  </section>`;
  const listings = await entrata({ fetchText: stub(html).fetchText, building: building("AVA High Line"), config: { url: "https://www.avaloncommunities.com/x" } });
  assert.equal(listings.length, 2);
  assert.equal(listings[0].beds, 0);
  assert.equal(listings[0].sqft, 564);
  assert.equal(listings[0].price, 4012);
  assert.equal(listings[0].availability, "Oct 20");
  assert.equal(listings[1].availability, "Now");
});

test("stonehenge parses webflow apartment cards", async () => {
  const html = `<div role="listitem" class="apt-card-collection-item shadow-xsmall background-color-primary w-dyn-item">
    <h4 fs-cmsfilter-field="building" class="heading-style-h4">101 West 15th Street</h4>
    <h4 class="heading-style-h4 text-color-secondary text-size-medium">308</h4>
    <div fs-cmsfilter-field="Bedroom" class="text-color-secondary text-size-small">1 Bedroom</div>
    <div fs-cmsfilter-field="Bathroom" class="text-color-secondary text-size-small">1</div>
    <div class="amenities-container hide"><div fs-cmsfilter-field="Bedroom" class="text-color-secondary text-size-small">620</div></div>
    <h4 wfu-format="usd" fs-cmsfilter-field="Price" class="heading-style-h4 all-h5-headings card-price">6995</h4>
    <a title="101 West 15th Street - 308" href="/apartments/555sixth-308" class="link-overlay w-inline-block"></a>
  </div>
  <div role="listitem" class="apt-card-collection-item shadow-xsmall background-color-primary w-dyn-item">
    <h4 fs-cmsfilter-field="building" class="heading-style-h4">Other Building</h4>
    <h4 class="heading-style-h4 text-color-secondary text-size-medium">12</h4>
    <h4 wfu-format="usd" fs-cmsfilter-field="Price" class="heading-style-h4 all-h5-headings card-price">9999</h4>
  </div>`;
  const listings = await stonehenge({ fetchText: stub(html).fetchText, building: building("101 West 15th Street"), config: { url: "https://www.stonehengenyc.com/buildings/101w15" } });
  assert.equal(listings.length, 1);
  assert.equal(listings[0].unit, "308");
  assert.equal(listings[0].beds, 1);
  assert.equal(listings[0].baths, 1);
  assert.equal(listings[0].sqft, 620);
  assert.equal(listings[0].price, 6995);
});

test("generic parses houston-style listing divs", async () => {
  const html = `<div id="listing" data-aos="fade-up">
    <a href="https://thehoustonnyc.com/wp-content/uploads/2025/05/3-8G_The_Houston.pdf">
      <div id="apartment-number"> 6G </div>
      <div id="apartment-info"><ul><li>Studio, 1 Bath</li></ul></div>
    </a>
  </div>`;
  const listings = await generic({ fetchText: stub(html).fetchText, building: building("The Houston"), config: { origin: "https://thehoustonnyc.com", availabilityUrl: null } });
  assert.equal(listings.length, 1);
  assert.equal(listings[0].unit, "6G");
  assert.equal(listings[0].beds, 0);
  assert.equal(listings[0].price, null);
});

test("generic parses spark unit rows", async () => {
  const html = `<li class="unit row" data-beds="Studio" data-baths="1 Bath" data-price="6100" data-terrace="">
    <p class="name">8O</p><p class="price">$6,100</p>
  </li>`;
  const listings = await generic({ fetchText: stub(html).fetchText, building: building("Chelsea Canvas"), config: { origin: "https://chelseacanvasnyc.com", availabilityUrl: null } });
  assert.equal(listings.length, 1);
  assert.equal(listings[0].unit, "8O");
  assert.equal(listings[0].beds, 0);
  assert.equal(listings[0].baths, 1);
  assert.equal(listings[0].price, 6100);
});
