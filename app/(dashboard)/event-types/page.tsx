"use client";

import { useState, useEffect } from "react";
import { Plus, Link2, Pencil, Trash2, Clock, X, Copy, MoreVertical, Loader2 } from "lucide-react";

import { API_BASE } from "@/lib/config";

interface EventType {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  slug: string;
}

const CARD_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-green-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-indigo-500",
];

const COLORS = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-violet-500", label: "Violet" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-red-500", label: "Red" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  duration: 30,
  slug: "",
  color: "bg-blue-500",
};

export default function EventTypesPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/event-types`)
      .then((r) => r.json())
      .then(setEvents)
      .catch((err) => {
        console.error("Failed to load event types:", err);
        setError("Could not connect to the server. Is it running on port 5000?");
      })
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (event: EventType) => {
    setForm({
      title: event.title,
      description: event.description ?? "",
      duration: event.duration,
      slug: event.slug,
      color: "bg-blue-500",
    });
    setEditingId(event.id);
    setActiveMenu(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setActiveMenu(null);
    try {
      const res = await fetch(`${API_BASE}/event-types/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete event type:", err);
      setError("Failed to delete event type.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) return;
    setSubmitting(true);
    try {
      if (editingId !== null) {
        const res = await fetch(`${API_BASE}/event-types/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            duration: form.duration,
            slug: form.slug,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? "Failed to update event type.");
          return;
        }
        const updated: EventType = await res.json();
        setEvents((prev) => prev.map((ev) => (ev.id === editingId ? updated : ev)));
      } else {
        const res = await fetch(`${API_BASE}/event-types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            duration: form.duration,
            slug: form.slug,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? "Failed to create event type.");
          return;
        }
        const created: EventType = await res.json();
        setEvents((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      console.error("Failed to save event type:", err);
      setError("Failed to save. Is the server running on port 5000?");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/harivegesna/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const autoSlug = (title: string) =>
    title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

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
      <div className="flex items-start sm:items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Types</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create events to share for people to book on your calendar.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Event Type
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      )}

      {/* Event Cards */}
      <div className="space-y-3">
        {events.map((event, idx) => (
          <div
            key={event.id}
            className="bg-white border border-gray-200 rounded-lg flex items-center hover:border-gray-300 transition-colors group relative"
          >
            {/* Color Bar */}
            <div className={`w-1 self-stretch rounded-l-lg ${CARD_COLORS[idx % CARD_COLORS.length]}`} />

            {/* Content */}
            <div className="flex-1 px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{event.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-md">{event.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  {event.duration} min
                </span>
                <a
                  href={`/harivegesna/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  /harivegesna/{event.slug}
                </a>
                <button
                  onClick={() => handleCopy(event.slug)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {copiedSlug === event.slug ? (
                    <span className="text-green-600 flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" />
                      Copied!
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div
              className={`flex items-center gap-1 pr-4 transition-opacity ${
                activeMenu === event.id
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <button
                onClick={() => openEdit(event)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === event.id ? null : event.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {activeMenu === event.id && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                    <button
                      onClick={() => openEdit(event)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && events.length === 0 && (
          <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-lg">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No event types yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first event type to start receiving bookings.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editingId ? "Edit Event Type" : "New Event Type"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: editingId ? f.slug : autoSlug(title),
                    }));
                  }}
                  placeholder="e.g. 30 Min Meeting"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this event..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Duration (minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                    min={5}
                    max={480}
                    step={5}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                        className={`w-6 h-6 rounded-full ${c.value} transition-transform ${
                          form.color === c.value ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-black/10 focus-within:border-gray-400 transition">
                  <span className="bg-gray-50 border-r border-gray-200 px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                    /harivegesna/
                  </span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))
                    }
                    placeholder="30min"
                    className="flex-1 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-white"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-black text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Saving…" : editingId ? "Save Changes" : "Create Event Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click-outside to close dropdown */}
      {activeMenu !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
}
