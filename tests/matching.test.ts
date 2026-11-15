import { describe, expect, it } from "vitest";
import { demoProfiles, sampleProfile } from "../src/lib/fixtures";
import {
  eligibility,
  recommend,
  missingInformation,
  answerInvestigation,
  isMutual,
  canMessage,
} from "../src/lib/matching";
import { profileSchema } from "../src/lib/profile";
import { initialDemo, reduceDemo, matched } from "../src/lib/demo-store";
const self = () => ({ ...sampleProfile(), approved: true });
const candidate = (id = "lena") =>
  structuredClone(demoProfiles.find((p) => p.id === id)!);
describe("Fictional fixtures", () => {
  it("contains 180 valid, distinct, approved fictional adults", () => {
    expect(demoProfiles).toHaveLength(180);
    expect(new Set(demoProfiles.map((p) => p.id)).size).toBe(180);
    demoProfiles.forEach((p) => {
      expect(profileSchema.safeParse(p).success).toBe(true);
      expect(p.fictional && p.approved).toBe(true);
      expect(p.age).toBeGreaterThanOrEqual(18);
    });
  });
});
describe("Reciprocal eligibility", () => {
  it("requires explicit profile sharing", () => {
    expect(eligibility(sampleProfile(), candidate()).eligible).toBe(false);
  });
  it("accepts an eligible introduction with a visible unknown", () => {
    expect(eligibility(self(), candidate()).eligible).toBe(true);
  });
  it("checks both age ranges", () => {
    const b = candidate();
    b.preferences.minAge = 34;
    expect(eligibility(self(), b).eligible).toBe(false);
    b.preferences.minAge = 27;
    b.age = 40;
    expect(eligibility(self(), b).eligible).toBe(false);
  });
  it("checks reciprocal gender preferences", () => {
    const b = candidate();
    b.preferences.genders = ["woman"];
    expect(eligibility(self(), b).eligible).toBe(false);
    const a = self();
    a.preferences.genders = ["man"];
    expect(eligibility(a, candidate()).eligible).toBe(false);
  });
  it("requires both people to accept different cities", () => {
    const a = self(),
      b = candidate();
    b.city = "Boston";
    a.preferences.locationMode = "anywhere";
    expect(eligibility(a, b).eligible).toBe(false);
    b.preferences.locationMode = "anywhere";
    expect(eligibility(a, b).eligible).toBe(true);
  });
  it("normalizes city spacing and case", () => {
    const b = candidate();
    b.city = " new YORK city ";
    expect(eligibility(self(), b).eligible).toBe(true);
  });
  it("checks relationship intentions from both sides", () => {
    const a = self(),
      b = candidate();
    b.intent = "exploring";
    a.preferences.strictIntent = false;
    expect(eligibility(a, b).eligible).toBe(false);
    b.preferences.strictIntent = false;
    expect(eligibility(a, b).eligible).toBe(true);
  });
  it("rejects confirmed hard conflicts on either side", () => {
    const a = self(),
      b = candidate();
    b.attributes.smoking = "yes";
    expect(eligibility(a, b).eligible).toBe(false);
    b.attributes.smoking = "no";
    a.attributes.smoking = "yes";
    expect(eligibility(a, b).eligible).toBe(false);
  });
  it("enforces blocks in either direction and excludes self", () => {
    const a = self(),
      b = candidate();
    a.blockedIds = [b.id];
    expect(eligibility(a, b).eligible).toBe(false);
    a.blockedIds = [];
    b.blockedIds = [a.id];
    expect(eligibility(a, b).eligible).toBe(false);
    expect(eligibility(a, a).eligible).toBe(false);
  });
  it("does not recommend incomplete profiles", () => {
    const b = candidate();
    b.gender = null;
    expect(eligibility(self(), b).eligible).toBe(false);
  });
});
describe("Deterministic ranking and evidence", () => {
  it("ranks consistently and excludes ineligible fixtures", () => {
    const ranked = recommend(self(), demoProfiles);
    expect(ranked.map((r) => r.profile.id)).toEqual(
      recommend(self(), demoProfiles).map((r) => r.profile.id),
    );
    expect(ranked.every((r) => eligibility(self(), r.profile).eligible)).toBe(
      true,
    );
    expect(ranked.some((r) => r.profile.id === "iris")).toBe(false);
    expect(ranked.some((r) => r.profile.id === "emma")).toBe(false);
    expect(ranked[0].profile.id).toBe("lena");
  });
  it("counts shared facts case-insensitively without invented interests", () => {
    const b = candidate();
    b.interests = ["HIKING", "hiking", "unshared"];
    const r = recommend(self(), [b])[0];
    expect(r.commonInterests).toEqual(["hiking"]);
    expect(r.evidence.join(" ")).not.toContain("unshared");
  });
  it("does not count unknown lifestyle as agreement", () => {
    const b = candidate(),
      before = recommend(self(), [b])[0];
    b.attributes.children = "yes";
    expect(recommend(self(), [b])[0].score).toBeGreaterThan(before.score);
  });
  it("lets explicit feedback change ordering weights without bypassing hard constraints", () => {
    const normal = recommend(self(), demoProfiles),
      weighted = recommend(self(), demoProfiles, {
        goals: 30,
        lifestyle: 25,
        interests: 100,
        values: 20,
        reciprocal: 5,
      });
    expect(weighted[0].score).toBeGreaterThan(normal[0].score);
    expect(weighted.some((r) => r.profile.id === "iris")).toBe(false);
  });
});
describe("Compatibility investigation", () => {
  it("only investigates relevant unknown dimensions and prioritizes hard preferences", () => {
    const qs = missingInformation(self(), candidate());
    expect(qs.map((q) => q.dimension)).toEqual(["children"]);
    expect(qs[0].hard).toBe(true);
  });
  it("does not change a profile without sharing consent", () => {
    const b = candidate();
    expect(answerInvestigation(b, "children", "yes", false)).toEqual(b);
  });
  it("confirms an answer, removes the question, and updates ranking", () => {
    const b = candidate(),
      next = answerInvestigation(b, "children", "yes", true);
    expect(missingInformation(self(), next)).toEqual([]);
    expect(recommend(self(), [next])[0].score).toBeGreaterThan(
      recommend(self(), [b])[0].score,
    );
  });
  it("removes a recommendation when an approved answer reveals a hard conflict", () => {
    expect(
      recommend(self(), [
        answerInvestigation(candidate(), "children", "no", true),
      ]),
    ).toEqual([]);
  });
  it("validates answer enum instead of accepting arbitrary generated JSON", () => {
    expect(() =>
      answerInvestigation(candidate(), "children", "invented", true),
    ).toThrow();
  });
  it("records decline without saving the private answer and prevents a repeated request", () => {
    let s = reduceDemo(initialDemo(), { type: "profile", profile: self() });
    const action = {
      type: "answer",
      id: "lena",
      subjectId: "lena",
      dimension: "children",
      answer: "no",
      consent: false,
    } as const;
    s = reduceDemo(s, action);
    expect(
      s.candidates.find((p) => p.id === "lena")!.attributes.children,
    ).toBeNull();
    expect(s.questions["guest:lena:children"]).toBe("declined");
    expect(() => reduceDemo(s, action)).toThrow();
  });
});
describe("Mutual decisions and messaging authorization", () => {
  it("requires two interested decisions", () => {
    expect(isMutual("interested")).toBe(false);
    expect(isMutual("interested", "pass")).toBe(false);
    expect(isMutual("interested", "interested")).toBe(true);
  });
  it("rejects strangers, unilateral interest, and blocked participants", () => {
    expect(canMessage("outsider", ["a", "b"], true, false)).toBe(false);
    expect(canMessage("a", ["a", "b"], false, false)).toBe(false);
    expect(canMessage("a", ["a", "b"], true, true)).toBe(false);
  });
  it("completes the local guest lifecycle with no implicit counterpart actions", () => {
    let s = reduceDemo(initialDemo(), { type: "profile", profile: self() });
    s = reduceDemo(s, { type: "decision", id: "lena", decision: "interested" });
    expect(matched(s, "lena")).toBe(false);
    expect(() =>
      reduceDemo(s, { type: "message", id: "lena", text: "hello" }),
    ).toThrow();
    s = reduceDemo(s, {
      type: "counterpart",
      id: "lena",
      decision: "interested",
    });
    expect(matched(s, "lena")).toBe(true);
    s = reduceDemo(s, { type: "message", id: "lena", text: "hello" });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].sender).toBe("you");
    s = reduceDemo(s, { type: "block", id: "lena" });
    expect(matched(s, "lena")).toBe(false);
    expect(() =>
      reduceDemo(s, { type: "message", id: "lena", text: "blocked" }),
    ).toThrow();
  });
  it("records feedback and applies a preference update only when requested", () => {
    const s = reduceDemo(initialDemo(), { type: "profile", profile: self() });
    const next = reduceDemo(s, {
      type: "decision",
      id: "lena",
      decision: "pass",
      reason: "More shared interests",
      prioritizeInterests: true,
    });
    expect(next.feedback).toHaveLength(1);
    expect(next.weights.interests).toBe(30);
    expect(s.weights.interests).toBe(20);
  });
});
