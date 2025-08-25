import { Outlet } from "react-router-dom";
import {AdminSidebar} from "./AdminSidebar.jsx";


export default function AdminLayout() {
    return (
        <div className="min-h-screen w-full bg-gray-50 flex">
            <aside className="w-64 shrink-0 border-r bg-white hidden md:block">
                <AdminSidebar />
            </aside>
            <main className="flex-1 p-4 md:p-6">
                <Outlet /> {/* /admin 하위 페이지가 여기 렌더링 */}
            </main>
        </div>
    );
}