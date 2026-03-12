import { Bell, Settings, Menu } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 shrink-0">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors mr-2"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 ml-auto">
        <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold ml-1">
          H
        </div>
      </div>
    </header>
  );
}
