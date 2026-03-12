"use client";

import { useState, useMemo, use, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Calendar, Video, CheckCircle, ArrowLeft, Globe, X } from "lucide-react";

import { API_BASE } from "@/lib/config";

interface ApiEventType {
  id: string;
  title: string;
  duration: number;
  description: string | null;
  slug: string;
  bufferTime: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ApiAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface DateOverride {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
}

// ── Time Slot Generator ──────────────────────────────────────────────────────
// Generates slots from a list of { startTime, endTime } blocks (HH:mm strings).
function generateSlotsFromBlocks(
  blocks: { startTime: string; endTime: string }[],
  duration: number,
  cutoffMins?: number
): string[] {
  const slots: string[] = [];
  for (const block of blocks) {
    const [startH, startM] = block.startTime.split(":").map(Number);
    const [endH, endM] = block.endTime.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    for (let mins = startMins; mins + duration <= endMins; mins += duration) {
      if (cutoffMins !== undefined && mins <= cutoffMins) continue;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const period = h < 12 ? "AM" : "PM";
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push(`${displayH}:${m.toString().padStart(2, "0")} ${period}`);
    }
  }
  return slots;
}

function generateSlotsForDay(
  dayOfWeek: number,
  availability: ApiAvailability[],
  duration: number,
  cutoffMins?: number
): string[] {
  const blocks = availability.filter((a) => a.dayOfWeek === dayOfWeek);
  return generateSlotsFromBlocks(blocks, duration, cutoffMins);
}

type View = "calendar" | "form" | "success";

// ── Shared page chrome (module-level so React never remounts on re-render) ──
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <Link
        href="/event-types"
        className="absolute top-4 right-5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        ← Back to Dashboard
      </Link>
      {children}
    </div>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────
export default function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; eventslug: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  const { username, eventslug } = use(params);
  const { reschedule: rescheduleId } = use(searchParams);
  const isRescheduling = Boolean(rescheduleId);

  const [event, setEvent] = useState<ApiEventType | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/event-types`)
      .then((r) => r.json())
      .then((types: ApiEventType[]) => {
        const found = types.find((t) => t.slug === eventslug);
        if (found) setEvent(found);
        else setEventError(true);
      })
      .catch(() => setEventError(true))
      .finally(() => setEventLoading(false));
  }, [eventslug]);

  // Availability — drives calendar highlighting and slot generation
  const [availability, setAvailability] = useState<ApiAvailability[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/availability`)
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() => {}); // non-fatal
  }, []);

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // All date overrides — fetched once so the calendar can gray out blocked days
  const [allDateOverrides, setAllDateOverrides] = useState<DateOverride[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/date-overrides`)
      .then((r) => r.json())
      .then((data: DateOverride[]) => setAllDateOverrides(data))
      .catch(() => {});
  }, []);

  // Taken booking intervals + date override for the selected day
  const [takenSlots, setTakenSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [dateOverride, setDateOverride] = useState<DateOverride | null>(null);

  const fetchTakenSlots = (year: number, month: number, day: number) => {
    if (!event) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    // Pass the browser's UTC offset so the server queries the correct local-day window
    const tzOffset = new Date().getTimezoneOffset();
    fetch(`${API_BASE}/bookings/taken?eventTypeId=${event.id}&date=${date}&tzOffset=${tzOffset}`)
      .then((r) => r.json())
      .then((data: { taken: Array<{ start: string; end: string }>; dateOverride: DateOverride | null }) => {
        setTakenSlots(data.taken ?? []);
        setDateOverride(data.dateOverride ?? null);
      })
      .catch(() => { setTakenSlots([]); setDateOverride(null); });
  };

  // Slots — re-computed whenever the selected day, availability, taken slots, or override change
  const slots = useMemo(() => {
    if (!event || selectedDay === null) return [];
    const selDate = new Date(calYear, calMonth, selectedDay);
    const dow = selDate.getDay();
    const now = new Date();
    const isToday =
      selDate.getFullYear() === now.getFullYear() &&
      selDate.getMonth() === now.getMonth() &&
      selDate.getDate() === now.getDate();
    const cutoff = isToday ? now.getHours() * 60 + now.getMinutes() : undefined;

    let generated: string[];
    if (dateOverride) {
      // Whole day blocked → no slots
      if (!dateOverride.startTime || !dateOverride.endTime) return [];
      // Custom hours override → completely replaces weekly schedule
      generated = generateSlotsFromBlocks(
        [{ startTime: dateOverride.startTime, endTime: dateOverride.endTime }],
        event.duration,
        cutoff
      );
    } else {
      generated = generateSlotsForDay(dow, availability, event.duration, cutoff);
    }

    // Filter using exact timestamp comparisons against the taken intervals.
    // takenSlots entries are ISO strings already expanded by bufferTime on the server.
    return generated.filter((slot) => {
      // Parse display string (e.g. "9:30 AM") into a full local Date for this calendar day.
      const [timePart, period] = slot.split(" ");
      const [hStr, mStr] = timePart.split(":");
      let h = parseInt(hStr);
      const m = parseInt(mStr);
      if (period === "AM" && h === 12) h = 0;
      if (period === "PM" && h !== 12) h += 12;
      const slotStart = new Date(calYear, calMonth, selectedDay, h, m, 0, 0);
      const slotEnd   = new Date(slotStart.getTime() + event.duration * 60 * 1000);

      const isSlotAvailable = !takenSlots.some((taken) => {
        const takenStart = new Date(taken.start).getTime();
        const takenEnd   = new Date(taken.end).getTime();
        const slotS = slotStart.getTime();
        const slotE = slotEnd.getTime();
        // Overlap: slot starts before taken ends AND slot ends after taken starts
        return slotS < takenEnd && slotE > takenStart;
      });
      return isSlotAvailable;
    });
  }, [event, selectedDay, calYear, calMonth, availability, takenSlots, dateOverride]);

  // Form state
  const [view, setView] = useState<View>("calendar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // ── Calendar helpers ─────────────────────────────────────────────────────
  const firstDayOffset = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // A day is "available" if it's not in the past AND either:
  //   (a) it has a custom-hours date override (replaces weekly schedule), OR
  //   (b) it has weekly availability and is NOT covered by a full-day block override.
  const isAvailable = (day: number) => {
    const d = new Date(calYear, calMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d < todayMidnight) return false;

    // Check date-level override first — it takes priority over the weekly schedule.
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const override = allDateOverrides.find((o) => o.date.slice(0, 10) === dateStr);
    if (override) {
      // Full-day block → not available
      if (!override.startTime) return false;
      // Custom hours override → available regardless of weekly schedule
      return true;
    }

    // No override: fall back to weekly availability
    const dow = d.getDay();
    return availability.some((a) => a.dayOfWeek === dow);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
    setSelectedDay(null);
    setSelectedSlot(null);
    setTakenSlots([]);
    setDateOverride(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
    setSelectedDay(null);
    setSelectedSlot(null);
    setTakenSlots([]);
    setDateOverride(null);
  };

  const selectDay = (day: number) => {
    if (!isAvailable(day)) return;
    setSelectedDay(day);
    setSelectedSlot(null);
    setTakenSlots([]);
    setDateOverride(null);
    fetchTakenSlots(calYear, calMonth, day);
  };

  const selectSlot = (slot: string) => {
    setSelectedSlot(slot);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || selectedDay === null || !selectedSlot) return;
    if (!isRescheduling && (!name.trim() || !email.trim())) return;
    setSubmitting(true);

    // Parse slot string (e.g. "9:00 AM") into a Date
    const [timePart, period] = selectedSlot.split(" ");
    const [h, m] = timePart.split(":").map(Number);
    let hours = h;
    if (period === "PM" && h !== 12) hours += 12;
    if (period === "AM" && h === 12) hours = 0;
    const startDate = new Date(calYear, calMonth, selectedDay, hours, m, 0);
    const endDate = new Date(startDate.getTime() + event.duration * 60 * 1000);

    try {
      if (isRescheduling && rescheduleId) {
        // PUT reschedule — update existing booking's time
        const res = await fetch(`${API_BASE}/bookings/${rescheduleId}/reschedule`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setBookingError((body as { error?: string }).error ?? "Failed to reschedule booking.");
          return;
        }
      } else {
        // POST new booking
        const res = await fetch(`${API_BASE}/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookerName: name,
            bookerEmail: email,
            notes: notes.trim() || null,
            eventTypeId: event.id,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setBookingError((body as { error?: string }).error ?? "Failed to create booking.");
          return;
        }
      }
      setView("success");
    } catch (err) {
      console.error("Failed to confirm booking:", err);
      setBookingError("Failed to confirm booking. Is the server running on port 5000?");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Formatted date string ────────────────────────────────────────────────
  const formattedDate =
    selectedDay !== null
      ? new Date(calYear, calMonth, selectedDay).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "";

  // ── Calendar grid cells ──────────────────────────────────────────────────
  const gridCells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // ── Loading / error guards ────────────────────────────────────────────────
  if (eventLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (eventError || !event) {
    return (
      <PageShell>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-sm p-8 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">Event not found</p>
          <p className="text-xs text-gray-400">This booking link may be invalid or expired.</p>
        </div>
      </PageShell>
    );
  }

  // ── Success View ─────────────────────────────────────────────────────────
  if (view === "success") {
    return (
      <PageShell>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {isRescheduling ? "Booking rescheduled!" : "This meeting is scheduled"}
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            {isRescheduling
              ? "Your booking has been moved to the new time."
              : <>A calendar invite has been sent to{" "}<span className="font-medium text-gray-800">{email}</span></>}
          </p>

          <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 text-left space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Date &amp; Time</p>
                <p className="text-sm font-medium text-gray-900">
                  {formattedDate} · {selectedSlot}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                <p className="text-sm font-medium text-gray-900">{event.duration} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Video className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Location</p>
                <p className="text-sm font-medium text-gray-900">Google Meet</p>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-gray-900">{event.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">with {username}</p>

          <button
            onClick={() => {
              setView("calendar");
              setSelectedDay(null);
              setSelectedSlot(null);
              setName("");
              setEmail("");
              setNotes("");
            }}
            className="mt-6 w-full border border-gray-200 text-sm font-medium text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Book another time
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Main booking card ─────────────────────────────────────────────────────
  return (
    <PageShell>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-4xl overflow-hidden">
        <div className="flex flex-col md:flex-row">

          {/* ── Left Column: Event Info ──────────────────────────────────── */}
          <div className="w-full md:w-[17rem] shrink-0 border-b md:border-b-0 md:border-r border-gray-100 p-6 flex flex-col gap-0">

            {/* Back arrow */}
            <button
              onClick={() => window.history.back()}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors mb-5 -ml-1"
              aria-label="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold mb-3">
              {username.charAt(0).toUpperCase()}
            </div>

            {/* Host name */}
            <p className="text-sm font-medium text-gray-600 mb-1">{username}</p>

            {/* Event title */}
            <h1 className="text-xl font-bold text-gray-900 mb-4 leading-snug">{event.title}</h1>

            {/* Icon row */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600">{event.duration} min</span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600">Google Meet</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600">Asia / Kolkata</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-500 leading-relaxed">{event.description}</p>

            {/* Selected datetime summary */}
            {selectedDay !== null && (
              <div className="mt-auto pt-5 border-t border-gray-100 mt-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">Selected</p>
                <p className="text-sm font-medium text-gray-900">{formattedDate}</p>
                {selectedSlot && (
                  <p className="text-sm text-gray-600 mt-0.5">{selectedSlot}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Right Column ─────────────────────────────────────────────── */}
          <div className="flex-1 p-6 md:p-8 min-w-0">

            {/* ── FORM VIEW ───────────────────────────────────────────────── */}
            {view === "form" ? (
              <div className="max-w-sm">
                <button
                  onClick={() => { setView("calendar"); setSelectedSlot(null); }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                {isRescheduling && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                    Rescheduling mode — confirming will update your existing booking to the new time.
                  </div>
                )}
                <h2 className="text-base font-bold text-gray-900 mb-0.5">
                  {isRescheduling ? "Confirm new time" : "Enter your details"}
                </h2>
                <p className="text-sm text-gray-500 mb-5">
                  {formattedDate} · {selectedSlot}
                </p>
                {bookingError && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{bookingError}</span>
                    <button onClick={() => setBookingError(null)} className="shrink-0 text-red-400 hover:text-red-600 transition-colors" aria-label="Dismiss">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <form onSubmit={handleConfirm} className="space-y-4">
                  {!isRescheduling && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Your Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jane Doe"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jane@example.com"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Additional Notes
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Share anything that will help prepare for our meeting…"
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition resize-none"
                        />
                      </div>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || (isRescheduling ? false : (!name.trim() || !email.trim()))}
                    className="w-full bg-black text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? isRescheduling ? "Rescheduling…" : "Confirming…"
                      : isRescheduling ? "Confirm Reschedule" : "Confirm Booking"}
                  </button>
                </form>
              </div>
            ) : (
              /* ── CALENDAR VIEW ──────────────────────────────────────────── */
              <div className="flex flex-col sm:flex-row gap-0 overflow-hidden">

                {/* Calendar grid */}
                <div className="flex-1 min-w-0">

                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-semibold text-gray-900">
                      {MONTH_NAMES[calMonth]} {calYear}
                    </h2>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={prevMonth}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={nextMonth}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label="Next month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {DAY_LABELS.map((d) => (
                      <div
                        key={d}
                        className="text-center text-xs font-medium text-gray-400 pb-2"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {gridCells.map((day, idx) => {
                      if (day === null) return <div key={`e-${idx}`} className="h-10" />;
                      const available = isAvailable(day);
                      const isToday =
                        day === today.getDate() &&
                        calMonth === today.getMonth() &&
                        calYear === today.getFullYear();
                      const isSelected = selectedDay === day;
                      return (
                        <div key={day} className="flex items-center justify-center h-10">
                          <button
                            disabled={!available}
                            onClick={() => selectDay(day)}
                            className={[
                              "w-9 h-9 rounded-full text-sm flex items-center justify-center transition-all font-medium",
                              isSelected
                                ? "bg-gray-900 text-white"
                                : available
                                ? "text-gray-900 hover:bg-gray-100 cursor-pointer"
                                : "text-gray-300 cursor-default",
                              isToday && !isSelected
                                ? "ring-1 ring-gray-900 ring-offset-1"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots panel — slides in when a date is selected */}
                {selectedDay !== null && (
                  <div className="sm:w-40 shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-5 sm:ml-4 mt-2 sm:mt-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pt-0.5">
                      {new Date(calYear, calMonth, selectedDay).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 max-h-48 sm:max-h-80 overflow-y-auto pr-0.5">
                      {slots.length === 0 ? (
                        <p className="col-span-3 sm:col-span-1 text-xs text-gray-400 text-center py-6 leading-relaxed">
                          No available slots<br />for this day.
                        </p>
                      ) : slots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => selectSlot(slot)}
                          className={`w-full text-center text-sm font-medium px-2 sm:px-3 py-2 rounded-lg border transition-all ${
                            selectedSlot === slot
                              ? "bg-gray-900 text-white border-gray-900"
                              : "border-gray-200 text-gray-700 hover:border-gray-800 hover:text-gray-900 bg-white"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                    {selectedSlot && (
                      <button
                        onClick={() => setView("form")}
                        className="w-full mt-4 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-black transition-colors"
                      >
                        Next →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
