import React from "react";
import { NavLink } from "react-router-dom";

// Simple inline icons (no external deps)
const Icon = {
  dashboard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h5v8H3v-8zm7 0h11v8H10v-8z"/>
    </svg>
  ),
  movies: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4 4h3l2 4h3l-2-4h3l2 4h3l-2-4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
    </svg>
  ),
  screenings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4 5h16v10H4z"/><path d="M2 19h20v2H2z"/>
    </svg>
  ),
  pricing: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm1 5v2.06c1.7.23 3 1.27 3 2.94 0 1.88-1.63 2.57-3.47 3.16-1.6.5-1.83.86-1.83 1.31 0 .38.25.8 1.3.8 1 0 1.77-.33 2.44-.79l.94 1.76c-.78.57-1.85.95-3.02 1.06V19h-2v-2.04c-1.78-.27-3.12-1.25-3.12-2.95 0-1.86 1.57-2.62 3.4-3.2 1.54-.48 1.9-.9 1.9-1.32 0-.44-.46-.83-1.32-.83-.9 0-1.86.32-2.63.8l-.98-1.74c.82-.58 1.98-.95 3.22-1.05V6h2z"/>
    </svg>
  ),
  bookings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M7 2h10a2 2 0 0 1 2 2v16l-7-3-7 3V4a2 2 0 0 1 2-2z"/>
    </svg>
  ),
  events: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm14 8H3v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8z"/>
    </svg>
  ),
  stats: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M5 9h3v10H5zM10.5 5h3v14h-3zM16 12h3v7h-3z"/>
    </svg>
  )
};

const navItems = [
  { to: "/admin", label: "대시보드", icon: Icon.dashboard, end: true },
  { to: "/admin/movies", label: "영화관리", icon: Icon.movies, end: true },
  { to: "/admin/screenings", label: "상영관리", icon: Icon.screenings, end: true },
  { to: "/admin/pricing", label: "요금관리", icon: Icon.pricing, end: true },
  { to: "/admin/bookings", label: "예매관리", icon: Icon.bookings },
  { to: "/admin/event", label: "이벤트관리", icon: Icon.events, end: true },
  { to: "/admin/stats", label: "매출통계", icon: Icon.stats }
];

export function AdminSidebar() {
  return (
    <div className="h-full flex flex-col">
      {/* Brand */}
      <div className="sticky top-0 z-10 px-5 py-6 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 text-white shadow">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
            <span className="text-xl font-black">T</span>
          </div>
          <div>
            <p className="text-sm/5 uppercase tracking-widest text-white/80">Ticketory</p>
            <h1 className="text-lg font-bold -mt-0.5">관리자</h1>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-5 bg-white">
        <ul className="space-y-2">
          {navItems.map(({ to, label, icon: Ico, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                <span className={`shrink-0 ${""}`}>
                  <Ico />
                </span>
                <span className="truncate tracking-wide">{label}</span>
                <span
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400"
                  aria-hidden
                >
                  →
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer helper */}
      <div className="px-4 pb-5 pt-3 border-t bg-white/80">
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          빠른 이동: <span className="font-medium text-gray-700">⌘</span> + <span className="font-medium text-gray-700">K</span>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }) {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex">
      {/* Sidebar: 관리자 페이지에서만 노출 */}
      <aside className="w-64 shrink-0 hidden md:flex md:flex-col bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border-r">
        <AdminSidebar />
      </aside>
      {/* 콘텐츠 */}
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}