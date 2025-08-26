import React, { useMemo, useState, useEffect } from "react";
import {getMovies, getScreenings} from "../../api/movieApi.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore.js";
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
const MovieItem = ({ movie, active, onClick }) => (
  <button
    onClick={onClick}
    className={
      `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition ` +
      (active ? "font-semibold text-white bg-zinc-700" : "text-gray-700 hover:bg-zinc-100")
    }
  >
    <Badge text={movie.rating || 'ALL'} />
    <span className="text-base font-semibold truncate">{movie.title}</span>
  </button>
);

//상영시간 목록
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
          "w-full flex items-center justify-between px-3 py-2 rounded-md border bg-white/80 backdrop-blur transition shadow-sm " +
          (disabled ? "opacity-20 cursor-not-allowed" : "hover:bg-white")
        }
      >
        {/* Left: start/end time */}
        <div className="w-20 text-right">
          <div className="text-lg font-bold leading-none">{start}</div>
          <div className="text-xs text-gray-400 leading-none mt-1">~{end || ""}</div>
        </div>

        {/* Middle: title and format */}
        <div className="flex-1 px-4 min-w-0">
          <div className="truncate text-base font-semibold">{title || "제목 미정"}</div>
          <div className="text-xs text-gray-500 mt-1">2D(자막)</div>
        </div>

        {/* Right: auditorium */}
        <div className="w-40 text-right">
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

  const handleDateChange = (e) => {
    const val = e.target.value; // yyyy-mm-dd
    if (!val) return;
    const [yy, mm, dd] = val.split("-");
    setSelectedDate(new Date(Number(yy), Number(mm) - 1, Number(dd)));
  };

  const openSeatPage = (slot) => {
    const params = new URLSearchParams({
      movieId: String(selectedMovieId ?? ''),
      screeningId: String(slot.id ?? ''),
      date: dateInputValue,
      start: slot.start ?? '',
      end: slot.end ?? '',
      auditorium: String(slot.auditorium ?? ''),
      title: slot.title ?? ''
    });

    // 지난 상영 시간 방지
    if (slot?.startMs && slot.startMs <= Date.now()) {
      alert("이미 지난 상영시간입니다. 다른 시간을 선택해주세요.");
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

  const dateInputValue = useMemo(() => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(selectedDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [selectedDate]);

  const todayValue = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-6 min-h-[75vh]">
      {/* 상단: 날짜 선택 */}
        <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-2xl font-semibold">예매</h2>
        <label className="inline-flex items-center gap-3">
          <span className="text-sm text-gray-600">날짜 선택</span>
          <input
            type="date"
            value={dateInputValue}
            onChange={handleDateChange}
            className="border rounded-md px-3 py-2"
            min={todayValue}
          />
        </label>
      </div>

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
                      onClick={() => setSelectedMovieId(Number(keyId))}
                    />
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* 우측: 시간표 */}
        <section className="md:col-span-7 lg:col-span-8">
          <div className="rounded-xl border bg-white/70 backdrop-blur flex flex-col h-full">
            <div className="px-4 py-3 border-b bg-white/60 sticky top-0 z-10">
              <h3 className="text-base font-semibold">시간</h3>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
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
                      disabled={typeof s.startMs === 'number' ? s.startMs <= Date.now() : false}
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