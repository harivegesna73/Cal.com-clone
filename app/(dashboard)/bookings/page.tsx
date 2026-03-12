"use client";

import { useState, useEffect } from "react";
import { Video, X, CheckCircle2, Clock, Mail, Loader2, MessageSquare, CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/lib/config";

interface Booking {
  id: string;
  bookerName: string;
  bookerEmail: string;
  notes?: string | null;
  startTime: string;
  endTime: string;
  status: "UPCOMING" | "PAST" | "CANCELLED";
  eventType: { title: string; duration: number; slug: string };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

export default function BookingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"UPCOMING" | "PAST">("UPCOMING");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/bookings`)
      .then((r) => r.json())
      .then(setBookings)
      .catch((err) => {
        console.error("Failed to load bookings:", err);
        setError("Could not connect to the server. Is it running on port 5000?");
      })
      .finally(() => setLoading(false));
  }, []);

  const displayed = bookings.filter((b) => b.status === activeTab);

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" as const } : b))
      );
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      setError("Failed to cancel booking.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          See your upcoming and past events booked through your scheduling links.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(["UPCOMING", "PAST"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.toLowerCase()}
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"
              }`}
            >
              {bookings.filter((b) => b.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      )}

      {/* Booking List */}
      {!loading && (
      <div className="space-y-3">
        {displayed.map((booking) => (
          <div
            key={booking.id}
            className="bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
                {booking.bookerName.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-gray-900">{booking.bookerName}</p>
                  <span className="text-gray-300">·</span>
                  <p className="text-xs text-gray-500">{booking.eventType.title}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail className="w-3 h-3" />
                    {booking.bookerEmail}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {booking.eventType.duration} min
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Video className="w-3 h-3" />
                    Google Meet
                  </span>
                </div>
              </div>

              {/* Date + Action stacked on the right */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">{formatDate(booking.startTime)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatTime(booking.startTime)}</p>
                </div>
                <div>
                  {activeTab === "UPCOMING" ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        onClick={() =>
                          router.push(`/harivegesna/${booking.eventType.slug}?reschedule=${booking.id}`)
                        }
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        Reschedule
                      </button>
                      <button
                        onClick={() => setCancellingId(booking.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {booking.notes && (
              <div className="mt-3 ml-12 flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500 italic leading-relaxed">{booking.notes}</p>
              </div>
            )}
          </div>
        ))}

        {displayed.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-lg">
            <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">
              No {activeTab.toLowerCase()} bookings
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTab === "UPCOMING"
                ? "Share your booking link to receive new meetings."
                : "Your completed meetings will appear here."}
            </p>
          </div>
        )}
      </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingId !== null && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setCancellingId(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">
              Cancel this booking?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This action cannot be undone. The guest will be notified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingId(null)}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep it
              </button>
              <button
                onClick={() => handleCancel(cancellingId)}
                className="flex-1 bg-red-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
