import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Reproducible fictional templates. No network calls, identities, or photos.
export const SEED = 22022026;
export function generatePopulation() {
  let state = SEED;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const pick = (values) => values[Math.floor(random() * values.length)];
  const templates = [
    {
      interests: ["jazz", "cooking", "travel", "film"],
      values: ["curiosity", "kindness", "honesty"],
      bio: "Late-night jazz sets, a new recipe on Sunday, and a trip somewhere I can't pronounce yet.",
      activities: ["cultural-event", "restaurant", "walk"],
    },
    {
      interests: ["comedy", "gaming", "coffee", "running"],
      values: ["humor", "loyalty", "growth"],
      bio: "Comedy shows, a morning run and a board game night with people who don't mind losing.",
      activities: ["cultural-event", "coffee", "sport"],
    },
    {
      interests: ["hiking", "cooking", "music", "coffee"],
      values: ["kindness", "curiosity", "family"],
      bio: "I make time for fresh air, home cooking, and conversations that go somewhere.",
      activities: ["walk", "coffee", "cultural-event"],
    },
    {
      interests: ["art", "reading", "coffee", "photography"],
      values: ["creativity", "honesty", "curiosity"],
      bio: "A gallery afternoon and a bookshop detour are my kind of weekend.",
      activities: ["museum", "coffee", "walk"],
    },
    {
      interests: ["running", "tennis", "travel", "cooking"],
      values: ["growth", "kindness", "independence"],
      bio: "I enjoy an active week and a slow meal with people I care about.",
      activities: ["sport", "walk", "restaurant"],
    },
    {
      interests: ["gardening", "reading", "film", "cooking"],
      values: ["family", "honesty", "kindness"],
      bio: "Building a grounded life, with room for a garden, films, and shared meals.",
      activities: ["restaurant", "coffee", "museum"],
    },
    {
      interests: ["music", "dance", "travel", "art"],
      values: ["freedom", "creativity", "curiosity"],
      bio: "I like trying a new dance class, live music, and exploring at my own pace.",
      activities: ["cultural-event", "museum", "shared-interest"],
    },
    {
      interests: ["cycling", "gaming", "coffee", "hiking"],
      values: ["honesty", "growth", "curiosity"],
      bio: "A bike ride, a board game, or a long conversation over coffee would make my day.",
      activities: ["sport", "coffee", "walk"],
    },
  ];
  const names = {
    woman: [
      "Priya",
      "Dana",
      "Mia",
      "Camila",
      "Sarah",
      "Nadia",
      "Keisha",
      "Grace",
      "Zoe",
      "Amelia",
      "Riley",
      "Hannah",
      "Sofia",
      "Lauren",
      "Mei",
    ],
    man: [
      "Marcus",
      "Diego",
      "Ethan",
      "Jordan",
      "Adam",
      "Ryan",
      "Noah",
      "Elias",
      "Amir",
      "Oscar",
      "Leo",
      "Max",
      "Andre",
      "Kevin",
      "Luis",
    ],
    nonbinary: [
      "Robin",
      "Ari",
      "River",
      "Rowan",
      "Sky",
      "Eden",
      "Sage",
      "Remy",
      "Quinn",
      "Ash",
      "Blair",
      "Morgan",
      "Jesse",
      "Casey",
      "Avery",
    ],
  };
  // US demo cities. New York City is the default, so it has the most people.
  const cities = [
    { city: "New York City", count: 54, tz: "America/New_York" },
    { city: "San Francisco", count: 36, tz: "America/Los_Angeles" },
    { city: "Chicago", count: 36, tz: "America/Chicago" },
    { city: "Austin", count: 36, tz: "America/Chicago" },
  ];
  // Optional Money & Lifestyle answers: some people share all, some a few,
  // some none, and some answered but chose not to share.
  const money = (i) => {
    const answered = i % 5 !== 4;
    const v = (values) => (answered && random() < 0.8 ? pick(values) : null);
    return {
      firstDates: v(["budget-friendly", "budget-friendly", "mix", "treat"]),
      spending: v(["saver", "balanced", "balanced", "spender"]),
      purchases: v(["planned", "mix", "spontaneous"]),
      experiences: v(["modest", "moderate", "generous"]),
      priority: v(["security", "experiences", "shared-goals", "independence"]),
      talking: v(["open", "when-serious", "when-serious", "private"]),
      shareWithMatches: answered && i % 7 !== 5,
    };
  };
  const profiles = [],
    planning = {};
  for (const { city, count, tz } of cities)
    for (let i = 0; i < count; i++) {
      const gender = ["woman", "man", "nonbinary"][i % 3];
      const template =
        templates[
          (Math.floor(i / 3) + Math.floor(random() * 3)) % templates.length
        ];
      const age =
        21 +
        ((Math.floor(i / 9) * 7 + (Math.floor(i / 3) % 3) * 2 + (i % 3) * 3) %
          25);
      const intent = ["long-term", "life-partner", "exploring"][
        Math.floor(i / 3) % 3
      ];
      const id = `fictional-${city.toLowerCase().replaceAll(" ", "-")}-${String(i + 1).padStart(3, "0")}`;
      // Broad, explicitly fictional preference cohorts supply coverage in each
      // city/goal/gender. Other cohorts exercise narrow, reciprocal rejection.
      const broad = i < 27 || i % 4 !== 3;
      const genders = broad
        ? ["woman", "man", "nonbinary"]
        : gender === "woman"
          ? ["woman"]
          : gender === "man"
            ? ["woman"]
            : ["man", "nonbinary"];
      const attributes = {
        children:
          i < 9
            ? "yes"
            : i < 18
              ? null
              : pick(["yes", "yes", "open", "no", null]),
        smoking: i >= 27 && i % 8 === 7 ? "yes" : i % 11 === 8 ? null : "no",
        drinking: pick(["no", "socially", "socially", "often", null]),
        pace: pick(["active", "balanced", "quiet", null]),
      };
      const desired = {
        children: i % 3 === 0 ? attributes.children : null,
        smoking: "no",
        drinking: i % 7 === 0 ? "no" : null,
        pace: i % 5 === 0 ? attributes.pace : null,
      };
      profiles.push({
        id,
        name: pick(names[gender]),
        age,
        gender,
        city,
        intent,
        bio: template.bio,
        interests: [...template.interests],
        values: [...template.values],
        attributes,
        preferences: {
          minAge: broad ? 21 : Math.max(21, age - 3),
          maxAge: broad ? 45 : Math.min(45, age + 4),
          genders,
          locationMode: i % 10 === 9 ? "anywhere" : "local",
          strictIntent: true,
          desired,
          hard:
            i >= 27 && i % 6 === 0 && desired.children
              ? ["smoking", "children"]
              : ["smoking"],
        },
        approved: true,
        fictional: true,
        blockedIds: [],
        readyToConnect: !(i >= 27 && i % 7 === 6),
        money: money(i),
      });
      const slots =
        i % 3 === 0
          ? [
              { day: "wed", start: "17:00", end: "22:00" },
              { day: "sat", start: "08:00", end: "12:00" },
              { day: "sun", start: "12:00", end: "22:00" },
            ]
          : i % 3 === 1
            ? [
                { day: "tue", start: "17:00", end: "22:00" },
                { day: "fri", start: "17:00", end: "22:00" },
                { day: "sun", start: "12:00", end: "17:00" },
              ]
            : [
                { day: "mon", start: "08:00", end: "12:00" },
                { day: "thu", start: "12:00", end: "17:00" },
                { day: "sat", start: "12:00", end: "17:00" },
              ];
      planning[id] = {
        availability:
          i % 17 === 16
            ? null
            : {
                timeZone: tz,
                slots,
                openToMeetingSoon: i % 9 !== 8,
                preference: i % 3 === 0 ? "weekend" : "either",
                shareWithMatches: i % 11 !== 10,
              },
        datePreferences: {
          budget: pick(["free", "low", "moderate", "flexible", null]),
          activityTypes: [...template.activities],
        },
      };
    }
  return { seed: SEED, profiles, planning };
}
const target = new URL(
  "../src/lib/generated/demo-population.json",
  import.meta.url,
);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expected = JSON.stringify(generatePopulation(), null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(target, "utf8") !== expected)
      throw new Error(
        "Generated population is stale. Run npm run demo:generate.",
      );
    console.log("PASS: generated population matches its seed.");
  } else {
    writeFileSync(target, expected);
    console.log("Generated 162 additional fictional profiles (180 total).");
  }
}
