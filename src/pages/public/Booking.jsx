import React, { useMemo, useState, useEffect } from "react";
import { getMovies } from "../../api/movieApi.js";
import {getScreenings} from "../../api/bookingApi.js";


function formatKoreanDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = date.toLocaleDateString("ko-KR", { weekday: "long" });
  return `${y}년 ${m}월 ${d}일 ${weekday}`;
}

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
        (display === "ALL" ? "bg-green-600" : "bg-yellow-500")
      }
    >
      {display}
    </span>
  );
};

const MovieItem = ({ movie, active, onClick }) => (
  <button
    onClick={onClick}
    className={
      `w-full flex items-center gap-3 px-2 py-2 text-left transition ` +
      (active ? "font-semibold text-gray-700" : "text-gray-800")
    }
  >
    <Badge text={movie.rating || 'ALL'} />
    <span className="text-base font-semibold">{movie.title}</span>
  </button>
);

const TimeCard = ({ auditorium, start, end, title, onClick }) => {
    const label =
        typeof auditorium === "string" && !auditorium.trim().endsWith("관")
            ? `${auditorium}관`
            : auditorium;

    return (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between border-b border-gray-200 last:border-b-0 bg-white/80 backdrop-blur px-2 py-2 hover:bg-white transition"
      >
        {/* Left: start/end time */}
        <div className="w-16 text-right">
          <div className="text-lg font-bold leading-none">{start}</div>
          <div className="text-xs text-gray-400 leading-none mt-1">~{end || ""}</div>
        </div>

        {/* Middle: title and format */}
        <div className="flex-1 px-4 min-w-0">
          <div className="truncate text-base font-semibold">{title || "제목 미정"}</div>
          <div className="text-xs text-gray-500 mt-1">2D(자막)</div>
        </div>

        {/* Right: auditorium */}
        <div className="w-36 text-right">
          <div className="text-sm font-medium">Ticketory(대구)</div>
          <div className="text-sm font-medium">{label}</div>
        </div>
      </button>
    );
};

const Bookings = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [screenings, setScreenings] = useState([]);
  const [screeningsLoading, setScreeningsLoading] = useState(false);
  const [screeningsError, setScreeningsError] = useState(null);
  const [fallbackNotice, setFallbackNotice] = useState("");

  useEffect(() => {
    (async function fetchMovies() {
      try {
        // 전체 영화 목록을 백엔드에서 가져온 뒤, 프론트에서 status=true만 필터링
        const data = await getMovies({ page: 0, size: 24 });
        const list = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);

        const filtered = list.filter((m) => m && m.status === true);

        // normalize id -> _id (fallback to movieId)
        const normalized = filtered.map((m) => ({
          ...m,
          _id: m.id ?? m.movieId ?? null,
        }));

        // deduplicate by _id (fallback to title)
        const dedupMap = new Map();
        for (const m of normalized) {
          const key = (m._id ?? m.title ?? Math.random()).toString();
          if (!dedupMap.has(key)) dedupMap.set(key, m);
        }
        const dedup = Array.from(dedupMap.values());

        setMovies(dedup);

        if (selectedMovieId === null && dedup.length > 0) {
          const firstId = dedup[0]._id ?? dedup[0].id ?? dedup[0].movieId;
          setSelectedMovieId(firstId ?? null);
        }
      } catch (e) {
        setError(e?.message || '영화 목록을 불러오는 중 오류가 발생했습니다.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // 날짜나 영화가 선택되지 않은 경우 초기화
    if (!selectedDate || !selectedMovieId) {
      setScreenings([]);
      return;
    }

    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(selectedDate.getDate()).padStart(2, "0");
    const dateOnly = `${yyyy}-${mm}-${dd}`; // 서버에서 이 포맷으로 받도록 가정: YYYY-MM-DD

    // Compute selected UTC YYYY-MM-DD string for screening filtering
    const selectedUtcYmd = new Date(Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      0, 0, 0, 0
    )).toISOString().slice(0, 10);

    (async function fetchScreenings() {
      setScreeningsLoading(true);
      setScreeningsError(null);
      try {
        // 1차: 선택 영화 기준 조회
        const numericMovieId = isNaN(Number(selectedMovieId)) ? selectedMovieId : Number(selectedMovieId);
        const primary = await getScreenings(dateOnly, numericMovieId);

        let list = Array.isArray(primary) ? primary : [];
        let usedFallback = false;

        // 2차: 해당 영화 상영이 없으면, 같은 날짜 전체 상영표로 fallback
        if (!list.length) {
          const allOfDay = await getScreenings(dateOnly, null);
          list = Array.isArray(allOfDay) ? allOfDay : [];
          usedFallback = list.length > 0;
        }

        // 그룹핑 변환 (UTC 기준)
        const grouped = list
          .map((it) => {
            const rawStart = it.startAt || it.start_at;
            const rawEnd = it.endAt || it.end_at;

            const startIso = new Date(rawStart).toISOString();
            const endIso = rawEnd ? new Date(rawEnd).toISOString() : null;

            const startUtcYmd = startIso.slice(0, 10);       // YYYY-MM-DD in UTC
            const startHH = startIso.substring(11, 13);      // HH in UTC
            const startMM = startIso.substring(14, 16);      // MM in UTC

            return {
              id: it.screeningId || it.id,
              hour: Number(startHH),
              auditorium: it.screenName || it.screen_name || it.screenId || it.screen_id,
              startLabel: `${startHH}:${startMM}`,
              endLabel: endIso ? endIso.substring(11, 16) : null,
              title: (it.movieTitle || it.title || (() => {
                const mid = it.movieId || it.movie_id || null;
                if (mid == null) return "";
                const mv = movies.find((m) => (m._id ?? m.id ?? m.movieId) === mid);
                return mv?.title || "";
              })()),
              _utcYmd: startUtcYmd,
            };
          })
          .filter(Boolean)
          // 선택한 날짜의 UTC 기준 상영만 남김
          .filter((cur) => cur._utcYmd === selectedUtcYmd)
          // 시간대 그룹핑 및 정렬
          .reduce((acc, cur) => {
            const found = acc.find((b) => b.hour === cur.hour);
            const slot = {
              id: cur.id,
              auditorium: cur.auditorium,
              start: cur.startLabel,
              end: cur.endLabel,
              title: cur.title,
            };
            if (found) found.slots.push(slot); else acc.push({ hour: cur.hour, slots: [slot] });
            return acc;
          }, [])
          .sort((a, b) => a.hour - b.hour)
          .map((block) => ({ ...block, slots: block.slots.sort((s1, s2) => s1.start.localeCompare(s2.start)) }));

        setScreenings(grouped);
        setFallbackNotice(
          usedFallback
            ? "선택한 영화의 상영이 없어 같은 날짜의 전체 상영표를 보여줍니다."
            : ""
        );
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
    // 추후 router로 좌석 페이지로 이동 (예: `/seats?movieId=...&start=...`)
    // 현재는 데모용으로 alert
    alert(`${selectedMovieId}번 영화, ${slot.auditorium}, ${slot.start} 상영 선택`);
  };

  const dateInputValue = useMemo(() => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(selectedDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [selectedDate]);

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
      {/* 상단: 날짜 선택 */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-xl font-extrabold">{formatKoreanDate(selectedDate)}</h2>
        <label className="inline-flex items-center gap-3">
          <span className="text-sm text-gray-600">날짜 선택</span>
          <input
            type="date"
            value={dateInputValue}
            onChange={handleDateChange}
            className="border rounded-md px-3 py-2"
          />
        </label>
      </div>

      {/* 본문 레이아웃 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* 좌측: 영화 리스트 */}
        <aside className="md:col-span-5 lg:col-span-4">
          <div className="rounded-xl border bg-white/70 backdrop-blur p-6">
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
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
                      active={keyId === selectedMovieId}
                      onClick={() => setSelectedMovieId(keyId)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* 우측: 시간표 */}
        <section className="md:col-span-7 lg:col-span-8">
          <div className="rounded-xl border bg-white/70 backdrop-blur p-0">
            <div className="p-4">
              {fallbackNotice && (
                <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {fallbackNotice}
                </div>
              )}
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