"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid3X3, CalendarDays, Clock, ExternalLink, X } from "lucide-react";

const navItems = [
  { href: "/event-types", label: "Event Types", icon: Grid3X3 },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/availability", label: "Availability", icon: Clock },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      {/* Logo */}
      <div className="px-4 h-14 flex items-center justify-between border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 tracking-tight text-lg">Cal</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-gray-900" : "text-gray-400"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Profile & public link */}
      <div className="px-3 py-3 border-t border-gray-200 space-y-2">
        <Link
          href="/harivegesna"
          target="_blank"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View public page
        </Link>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            H
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">harivegesna</p>
            <p className="text-xs text-gray-400 truncate">Free plan</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
