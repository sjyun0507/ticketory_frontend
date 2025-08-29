import React, { useEffect, useState } from "react";
import {getBoards} from "../../api/adminApi.js";


// 간단한 날짜 포맷터 (YYYY.MM.DD)
const fmt = (d) => new Date(d).toISOString().slice(0, 10).replaceAll("-", ".");

// YYYY-MM-DD from Date or string
const ymd = (d) => {
  if (!d) return "";
  const dt = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
};
const isEnded = (endDate) => {
  if (!endDate) return false; // 종료일 없으면 진행 중으로 간주
  const today = ymd(new Date());
  return ymd(endDate) < today;
};

const Badge = ({ type }) => {
  const isEvent = type !== "NOTICE"; // default 이벤트
  const label = type === "NOTICE" ? "공지" : "이벤트";
  const base =
    "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border";
  const color = isEvent
    ? "bg-purple-50 border-purple-200 text-purple-700"
    : "bg-blue-50 border-blue-200 text-blue-700";
  return <span className={`${base} ${color}`}>{label}</span>;
};

const EventCard = ({ item, onOpen }) => {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(item)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen?.(item)}
      className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={item.bannerUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute left-3 top-3">
          <Badge type={item.type} />
        </div>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-sm sm:text-base font-semibold text-gray-900">
          {item.title}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500">
          {fmt(item.startDate)} ~ {fmt(item.endDate)}
        </p>
        {item.content && (
          <p className="text-xs text-gray-600 line-clamp-2">{item.content}</p>
        )}
      </div>
    </article>
  );
};

const Events = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("active"); // active | ended
  const close = () => setActive(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getBoards();
        const list = Array.isArray(data) ? data : (data?.content ?? []);
        list.sort((a, b) => new Date(b.startDate || b.createdDate || 0) - new Date(a.startDate || a.createdDate || 0));
        setPosts(list);
      } catch (e) {
        console.error("[Events] getBoards failed", e);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 1) 공개글만 노출
  const publishedPosts = posts.filter(p => p.published === true);

  // 2) 종료 여부 분리
  const activePosts = publishedPosts.filter(p => !isEnded(p.endDate));
  const endedPosts  = publishedPosts.filter(p => isEnded(p.endDate));

  // 3) 정렬: 시작일 또는 생성일 desc (기존 기준 유지)
  const sortByDateDesc = (list) => list.slice().sort(
    (a, b) => new Date(b.startDate || b.createdDate || 0) - new Date(a.startDate || a.createdDate || 0)
  );
  const activeSorted = sortByDateDesc(activePosts);
  const endedSorted  = sortByDateDesc(endedPosts);

  const featured = activeSorted.find((p) => p.bannerUrl) || activeSorted[0] || null;

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
      {/* 헤더 */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">이벤트</h1>
          <p className="mt-1 text-gray-500 text-sm">공지와 이벤트를 한눈에 확인하세요.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setTab("active")}
              className={`px-3 py-1.5 text-sm rounded-md ${tab === "active" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              진행/예정 이벤트
            </button>
            <button
              onClick={() => setTab("ended")}
              className={`px-3 py-1.5 text-sm rounded-md ${tab === "ended" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              종료된 이벤트
            </button>
          </div>
        </div>
      </header>

      {/* 메인 포스터 (1장) */}
      {tab === "active" && featured && (
        <section className="mb-10">
          <div
            className="relative overflow-hidden rounded-2xl border bg-white shadow-sm cursor-pointer"
            onClick={() => setActive(featured)}
          >
            <img
              src={featured.bannerUrl}
              alt={featured.title}
              className="w-full h-[280px] sm:h-[360px] object-cover"
            />
            <div className="absolute left-4 top-4">
              <Badge type={featured.type} />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 sm:p-6">
              <h2 className="text-white text-lg sm:text-2xl font-semibold">{featured.title}</h2>
              <p className="mt-1 text-white/80 text-xs sm:text-sm">
                기간: {fmt(featured.startDate)} ~ {fmt(featured.endDate)}
              </p>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-center text-gray-500">불러오는 중...</p>
      ) : (
        tab === "active" ? (
          activeSorted.length === 0 ? (
            <p className="text-center text-gray-500">진행 중/예정인 공개 이벤트가 없습니다.</p>
          ) : (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeSorted
                .filter((p) => !featured || p.id !== featured.id)
                .map((e) => (
                  <EventCard key={e.id} item={e} onOpen={setActive} />
                ))}
            </section>
          )
        ) : (
          endedSorted.length === 0 ? (
            <p className="text-center text-gray-500">완료된 공개 이벤트가 없습니다.</p>
          ) : (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {endedSorted.map((e) => (
                <EventCard key={e.id} item={e} onOpen={setActive} />
              ))}
            </section>
          )
        )
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Badge type={active.type} />
                <h3 className="text-lg font-semibold text-gray-900">{active.title}</h3>
              </div>
              <button
                onClick={close}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            {active.bannerUrl && (
              <img
                src={active.bannerUrl}
                alt={active.title}
                className="max-h-[60vh] w-full object-contain"
              />
            )}
            <div className="space-y-3 py-5">
              {(active.startDate || active.endDate) && (
                <p className="text-sm text-gray-500">
                  기간: {fmt(active.startDate)} ~ {fmt(active.endDate)}
                </p>
              )}
              {active.content && (
                <div className="prose max-w-none text-sm text-gray-800 whitespace-pre-line">
                  {active.content}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t bg-gray-50 pt-3">
              <button
                onClick={close}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Events;