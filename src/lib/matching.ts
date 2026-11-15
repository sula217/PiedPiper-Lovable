import {
  dimensionKeys,
  dimensionLabels,
  type Dimension,
  type Profile,
  requiredMissing,
  attributeLabel,
  moneyLabel,
  sharedMoney,
} from "./profile";
import { cityIdFor } from "./places/types";

/**
 * Confirmed Money & Lifestyle alignment, from answers BOTH people chose to
 * share. Advisory only: it adds explanations, never a score or a filter, and
 * an unanswered question is never treated as a difference.
 */
export function moneyComparison(a: Profile, b: Profile) {
  const theirs = new Map(sharedMoney(b).map((m) => [m.key, m.value]));
  const aligned: string[] = [],
    different: string[] = [];
  for (const { key, value } of sharedMoney(a)) {
    const other = theirs.get(key);
    if (!other) continue;
    if (other === value)
      aligned.push(
        key === "firstDates" && value === "budget-friendly"
          ? "You both prefer affordable first dates."
          : `You both: ${moneyLabel(key, value).toLowerCase()}.`,
      );
    else
      different.push(
        `${a.name}: ${moneyLabel(key, value).toLowerCase()}; ${b.name}: ${moneyLabel(key, other).toLowerCase()}.`,
      );
  }
  return { aligned, different };
}

export const DEFAULT_WEIGHTS = {
  goals: 30,
  lifestyle: 25,
  interests: 20,
  values: 20,
  reciprocal: 5,
};
export type Weights = typeof DEFAULT_WEIGHTS;
const normalize = (s: string) => s.trim().toLocaleLowerCase("en-US");
/** Supported cities compare by id, so "NYC", "Brooklyn" and "New York, NY" match. */
export const normalizeCity = (s: string) => cityIdFor(s) ?? normalize(s);
export const intersection = (a: string[], b: string[]) =>
  [...new Set(a.map(normalize))].filter((x) => b.map(normalize).includes(x));
const overlap = (a: string[], b: string[]) =>
  a.length && b.length
    ? intersection(a, b).length /
      Math.max(new Set(a.map(normalize)).size, new Set(b.map(normalize)).size)
    : 0;
export function eligibility(a: Profile, b: Profile) {
  const reasons: string[] = [];
  if (a.id === b.id) reasons.push("Same person");
  if (!a.approved || !b.approved)
    reasons.push("Profile sharing has not been approved");
  if (requiredMissing(a).length || requiredMissing(b).length)
    reasons.push("Required profile information is missing");
  if (a.blockedIds.includes(b.id) || b.blockedIds.includes(a.id))
    reasons.push("A person has blocked this connection");
  for (const [viewer, candidate] of [
    [a, b],
    [b, a],
  ]) {
    if (
      candidate.age !== null &&
      (candidate.age < viewer.preferences.minAge ||
        candidate.age > viewer.preferences.maxAge)
    )
      reasons.push(`${viewer.name}'s age preference`);
    if (
      candidate.gender &&
      !viewer.preferences.genders.includes(candidate.gender)
    )
      reasons.push(`${viewer.name}'s gender preference`);
    if (
      viewer.preferences.locationMode === "local" &&
      normalizeCity(viewer.city) !== normalizeCity(candidate.city)
    )
      reasons.push(`${viewer.name}'s location preference`);
    if (
      viewer.preferences.strictIntent &&
      viewer.intent &&
      candidate.intent &&
      viewer.intent !== candidate.intent
    )
      reasons.push(`${viewer.name}'s relationship intention`);
    for (const d of viewer.preferences.hard) {
      const expected = viewer.preferences.desired[d],
        actual = candidate.attributes[d];
      if (expected !== null && actual !== null && expected !== actual)
        reasons.push(`${viewer.name}'s dealbreaker: ${dimensionLabels[d]}`);
    }
  }
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}
export function isOpenToIntroductions(p: Profile) {
  return p.readyToConnect !== false;
}
/** Aggregate exclusions only; rejected profile details are never displayed. */
export function exclusionSummary(a: Profile, candidates: Profile[]) {
  const counts = new Map<string, number>();
  for (const b of candidates) {
    const labels = new Set<string>();
    if (!isOpenToIntroductions(b)) labels.add("Ready-to-Connect is paused");
    for (const reason of eligibility(a, b).reasons) {
      labels.add(
        reason.includes("age preference")
          ? "Both people’s age ranges"
          : reason.includes("gender preference")
            ? "Both people’s dating preferences"
            : reason.includes("location preference")
              ? "Both people’s city preferences"
              : reason.includes("relationship intention")
                ? "Relationship intentions"
                : reason.includes("dealbreaker")
                  ? "Confirmed hard dealbreakers"
                  : reason.includes("blocked")
                    ? "Blocking restrictions"
                    : reason,
      );
    }
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));
}
export type Investigation = {
  key: string;
  subjectId: string;
  requesterId: string;
  dimension: Dimension;
  reason: string;
  hard: boolean;
};
export function missingInformation(a: Profile, b: Profile): Investigation[] {
  const results: Investigation[] = [];
  for (const [requester, subject] of [
    [a, b],
    [b, a],
  ]) {
    for (const d of dimensionKeys)
      if (
        requester.preferences.desired[d] !== null &&
        subject.attributes[d] === null
      ) {
        results.push({
          key: `${requester.id}:${subject.id}:${d}`,
          subjectId: subject.id,
          requesterId: requester.id,
          dimension: d,
          reason: `${dimensionLabels[d]} matters to ${requester.name}, and ${subject.name} has not shared this yet.`,
          hard: requester.preferences.hard.includes(d),
        });
      }
  }
  return results.sort((x, y) => Number(y.hard) - Number(x.hard));
}
export function recommend(
  a: Profile,
  candidates: Profile[],
  weights: Weights = DEFAULT_WEIGHTS,
) {
  // Ready-to-Connect: a paused person neither receives nor appears in new
  // introductions. This is separate from hard eligibility so existing mutual
  // connections and messages are preserved while paused.
  if (!isOpenToIntroductions(a)) return [];
  return candidates
    .filter((b) => isOpenToIntroductions(b) && eligibility(a, b).eligible)
    .map((b) => {
      const commonInterests = intersection(a.interests, b.interests),
        commonValues = intersection(a.values, b.values);
      const differences: string[] = [],
        evidence: string[] = [];
      if (a.intent === b.intent)
        evidence.push(
          `You both want a ${a.intent?.replaceAll("-", " ")} relationship.`,
        );
      else differences.push("Your stated relationship intentions differ.");
      if (commonInterests.length)
        evidence.push(`Shared interests: ${commonInterests.join(", ")}.`);
      if (commonValues.length)
        evidence.push(`Shared values: ${commonValues.join(", ")}.`);
      const money = moneyComparison(a, b);
      evidence.push(...money.aligned.slice(0, 2));
      differences.push(...money.different.slice(0, 2));
      let matches = 0,
        total = 0;
      for (const [viewer, candidate] of [
        [a, b],
        [b, a],
      ])
        for (const d of dimensionKeys) {
          const desired = viewer.preferences.desired[d];
          if (desired !== null) {
            total++;
            if (desired === candidate.attributes[d]) matches++;
          }
        }
      for (const d of dimensionKeys) {
        if (
          a.attributes[d] &&
          b.attributes[d] &&
          a.attributes[d] !== b.attributes[d]
        )
          differences.push(
            `${dimensionLabels[d]}: you — ${attributeLabel(d, a.attributes[d])}; ${b.name} — ${attributeLabel(d, b.attributes[d])}.`,
          );
        if (
          a.preferences.desired[d] &&
          b.attributes[d] === a.preferences.desired[d]
        )
          evidence.push(
            `${b.name}: ${attributeLabel(d, b.attributes[d])}, as you prefer.`,
          );
        if (
          a.preferences.desired[d] &&
          b.attributes[d] &&
          b.attributes[d] !== a.preferences.desired[d]
        )
          differences.push(
            `${b.name}'s ${dimensionLabels[d].toLowerCase()} differs from your soft preference.`,
          );
        if (
          b.preferences.desired[d] &&
          a.attributes[d] &&
          a.attributes[d] !== b.preferences.desired[d]
        )
          differences.push(
            `Your ${dimensionLabels[d].toLowerCase()} differs from ${b.name}'s soft preference.`,
          );
      }
      const centeredAge = (p: Profile, other: Profile) =>
        Math.max(
          0,
          1 -
            Math.abs(
              other.age! - (p.preferences.minAge + p.preferences.maxAge) / 2,
            ) /
              Math.max(1, (p.preferences.maxAge - p.preferences.minAge) / 2),
        );
      const components = {
        goals: a.intent === b.intent ? 1 : 0,
        lifestyle: total ? matches / total : 0,
        interests: overlap(a.interests, b.interests),
        values: overlap(a.values, b.values),
        reciprocal: (centeredAge(a, b) + centeredAge(b, a)) / 2,
      };
      const score = Object.entries(components).reduce(
        (sum, [key, v]) => sum + v * weights[key as keyof Weights],
        0,
      );
      const missing = missingInformation(a, b);
      return {
        profile: b,
        score,
        components,
        evidence,
        commonInterests,
        commonValues,
        differences: [...new Set(differences)],
        missing,
        label: missing.some((q) => q.hard)
          ? "A question worth asking"
          : evidence.length >= 4
            ? "A promising introduction"
            : "Worth getting to know",
      };
    })
    .sort(
      (x, y) => y.score - x.score || x.profile.id.localeCompare(y.profile.id),
    );
}
export type Recommendation = ReturnType<typeof recommend>[number];
export function answerInvestigation(
  profile: Profile,
  dimension: Dimension,
  answer: string,
  consent: boolean,
): Profile {
  if (!consent) return profile;
  // Parse the entire profile so invalid values can never become confirmed facts.
  return profileSchema.parse({
    ...profile,
    attributes: { ...profile.attributes, [dimension]: answer },
  });
}
import { profileSchema } from "./profile";
export function isMutual(aDecision?: string, bDecision?: string) {
  return aDecision === "interested" && bDecision === "interested";
}
export function canMessage(
  sender: string,
  participants: string[],
  mutual: boolean,
  blocked: boolean,
) {
  return (
    mutual &&
    !blocked &&
    participants.includes(sender) &&
    participants.length === 2
  );
}
