import React, { useMemo, useState, useEffect } from "react";
import {getMovies, getScreenings} from "../../api/movieApi.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore.js";
import { DateStrip } from "../admin/AdminScreenings.jsx";
/* 예매 페이지
영화별 상영목록 > 날짜필터링에서 상영시간 노출> 예매하기 흐름
*/

//한국시간 포맷
function formatKoreanDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "long" });
  return `${y}년 ${m}월 ${d}일 ${weekday}`;
}
function toYmdLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function toHHMMLocal(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

// ---- DateStrip helpers (KST date keys) ----
function toKstDateKey(date) {
  // Use local time as KST in browser (assumes user is KST or data is already normalized)
  return toYmdLocal(date);
}
function parseKeyToDate(key) {
  const [y, m, d] = key.split("-").map((v) => Number(v));
  return new Date(y, m - 1, d);
}
function addDaysKey(baseKey, delta) {
  const base = parseKeyToDate(baseKey);
  base.setDate(base.getDate() + delta);
  return toKstDateKey(base);
}
function dateLabel(key, todayKey) {
  if (key === todayKey) return "오늘";
  const d = parseKeyToDate(key);
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const weekday = d.toLocaleDateString("ko-KR", { weekday: "short" }); // 월,화...
  return `${M}/${D}(${weekday})`;
}
// ---- /DateStrip helpers ----

//관람등급
const Badge = ({ text }) => {
  let display = "";

  if (!text) {
    display = "ALL";
  } else if (text.includes("전체")) {
    display = "ALL";
  } else if (text.includes("청소년")) {
    display = "19";
  } else {
    const num = text.replace(/[^0-9]/g, "");
    display = num || text;
  }

  return (
    <span
      className={
        `inline-flex items-center justify-center rounded-md text-white text-base font-bold w-7 h-7 mr-1 ` +
          (display === "ALL"
              ? "bg-green-600"
              : display === "19"
                  ? "bg-red-600"
                  : "bg-yellow-500")
        }
    >
      {display}
    </span>
  );
};

//영화목록
const MovieItem = ({ movie, active, onClick, dimmed = false }) => (
  <button
    onClick={onClick}
    className={
      `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition ` +
      (active ? "font-semibold text-white bg-zinc-700" : "text-gray-700 hover:bg-zinc-100") +
      ( !active && dimmed ? " opacity-40 grayscale" : "" )
    }
  >
    <Badge text={movie.rating || 'ALL'} />
    <span className="text-base font-semibold truncate">{movie.title}</span>
  </button>
);

//상영시간 목록 (스타일 개선 및 disabled 뚜렷하게)
const TimeCard = ({ auditorium, start, end, title, disabled = false, onClick }) => {
    const label =
        typeof auditorium === "string" && !auditorium.trim().endsWith("관")
            ? `${auditorium}관`
            : auditorium;

    return (
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-disabled={disabled}
        className={
          "w-full group flex items-center justify-between px-4 py-3 rounded-lg border bg-gradient-to-r from-white to-zinc-50 backdrop-blur ring-1 ring-zinc-100 shadow-sm transition-shadow duration-200 " +
          (disabled ? "opacity-50 grayscale cursor-not-allowed hover:shadow-none" : "hover:bg-white hover:shadow-md")
        }
      >
        {/* Left: start/end time */}
        <div className="w-24 text-right">
          <div className="text-xl font-extrabold leading-none tabular-nums tracking-tight">{start}</div>
          <div className="text-xs text-gray-400 leading-none mt-1">~{end || ""}</div>
        </div>

        {/* Middle: title and format */}
        <div className="flex-1 px-4 min-w-0">
          <div className="truncate text-base font-semibold">{title || "제목 미정"}</div>
          <div className="text-xs text-gray-500 mt-1">2D(자막)</div>
        </div>

        {/* Right: auditorium */}
        <div className="w-44 text-right">
          <div className="text-sm font-medium">Ticketory(대구)</div>
          <div className="text-sm font-medium">{label}</div>
        </div>
      </button>
    );
};

const Bookings = () => {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = !!token;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // DateStrip states
  const todayKey = useMemo(() => toKstDateKey(new Date()), []);
  const [activeDate, setActiveDate] = useState(todayKey);
  const [weekStartKey, setWeekStartKey] = useState(todayKey);
  const [dateHasItems, setDateHasItems] = useState(new Set([todayKey]));
  const preselectedMovieIdParam = searchParams.get("movieId");
  const preselectedMovieId = preselectedMovieIdParam ? Number(preselectedMovieIdParam) : null;
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedMovieId, setSelectedMovieId] = useState(preselectedMovieId);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [screenings, setScreenings] = useState([]);
  const [screeningsLoading, setScreeningsLoading] = useState(false);
  const [screeningsError, setScreeningsError] = useState(null);
  const [fallbackNotice, setFallbackNotice] = useState("");
  const [hasFutureByMovieId, setHasFutureByMovieId] = useState({});

  // Sync selectedDate with activeDate (DateStrip)
  useEffect(() => {
    if (activeDate && /^\d{4}-\d{2}-\d{2}$/.test(activeDate)) {
      setSelectedDate(parseKeyToDate(activeDate));
    }
  }, [activeDate]);

  // Prefetch availability for the current 7-day window to enable/disable tabs
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                // 영화가 아직 선택되지 않았다면 비활성 세트로 초기화
                if (!selectedMovieId) {
                    if (!cancelled) setDateHasItems(new Set());
                    return;
                }

                const startKey = weekStartKey || todayKey;
                const keys = Array.from({ length: 7 }, (_, i) => addDaysKey(startKey, i));

                // 날짜별로 해당 영화 상영이 있는지 확인 (백엔드에서 movieId 필터 지원)
                const results = await Promise.allSettled(
                    keys.map((k) => getScreenings(k, Number(selectedMovieId), { page: 0, size: 1 }))
                );

                const next = new Set();
                results.forEach((res, idx) => {
                    if (res.status === "fulfilled") {
                        const data = res.value;
                        const list = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
                        if (list.length > 0) next.add(keys[idx]); // 해당 날짜에 이 영화 상영 있음
                    }
                });

                if (cancelled) return;

                setDateHasItems(next);

                // 현재 activeDate가 비활성화되었으면 가장 가까운 활성 날짜로 자동 이동
                if (!next.has(activeDate)) {
                    const firstEnabled = keys.find((k) => next.has(k));
                    if (firstEnabled) setActiveDate(firstEnabled);
                }
            } catch {
                // 네트워크 오류 등은 조용히 무시 (기존 상태 유지)
            }
        })();

        return () => { cancelled = true; };
    }, [weekStartKey, todayKey, selectedMovieId]);

  useEffect(() => {
    if (preselectedMovieId !== null && preselectedMovieId !== undefined) {
      setSelectedMovieId(preselectedMovieId);
    }
  }, [preselectedMovieId]);

  useEffect(() => {
    (async function fetchMovies() {
      try {
        // 전체 영화 목록을 백엔드에서 가져온 뒤, 프론트에서 status=true만 필터링
        const data = await getMovies({ page: 0, size: 24 });
        const list = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);

        const filtered = list.filter((m) => m && m.status === true);

        const normalized = filtered.map((m) => ({
          ...m,
          _id: m.id ?? m.movieId ?? null,
        }));

        const dedupMap = new Map();
        for (const m of normalized) {
          const key = (m._id ?? m.title ?? Math.random()).toString();
          if (!dedupMap.has(key)) dedupMap.set(key, m);
        }
        const dedup = Array.from(dedupMap.values());

        const ids = dedup.map(m => m._id ?? m.id ?? m.movieId).filter(v => v !== null && v !== undefined);

        if (ids.length > 0) {
          if (preselectedMovieId !== null && preselectedMovieId !== undefined) {
            const exists = ids.some(id => String(id) === String(preselectedMovieId));
            setSelectedMovieId(exists ? preselectedMovieId : ids[0]);
          } else if (selectedMovieId === null || selectedMovieId === undefined) {
            setSelectedMovieId(ids[0]);
          } else {
            const exists = ids.some(id => String(id) === String(selectedMovieId));
            if (!exists) setSelectedMovieId(ids[0]);
          }
        } else {
          setSelectedMovieId(null);
        }

        setMovies(dedup);

      } catch (e) {
        setError(e?.message || '영화 목록을 불러오는 중 오류가 발생했습니다.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [preselectedMovieId]);

  useEffect(() => {
    // 날짜나 영화가 선택되지 않은 경우 초기화
    if (!selectedDate || !selectedMovieId) {
      setScreenings([]);
      return;
    }
    const dateOnly = toYmdLocal(selectedDate); // YYYY-MM-DD (로컬/KST 기준)

    (async function fetchScreenings() {
      setScreeningsLoading(true);
      setScreeningsError(null);
      try {
        // 하루 전체 상영표 조회 (로컬/KST 기준 필터는 아래에서 수행)
        const allOfDay = await getScreenings(dateOnly, null, {
            page: 0, size: 200, allPages: true, maxPages: 20, debug: true
        });

        const list = Array.isArray(allOfDay?.content)
          ? allOfDay.content
          : (Array.isArray(allOfDay) ? allOfDay : []);

        // 1) 로컬(KST) 기반 정규화 (표시용 라벨/필드 생성)
        const normalized = (list || []).map((it) => {
          const rawStart = it.startAt || it.start_at;
          const rawEnd = it.endAt || it.end_at;

          const startDate = new Date(rawStart); // 백엔드가 KST로 보낸 값을 로컬로 그대로 사용
          const endDate = rawEnd ? new Date(rawEnd) : null;

          const startYmd = toYmdLocal(startDate); // 로컬 YYYY-MM-DD

          return {
            id: it.screeningId || it.id,
            hour: startDate.getHours(),
            auditorium: it.screenName || it.screen_name || it.screenId || it.screen_id,
            startLabel: toHHMMLocal(startDate),
            endLabel: endDate ? toHHMMLocal(endDate) : null,
            title: (it.movieTitle || it.title || (() => {
              const mid = it.movieId || it.movie_id || null;
              if (mid == null) return "";
              const mv = movies.find((m) => (m._id ?? m.id ?? m.movieId) === mid);
              return mv?.title || "";
            })()),
            _ymd: startYmd,              // 로컬 기준 날짜
            _movieId: it.movieId || it.movie_id || null,
            _startMs: startDate.getTime() // 로컬 기준 timestamp
          };
        }).filter(Boolean);

        // 2) 로컬 날짜(KST) 필터
        const localFiltered = normalized.filter((cur) => cur._ymd === dateOnly);

        // Build availability map for movies on the selected date (future showtimes only)
        const nowMs = Date.now();
        const futureByMovie = {};
        for (const item of localFiltered) {
          const mid = item._movieId;
          if (mid == null) continue;
          if (typeof item._startMs === 'number' && item._startMs > nowMs) {
            futureByMovie[mid] = true;
          } else if (!(mid in futureByMovie)) {
            // initialize as false; will flip to true when a future showtime is found
            futureByMovie[mid] = false;
          }
        }
        // ensure all listed movies have an entry (default false)
        for (const m of movies) {
          const key = m._id ?? m.id ?? m.movieId;
          if (key != null && !(key in futureByMovie)) futureByMovie[key] = false;
        }
        setHasFutureByMovieId(futureByMovie);

        // 3) 선택 영화 필터 (선택이 없는 경우 모두 통과)
        const wantMovieId = Number(selectedMovieId);
        const movieFiltered = Number.isNaN(wantMovieId)
          ? localFiltered
          : localFiltered.filter((cur) => cur._movieId === wantMovieId);

        // 4) 그룹화 및 정렬
        const grouped = movieFiltered
          .reduce((acc, cur) => {
            const found = acc.find((b) => b.hour === cur.hour);
            const slot = {
              id: cur.id,
              auditorium: cur.auditorium,
              start: cur.startLabel,
              end: cur.endLabel,
              title: cur.title,
              startMs: cur._startMs,
            };
            if (found) found.slots.push(slot); else acc.push({ hour: cur.hour, slots: [slot] });
            return acc;
          }, [])
          .sort((a, b) => a.hour - b.hour)
          .map((block) => ({ ...block, slots: block.slots.sort((s1, s2) => s1.start.localeCompare(s2.start)) }));

        setScreenings(grouped);
        setFallbackNotice("");
      } catch (err) {
        setScreenings([]);
        setFallbackNotice("");
        setScreeningsError(err?.message || "상영 시간을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setScreeningsLoading(false);
      }
    })();
  }, [selectedDate, selectedMovieId, movies]);


  const openSeatPage = (slot) => {
    const dateStr = (typeof activeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(activeDate))
      ? activeDate
      : toYmdLocal(selectedDate || new Date());
    const params = new URLSearchParams({
      movieId: String(selectedMovieId ?? ''),
      screeningId: String(slot.id ?? ''),
      date: dateStr,
      start: slot.start ?? '',
      end: slot.end ?? '',
      auditorium: String(slot.auditorium ?? ''),
      title: slot.title ?? ''
    });

    // 지난 상영 시간 또는 30분 이내 방지
    if (slot?.startMs && (slot.startMs - 30 * 60 * 1000) <= Date.now()) {
      alert("상영 시작 30분 이내에는 예매할 수 없습니다. 다른 시간을 선택해주세요.");
      return;
    }

    // 최신 토큰을 즉시 조회(스토어 hydration 지연 대응) + 로컬스토리지 폴백
      const currentToken =
          useAuthStore.getState().token ||
          localStorage.getItem('accessToken') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('accessToken') ||
          sessionStorage.getItem('token');

      const authedNow = !!currentToken;

    // 로그인 여부 확인 후 분기
    const seatUrl = `/seat?${params.toString()}`;
    if (!authedNow) {
      // 로그인 페이지로 이동하면서 로그인 후 다시 돌아올 경로를 전달
      navigate(`/login?redirect=${encodeURIComponent(seatUrl)}`);
      return;
    }

    // 좌석 선택 페이지로 이동
    navigate(seatUrl);
  };


  return (
      <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh] bg-gradient-to-b from-white via-indigo-50/40 to-white rounded-2xl">
          {/* 헤더 & 날짜 선택*/}
          <header className="mb-8 flex items-end justify-between">
              <div>
                  <h1 className="text-2xl font-semibold">예매</h1>
                  <p className="mt-1 text-gray-500 text-sm"> 영화별 상영시간을 한눈에 확인하세요. 온라인 티켓 예매의 경우 상영 시간 시작 30분 전까지 예매 또는 취소가 가능합니다.</p>
              </div>
              <div>
                <DateStrip
                  activeDate={activeDate}
                  setActiveDate={setActiveDate}
                  weekStartKey={weekStartKey}
                  setWeekStartKey={setWeekStartKey}
                  todayKey={todayKey}
                  dateHasItems={dateHasItems}
                  addDaysKey={addDaysKey}
                  dateLabel={dateLabel}
                />
              </div>
          </header>

      {/* 본문 레이아웃 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* 좌측: 영화 리스트 */}
        <aside className="md:col-span-5 lg:col-span-4">
          <div className="rounded-xl border bg-white/70 backdrop-blur flex flex-col h-full">
            <div className="px-4 py-3 border-b bg-white/60 sticky top-0 z-10">
              <h3 className="text-base font-semibold">영화</h3>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="text-gray-500">로딩 중...</div>
              ) : error ? (
                <div className="text-red-600">{error}</div>
              ) : !movies.length ? (
                <div className="text-gray-500">상영중인 영화가 없습니다.</div>
              ) : (
                movies.map((m, idx) => {
                  const keyId = m._id ?? m.id ?? m.movieId ?? m.title ?? idx;
                  return (
                    <MovieItem
                      key={keyId}
                      movie={m}
                      active={String(keyId) === String(selectedMovieId)}
                      dimmed={!hasFutureByMovieId[String(keyId)]}
                      onClick={() => setSelectedMovieId(Number(keyId))}
                    />
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* 우측: 시간표 */}
        <section className="md:col-span-7 lg:col-span-8 ">
          <div className="rounded-xl border bg-white/70 backdrop-blur flex flex-col h-full">
            <div className="px-4 py-3 border-b bg-white/60 sticky top-0 z-10">
              <h3 className="text-base font-semibold">시간</h3>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto ">
              {screeningsLoading ? (
                <div className="text-center text-gray-500 py-14">상영 시간을 불러오는 중...</div>
              ) : screeningsError ? (
                <div className="text-center text-red-600 py-14">{screeningsError}</div>
              ) : screenings.length === 0 ? (
                <div className="text-center text-gray-500 py-14">표시할 상영 시간이 없습니다.</div>
              ) : (
                screenings.flatMap((block) =>
                  block.slots.map((s) => (
                    <TimeCard
                      key={s.id}
                      auditorium={s.auditorium}
                      start={s.start}
                      end={s.end}
                      title={s.title}
                      disabled={typeof s.startMs === 'number' ? (s.startMs - 30 * 60 * 1000) <= Date.now() : false}
                      onClick={() => openSeatPage(s)}
                    />
                  ))
                )
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Bookings;