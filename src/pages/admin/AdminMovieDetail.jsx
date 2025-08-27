import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "../../components/AdminSidebar.jsx";
import { getAdminMovieById, patchMovie } from "../../api/adminApi.js";


function toDateInputValue(isoOrDateStr) {
    if (!isoOrDateStr) return "";
    // 가능한 다양한 포맷에 안전하게 대응
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

const AdminMovieDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);

    // 폼 상태
    const [form, setForm] = useState({
      title: "",
      subTitle: "",
      genre: "",
      runningMinutes: "",
      status: true,
      releaseDate: "",
      summary: "",
      rating: "",
      director: "",
      actors: ""
    });

    // 초기 로드
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const data = await getAdminMovieById(id);
                console.log("[AdminMovieDetail] fetched movie keys:", data && typeof data === "object" ? Object.keys(data) : data);
                if (!mounted) return;

                setForm({
                  title: data.title ?? data.name ?? "",
                  subTitle: data.subTitle ?? data.subtitle ?? data.originalTitle ?? data.original_title ?? data.sub_title ?? "",
                  genre: data.genre ?? (Array.isArray(data.genres) ? data.genres.join(", ") : ""),
                  runningMinutes: (typeof data.runningMinutes === "number" || typeof data.runningMinutes === "string")
                    ? String(data.runningMinutes)
                    : "",
                  status: data.status === true,
                  releaseDate: toDateInputValue(data.releaseDate),
                  summary: data.summary ?? "",
                  rating: data.rating ?? "",
                  director: data.director ?? "",
                  actors: data.actors ?? ""
                });
            } catch (e) {
                setErr(e?.response?.data?.message || e.message || "영화 정보를 불러오지 못했어요.");
            } finally {
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [id]);

    const onChange = (field) => (e) => {
        const value = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        // 간단 유효성
        if (!form.title.trim()) return alert("제목을 입력하세요.");
        if (form.runningMinutes && isNaN(Number(form.runningMinutes))) return alert("러닝타임은 숫자여야 합니다.");

        const payload = {
          title: form.title.trim(),
          subTitle: form.subTitle.trim(),
          originalTitle: form.subTitle.trim(),
          genre: form.genre.trim(),
          runningMinutes: form.runningMinutes !== "" ? Number(form.runningMinutes) : null,
          status: !!form.status,
          releaseDate: form.releaseDate || null,
          summary: form.summary.trim(),
          rating: form.rating.trim() || null,
          director: form.director.trim() || null,
          actors: form.actors.trim() || null,
        };

        try {
            setSaving(true);
            await patchMovie(id, payload);
            alert("저장되었습니다.");
            navigate("/admin/movies");
        } catch (e) {
            alert(e?.response?.data?.message || e.message || "저장에 실패했어요.");
        } finally {
            setSaving(false);
        }
    };

    const statusLabel = useMemo(() => (form.status ? "상영중" : "상영종료"), [form.status]);

  const handleStatusChange = (next) => {
    if (next === false && form.status === true) {
      if (!confirm("이 영화를 상영종료로 표시할까요?\n\n참고: 상영종료로 변경하면 예매 버튼이 비활성화되고, 향후 상영시간이 있다면 노출/예매 정책을 다시 확인해야 합니다.")) {
        return;
      }
    }
    setForm((prev) => ({ ...prev, status: next }));
  };

    return (
        <AdminLayout>
            <main className="max-w-[900px] mx-auto px-4 py-10">
                <header className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl sm:text-3xl font-semibold">영화 상세 수정</h1>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="rounded border px-3 py-2 text-sm"
                        >
                            뒤로
                        </button>
                    </div>
                </header>

                {loading && <div className="py-16 text-center text-gray-500">불러오는 중…</div>}
                {err && !loading && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {err}
                    </div>
                )}

                {!loading && !err && (
                    <form onSubmit={onSubmit} className="space-y-6 bg-white rounded-lg border p-6 shadow-sm ring-1 ring-gray-100">
                        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2">기본 정보</h2>
                        {/* 제목 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">제목</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={onChange("title")}
                                className="w-full rounded border px-3 py-2"
                                placeholder="영화 제목"
                                required
                            />
                        </div>

                        {/* 부제목 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">부제목</label>
                            <input
                                type="text"
                                value={form.subTitle}
                                onChange={onChange("subTitle")}
                                className="w-full rounded border px-3 py-2"
                                placeholder="영화 부제목"
                                required
                            />
                        </div>

                        {/* 장르 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">장르</label>
                            <input
                                type="text"
                                value={form.genre}
                                onChange={onChange("genre")}
                                className="w-full rounded border px-3 py-2"
                                placeholder="예: 드라마, 액션"
                            />
                            <p className="mt-1 text-xs text-gray-500">콤마(,)로 여러 장르 구분 가능</p>
                        </div>

                        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mt-6">상영 정보</h2>
                        {/* 상영 상태 & 러닝타임 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                <label className="block text-sm font-medium mb-1">상태</label>
                <div className="inline-flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm ${form.status ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    onClick={() => handleStatusChange(true)}
                  >
                    상영중
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm border-l ${!form.status ? "bg-gray-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    onClick={() => handleStatusChange(false)}
                  >
                    상영종료
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">상태는 저장 시 반영됩니다. 상영종료로 바꾸면 예매 버튼이 비활성화됩니다.</p>
              </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">러닝타임(분)</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={form.runningMinutes}
                                    onChange={onChange("runningMinutes")}
                                    className="w-full rounded border px-3 py-2"
                                    placeholder="예: 120"
                                />
                            </div>
                        </div>

                        {/* 개봉일 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">개봉일</label>
                            <input
                                type="date"
                                value={form.releaseDate}
                                onChange={onChange("releaseDate")}
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>

                        <h2 className="text-sm font-semibold text-gray-700 border-b pb-2 mt-6">추가 정보</h2>
                        {/* 등급(선택) */}
                        <div>
                            <label className="block text-sm font-medium mb-1">관람등급(선택)</label>
                            <input
                                type="text"
                                value={form.rating}
                                onChange={onChange("rating")}
                                className="w-full rounded border px-3 py-2"
                                placeholder="예: 12세, 15세, 청불"
                            />
                        </div>

                        {/* 감독 */}
                        <div>
                          <label className="block text-sm font-medium mb-1">감독</label>
                          <input
                            type="text"
                            value={form.director}
                            onChange={onChange("director")}
                            className="w-full rounded border px-3 py-2"
                            placeholder="예: 조셉 코신스키"
                          />
                        </div>

                        {/* 출연진 */}
                        <div>
                          <label className="block text-sm font-medium mb-1">출연진</label>
                          <input
                            type="text"
                            value={form.actors}
                            onChange={onChange("actors")}
                            className="w-full rounded border px-3 py-2"
                            placeholder="예: 브래드 피트, 댐슨 이드리스"
                          />
                          <p className="mt-1 text-xs text-gray-500">콤마(,)로 여러 명 입력</p>
                        </div>

                        {/* 줄거리 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">줄거리</label>
                            <textarea
                                value={form.summary}
                                onChange={onChange("summary")}
                                className="w-full min-h-[120px] rounded border px-3 py-2"
                                placeholder="줄거리(요약)"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="rounded border px-4 py-2 text-sm"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {saving ? "저장 중…" : "저장"}
                            </button>
                        </div>
                    </form>
                )}
            </main>
        </AdminLayout>
    );
};

export default AdminMovieDetail;