"use client";
import { useState } from "react";
import { CalendarDays, Check, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  budgetLabels,
  budgetLevels,
  dateCategories,
  dateCategoryLabels,
  emptyPlanning,
  gridHas,
  slotsFromGrid,
  timeWindowKeys,
  timeWindows,
  weekdayLabels,
  weekdays,
  type Planning,
  type TimeWindow,
  type Weekday,
} from "@/lib/planning";

const commonZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Asia/Almaty",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];
function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
type Grid = Record<Weekday, TimeWindow[]>;
const toGrid = (p: Planning | undefined): Grid =>
  Object.fromEntries(
    weekdays.map((d) => [
      d,
      timeWindowKeys.filter((w) =>
        p?.availability ? gridHas(p.availability.slots, d, w) : false,
      ),
    ]),
  ) as Grid;

/**
 * A simple weekly availability editor. No calendar integration: people pick
 * general windows, and nothing is shared unless they explicitly consent.
 */
export function AvailabilityEditor({
  value,
  onSave,
  sample,
  compact = false,
}: {
  value: Planning | undefined;
  onSave: (planning: Planning) => void;
  sample?: () => Planning;
  compact?: boolean;
}) {
  const initial = value ?? emptyPlanning();
  const [grid, setGrid] = useState<Grid>(() => toGrid(value)),
    [timeZone, setTimeZone] = useState(
      () => initial.availability?.timeZone ?? browserZone(),
    ),
    [openSoon, setOpenSoon] = useState<boolean | null>(
      initial.availability?.openToMeetingSoon ?? null,
    ),
    [preference, setPreference] = useState(
      initial.availability?.preference ?? null,
    ),
    [share, setShare] = useState(
      initial.availability?.shareWithMatches ?? false,
    ),
    [budget, setBudget] = useState(initial.datePreferences.budget),
    [activities, setActivities] = useState(
      initial.datePreferences.activityTypes,
    ),
    [saved, setSaved] = useState(""),
    [error, setError] = useState("");
  const zones = [...new Set([timeZone, browserZone(), ...commonZones])];
  const count = weekdays.reduce((n, d) => n + grid[d].length, 0);
  function load(p: Planning) {
    setGrid(toGrid(p));
    setTimeZone(p.availability?.timeZone ?? browserZone());
    setOpenSoon(p.availability?.openToMeetingSoon ?? null);
    setPreference(p.availability?.preference ?? null);
    setShare(p.availability?.shareWithMatches ?? false);
    setBudget(p.datePreferences.budget);
    setActivities(p.datePreferences.activityTypes);
  }
  function save(clear = false) {
    setError("");
    try {
      const slots = clear ? [] : slotsFromGrid(grid);
      const next: Planning = {
        availability: slots.length
          ? {
              timeZone,
              slots,
              openToMeetingSoon: openSoon,
              preference,
              shareWithMatches: share,
            }
          : null,
        datePreferences: { budget, activityTypes: activities },
      };
      onSave(next);
      if (clear) load(next);
      setSaved(
        clear
          ? "Availability cleared. Nothing is assumed about when you’re free."
          : slots.length
            ? share
              ? "Saved. Mutual connections can now compare general availability with you."
              : "Saved privately. Turn on sharing when you’re ready to compare."
            : "Saved. No availability entered, so none will be shown.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Availability could not be saved.",
      );
    }
  }
  return (
    <div className={`availability-editor ${compact ? "compact" : ""}`}>
      <div className="availability-head">
        <span className="eyebrow">
          <CalendarDays size={13} /> GENERAL WEEKLY AVAILABILITY
        </span>
        {sample && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              load(sample());
              setSaved("");
            }}
          >
            Use Jamie’s fictional sample
          </button>
        )}
      </div>
      <div className="week-grid" role="group" aria-label="Weekly availability">
        <span />
        {timeWindowKeys.map((w) => (
          <span key={w} className="week-grid-head">
            {timeWindows[w].label}
            <small>
              {timeWindows[w].start}–{timeWindows[w].end}
            </small>
          </span>
        ))}
        {weekdays.map((d) => (
          <div className="week-row" key={d}>
            <span className="week-day">{weekdayLabels[d].slice(0, 3)}</span>
            {timeWindowKeys.map((w) => {
              const on = grid[d].includes(w);
              return (
                <button
                  type="button"
                  key={w}
                  aria-pressed={on}
                  aria-label={`${weekdayLabels[d]} ${timeWindows[w].label.toLowerCase()}`}
                  className={on ? "on" : ""}
                  onClick={() =>
                    setGrid({
                      ...grid,
                      [d]: on
                        ? grid[d].filter((x) => x !== w)
                        : [...grid[d], w],
                    })
                  }
                >
                  {on && <Check size={13} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="form-grid">
        <label>
          Time zone
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Open to meeting soon?
          <select
            value={openSoon === null ? "" : String(openSoon)}
            onChange={(e) =>
              setOpenSoon(
                e.target.value === "" ? null : e.target.value === "true",
              )
            }
          >
            <option value="">Prefer not to say</option>
            <option value="true">Yes, in the next week or two</option>
            <option value="false">Not right now</option>
          </select>
        </label>
        <label>
          Weekday or weekend?
          <select
            value={preference ?? ""}
            onChange={(e) =>
              setPreference(
                (e.target.value || null) as
                  "weekday" | "weekend" | "either" | null,
              )
            }
          >
            <option value="">No preference shared</option>
            <option value="weekday">Weekdays</option>
            <option value="weekend">Weekends</option>
            <option value="either">Either works</option>
          </select>
        </label>
        <label>
          First-date budget
          <select
            value={budget ?? ""}
            onChange={(e) =>
              setBudget(
                (e.target.value || null) as
                  (typeof budgetLevels)[number] | null,
              )
            }
          >
            <option value="">No preference shared</option>
            {budgetLevels.map((b) => (
              <option key={b} value={b}>
                {budgetLabels[b]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-label">First-date activities you enjoy</div>
      <div className="checkbox-row activity-row">
        {dateCategories.map((c) => (
          <label className="check-label" key={c}>
            <input
              type="checkbox"
              checked={activities.includes(c)}
              onChange={(e) =>
                setActivities(
                  e.target.checked
                    ? [...activities, c]
                    : activities.filter((x) => x !== c),
                )
              }
            />
            {dateCategoryLabels[c]}
          </label>
        ))}
      </div>
      <label className="check-label consent-label">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
        />
        <span>
          <strong>
            Share my general availability with mutual connections.
          </strong>
          <br />
          <small>
            Only people you’ve both said yes to can compare it with theirs. You
            can turn this off or clear it at any time.
          </small>
        </span>
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="saved-text">
          <Check size={14} /> {saved}
        </p>
      )}
      <div className="inline-actions">
        <Button type="button" onClick={() => save(false)}>
          Save availability & preferences
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!value?.availability && count === 0}
          onClick={() => save(true)}
        >
          <Trash2 size={15} /> Clear availability
        </Button>
      </div>
      <p className="fine-print">
        <ShieldCheck size={14} />
        {count} window{count === 1 ? "" : "s"} selected · No calendar access ·
        Empty means unknown, never “free”.
      </p>
    </div>
  );
}
