import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Builds src/lib/places/us-places.json from raw OpenStreetMap (Overpass) JSON
 * responses saved in a directory: `node scripts/build-us-places.mjs <dir>`.
 *
 * Only the hand-picked OSM elements below are kept. Every field comes from
 * tags present on the element: name, street + house number, website,
 * coordinates. Nothing is guessed. No ratings, prices or opening hours are
 * stored (parks are marked free only as public parks; see priceFor).
 */
const VERIFIED_AT = "2026-11-15";
const pick = {
  "new-york": [
    ["node", 3233791134, ["coffee", "board games"]],
    ["node", 5265713182, ["coffee", "dessert", "baking"]],
    ["node", 2486570141, ["baking", "food"]],
    ["node", 5700167968, ["food", "brunch"]],
    ["node", 1915398676, ["food"]],
    ["node", 5254374730, ["food"]],
    ["way", 427818536, ["walk", "running", "picnic", "nature"]],
    ["relation", 7141751, ["walk", "art", "architecture"]],
    ["way", 22727025, ["walk", "reading", "picnic"]],
    ["way", 22899286, ["walk", "art"]],
    ["relation", 3698894, ["art", "history", "museum"]],
    ["way", 388436810, ["science", "history", "museum", "nature"]],
    ["way", 278346578, ["art", "design", "film", "museum"]],
    ["way", 266170808, ["music", "concert", "dance"]],
    ["way", 265354527, ["music", "concert", "orchestra"]],
    ["way", 681503639, ["art", "music", "performance"]],
  ],
  "san-francisco": [
    ["node", 331389010, ["coffee", "music"]],
    ["node", 443372068, ["coffee"]],
    ["way", 276049451, ["coffee"]],
    ["node", 366701342, ["food"]],
    ["node", 3702219083, ["food"]],
    ["node", 1221046206, ["food"]],
    ["relation", 8346137, ["hiking", "walk", "nature", "running"]],
    ["way", 23871270, ["picnic", "walk"]],
    ["way", 28842443, ["walk", "art", "garden"]],
    ["way", 16751737, ["walk", "running"]],
    ["way", 41692824, ["art", "design", "photography", "museum"]],
    ["relation", 1652482, ["art", "history", "museum"]],
    ["way", 28695389, ["science", "nature", "museum"]],
    ["node", 368166365, ["gaming", "history"]],
    ["node", 368171371, ["music", "concert"]],
    ["way", 256733182, ["film", "performance", "theatre"]],
    ["way", 32866034, ["performance", "theatre", "comedy"]],
  ],
  chicago: [
    ["node", 1308260687, ["coffee"]],
    ["node", 6322570530, ["coffee"]],
    ["node", 4953114355, ["coffee"]],
    ["way", 150864783, ["food", "brunch"]],
    ["node", 2203666226, ["food"]],
    ["node", 368064192, ["food"]],
    ["way", 23888253, ["walk", "art", "music"]],
    ["way", 224231352, ["walk", "outdoors"]],
    ["relation", 11610689, ["walk", "running", "cycling", "nature"]],
    ["relation", 13360336, ["walk", "running", "cycling"]],
    ["relation", 1870546, ["art", "history", "museum"]],
    ["way", 24825537, ["science", "history", "nature", "museum"]],
    ["way", 24800223, ["art", "design", "museum"]],
    ["way", 202372249, ["art", "history", "museum"]],
    ["way", 124873919, ["music", "concert", "comedy", "theatre"]],
    ["way", 145493030, ["music", "concert", "orchestra", "jazz"]],
    ["way", 210315491, ["theatre", "performance"]],
  ],
  austin: [
    ["node", 10563618404, ["coffee"]],
    ["node", 919335942, ["coffee"]],
    ["node", 7111030356, ["coffee", "baking"]],
    ["way", 382368408, ["food"]],
    ["way", 383355208, ["food"]],
    ["way", 383355338, ["food"]],
    ["relation", 13307353, ["walk", "running", "picnic", "outdoors"]],
    ["relation", 5716409, ["hiking", "nature", "running", "outdoors"]],
    ["relation", 8268247, ["walk", "running", "music"]],
    ["relation", 20972967, ["art", "museum"]],
    ["way", 27397820, ["history", "museum"]],
    ["way", 929864020, ["art", "design", "museum"]],
    ["way", 1266596014, ["art", "garden", "museum"]],
    ["way", 328526454, ["film", "comedy", "music", "theatre"]],
    ["way", 187668220, ["music", "concert", "dance", "theatre"]],
    ["way", 1317157542, ["theatre", "performance"]],
  ],
};
const country = "United States";
const categoryOf = (t) =>
  t.amenity === "cafe"
    ? "cafe"
    : t.amenity === "restaurant"
      ? "restaurant"
      : t.leisure === "park"
        ? "park"
        : t.tourism === "museum"
          ? "museum"
          : t.tourism === "gallery"
            ? "gallery"
            : t.amenity === "theatre" || t.amenity === "arts_centre"
              ? "venue"
              : null;
const kindOf = (c) =>
  c === "cafe" || c === "restaurant"
    ? "food-coffee"
    : c === "park"
      ? "parks-outdoors"
      : c === "venue"
        ? "concerts-events"
        : "culture-activities";

export function buildUsPlaces(dir) {
  const elements = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    let json;
    try {
      json = JSON.parse(readFileSync(join(dir, f), "utf8"));
    } catch {
      continue;
    }
    for (const el of json.elements ?? [])
      elements.set(`${el.type}/${el.id}`, el);
  }
  const out = [];
  for (const [city, list] of Object.entries(pick))
    for (const [type, id, tags] of list) {
      const el = elements.get(`${type}/${id}`);
      if (!el) throw new Error(`Missing OSM element ${type}/${id}`);
      const t = el.tags ?? {};
      const category = categoryOf(t);
      if (!category) throw new Error(`No category for ${type}/${id}`);
      const lat = el.lat ?? el.center?.lat,
        lon = el.lon ?? el.center?.lon;
      const street = [t["addr:housenumber"], t["addr:street"]]
        .filter(Boolean)
        .join(" ");
      const url = `https://www.openstreetmap.org/${type}/${id}`;
      const website = t.website || t["contact:website"] || null;
      out.push({
        id: `osm-${type}-${id}`,
        type: "place",
        // Some OSM names list two variants separated by ";": keep the first.
        name: (t["name:en"] || t.name).split(";")[0].trim(),
        localName: null,
        city,
        country,
        category,
        kind: kindOf(category),
        setting: category === "park" ? "outdoor" : "indoor",
        address: street || null,
        localAddress: null,
        coordinates:
          typeof lat === "number" && typeof lon === "number"
            ? { lat: +lat.toFixed(5), lon: +lon.toFixed(5) }
            : null,
        website: website && /^https?:\/\//.test(website) ? website : null,
        mapUrl: url,
        // Public parks are free to enter; everything else is "not listed".
        price: category === "park" ? "free" : null,
        tags: [
          category,
          ...(t.cuisine ? t.cuisine.split(";").slice(0, 3) : []),
          ...tags,
        ]
          .map((x) => x.trim().toLowerCase().replaceAll("_", " "))
          .filter((x, i, a) => x && a.indexOf(x) === i)
          .slice(0, 12),
        source: {
          name: "OpenStreetMap",
          url,
          attribution: "© OpenStreetMap contributors (ODbL)",
          kind: "curated",
        },
        lastVerified: VERIFIED_AT,
      });
    }
  return out;
}

if (process.argv[2]) {
  const places = buildUsPlaces(process.argv[2]);
  writeFileSync(
    new URL("../src/lib/places/us-places.json", import.meta.url),
    JSON.stringify(places, null, 2) + "\n",
  );
  console.log(`Wrote ${places.length} OpenStreetMap places.`);
}
