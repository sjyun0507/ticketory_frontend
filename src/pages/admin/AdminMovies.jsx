import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getAdminMovies,
  deleteMovie,
  toggleMovieStatus,
} from "../../api/adminApi.js";
import {AdminLayout} from "../../components/AdminSidebar.jsx"; // ✅ 새 Admin API 사용

const PAGE_SIZE = 24;

const AdminMovies = () => {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // 검색/필터 상태
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(""); // '', true, false
  const [page, setPage] = useState(0);
  const size = PAGE_SIZE;

  // 총 페이지/개수(백엔드가 주면 사용, 없으면 프론트에서 대충 계산)
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);

  const params = useMemo(() => ({
    page,
    size,
    q: q || undefined,
    // 백엔드 boolean(status)과 맞추기: ''는 undefined, 그 외는 true/false로 전달
    status: status === "" ? undefined : (status === "true")
  }), [page, size, q, status]);

  // 목록 로드
  const load = async (p = params) => {
    try {
      setLoading(true);
      setErr(null);
      const data = await getAdminMovies(p);
      const list = Array.isArray(data) ? data : (data?.content ?? []);
      setMovies(list);
      if (!Array.isArray(data)) {
        setTotalElements(data?.totalElements ?? null);
        setTotalPages(data?.totalPages ?? null);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]); // 검색어는 submit으로만 반영

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    load({ ...params, page: 0, q: q || undefined });
  };

  // 상태 토글
  const onToggle = async (m) => {
    const id = m.id ?? m.movieId;
    if (!id) return;
    try {
      await toggleMovieStatus(id, !(m.status === true));
      // 낙관적 갱신: status(boolean) 뒤집기
      setMovies((prev) =>
        prev.map((x) =>
          (x.id ?? x.movieId) === id ? { ...x, status: !(m.status === true) } : x
        )
      );
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "상태 변경에 실패했어요.");
    }
  };

  // 소프트 삭제
  const onDelete = async (m) => {
    const id = m.id ?? m.movieId;
    if (!id) return;
    if (!confirm(`정말 삭제할까요? (ID: ${id})`)) return;
    try {
      await deleteMovie(id);
      setMovies((prev) => prev.filter((x) => (x.id ?? x.movieId) !== id));
      // 총합/페이지 갱신 필요 시 재로딩
      if (typeof totalElements === "number") {
        const remaining = (totalElements - 1);
        const maxPage = totalPages ? Math.max(0, Math.ceil(remaining / size) - 1) : page;
        if (page > maxPage) setPage(maxPage);
      }
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "삭제에 실패했어요.");
    }
  };

  return (
    <AdminLayout>
      <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold">영화 관리</h1>
          <button
            type="button"
            onClick={() => navigate("/admin/movies/new")}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 active:bg-indigo-800"
          >
            + 새 영화 추가
          </button>
        </header>

        {/* 검색/필터 */}
        <form onSubmit={onSearchSubmit} className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목 검색"
            className="h-10 w-52 rounded border px-3 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded border px-3 text-sm"
          >
            <option value="">전체 상태</option>
            <option value="true">상영중</option>
            <option value="false">상영종료</option>
          </select>
          <button
            type="submit"
            className="h-10 rounded-md bg-gray-800 px-4 text-sm text-white hover:bg-black"
          >
            검색
          </button>
        </form>

        {loading && <div className="py-16 text-center text-gray-500">불러오는 중…</div>}

        {err && !loading && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && movies.length === 0 && (
          <div className="rounded-lg bg-white/80 backdrop-blur p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-gray-600">등록된 영화가 없습니다.</p>
          </div>
        )}

        {!loading && !err && movies.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {movies.map((m) => {
              const id = m.id ?? m.movieId;
              const isRunning = m.status === true; // true=상영중, false=상영종료
              return (
                <li key={id ?? Math.random()} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold mb-1">
                        {m.title ?? m.name ?? "(제목 없음)"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {m.genre ?? m.genres?.join(", ") ?? ""}
                      </div>
                      {m.releaseDate && (
                        <div className="text-xs text-gray-400 mt-1">
                          개봉: {m.releaseDate}
                        </div>
                      )}
                      <div className="mt-2 inline-flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${isRunning ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}
                        >
                          {isRunning ? "상영중" : "상영종료"}
                        </span>
                        {typeof m.runtime === "number" && (
                          <span className="text-xs text-gray-500">{m.runtime}분</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">#{id}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/movies/${id}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        상세/수정
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/movies/${id}/media`)}
                        className="text-sky-600 hover:underline"
                      >
                        미디어
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggle(m)}
                        className={`rounded border px-2 py-1 text-xs ${isRunning ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-green-300 text-green-700 hover:bg-green-50"}`}
                      >
                        {isRunning ? "비활성화" : "활성화"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 간단 페이지네이션 (백엔드 totalPages 제공 시) */}
        {!loading && !err && (totalPages ?? 0) > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              이전
            </button>
            <div className="text-sm text-gray-600">
              {page + 1} / {totalPages}
            </div>
            <button
              type="button"
              disabled={page + 1 >= (totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              다음
            </button>
          </div>
        )}
      </main>
    </AdminLayout>
  );
};

export default AdminMovies;