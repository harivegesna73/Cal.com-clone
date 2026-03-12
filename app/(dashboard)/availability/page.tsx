"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Globe, Loader2, X, CalendarX } from "lucide-react";
import { API_BASE } from "@/lib/config";

interface TimeBlock {
  id: number;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  timeBlocks: TimeBlock[];
}

type WeekSchedule = Record<string, DaySchedule>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const DAY_TO_DOW: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const DOW_TO_DAY: Record<number, string> = Object.fromEntries(
  Object.entries(DAY_TO_DOW).map(([k, v]) => [v, k])
);

interface DateOverride {
  id: string;
  date: string; // ISO
  startTime: string | null;
  endTime: string | null;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 ${
        checked ? "bg-black" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function AvailabilityPage() {
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [schedule, setSchedule] = useState<WeekSchedule>(
    Object.fromEntries(DAYS.map((d) => [d, { enabled: false, timeBlocks: [] }]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date Overrides state
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideType, setOverrideType] = useState<"blocked" | "custom">("blocked");
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("17:00");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/availability`)
      .then((r) => r.json())
      .then((data: { dayOfWeek: number; startTime: string; endTime: string }[]) => {
        const built: WeekSchedule = Object.fromEntries(
          DAYS.map((d) => [d, { enabled: false, timeBlocks: [] }])
        );
        data.forEach((row, i) => {
          const day = DOW_TO_DAY[row.dayOfWeek];
          if (!day) return;
          built[day].enabled = true;
          built[day].timeBlocks.push({ id: i + 1, start: row.startTime, end: row.endTime });
        });
        setSchedule(built);
      })
      .catch((err) => {
        console.error("Failed to load availability:", err);
        setError("Could not connect to the server. Is it running on port 5000?");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/date-overrides`)
      .then((r) => r.json())
      .then((data: DateOverride[]) => setDateOverrides(data))
      .catch(() => {});
  }, []);

  const toggleDay = (day: string) => {
    setSchedule((prev) => {
      const wasEnabled = prev[day].enabled;
      return {
        ...prev,
        [day]: {
          enabled: !wasEnabled,
          timeBlocks:
            !wasEnabled && prev[day].timeBlocks.length === 0
              ? [{ id: Date.now(), start: "09:00", end: "17:00" }]
              : prev[day].timeBlocks,
        },
      };
    });
  };

  const addTimeBlock = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeBlocks: [
          ...prev[day].timeBlocks,
          { id: Date.now(), start: "09:00", end: "17:00" },
        ],
      },
    }));
  };

  const removeTimeBlock = (day: string, id: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeBlocks: prev[day].timeBlocks.filter((b) => b.id !== id),
      },
    }));
  };

  const updateTimeBlock = (
    day: string,
    id: number,
    field: "start" | "end",
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeBlocks: prev[day].timeBlocks.map((b) =>
          b.id === id ? { ...b, [field]: value } : b
        ),
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const schedulePayload: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
    for (const day of DAYS) {
      if (!schedule[day].enabled) continue;
      for (const block of schedule[day].timeBlocks) {
        schedulePayload.push({
          dayOfWeek: DAY_TO_DOW[day],
          startTime: block.start,
          endTime: block.end,
        });
      }
    }
    try {
      const res = await fetch(`${API_BASE}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: schedulePayload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save availability:", err);
      setError("Failed to save availability. Is the server running on port 5000?");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!overrideDate) return;
    setSavingOverride(true);
    try {
      const body =
        overrideType === "blocked"
          ? { date: overrideDate, startTime: null, endTime: null }
          : { date: overrideDate, startTime: overrideStart, endTime: overrideEnd };
      const res = await fetch(`${API_BASE}/date-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: DateOverride = await res.json();
      setDateOverrides((prev) => {
        const filtered = prev.filter((o) => o.date.slice(0, 10) !== overrideDate);
        return [...filtered, saved].sort((a, b) => a.date.localeCompare(b.date));
      });
      setOverrideDate("");
    } catch (err) {
      console.error("Failed to save date override:", err);
      setError("Failed to save date override.");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      await fetch(`${API_BASE}/date-overrides/${id}`, { method: "DELETE" });
      setDateOverrides((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error("Failed to delete override:", err);
      setError("Failed to delete date override.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inline error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600 transition-colors" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure the times you are available for bookings each week.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-60 shrink-0 ${
            saved
              ? "bg-green-600 text-white"
              : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      )}

      {/* Timezone */}
      <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 mb-4 flex items-center gap-3">
        <Globe className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <span className="text-sm font-medium text-gray-700 min-w-fit">Timezone</span>
          <div className="relative flex-1 min-w-48">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-200 rounded-md px-3 py-2 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
        {DAYS.map((day) => {
          const dayData = schedule[day];
          return (
            <div key={day} className="px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                {/* Toggle + Label */}
                <div className="flex items-center gap-3 sm:min-w-32 sm:pt-0.5">
                  <Toggle
                    checked={dayData.enabled}
                    onChange={() => toggleDay(day)}
                  />
                  <span
                    className={`text-sm font-medium ${
                      dayData.enabled ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {day}
                  </span>
                </div>

                {/* Time blocks or unavailable label */}
                {dayData.enabled ? (
                  <div className="flex-1 space-y-2 pl-9 sm:pl-0">
                    {dayData.timeBlocks.map((block) => (
                      <div key={block.id} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={block.start}
                          onChange={(e) =>
                            updateTimeBlock(day, block.id, "start", e.target.value)
                          }
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                        />
                        <span className="text-gray-400 text-sm">–</span>
                        <input
                          type="time"
                          value={block.end}
                          onChange={(e) =>
                            updateTimeBlock(day, block.id, "end", e.target.value)
                          }
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                        />
                        {dayData.timeBlocks.length > 1 && (
                          <button
                            onClick={() => removeTimeBlock(day, block.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addTimeBlock(day)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add time block
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 pl-9 sm:pl-0 pt-0 sm:pt-0.5">
                    <span className="text-sm text-gray-400">Unavailable</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Date Overrides ──────────────────────────────────────────────── */}
      <div className="mt-8 mb-8">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CalendarX className="w-4 h-4 text-gray-500" />
            Date Overrides
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Block a specific date or set custom hours that override your weekly schedule.
          </p>
        </div>

        {/* Add override form */}
        <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 mb-3 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Type</label>
              <select
                value={overrideType}
                onChange={(e) => setOverrideType(e.target.value as "blocked" | "custom")}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
              >
                <option value="blocked">Unavailable (block whole day)</option>
                <option value="custom">Custom hours</option>
              </select>
            </div>
            {overrideType === "custom" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">From</label>
                  <input
                    type="time"
                    value={overrideStart}
                    onChange={(e) => setOverrideStart(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">To</label>
                  <input
                    type="time"
                    value={overrideEnd}
                    onChange={(e) => setOverrideEnd(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                  />
                </div>
              </>
            )}
            <button
              onClick={handleAddOverride}
              disabled={!overrideDate || savingOverride}
              className="flex items-center gap-1.5 text-sm font-medium bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Override
            </button>
          </div>
        </div>

        {/* List of existing overrides */}
        {dateOverrides.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
            {dateOverrides.map((o) => {
              const d = new Date(o.date);
              const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
              return (
                <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CalendarX className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">
                        {o.startTime && o.endTime ? `${o.startTime} – ${o.endTime}` : "Unavailable all day"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteOverride(o.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Remove override"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}
