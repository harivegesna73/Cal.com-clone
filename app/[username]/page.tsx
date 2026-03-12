"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

interface EventType {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  slug: string;
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const initials = username
    .split(/[\s_-]/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-start pt-16 pb-16 px-4">
      {/* Profile card */}
      <div className="w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl p-6 mb-4">
        <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
          {initials}
        </div>
        <h1 className="text-white text-xl font-bold capitalize">
          {username.replace(/[-_]/g, " ")}
        </h1>
      </div>

      {/* Event type cards */}
      <div className="w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        {loading && (
          <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
        )}
        {!loading && events.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">
            No event types available.
          </div>
        )}
        {!loading &&
          events.map((event, idx) => (
            <Link
              key={event.id}
              href={`/${username}/${event.slug}`}
              className={`block px-6 py-5 hover:bg-white/5 transition-colors ${
                idx !== events.length - 1 ? "border-b border-white/10" : ""
              }`}
            >
              <p className="text-white font-semibold text-base mb-1">
                {event.title}
              </p>
              {event.description && (
                <p className="text-gray-400 text-sm mb-2">{event.description}</p>
              )}
              <span className="inline-flex items-center gap-1.5 bg-white/10 text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                {event.duration}m
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}
