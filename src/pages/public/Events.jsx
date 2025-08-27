import React from "react";

// 간단한 날짜 포맷터 (YYYY.MM.DD)
const fmt = (d) => new Date(d).toISOString().slice(0, 10).replaceAll("-", ".");

// 샘플 이벤트 데이터 (이미지 경로는 상황에 맞게 교체 가능)
const FEATURED_POSTER =
  "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?q=80&w=1600&auto=format&fit=crop"; // 포스터 1장

const EVENTS = [
  {
    id: 1,
    kind: "이벤트", // 뱃지 컬러: 보라계열
    title: "〈국장판 귀멸의 칼날: 무한성편〉 돌비 포스터 증정",
    period: { start: "2025-08-27", end: "2025-09-30" },
    image:
      "https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 2,
    kind: "이벤트",
    title: "〈엔하이픈 콘서트: 이머전〉 캔음료 증정 상영회",
    period: { start: "2025-08-29", end: "2025-08-29" },
    image:
      "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 3,
    kind: "공지", // 뱃지 컬러: 하늘/블루계열
    title: "메가박스 아트그래피 〈첫사랑 엔딩〉 상영 안내",
    period: { start: "2025-08-30", end: "2025-08-31" },
    image:
      "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 4,
    kind: "이벤트",
    title: "〈3670〉 작가와의 메가토크",
    period: { start: "2025-09-03", end: "2025-09-03" },
    image:
      "https://images.unsplash.com/photo-1497032205916-ac775f0649ae?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 5,
    kind: "공지",
    title: "〈라이브뷰잉〉 대운항 명고 라이브 상영 안내",
    period: { start: "2025-09-12", end: "2025-09-12" },
    image:
      "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?q=80&w=800&auto=format&fit=crop",
  },
];

const Badge = ({ kind }) => {
  const isEvent = kind === "이벤트";
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border";
  const color = isEvent
    ? "bg-purple-50 border-purple-200 text-purple-700"
    : "bg-sky-50 border-sky-200 text-sky-700";
  return <span className={`${base} ${color}`}>{kind}</span>;
};

const EventCard = ({ item }) => {
  return (
    <article className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute left-3 top-3">
          <Badge kind={item.kind} />
        </div>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-sm sm:text-base font-semibold text-gray-900">
          {item.title}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500">
          {fmt(item.period.start)} ~ {fmt(item.period.end)}
        </p>
      </div>
    </article>
  );
};

const Events = () => {
  return (
    <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
      {/* 헤더 */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">이벤트</h1>
          <p className="mt-1 text-gray-500 text-sm">공지와 이벤트를 한눈에 확인하세요.</p>
        </div>
      </header>

      {/* 메인 포스터 (1장) */}
      <section className="mb-10">
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
          <img
            src={FEATURED_POSTER}
            alt="featured poster"
            className="w-full h-[280px] sm:h-[360px] object-cover"
          />
          <div className="absolute left-4 top-4">
            <Badge kind="이벤트" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 sm:p-6">
            <h2 className="text-white text-lg sm:text-2xl font-semibold">
              특별 상영 & 굿즈 증정 이벤트
            </h2>
            <p className="mt-1 text-white/80 text-xs sm:text-sm">기간: 2025.08.27 ~ 2025.09.30</p>
          </div>
        </div>
      </section>

      {/* 이벤트 카드 그리드 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {EVENTS.map((e) => (
          <EventCard key={e.id} item={e} />
        ))}
      </section>
    </main>
  );
};

export default Events;