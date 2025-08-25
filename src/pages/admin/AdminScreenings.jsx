import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosInstance.js";
import {AdminLayout} from "../../components/AdminSidebar.jsx";

const AdminScreenings = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await api.get("/screenings", { params: { page: 0, size: 100 } });
        const list = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
        if (alive) setItems(list);
      } catch (e) {
        if (alive) setErr(e?.response?.data?.message || e.message || "상영시간 목록을 불러오지 못했어요.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const fmt = (v) => {
    if (!v) return "";
    try {
      // v가 ISO 또는 'YYYY-MM-DD HH:mm:ss'일 때도 안전하게 표시
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toLocaleString();
      return String(v);
    } catch {
      return String(v);
    }
  };

  return (
    <AdminLayout>
      <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold">상영시간 관리</h1>
          <button
            type="button"
            onClick={() => navigate("/admin/screenings/new")}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 active:bg-indigo-800"
          >
            + 새 상영 추가
          </button>
        </header>

        {loading && <div className="py-16 text-center text-gray-500">불러오는 중…</div>}

        {err && !loading && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && items.length === 0 && (
          <div className="rounded-lg bg-white/80 backdrop-blur p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">🕒</div>
            <p className="text-gray-600">등록된 상영시간이 없습니다.</p>
          </div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">영화</th>
                  <th className="px-4 py-3 text-left">상영관</th>
                  <th className="px-4 py-3 text-left">시작</th>
                  <th className="px-4 py-3 text-left">종료</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((s) => {
                  const id = s.id ?? s.screeningId ?? s.screen_id ?? s.screening_id;
                  const movie = s.movieTitle ?? s.movie?.title ?? s.title ?? "(제목 없음)";
                  const screen = s.screenName ?? s.screen?.name ?? s.screenId ?? s.screen_id ?? "-";
                  const status = s.status ?? s.enabled ?? s.active ?? "";
                  return (
                    <tr key={id || Math.random()}>
                      <td className="px-4 py-3">{movie}</td>
                      <td className="px-4 py-3">{screen}</td>
                      <td className="px-4 py-3">{fmt(s.startAt ?? s.start_at ?? s.start)}</td>
                      <td className="px-4 py-3">{fmt(s.endAt ?? s.end_at ?? s.end)}</td>
                      <td className="px-4 py-3">{String(status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => id && navigate(`/admin/screenings/${id}`)}
                          className="text-indigo-600 hover:underline disabled:text-gray-300"
                          disabled={!id}
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AdminLayout>
  );
};

export default AdminScreenings;