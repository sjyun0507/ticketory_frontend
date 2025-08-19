import axiosInstance from "./axiosInstance.js";

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
    if (opts.debug) console.info("[sched] /screenings params", params);
    const { data } = await axiosInstance.get("/screenings", { params });
    const list = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.content)
        ? data.content
        : (Array.isArray(data) ? data : []);
    return list;
  }

  // ✅ 전 페이지 수집 모드 (page 무시 서버도 대응)
  const MAX_PAGES = opts.maxPages ?? 20; // 안전장치
  const all = [];
  const seen = new Set(); // screeningId/id 중복 감지
  let totalPages = null;

  for (let i = 0; i < MAX_PAGES; i += 1) {
    const params = { ...baseParams, page, size };
    if (opts.debug) console.info("[sched] /screenings params", params);

    const { data } = await axiosInstance.get("/screenings", { params });

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

    // 페이지 정보가 있으면 활용
    if (typeof data?.totalPages === "number") {
      totalPages = data.totalPages;
      if (opts.debug) console.info("[sched] page", page, "of", totalPages, "got", items.length, "added", added, "cum", all.length, "totalElements", data?.totalElements);
      if (page + 1 >= totalPages) break;
    } else {
      if (opts.debug) console.info("[sched] page", page, "got", items.length, "added", added, "cum", all.length);
    }

    // 더 이상 새로 추가되는 항목이 없으면 중단 (page 파라미터 무시 서버 보호)
    if (added === 0) break;

    page += 1;
  }

  if (opts.debug) console.info("[sched] all pages collected", { count: all.length, totalPages });
  return all;
};