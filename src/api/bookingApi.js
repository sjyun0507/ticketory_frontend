import api from "./axiosInstance.js";

// 상영 시간 조회 API (전 페이지 수집 지원)
export const getScreenings = async (date, movieId, opts = {}) => {
  const baseParams = { date };
  if (movieId !== null && movieId !== undefined && movieId !== "") {
    baseParams.movieId = movieId;
  }

  const size = opts.size ?? 200;
  let page = opts.page ?? 0;

  // 단일 페이지 모드
  if (!opts.allPages) {
    const params = { ...baseParams, page, size };
    const { data } = await api.get("/screenings", { params });
    const list = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.content)
        ? data.content
        : (Array.isArray(data) ? data : []);
    return list;
  }

  const MAX_PAGES = opts.maxPages ?? 20; // 안전장치
  const all = [];
  const seen = new Set(); // screeningId/id 중복 감지
  let totalPages = null;

  for (let i = 0; i < MAX_PAGES; i += 1) {
    const params = { ...baseParams, page, size };

    const { data } = await api.get("/screenings", { params });

    // items/content/배열 대응
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.content)
        ? data.content
        : (Array.isArray(data) ? data : []);

    const before = seen.size;
    for (const it of items) {
      const key = (it?.screeningId ?? it?.id ?? `${page}:${all.length}`);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(it);
      }
    }
    const added = seen.size - before;

    // 더 이상 새로 추가되는 항목이 없으면 중단 (page 파라미터 무시 서버 보호)
    if (added === 0) break;

    page += 1;
  }

  return all;
};



//예약 HOLD를 해제(취소)
export async function releaseBookingHold(bookingId) {
  if (!bookingId) return;
  return api.delete(`/bookings/${bookingId}/cancel`);
}