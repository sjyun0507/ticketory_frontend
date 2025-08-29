import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminMovies, getAdminScreens } from "../../api/adminApi.js";
import { AdminLayout } from "../../components/AdminSidebar.jsx";
import ReactDOM from "react-dom";
import { createScreening, fetchScreenings, updateScreening, deleteScreening } from "../../api/adminScreeningApi.js";
import { computeMovieStatus } from "../../utils/movieStatus.js";


const AdminScreenings = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [movies, setMovies] = useState([]);
  const [screens, setScreens] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    movieId: "",
    screenId: "",
    date: "",
    firstStart: "10:00",
    cleanMinutes: 10,
    mode: "single", // 'single' | 'auto'
    closeTime: "24:00"
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(null); // raw item being edited
  const [editForm, setEditForm] = useState({
    id: "",
    movieId: "",
    screenId: "",
    startInput: "",
    endInput: "",
  });

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const getRuntimeMin = (m) => {
    if (!m) return 0;
    return (
      m.runningTime ?? m.runningMinutes ?? m.runtime ?? m.durationMinutes ?? m.duration ?? m.lengthMinutes ?? 0
    );
  };
  // Sorting controls (must be top-level hooks)
  const [sortKey, setSortKey] = useState("start");
  const [sortAsc, setSortAsc] = useState(true);
  // --- Filter controls ---

  function toDateKey(v) {
    if (!v) return '';
    let d = new Date(v);
    if (isNaN(d.getTime())) {
      const s = String(v).replace(' ', 'T');
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  // --- Date helpers for week strip ---
  const keyToDate = (key) => {
    if (!key) return null;
    const [y,m,d] = String(key).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const addDaysKey = (key, days) => {
    const base = keyToDate(key);
    if (!base) return '';
    const d = new Date(base);
    d.setDate(d.getDate() + Number(days || 0));
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  const WEEKDAY_KO = ['일','월','화','수','목','금','토'];
  const dateLabel = (key, todayKey) => {
    const d = keyToDate(key);
    if (!d) return key;
    const day = d.getDate();
    if (key === todayKey) return `${day}·오늘`;
    const tomorrow = addDaysKey(todayKey, 1);
    if (key === tomorrow) return `${day}·내일`;
    return `${day}·${WEEKDAY_KO[d.getDay()]}`;
  };
  const [filterTitle, setFilterTitle] = useState("");
  const [filterScreen, setFilterScreen] = useState("");
  // 날짜 탭 선택 상태: 'ALL' 또는 'YYYY-MM-DD'
  const [activeDate, setActiveDate] = useState('ALL');
  // 주간 스트립 시작일(YYYY-MM-DD). 기본은 오늘.
  const [weekStartKey, setWeekStartKey] = useState(null);
  // --- Sorting helpers (top-level, not inside render condition) ---
  const keyExtractors = {
    movieId: (s) => s.movieId ?? s.movie?.id ?? s.movie?.movieId ?? s.movie_id ?? s.movie?.movie_id ?? "",
    title: (s) => s.movieTitle ?? s.movie?.title ?? s.title ?? "",
    screen: (s) => s.screenName ?? s.screen?.name ?? s.screenId ?? s.screen_id ?? "",
    start: (s) => {
      const t = (new Date(s.startAt ?? s.start_at ?? s.start)).getTime();
      return isNaN(t) ? 0 : t;
    },
    end: (s) => {
      const t = (new Date(s.endAt ?? s.end_at ?? s.end)).getTime();
      return isNaN(t) ? 0 : t;
    },
    // status removed for sorting
  };

  // --- Filtered items ---
  const filteredItems = React.useMemo(() => {
    const titleKeyword = filterTitle.trim().toLowerCase();
    const screenKeyword = filterScreen.trim().toLowerCase();
    return (Array.isArray(items) ? items : []).filter((s) => {
      const title = (s.movieTitle ?? s.movie?.title ?? s.title ?? "").toString().toLowerCase();
      const screen = (s.screenName ?? s.screen?.name ?? s.screenId ?? s.screen_id ?? "").toString().toLowerCase();
      const titleOk = titleKeyword ? title.includes(titleKeyword) : true;
      const screenOk = screenKeyword ? screen.includes(screenKeyword) : true;
        const dateKey = toDateKey(s.startAt ?? s.start_at ?? s.start);
        const dateOk = activeDate === 'ALL' ? true : dateKey === activeDate;
        if (!dateOk) return false;
        return titleOk && screenOk && dateOk;
    });
  }, [items, filterTitle, filterScreen, activeDate]);

  const sortedItems = React.useMemo(() => {
    const arr = Array.isArray(filteredItems) ? [...filteredItems] : [];
    const extractor = keyExtractors[sortKey] ?? (() => "");
    arr.sort((a, b) => {
      const av = extractor(a);
      const bv = extractor(b);
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredItems, sortKey, sortAsc]);

  // 아이템이 존재하는 날짜 집합
  const dateHasItems = React.useMemo(() => {
    const set = new Set();
    (Array.isArray(items) ? items : []).forEach((s) => {
      const key = toDateKey(s.startAt ?? s.start_at ?? s.start);
      if (key) set.add(key);
    });
    return set;
  }, [items]);

  // 오늘 키
  const todayKey = React.useMemo(() => toDateKey(new Date()), []);

  // 주간 시작일 초기화 (처음 로드 시)
  useEffect(() => {
    if (!weekStartKey) setWeekStartKey(todayKey);
    // activeDate 기본값: 오늘에 상영이 있으면 오늘, 아니면 ALL 유지
    if (activeDate === 'ALL' && dateHasItems.has(todayKey)) {
      setActiveDate(todayKey);
    }
  }, [todayKey, weekStartKey, activeDate, dateHasItems]);

  // 표시할 7일 키 배열
  const weekKeys = React.useMemo(() => {
    const start = weekStartKey || todayKey;
    return Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
  }, [weekStartKey, todayKey]);

  const toggleSort = React.useCallback((key) => {
    setSortKey((prev) => (prev === key ? prev : key));
    setSortAsc((prev) => (sortKey === key ? !prev : true));
  }, [sortKey]);

  const sortArrow = React.useCallback((key) => (sortKey === key ? (sortAsc ? "▲" : "▼") : ""), [sortKey, sortAsc]);

  const renderArrowPair = React.useCallback((key) => {
        const upActive = sortKey === key && sortAsc === true;
        const downActive = sortKey === key && sortAsc === false;
        return (
            <span className="ml-1 inline-flex flex-col leading-none align-middle select-none">
      <span className={upActive ? "opacity-100 font-semibold" : "opacity-40"}>▲</span>
      <span className={downActive ? "opacity-100 font-semibold" : "opacity-40"}>▼</span>
    </span>
        );
    }, [sortKey, sortAsc]);

  const addMinutes = (dt, minutes) => {
    const d = new Date(dt);
    d.setMinutes(d.getMinutes() + Number(minutes || 0));
    return d;
  };

  const toLocalIso = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" + pad(d.getMonth() + 1) +
      "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) +
      ":" + pad(d.getMinutes()) +
      ":" + pad(d.getSeconds())
    );
  };

  const toInputValue = (v) => {
    // convert ISO or "YYYY-MM-DD HH:mm:ss" to input[type=datetime-local] value
    if (!v) return "";
    let d = new Date(v);
    if (isNaN(d.getTime())) {
      // try to parse "YYYY-MM-DD HH:mm:ss"
      const s = String(v).replace(" ", "T");
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" + pad(d.getMonth() + 1) +
      "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) +
      ":" + pad(d.getMinutes())
    );
  };

  const fromInputValue = (s) => {
    // input "YYYY-MM-DDTHH:mm" -> Date
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const composeDateTime = (dateStr, timeStr) => {
    // timeStr like HH:mm
    const [hh = "00", mm = "00"] = String(timeStr || "00:00").split(":");
    const d = new Date(dateStr + "T" + hh.padStart(2, "0") + ":" + mm.padStart(2, "0") + ":00");
    return d;
  };



  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
    const s = String(v).replace(" ", "T");
    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
  };

  const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd;
  };

  const getErrorMessage = (e) => {
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.response?.data?.detail;
    if (status) {
      return `[${status}] ${serverMsg || e.message || "요청 처리 중 오류가 발생했습니다."}`;
    }
    if (e?.request && !e?.response) {
      // Network layer (CORS / 네트워크 / 서버 다운 등)
      return `네트워크 오류로 요청이 실패했어요. (서버 응답 없음) 상세: ${e.message || "알 수 없음"}`;
    }
    return e?.message || "알 수 없는 오류가 발생했습니다.";
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetchScreenings();
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

  useEffect(() => {
    if (!isNewOpen) return;
    let alive = true;
    (async () => {
      try {
        const [mData, sData] = await Promise.all([
          getAdminMovies({ page: 0, size: 200 }),
          getAdminScreens({ page: 0, size: 200 })
        ]);
        const toList = (data) => {
          if (Array.isArray(data)) return data;
          if (Array.isArray(data?.content)) return data.content;
          if (Array.isArray(data?.data?.content)) return data.data.content; // some backends wrap under data
          if (Array.isArray(data?.items)) return data.items;
          return [];
        };
        const mList = toList(mData);
        const sList = toList(sData);
        const playableMovies = mList.filter((m) => {
          const st = (computeMovieStatus(m) || "").toString().toUpperCase();
          return !(st.includes("FINISHED"));
        });
        if (alive) {
          setMovies(playableMovies);
          setScreens(sList);
          if (mList.length !== playableMovies.length) {
            console.warn(`[AdminScreenings] 종료된 영화 ${mList.length - playableMovies.length}건이 제외되었습니다.`);
          }
          if (playableMovies.length === 0) console.warn("[AdminScreenings] 표시 가능한 영화가 없습니다. 응답:", mData);
          if (sList.length === 0) console.warn("[AdminScreenings] 상영관 목록이 비어있습니다. 응답:", sData);
        }
      } catch (e) {
        console.error("상영 생성용 데이터 로드 실패", e);
      }
    })();
    return () => { alive = false; };
  }, [isNewOpen]);

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

  const buildSchedule = () => {
    const movie = movies.find((m) => String(m.id ?? m.movieId) === String(form.movieId));
    const runtime = getRuntimeMin(movie);
    if (!form.date || !form.firstStart || !runtime || !form.screenId) return [];

    const clean = Number(form.cleanMinutes || 0);
    const first = composeDateTime(form.date, form.firstStart);

    if (form.mode === "single") {
      const end = addMinutes(first, runtime);
      const outEnd = addMinutes(end, 0); // show exact end (청소시간 제외)
      return [{ start: first, end: outEnd }];
    }

    // auto mode: back-to-back until closeTime (exclusive)
    const [ch = "24", cm = "00"] = String(form.closeTime || "24:00").split(":");
    const close = composeDateTime(form.date, `${ch.padStart(2, "0")}:${cm.padStart(2, "0")}`);
    const list = [];
    let cur = new Date(first);
    while (cur < close) {
      const end = addMinutes(cur, runtime);
      const showEnd = new Date(end);
      list.push({ start: new Date(cur), end: showEnd });
      // 다음 회차: 종료 + 청소
      cur = addMinutes(end, clean);
    }
    return list;
  };

  const postOne = async (payload) => {
    return await createScreening(payload);
  };

  const handleCreate = async () => {
    const schedule = buildSchedule();
    if (!schedule.length) return;
    // Overlap check with existing screenings on the same screen
    const screenId = Number(form.screenId);
    const existingOnScreen = items.filter((x) => {
      const scId = Number(x.screenId ?? x.screen?.id ?? x.screen?.screenId ?? x.screen_id);
      return scId === screenId;
    });
    const overlaps = [];
    for (const slot of schedule) {
      for (const ex of existingOnScreen) {
        const exStart = parseDate(ex.startAt ?? ex.start_at ?? ex.start);
        const exEnd = parseDate(ex.endAt ?? ex.end_at ?? ex.end);
        if (!exStart || !exEnd) continue;
        if (intervalsOverlap(slot.start, slot.end, exStart, exEnd)) {
          overlaps.push({ slot, ex });
        }
      }
    }
    if (overlaps.length > 0) {
      const msg = overlaps.slice(0, 5).map((o, i) => {
        return `#${i + 1}) ${toLocalIso(o.slot.start)} ~ ${toLocalIso(o.slot.end)} 가 기존 상영(${fmt(o.ex.startAt ?? o.ex.start_at ?? o.ex.start)} ~ ${fmt(o.ex.endAt ?? o.ex.end_at ?? o.ex.end)})과 겹칩니다.`;
      }).join("\n");
      alert("선택한 상영관의 기존 상영시간과 겹치므로 생성할 수 없습니다.\n\n" + msg + (overlaps.length > 5 ? `\n...외 ${overlaps.length - 5}건` : ""));
      return;
    }
    setSubmitting(true);
    try {
      const movie = movies.find((m) => String(m.id ?? m.movieId) === String(form.movieId));
      const screenIdStr = form.screenId;
      for (const slot of schedule) {
        const payload = {
          movieId: Number(form.movieId),
          screenId: Number(screenIdStr),
          startAt: toLocalIso(slot.start),
          endAt: toLocalIso(slot.end)
        };
        await postOne(payload);
      }
      // 생성 후 목록 리프레시
      setIsNewOpen(false);
      setForm((p) => ({ ...p, movieId: "", screenId: "" }));
      // reload list
      setLoading(true);
      setErr(null);
      const res = await fetchScreenings();
      const list = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      setItems(list);
    } catch (e) {
      console.error(e);
      alert(getErrorMessage(e));
    } finally {
        setSubmitting(false);
        setLoading(false);
    }
  };

  const openEdit = (s) => {
    const id = s.id ?? s.screeningId ?? s.screen_id ?? s.screening_id;
    const movieId = s.movieId ?? s.movie?.id ?? s.movie?.movieId ?? "";
    const screenId = s.screenId ?? s.screen?.id ?? s.screen?.screenId ?? s.screen_id ?? "";
    setEditing(s);
    setEditForm({
      id: id ? String(id) : "",
      movieId: movieId ? String(movieId) : "",
      screenId: screenId ? String(screenId) : "",
      startInput: toInputValue(s.startAt ?? s.start_at ?? s.start),
      endInput: toInputValue(s.endAt ?? s.end_at ?? s.end),
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editForm.id) return;
    setSubmitting(true);
    try {
      const start = fromInputValue(editForm.startInput);
      const end = fromInputValue(editForm.endInput);
      if (!start || !end) throw new Error("시작/종료 시간을 확인해주세요.");
      const payload = {
        movieId: Number(editForm.movieId || 0) || undefined,
        screenId: Number(editForm.screenId || 0) || undefined,
        startAt: toLocalIso(start),
        endAt: toLocalIso(end),
      };
      await updateScreening(editForm.id, payload);
      // refresh list
      const res = await fetchScreenings();
      const list = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      setItems(list);
      setIsEditOpen(false);
    } catch (e) {
      console.error(e);
      alert(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOne = async () => {
    if (!editForm.id) return;
    if (!confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    setSubmitting(true);
    try {
      await deleteScreening(editForm.id);
      const res = await fetchScreenings();
      const list = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      setItems(list);
      setIsEditOpen(false);
    } catch (e) {
      console.error(e);
      alert(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold">상영시간 관리</h1>
          <button
            type="button"
            onClick={() => setIsNewOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 active:bg-indigo-800"
          >
            + 새 상영 추가
          </button>
        </header>

          {/* Date Week Strip (7 days) */}
          <div className="mb-3 -mt-2 overflow-x-auto">
            <div className="inline-flex items-center gap-2 whitespace-nowrap">
              {/* Prev 7 days */}
              <button
                type="button"
                onClick={() => setWeekStartKey((k) => addDaysKey(k || todayKey, -7))}
                className="px-2 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50"
                title="이전 7일"
              >◀</button>

              {/* 전체 버튼 */}
              <button
                type="button"
                onClick={() => setActiveDate('ALL')}
                className={
                  'px-3 py-1.5 rounded-full border text-sm ' +
                  (activeDate === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 hover:bg-gray-50')
                }
              >전체</button>

              {/* 7-day buttons */}
              {weekKeys.map((d) => {
                const isActive = activeDate === d;
                const has = dateHasItems.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => has && setActiveDate(d)}
                    className={
                      'px-3 py-1.5 rounded-full border text-sm ' +
                      (isActive
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : has
                          ? 'bg-white text-gray-700 hover:bg-gray-50'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                    }
                    title={d}
                    disabled={!has}
                  >{dateLabel(d, todayKey)}</button>
                );
              })}

              {/* Next 7 days */}
              <button
                type="button"
                onClick={() => setWeekStartKey((k) => addDaysKey(k || todayKey, 7))}
                className="px-2 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50"
                title="다음 7일"
              >▶</button>
            </div>
          </div>

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

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">영화 제목</span>
            <input
              type="text"
              className="h-10 w-52 rounded border px-3 text-sm"
              placeholder="제목 검색"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">상영관</span>
            <input
              type="text"
              className="h-10 w-52 rounded border px-3 text-sm"
              placeholder="상영관명/ID 검색"
              value={filterScreen}
              onChange={(e) => setFilterScreen(e.target.value)}
            />
          </label>
        </div>

        {!loading && !err && items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                    <th className="px-4 py-3 text-left">
                        <button type="button" onClick={() => toggleSort("movieId")} className="inline-flex items-center">
                            ID {renderArrowPair("movieId")}
                        </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                        <button type="button" onClick={() => toggleSort("title")} className="inline-flex items-center">
                            영화제목 {renderArrowPair("title")}
                        </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                        <button type="button" onClick={() => toggleSort("screen")} className="inline-flex items-center">
                            상영관 {renderArrowPair("screen")}
                        </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                        <button type="button" onClick={() => toggleSort("start")} className="inline-flex items-center">
                            시작시간 {renderArrowPair("start")}
                        </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                        <button type="button" onClick={() => toggleSort("end")} className="inline-flex items-center">
                            종료시간 {renderArrowPair("end")}
                        </button>
                    </th>
                  <th className="px-4 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedItems.map((s, idx) => {
                  const id = s.id ?? s.screeningId ?? s.screen_id ?? s.screening_id;
                  const movie = s.movieTitle ?? s.movie?.title ?? s.title ?? "(제목 없음)";
                  const screen = s.screenName ?? s.screen?.name ?? s.screenId ?? s.screen_id ?? "-";
                  const rowKey = id ? String(id) : `row-${idx}`;
                  const movieIdCol = s.movieId ?? s.movie?.id ?? s.movie?.movieId ?? s.movie_id ?? s.movie?.movie_id ?? "";
                  return (
                    <tr key={rowKey}>
                      <td className="px-4 py-3">{String(movieIdCol)}</td>
                      <td className="px-4 py-3">{movie}</td>
                      <td className="px-4 py-3">{screen}</td>
                      <td className="px-4 py-3">{fmt(s.startAt ?? s.start_at ?? s.start)}</td>
                      <td className="px-4 py-3">{fmt(s.endAt ?? s.end_at ?? s.end)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => id && openEdit(s)}
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

        {isNewOpen && (
          ReactDOM.createPortal(
            <div className="fixed inset-0 z-[1000]">
              <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setIsNewOpen(false)} />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b px-5 py-4">
                    <h3 className="text-lg font-semibold">새 상영 자동 생성</h3>
                    <button className="text-gray-500 hover:text-gray-700" onClick={() => !submitting && setIsNewOpen(false)}>✕</button>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">영화</span>
                        <select
                          className="rounded border px-3 py-2"
                          value={form.movieId}
                          onChange={(e) => onChange("movieId", e.target.value)}
                        >
                          <option value="">영화 선택</option>
                          {movies.map((m) => {
                            const id = m.id ?? m.movieId;
                            const title = m.title ?? m.name ?? `(ID:${id})`;
                            const rt = getRuntimeMin(m);
                            return (
                              <option key={id ?? title} value={id}>
                                {title} ({rt || "?"}분)
                              </option>
                            );
                          })}
                        </select>
                        {movies.length === 0 && (
                          <span className="text-xs text-amber-600">영화 목록이 비어있어요. 관리자 API 응답을 확인해 주세요.</span>
                        )}
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">상영관</span>
                        <select
                          className="rounded border px-3 py-2"
                          value={form.screenId}
                          onChange={(e) => onChange("screenId", e.target.value)}
                        >
                          <option value="">상영관 선택</option>
                          {screens.map((sc) => {
                            const id = sc.id ?? sc.screenId ?? sc.screen_id;
                            const name = sc.name ?? sc.screenName ?? `관 ${id}`;
                            return (
                              <option key={id ?? name} value={id}>{name}</option>
                            );
                          })}
                        </select>
                        {screens.length === 0 && (
                          <span className="text-xs text-amber-600">상영관 목록이 비어있어요. 관리자 API 응답을 확인해 주세요.</span>
                        )}
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">날짜</span>
                        <input
                          type="date"
                          className="rounded border px-3 py-2"
                          value={form.date}
                          onChange={(e) => onChange("date", e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">첫 회차 시작</span>
                        <input
                          type="time"
                          className="rounded border px-3 py-2"
                          value={form.firstStart}
                          onChange={(e) => onChange("firstStart", e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">청소시간(분)</span>
                        <input
                          type="number"
                          min={0}
                          className="rounded border px-3 py-2"
                          value={form.cleanMinutes}
                          onChange={(e) => onChange("cleanMinutes", e.target.value)}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">모드</span>
                        <select
                          className="rounded border px-3 py-2"
                          value={form.mode}
                          onChange={(e) => onChange("mode", e.target.value)}
                        >
                          <option value="single">단일 회차 생성</option>
                          <option value="auto">자동 편성(마감까지)</option>
                        </select>
                      </label>

                      {form.mode === "auto" && (
                        <label className="flex flex-col gap-1 sm:col-span-2">
                          <span className="text-sm text-gray-600">운영 마감 시간</span>
                          <input
                            type="time"
                            className="rounded border px-3 py-2"
                            value={form.closeTime}
                            onChange={(e) => onChange("closeTime", e.target.value)}
                          />
                        </label>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="rounded border bg-gray-50/60">
                      <div className="border-b px-3 py-2 text-sm text-gray-700">미리보기</div>
                      <div className="max-h-48 overflow-auto px-3 py-2 text-sm">
                        {buildSchedule().length === 0 && (
                          <div className="text-gray-500">조건을 입력하면 미리보기가 표시됩니다.</div>
                        )}
                        {buildSchedule().map((slot, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <span>#{idx + 1}</span>
                            <span>{toLocalIso(slot.start)} → {toLocalIso(slot.end)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                    <button
                      type="button"
                      className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100"
                      onClick={() => setIsNewOpen(false)}
                      disabled={submitting}
                    >취소</button>
                    <button
                      type="button"
                      className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                      onClick={handleCreate}
                      disabled={submitting || !buildSchedule().length}
                    >{submitting ? "생성 중…" : "생성"}</button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        )}
        {isEditOpen && (
          ReactDOM.createPortal(
            <div className="fixed inset-0 z-[1000]">
              <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setIsEditOpen(false)} />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b px-5 py-4">
                    <h3 className="text-lg font-semibold">상영 수정 / 삭제</h3>
                    <button className="text-gray-500 hover:text-gray-700" onClick={() => !submitting && setIsEditOpen(false)}>✕</button>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">시작 일시</span>
                        <input
                          type="datetime-local"
                          className="rounded border px-3 py-2"
                          value={editForm.startInput}
                          onChange={(e) => setEditForm((p) => ({ ...p, startInput: e.target.value }))}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">종료 일시</span>
                        <input
                          type="datetime-local"
                          className="rounded border px-3 py-2"
                          value={editForm.endInput}
                          onChange={(e) => setEditForm((p) => ({ ...p, endInput: e.target.value }))}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t px-5 py-4">
                    <button
                      type="button"
                      className="rounded-md px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                      onClick={handleDeleteOne}
                      disabled={submitting}
                    >삭제</button>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100"
                        onClick={() => setIsEditOpen(false)}
                        disabled={submitting}
                      >취소</button>
                      <button
                        type="button"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                        onClick={handleUpdate}
                        disabled={submitting}
                      >저장</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        )}
      </main>
    </AdminLayout>
  );
};

export default AdminScreenings;