import React from "react";
import { Link, NavLink } from "react-router-dom";

export function AdminSidebar() {
    const item = "block px-3 py-3 rounded-md text-lg font-semibold text-gray-700 hover:bg-gray-100 text-center w-full transition-colors duration-200 tracking-wide";
    const active = "bg-gray-200 text-gray-900";

    return (
        <div className="h-full flex flex-col">
            {/* Menu */}
            <nav className="flex-1 flex flex-col items-center px-3 text-lg font-semibold text-gray-600 uppercase space-y-3">
                <NavLink to="/admin" end className={({isActive}) => (isActive ? `${item} ${active}` : item)}>
                    대시보드
                </NavLink>
                <NavLink to="/admin/movies" end className={({isActive}) => (isActive ? `${item} ${active}` : item)}>
                    영화관리
                </NavLink>
                <NavLink to="/admin/screenings" end className={({isActive}) => (isActive ? `${item} ${active}` : item)}>
                    상영관리
                </NavLink>
                <NavLink to="/admin/bookings" className={({isActive}) => (isActive ? `${item} ${active}` : item)}>
                    회원관리
                </NavLink>
                <NavLink to="/admin/stats" className={({isActive}) => (isActive ? `${item} ${active}` : item)}>
                    매출통계
                </NavLink>
            </nav>
        </div>
    );
}

export function AdminLayout({ children }) {
    return (
        <div className="min-h-screen w-full bg-gray-50 flex">
            {/* Sidebar: 관리자 페이지에서만 노출 */}
            <aside className="w-64 shrink-0 border-r bg-white hidden md:block">
                <AdminSidebar />
            </aside>
            {/* 콘텐츠 */}
            <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
    );
}