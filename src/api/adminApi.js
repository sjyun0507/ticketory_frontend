import api from "./axiosInstance";
import qs from "qs";

// Remove empty/NaN params so the server never receives invalid values
const cleanParams = (obj = {}) => Object.fromEntries(
  Object.entries(obj).filter(([_, v]) => (
    v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v))
  ))
);

//영화 목록 (Admin) GET /admin/movies
export async function getAdminMovies(params = {}) {
  // params: { page=0, size=20, q, status, sort }
  const { page = 0, size = 20, ...rest } = params;
  const res = await api.get("/admin/movies", { params: { page, size, ...rest } });
  return res.data;
}

// 상영관 목록 (Admin) GET /admin/screens
export async function getAdminScreens(params = {}) {
  const { page = 0, size = 50, ...rest } = params;
  const res = await api.get("/admin/screen", { params: { page, size, ...rest } });
  return res.data;
}

// 영화 생성 POST /admin/movies
export async function createMovie(payload) {
  // payload 예: { title, originalTitle, overview, releaseDate, runtime, status, genres:[], rating, ... }
  const res = await api.post("/admin/movies", payload);
  return res.data;
}


// 영화 부분 수정 PATCH /admin/movies/{movieId}
export async function patchMovie(movieId, partial) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.patch(`/admin/movies/${movieId}`, partial);
  return res.data;
}

// 영화 삭제(소프트) DELETE /admin/movies/{movieId}
export async function deleteMovie(movieId) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.delete(`/admin/movies/${movieId}`);
  return res.data;
}

/*
 * 영화 이미지 업로드 (포스터/스틸/기타)
 @param {number|string} movieId
 @param {File|Blob}     file
 @param {string|object} typeOrOptions  - "POSTER" | "STILL" | "OTHER" 또는 옵션 객체({ type|kind, title, extra })
 @param {object}        [maybeOptions] - 세 번째 인자를 문자열로 넘긴 경우 추가 옵션({ title, extra })
 */
export async function uploadMovieImage(movieId, file, typeOrOptions, maybeOptions) {
  if (!movieId) throw new Error("movieId is required");
  if (!file) throw new Error("file is required");

  // 인자 정규화: (id, file, "POSTER") 또는 (id, file, { type|kind, ... }) 모두 지원
  let opts = {};
  let type = undefined;
  if (typeof typeOrOptions === "string") {
    type = typeOrOptions; // ex) "POSTER"
    opts = maybeOptions || {};
  } else if (typeof typeOrOptions === "object" && typeOrOptions) {
    opts = typeOrOptions;
    type = opts.type || opts.kind; // 백엔드 요구는 type이지만, kind를 넘겨도 호환
  }
  if (!type) type = "POSTER";

  const form = new FormData();
  // 일부 백엔드는 키 이름을 다르게 받을 수 있어 둘 다 첨부
  form.append("image", file);
  form.append("file", file);
  form.append("type", type); // POSTER | STILL | OTHER

  // 선택 파라미터
  if (opts.title) form.append("title", opts.title);
  if (opts.extra && typeof opts.extra === "object") {
    Object.entries(opts.extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v);
    });
  }

  const res = await api.post(`/admin/movies/${movieId}/media/image`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/*
 * 영화 트레일러(URL) 등록
 @param {number|string} movieId
 @param {string} url                - 트레일러 URL
 @param {object} [meta]             - { title, provider } 등 추가 메타데이터
 */
export async function addMovieTrailer(movieId, url, meta = {}) {
  if (!movieId) throw new Error("movieId is required");
  if (!url) throw new Error("trailer url is required");
  const payload = { url, ...meta };
  const res = await api.post(`/admin/movies/${movieId}/media/trailer`, payload);
  return res.data;
}

// 영화 미디어 목록 조회 GET /admin/movies/{movieId}/media
export async function getMovieMedia(movieId) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.get(`/admin/movies/${movieId}/media`);
  return res.data;
}

// 영화 미디어 삭제 DELETE /admin/media/{mediaId}
export async function deleteMedia(mediaId) {
  if (!mediaId) throw new Error("mediaId is required");
  const res = await api.delete(`/admin/media/${mediaId}`);
  return res.data;
}

// 단건 조회
export async function getAdminMovieById(movieId) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.get(`/admin/movies/${movieId}`);
  return res.data;
}

// status: true(상영중) / false(상영종료)
export async function toggleMovieStatus(movieId, status) {
    const { data } = await api.patch(`/admin/movies/${movieId}`, { status });
    return data;
}
// 관리자: 상영관 요금 규칙 목록 (필터 파라미터 선택적)
export async function getAdminPricing(params = {}) {
  const res = await api.get('/admin/pricing', { params: cleanParams(params) });
  return res.data;
}
// pricing_rule 목록(또는 페이지네이션 content)을 통일된 배열로 리턴
export async function getPricingRules(screenId) {
  try {
    const sid = Number(screenId);
    if (!Number.isFinite(sid)) {
      console.warn('[adminApi] getPricingRules skipped: invalid screenId ->', screenId);
      return []; // do not call backend with NaN
    }
    const res = await api.get('/admin/pricing', { params: { screenId: sid } });
    const raw = res?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.content)) return raw.content;
    return [];
  } catch (e) {
    console.warn('[adminApi] getPricingRules failed', e?.response?.status, e?.response?.data || e);
    return []; // 프론트는 기본가로 폴백
  }
}

// pricing_rule 등록, 갱신
export const upsertAdminPricing = async (payload) => {
    const { data } = await api.put('/admin/pricing', payload);
    return data;
};

// pricing_rule 삭제
export const deleteAdminPricing = async (id) => {
  const rid = Number(id);
  if (!Number.isFinite(rid)) throw new Error('deleteAdminPricing: invalid id');
  const { data } = await api.delete('/admin/pricing', { params: { id: rid } });
  return data;
};

// 수요일 글로벌 할인 규칙 생성
export const createWednesdayDiscount = ({ from, to, percent, kinds }) => {
    return api.post('/admin/pricing/global/wed-discount', null, {
        params: { from, to, percent, ...(kinds?.length ? { kinds } : {}) },
        paramsSerializer: p => qs.stringify(p, { arrayFormat: 'repeat' }),
    });
};


// 상영관리
export const fetchScreenings = () =>
    api.get("/admin/screenings", { params: { page: 0, size: 999 } });

export const createScreening = (payload) =>
    api.post("/admin/screenings", payload);

export const updateScreening = (id, payload) =>
    api.put(`/admin/screenings/${id}`, payload);

export const deleteScreening = (id) =>
    api.delete(`/admin/screenings/${id}`);

// 이벤트/공지 게시판
export const getBoards = () => api.get("/board");
export const createBoard = (payload) => api.post("/admin/board", payload);
export const updateBoard = (id, payload) => api.put(`/admin/board/${id}`, payload);
export const deleteBoard = (id) => api.delete(`/admin/board/${id}`);

// 매출통계
export const getStatsSummary = (params) =>
    api.get('/admin/stats/summary', { params });

export const getDailyRevenue = (params) =>
    api.get('/admin/stats/revenue/daily', { params });

export const getTopMovies = (params) =>
    api.get('/admin/stats/top-movies', { params });