import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminMovies, deleteMovie, toggleMovieStatus, getMovieMedia, uploadMovieImage, addMovieTrailer, deleteMedia, createMovie } from "../../api/adminApi.js";
import { AdminLayout} from "../../components/AdminSidebar.jsx";

const PAGE_SIZE = 24;

const AdminMovies = () => {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // 검색/필터 상태
  // 로컬 상태 필터
  const [filterStatus, setFilterStatus] = useState(""); // '', 'running', 'ended'
  const [page, setPage] = useState(0);
  const size = PAGE_SIZE;

  // 총 페이지/개수(백엔드가 주면 사용, 없으면 프론트에서 대충 계산)
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);

  // 클라이언트 측 필터 (ID, 제목, 개봉일)
  const [filterId, setFilterId] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterReleaseFrom, setFilterReleaseFrom] = useState("");
  const [filterReleaseTo, setFilterReleaseTo] = useState("");

  // 미디어 모달 상태
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaMovie, setMediaMovie] = useState({ id: null, title: "" });
  const [mediaList, setMediaList] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [imageKind, setImageKind] = useState("POSTER");
  const [imageFile, setImageFile] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState("");

  // 새 영화 추가 모달 상태/폼
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    originalTitle: "",
    genre: "",
    releaseDate: "",
    runningMinutes: "",
    status: true,
    ageRating: "",
    director: "",
    cast: "",
    overview: "",
  });
  // 새 영화 추가: 대표 포스터 파일
  const [addPosterFile, setAddPosterFile] = useState(null);
  const onChangeForm = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title?.trim() || "",
        ...(form.originalTitle?.trim() ? { originalTitle: form.originalTitle.trim() } : {}),
        ...(form.genre?.trim() ? { genre: form.genre.trim() } : {}),
        ...(form.releaseDate ? { releaseDate: form.releaseDate } : {}),
        ...(form.runningMinutes !== "" ? { runningMinutes: Number(form.runningMinutes) } : {}),
        status: !!form.status,
        ...(form.ageRating?.trim() ? { ageRating: form.ageRating.trim() } : {}),
        ...(form.director?.trim() ? { director: form.director.trim() } : {}),
        ...(form.cast?.trim() ? { cast: form.cast.trim() } : {}),
        ...(form.overview?.trim() ? { overview: form.overview.trim() } : {}),
      };

      const created = await createMovie(payload);
      if (created) {
        const newId = created.id ?? created.movieId;
        // 대표 포스터가 선택되어 있으면 즉시 업로드
        if (addPosterFile && newId) {
          try {
            await uploadMovieImage(newId, addPosterFile, "POSTER");
          } catch (err) {
            console.error(err);
            alert("영화는 등록되었지만 포스터 업로드에 실패했어요. 미디어 메뉴에서 다시 시도해 주세요.");
          }
        }
        setMovies((prev) => [created, ...prev]);
      }
      setAddOpen(false);
      setForm({
        title: "",
        originalTitle: "",
        genre: "",
        releaseDate: "",
        runningMinutes: "",
        status: true,
        ageRating: "",
        director: "",
        cast: "",
        overview: "",
      });
      setAddPosterFile(null);
      await load({ page: 0, size });
      setPage(0);
      alert("새 영화를 추가했어요.");
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "영화 추가에 실패했어요.");
    }
  };

  const params = useMemo(() => ({
    page,
    size,
  }), [page, size]);

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
  }, [page]);


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

  const openMedia = async (m) => {
    const id = m.id ?? m.movieId;
    setMediaMovie({ id, title: m.title ?? m.name ?? "" });
    setMediaOpen(true);
    await refreshMedia(id);
  };

  const refreshMedia = async (movieId = mediaMovie.id) => {
    if (!movieId) return;
    try {
      setMediaLoading(true);
      const list = await getMovieMedia(movieId);
      setMediaList(Array.isArray(list) ? list : (list?.content ?? []));
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "미디어 목록을 불러오지 못했어요.");
    } finally {
      setMediaLoading(false);
    }
  };

  const handleUploadImage = async (e) => {
    e.preventDefault();
    if (!imageFile) return alert("이미지 파일을 선택하세요.");
    try {
      await uploadMovieImage(mediaMovie.id, imageFile, imageKind);
      setImageFile(null);
      await refreshMedia();
      alert("이미지를 업로드했어요.");
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "이미지 업로드에 실패했어요.");
    }
  };

  const handleAddTrailer = async (e) => {
    e.preventDefault();
    if (!trailerUrl.trim()) return alert("트레일러 URL을 입력하세요.");
    try {
      await addMovieTrailer(mediaMovie.id, trailerUrl.trim());
      setTrailerUrl("");
      await refreshMedia();
      alert("트레일러를 등록했어요.");
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "트레일러 등록에 실패했어요.");
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!confirm("이 미디어를 삭제할까요?")) return;
    try {
      await deleteMedia(mediaId);
      await refreshMedia();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "삭제에 실패했어요.");
    }
  };

  // 클라이언트 필터링: ID/제목/개봉일/상태
  const filteredMovies = useMemo(() => {
    const idKw = filterId.trim().toLowerCase();
    const titleKw = filterTitle.trim().toLowerCase();
    const from = filterReleaseFrom ? new Date(filterReleaseFrom) : null;
    const to = filterReleaseTo ? new Date(filterReleaseTo) : null;
    return (Array.isArray(movies) ? movies : []).filter((m) => {
      const id = (m.id ?? m.movieId ?? "").toString().toLowerCase();
      const title = (m.title ?? m.name ?? "").toString().toLowerCase();
      const rdStr = m.releaseDate ? String(m.releaseDate) : "";
      const rd = rdStr ? new Date(rdStr) : null;
      const idOk = idKw ? id.includes(idKw) : true;
      const titleOk = titleKw ? title.includes(titleKw) : true;
      let dateOk = true;
      if (from && rd) dateOk = dateOk && rd >= from;
      if (to && rd) dateOk = dateOk && rd <= to;
      let statusOk = true;
      if (filterStatus === "running") statusOk = m.status === true;
      if (filterStatus === "ended") statusOk = !(m.status === true);
      return idOk && titleOk && dateOk && statusOk;
    });
  }, [movies, filterId, filterTitle, filterReleaseFrom, filterReleaseTo, filterStatus]);

  return (
    <AdminLayout>
      <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold">영화 관리</h1>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 active:bg-indigo-800"
          >
            + 새 영화 추가
          </button>
        </header>

        {/* 검색/필터 - (서버 검색/필터 폼 제거됨) */}

        {/* 로컬 필터(ID/제목/개봉일/상태) */}
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Movie ID</span>
            <input
              type="text"
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              placeholder="예: 12"
              className="h-9 rounded border px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">영화 제목</span>
            <input
              type="text"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
              placeholder="부분 일치 검색"
              className="h-9 rounded border px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">개봉일(부터)</span>
            <input
              type="date"
              value={filterReleaseFrom}
              onChange={(e) => setFilterReleaseFrom(e.target.value)}
              className="h-9 rounded border px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">개봉일(까지)</span>
            <input
              type="date"
              value={filterReleaseTo}
              onChange={(e) => setFilterReleaseTo(e.target.value)}
              className="h-9 rounded border px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">상태</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 rounded border px-3 text-sm"
            >
              <option value="">전체 상태</option>
              <option value="running">상영중</option>
              <option value="ended">상영종료</option>
            </select>
          </label>
            <div className="mb-4">
                <button
                    type="button"
                    onClick={() => { setFilterId(""); setFilterTitle(""); setFilterReleaseFrom(""); setFilterReleaseTo(""); setFilterStatus(""); }}
                    className="rounded border px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                >
                    필터 초기화
                </button>
            </div>
        </div>


        {loading && <div className="py-16 text-center text-gray-500">불러오는 중…</div>}

        {err && !loading && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && filteredMovies.length === 0 && (
          <div className="rounded-lg bg-white/80 backdrop-blur p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-gray-600">조건에 맞는 결과가 없습니다.</p>
          </div>
        )}

        {!loading && !err && filteredMovies.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-center uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3">영화제목</th>
                  <th className="px-4 py-3">장르</th>
                  <th className="px-4 py-3 w-30">개봉일</th>
                  <th className="px-4 py-3 w-24">러닝타임</th>
                  <th className="px-4 py-3 w-28">상태</th>
                  <th className="px-4 py-3 w-75">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-center">
                {filteredMovies.map((m) => {
                  const id = m.id ?? m.movieId;
                  const isRunning = m.status === true; // true=상영중, false=상영종료
                  const minutes = m.runningMinutes ?? m.runtime; // 호환 처리
                  return (
                    <tr key={id ?? Math.random()} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-gray-500">{id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{m.title ?? m.name ?? "(제목 없음)"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{m.genre ?? m.genres?.join(", ") ?? ""}</td>
                      <td className="px-4 py-3 text-gray-700">{m.releaseDate ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-700">{typeof minutes === "number" ? `${minutes}분` : (minutes ?? "-")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${isRunning ? "border-gray-300 text-gray-700 bg-white" : "border-gray-300 text-gray-500 bg-white"}`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${isRunning ? "bg-green-500" : "bg-gray-400"}`}></span>
                          {isRunning ? "상영중" : "상영종료"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/movies/${id}`)}
                            className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            상세/수정
                          </button>
                          <button
                            type="button"
                            onClick={() => openMedia(m)}
                            className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            미디어
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggle(m)}
                            className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                          >
                            상태 변경
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(m)}
                            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
            <div className="relative z-10 w-[min(960px,92vw)] max-h-[92vh] overflow-y-auto rounded-lg border bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">새 영화 추가</h2>
                <button onClick={() => setAddOpen(false)} className="rounded border px-2 py-1 text-sm text-gray-700 hover:bg-gray-100">닫기</button>
              </div>

              <form onSubmit={submitAdd} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">제목 <span className="text-red-500">*</span></label>
                    <input
                      name="title"
                      value={form.title}
                      onChange={onChangeForm}
                      required
                      placeholder="예: 인셉션"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">부제목</label>
                    <input
                      name="originalTitle"
                      value={form.originalTitle}
                      onChange={onChangeForm}
                      placeholder="예: Inception"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">장르</label>
                    <input
                      name="genre"
                      value={form.genre}
                      onChange={onChangeForm}
                      placeholder="예: SF, 액션"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">개봉일</label>
                    <input
                      type="date"
                      name="releaseDate"
                      value={form.releaseDate}
                      onChange={onChangeForm}
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">러닝타임(분)</label>
                    <input
                      type="number"
                      min="0"
                      name="runningMinutes"
                      value={form.runningMinutes}
                      onChange={onChangeForm}
                      placeholder="예: 128"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">관람등급</label>
                    <input
                      name="ageRating"
                      value={form.ageRating}
                      onChange={onChangeForm}
                      placeholder="예: 12세 관람가"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">감독</label>
                    <input
                      name="director"
                      value={form.director}
                      onChange={onChangeForm}
                      placeholder="예: 크리스토퍼 놀란"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">출연</label>
                    <input
                      name="cast"
                      value={form.cast}
                      onChange={onChangeForm}
                      placeholder="예: 디카프리오, 와타나베…"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">줄거리</label>
                  <textarea
                    name="overview"
                    value={form.overview}
                    onChange={onChangeForm}
                    rows={4}
                    placeholder="간단한 줄거리를 입력하세요."
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="block text-xs text-gray-500 mb-1">대표 포스터 (선택)</label>
                  <input
                    id="addPosterInput"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAddPosterFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => document.getElementById('addPosterInput').click()}
                      className="rounded border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      포스터 선택
                    </button>
                    {addPosterFile && (
                      <span className="text-xs text-gray-600 truncate max-w-[50%]">{addPosterFile.name}</span>
                    )}
                  </div>
                  {addPosterFile && (
                    <div className="mt-2">
                      <img
                        src={URL.createObjectURL(addPosterFile)}
                        alt="poster-preview"
                        className="max-h-40 rounded border"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="statusRunning"
                    type="checkbox"
                    name="status"
                    checked={!!form.status}
                    onChange={onChangeForm}
                    className="h-4 w-4"
                  />
                  <label htmlFor="statusRunning" className="text-sm text-gray-700">상영중으로 등록</label>
                </div>

                <div className="text-right">
                  <button type="button" onClick={() => setAddOpen(false)} className="mr-2 rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">취소</button>
                  <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">등록</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {mediaOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMediaOpen(false)} />
            <div className="relative z-10 w-[min(960px,92vw)] max-h-[90vh] overflow-y-auto rounded-lg border bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">미디어 관리 — {mediaMovie.title} <span className="text-gray-400">#{mediaMovie.id}</span></h2>
                <button onClick={() => setMediaOpen(false)} className="rounded border px-2 py-1 text-sm text-gray-700 hover:bg-gray-100">닫기</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <form onSubmit={handleUploadImage} className="rounded-md border p-4">
                      <h3 className="mb-3 text-sm font-semibold text-gray-700">
                          이미지 업로드 (포스터/스틸/기타)
                      </h3>

                      {/* 종류 선택 */}
                      <div className="mb-3">
                          <label className="block text-xs text-gray-500 mb-1">종류</label>
                          <select
                              value={imageKind}
                              onChange={(e) => setImageKind(e.target.value)}
                              className="w-full rounded border px-3 py-2 text-sm"
                          >
                              <option value="POSTER">포스터</option>
                              <option value="STILL">스틸컷</option>
                              <option value="OTHER">기타</option>
                          </select>
                      </div>

                      {/* 파일 선택 버튼 */}
                      <div className="mb-4">
                          <label className="block text-xs text-gray-500 mb-1">이미지 파일</label>
                          <input
                              id="movieImageInput"
                              type="file"
                              accept="image/*"
                              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                              className="hidden" // 기본 input 숨김
                          />
                          <button
                              type="button"
                              onClick={() => document.getElementById("movieImageInput").click()}
                              className="rounded border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                              이미지 선택
                          </button>

                          {imageFile && (
                              <div className="mt-3">
                                  <img
                                      src={URL.createObjectURL(imageFile)}
                                      alt="preview"
                                      className="max-h-40 rounded border"
                                  />
                              </div>
                          )}
                      </div>

                      {/* 업로드 버튼 */}
                      <div className="text-right">
                          <button
                              type="submit"
                              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                          >
                              업로드
                          </button>
                      </div>
                  </form>

                {/* 트레일러 등록 */}
                <form onSubmit={handleAddTrailer} className="rounded-md border p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">트레일러(URL) 등록</h3>
                  <input
                    type="url"
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    placeholder="예: https://www.youtube.com/watch?v=..."
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                  <div className="mt-3 text-right">
                    <button type="submit" className="rounded border px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">등록</button>
                  </div>
                </form>
              </div>

              {/* 미디어 목록 */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">등록된 미디어</h3>
                  <button onClick={() => refreshMedia()} className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">새로고침</button>
                </div>
                {mediaLoading ? (
                  <div className="py-10 text-center text-gray-500">불러오는 중…</div>
                ) : mediaList.length === 0 ? (
                  <div className="rounded-md border bg-white p-6 text-center text-gray-500">등록된 미디어가 없습니다.</div>
                ) : (
                  <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mediaList.map((it) => (
                      <li key={it.mediaId ?? it.id} className="rounded-lg border p-2">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{it.kind ?? it.type ?? "MEDIA"}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(it.mediaId ?? it.id)}
                            className="rounded px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                        {it.url && (
                          it.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img src={it.url} alt="media" className="aspect-[4/3] w-full rounded object-cover" />
                          ) : (
                            <a href={it.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-sky-600 hover:underline">{it.url}</a>
                          )
                        )}
                        {it.createdAt && (
                          <div className="mt-2 text-[11px] text-gray-400">{it.createdAt}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
};

export default AdminMovies;