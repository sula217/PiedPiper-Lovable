import { z } from "zod";

export const genders = ["woman", "man", "nonbinary"] as const;
export const intentions = ["long-term", "life-partner", "exploring"] as const;
export const dimensionKeys = [
  "children",
  "smoking",
  "drinking",
  "pace",
] as const;
export type Dimension = (typeof dimensionKeys)[number];
export const dimensionLabels: Record<Dimension, string> = {
  children: "Family plans",
  smoking: "Smoking",
  drinking: "Drinking",
  pace: "Everyday pace",
};
export const dimensionOptions = {
  children: ["yes", "no", "open"],
  smoking: ["yes", "no"],
  drinking: ["socially", "no", "often"],
  pace: ["active", "balanced", "quiet"],
} as const;
export const attributesSchema = z.object({
  children: z.enum(dimensionOptions.children).nullable(),
  smoking: z.enum(dimensionOptions.smoking).nullable(),
  drinking: z.enum(dimensionOptions.drinking).nullable(),
  pace: z.enum(dimensionOptions.pace).nullable(),
});
export const preferencesSchema = z
  .object({
    minAge: z.number().int().min(18).max(100),
    maxAge: z.number().int().min(18).max(100),
    genders: z.array(z.enum(genders)).max(3),
    locationMode: z.enum(["local", "anywhere"]),
    strictIntent: z.boolean(),
    desired: attributesSchema,
    hard: z.array(z.enum(dimensionKeys)).max(4),
  })
  .refine((p) => p.minAge <= p.maxAge, {
    message: "Minimum age must not exceed maximum age.",
  })
  .refine((p) => p.hard.every((d) => p.desired[d] !== null), {
    message: "Choose a partner preference for every hard dealbreaker.",
  });

/**
 * Optional "Money & Lifestyle" preferences. Broad, self-described styles only:
 * never salary, income, balances, debt, credit or bank data, and never
 * inferred from a job, photo, neighborhood or anything else. Unknown (null)
 * is never treated as an incompatibility. Shared with matchmakers only when
 * `shareWithMatches` is true.
 */
export const moneyKeys = [
  "firstDates",
  "spending",
  "purchases",
  "experiences",
  "priority",
  "talking",
] as const;
export type MoneyKey = (typeof moneyKeys)[number];
export const moneyOptions = {
  firstDates: ["budget-friendly", "mix", "treat"],
  spending: ["saver", "balanced", "spender"],
  purchases: ["planned", "mix", "spontaneous"],
  experiences: ["modest", "moderate", "generous"],
  priority: ["security", "experiences", "shared-goals", "independence"],
  talking: ["open", "when-serious", "private"],
} as const;
export const moneyLabels: Record<MoneyKey, string> = {
  firstDates: "First-date budget",
  spending: "Saving vs. spending",
  purchases: "Big purchases",
  experiences: "Travel & entertainment budget",
  priority: "Financial priority in a relationship",
  talking: "Talking about money",
};
const moneyValueLabels: Record<MoneyKey, Record<string, string>> = {
  firstDates: {
    "budget-friendly": "Prefers budget-friendly first dates",
    mix: "Happy with a mix of simple and special first dates",
    treat: "Enjoys treating a first date to something special",
  },
  spending: {
    saver: "More of a saver",
    balanced: "Balances saving and spending",
    spender: "Enjoys spending on what matters now",
  },
  purchases: {
    planned: "Plans major purchases ahead",
    mix: "Plans some purchases, is spontaneous with others",
    spontaneous: "Values spontaneity with purchases",
  },
  experiences: {
    modest: "Keeps travel and entertainment simple",
    moderate: "Sets aside a moderate amount for travel and fun",
    generous: "Prioritizes travel and experiences",
  },
  priority: {
    security: "Prioritizes financial security",
    experiences: "Prioritizes shared experiences",
    "shared-goals": "Prioritizes building shared goals",
    independence: "Prioritizes financial independence",
  },
  talking: {
    open: "Comfortable talking about money early",
    "when-serious": "Prefers to talk about money once things are serious",
    private: "Prefers to keep finances private",
  },
};
export function moneyLabel(k: MoneyKey, v: string | null) {
  return v ? (moneyValueLabels[k][v] ?? v) : "Not shared";
}
export const moneySchema = z.object({
  firstDates: z.enum(moneyOptions.firstDates).nullable(),
  spending: z.enum(moneyOptions.spending).nullable(),
  purchases: z.enum(moneyOptions.purchases).nullable(),
  experiences: z.enum(moneyOptions.experiences).nullable(),
  priority: z.enum(moneyOptions.priority).nullable(),
  talking: z.enum(moneyOptions.talking).nullable(),
  /** Explicit consent to let matchmakers and matches see these answers. */
  shareWithMatches: z.boolean(),
});
export type Money = z.infer<typeof moneySchema>;
export const emptyMoney = (): Money => ({
  firstDates: null,
  spending: null,
  purchases: null,
  experiences: null,
  priority: null,
  talking: null,
  shareWithMatches: false,
});
/** Answers that may be used for matching/agents: only with consent. */
export function sharedMoney(p: { money?: Money }) {
  const m = p.money;
  if (!m?.shareWithMatches) return [];
  return moneyKeys
    .filter((k) => m[k] !== null)
    .map((k) => ({ key: k, value: m[k] as string }));
}

export const profileSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(50),
  age: z.number().int().min(18).max(100).nullable(),
  gender: z.enum(genders).nullable(),
  city: z.string().max(100),
  intent: z.enum(intentions).nullable(),
  bio: z.string().max(700),
  interests: z.array(z.string().min(1).max(40)).max(12),
  values: z.array(z.string().min(1).max(40)).max(10),
  attributes: attributesSchema,
  preferences: preferencesSchema,
  approved: z.boolean(),
  fictional: z.boolean(),
  blockedIds: z.array(z.string()).max(1000),
  /** Ready-to-Connect: when false, the person is paused from new introductions.
   *  Existing matches and messages are preserved. Defaults to true for older data. */
  readyToConnect: z.boolean().default(true),
  /** Optional Money & Lifestyle answers. Older saved data has none. */
  money: moneySchema.default(emptyMoney),
});
export type Profile = z.infer<typeof profileSchema>;
export const emptyAttributes: Profile["attributes"] = {
  children: null,
  smoking: null,
  drinking: null,
  pace: null,
};
export function blankProfile(id = "guest"): Profile {
  return {
    id,
    name: "",
    age: null,
    gender: null,
    city: "",
    intent: null,
    bio: "",
    interests: [],
    values: [],
    attributes: { ...emptyAttributes },
    preferences: {
      minAge: 25,
      maxAge: 45,
      genders: [],
      locationMode: "local",
      strictIntent: true,
      desired: { ...emptyAttributes },
      hard: [],
    },
    approved: false,
    fictional: true,
    blockedIds: [],
    readyToConnect: true,
    money: emptyMoney(),
  };
}
export function requiredMissing(p: Profile): string[] {
  return [
    !p.name.trim() && "name",
    !p.age && "adult age",
    !p.gender && "gender",
    !p.city.trim() && "city",
    !p.intent && "relationship intention",
    !p.preferences.genders.length && "dating preferences",
  ].filter(Boolean) as string[];
}
export function title(value: string | null | undefined) {
  return value
    ? value.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not shared yet";
}
export function attributeLabel(d: Dimension, value: string | null) {
  if (!value) return "Not shared yet";
  if (d === "children")
    return (
      {
        yes: "Wants children",
        no: "Does not want children",
        open: "Open to discussing children",
      } as Record<string, string>
    )[value];
  if (d === "smoking") return value === "no" ? "Does not smoke" : "Smokes";
  if (d === "drinking")
    return value === "no" ? "Does not drink" : `Drinks ${value}`;
  return `${title(value)} pace`;
}
