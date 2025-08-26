import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {getMovies, getScreenings} from "../../api/movieApi.js";
import {useAuthStore} from "../../store/useAuthStore.js";


/* 상영시간표 페이지
전체상영목록> 예매하기 흐름
*/

// 한국시간 포맷 라벨
function formatKoreanDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "long" });
  return `${y}년 ${m}월 ${d}일 ${weekday}`;
}
// 로컬시간 헬퍼 (KST에서 24시간제 HH:mm 출력)
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

// 관람등급 배지 (Booking 페이지와 통일)
const Badge = ({ text }) => {
  let display = "";
  if (!text) display = "ALL";
  else if (text.includes("전체")) display = "ALL";
  else if (text.includes("청소년")) display = "19";
  else {
    const num = text.replace(/[^0-9]/g, "");
    display = num || text;
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md text-white text-xs font-bold w-6 h-6 mr-1 ` +
        (display === "ALL" ? "bg-green-600" : display === "19" ? "bg-red-600" : "bg-yellow-500")}
    >
      {display}
    </span>
  );
};

// 한 상영 시간 버튼
const TimePill = ({ labelStart, labelEnd, auditorium, disabled = false, onClick }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    aria-disabled={disabled}
    className={
      "inline-flex items-center gap-2 px-4 py-3 rounded-full border bg-gray-50 backdrop-blur transition text-sm mr-2 shadow-sm " +
      (disabled ? "opacity-20 cursor-not-allowed pointer-events-none" : "hover:bg-white")
    }
    title={auditorium ? `${auditorium} | ${labelStart}${labelEnd ? ` ~ ${labelEnd}` : ""}` : labelStart}
  >
    <span className="font-semibold leading-none">{labelStart}</span>
    {labelEnd && <span className="text-gray-400 leading-none">~ {labelEnd}</span>}
    {auditorium && <span className="text-gray-900 leading-none">| {auditorium}</span>}
  </button>
);

// 영화별 블록
const MovieBlock = ({ movie, slots, onClickTime }) => (
  <div className="border rounded-xl bg-white/70 backdrop-blur p-4 mb-4">
    <div className="flex items-center justify-between mb-3">
      <button className="flex items-center gap-2 text-left">
        <Badge text={movie.rating || "ALL"} />
        <h3 className="text-base sm:text-lg font-semibold">
          {movie.title}
        </h3>
      </button>
    </div>
    {slots && slots.length ? (
      <div className="flex flex-wrap">
        {slots.map((s) => {
          const isPast = typeof s.startMs === 'number' ? s.startMs <= Date.now() : false;
          return (
            <TimePill
              key={s.id}
              labelStart={s.start}
              labelEnd={s.end}
              auditorium={s.auditorium}
              disabled={isPast}
              onClick={() => (!isPast ? onClickTime(s) : undefined)}
            />
          );
        })}
      </div>
    ) : (
      <div className="text-sm text-gray-500">상영 시간이 없습니다.</div>
    )}
  </div>
);

const Screenings = () => {
    const token = useAuthStore((s) => s.token);
    const isAuthenticated = !!token;
    const navigate = useNavigate();
    // 날짜 상태
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const dateInputValue = useMemo(() => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(selectedDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [selectedDate]);

  // 영화 목록
  const [movies, setMovies] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [moviesError, setMoviesError] = useState(null);

  // 상영표 (하루 전체 → 영화별 그룹)
  const [groups, setGroups] = useState([]); // [{ movieId, movie, slots: [{id,start,end,auditorium,title}]}]
  const [screeningsLoading, setScreeningsLoading] = useState(false);
  const [screeningsError, setScreeningsError] = useState(null);

  // 영화 불러오기 (status=true만 사용)
  useEffect(() => {
    (async () => {
      try {
        const data = await getMovies({ page: 0, size: 200 });
        const list = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
        const filtered = list.filter((m) => m && m.status === true);
        const normalized = filtered.map((m) => ({ ...m, _id: m.id ?? m.movieId ?? null }));
        const dedupMap = new Map();
        for (const m of normalized) {
          const key = (m._id ?? m.title ?? Math.random()).toString();
          if (!dedupMap.has(key)) dedupMap.set(key, m);
        }
        setMovies(Array.from(dedupMap.values()));
      } catch (e) {
        setMovies([]);
        setMoviesError(e?.message || "영화 목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setMoviesLoading(false);
      }
    })();
  }, []);

  // 날짜 변경 핸들러
  const handleDateChange = (e) => {
    const val = e.target.value; // yyyy-mm-dd
    if (!val) return;
    const [yy, mm, dd] = val.split("-");
    setSelectedDate(new Date(Number(yy), Number(mm) - 1, Number(dd)));
  };

  // 해당 날짜의 전체 상영표 불러와 영화별로 그룹화
  useEffect(() => {
    const dateOnly = toYmdLocal(selectedDate); // 서버: YYYY-MM-DD (로컬/KST)

    (async () => {
      setScreeningsLoading(true);
      setScreeningsError(null);
      try {
        const allOfDay = await getScreenings(dateOnly, null, { page: 0, size: 500, allPages: true, maxPages: 30 });
        const list = Array.isArray(allOfDay?.content)
          ? allOfDay.content
          : Array.isArray(allOfDay)
          ? allOfDay
          : [];

        // 상영 아이템 정규화
        const normalized = (list || [])
          .map((it) => {
            const rawStart = it.startAt || it.start_at;
            const rawEnd = it.endAt || it.end_at;
            if (!rawStart) return null;

            const startDate = new Date(rawStart);
            const endDate = rawEnd ? new Date(rawEnd) : null;

            const mid = it.movieId || it.movie_id || null;
            const titleFromMovie = (() => {
              if (mid == null) return "";
              const mv = movies.find((m) => (m._id ?? m.id ?? m.movieId) === mid);
              return mv?.title || "";
            })();

            return {
              id: it.screeningId || it.id,
              movieId: mid,
              title: it.movieTitle || it.title || titleFromMovie || "",
              auditorium: it.screenName || it.screen_name || it.screenId || it.screen_id,
              start: toHHMMLocal(startDate),    // 24시간제 HH:mm
              end: endDate ? toHHMMLocal(endDate) : null,
              startMs: startDate.getTime(),
              _ymd: toYmdLocal(startDate),      // 로컬 기준 날짜
            };
          })
          .filter(Boolean)
          .filter((cur) => cur._ymd === dateOnly);

        // 영화별 그룹화
        const byMovie = new Map();
        for (const s of normalized) {
          if (!s.movieId) continue;
          if (!byMovie.has(s.movieId)) byMovie.set(s.movieId, []);
          byMovie.get(s.movieId).push(s);
        }

        // 출력용 정렬 (영화 제목 -> 시간)
        const groupsSorted = Array.from(byMovie.entries())
          .map(([movieId, slots]) => {
            const movie = movies.find((m) => (m._id ?? m.id ?? m.movieId) === movieId) || { _id: movieId, title: slots[0]?.title || "" };
            const sortedSlots = slots
              .slice()
              .sort((a, b) => a.start.localeCompare(b.start));
            return { movieId, movie, slots: sortedSlots };
          })
          .sort((a, b) => String(a.movie?.title || "").localeCompare(String(b.movie?.title || "")));

        setGroups(groupsSorted);
      } catch (err) {
        setGroups([]);
        setScreeningsError(err?.message || "상영 시간을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setScreeningsLoading(false);
      }
    })();
  }, [selectedDate, movies]);

  // 이동: 시간 클릭 → 좌석 예약 (로그인 가드)
  const goSeatForTime = (slot) => {
    if (slot && typeof slot.startMs === 'number' && slot.startMs <= Date.now()) {
      alert('이미 지난 상영시간입니다. 다른 시간을 선택해주세요.');
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

    const params = new URLSearchParams({
      movieId: String(slot.movieId ?? ''),
      screeningId: String(slot.id ?? ''),
      date: dateInputValue,
      start: slot.start ?? '',
      end: slot.end ?? '',
      auditorium: String(slot.auditorium ?? ''),
      title: String(slot.title ?? ''),
    });

    const seatUrl = `/seat?${params.toString()}`;
    if (!authedNow) {
      navigate(`/login?redirect=${encodeURIComponent(seatUrl)}`);
      return;
    }
    navigate(seatUrl);
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-6 min-h-[75vh]">
      {/* 상단: 날짜 선택 */}
      <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold">상영시간표</h2>
        <label className="inline-flex items-center gap-3">
          <span className="text-sm text-gray-600">날짜 선택</span>
          <input
            type="date"
            value={dateInputValue}
            onChange={handleDateChange}
            className="border rounded-md px-3 py-2"
            min={toYmdLocal(new Date())}
          />
        </label>
      </div>

      {/* 본문: 영화별 상영표 */}
      <section>
        {moviesLoading ? (
          <div className="text-gray-500">영화 목록을 불러오는 중...</div>
        ) : moviesError ? (
          <div className="text-red-600">{moviesError}</div>
        ) : screeningsLoading ? (
          <div className="text-gray-500 py-14 text-center">상영 시간을 불러오는 중...</div>
        ) : screeningsError ? (
          <div className="text-red-600 py-14 text-center">{screeningsError}</div>
        ) : !groups.length ? (
          <div className="text-gray-500 py-14 text-center">표시할 상영 정보가 없습니다.</div>
        ) : (
          groups.map(({ movieId, movie, slots }) => (
            <MovieBlock
              key={movieId}
              movie={movie}
              slots={slots}
              onClickTime={(s) => goSeatForTime({ ...s, movieId })}
            />
          ))
        )}
      </section>
    </main>
  );
};

export default Screenings;