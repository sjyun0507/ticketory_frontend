import api from "./axiosInstance";

/** 영화 목록 (Admin) GET /admin/movies */
export async function getAdminMovies(params = {}) {
  // params: { page=0, size=20, q, status, sort }
  const { page = 0, size = 20, ...rest } = params;
  const res = await api.get("/admin/movies", { params: { page, size, ...rest } });
  return res.data;
}

// 영화 생성 POST /admin/movies
export async function createMovie(payload) {
  // payload 예: { title, originalTitle, overview, releaseDate, runtime, status, genres:[], rating, ... }
  const res = await api.post("/admin/movies", payload);
  return res.data;
}

// 영화 수정(전체) PUT /admin/movies/{movieId}
export async function updateMovie(movieId, payload) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.put(`/admin/movies/${movieId}`, payload);
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

/**
 * 영화 이미지 업로드 (포스터/스틸/기타)
 * POST /admin/movies/{movieId}/media/image
 * @param {number|string} movieId
 * @param {File|Blob} file           - 이미지 파일
 * @param {object} options
 * @param {"POSTER"|"STILL"|"OTHER"} [options.kind="POSTER"] - 미디어 구분
 * @param {string} [options.title]    - 이미지 제목/설명
 * @param {object} [options.extra]    - 백엔드가 추가로 받는 필드들(form-data로 함께 전송)
 */
export async function uploadMovieImage(movieId, file, options = {}) {
  if (!movieId) throw new Error("movieId is required");
  if (!file) throw new Error("file is required");

  const { kind = "POSTER", title, extra } = options;
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  if (title) form.append("title", title);
  if (extra && typeof extra === "object") {
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v);
    });
  }

  const res = await api.post(`/admin/movies/${movieId}/media/image`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/**
 * 영화 트레일러(URL) 등록
 * POST /admin/movies/{movieId}/media/trailer
 * @param {number|string} movieId
 * @param {string} url                - 트레일러 URL
 * @param {object} [meta]             - { title, provider } 등 추가 메타데이터
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

// (선택) 단건 조회가 필요하면 사용: GET /admin/movies/{movieId}
export async function getAdminMovieById(movieId) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.get(`/admin/movies/${movieId}`);
  return res.data;
}

// (선택) 상태 토글 등 간단 액션 패턴
export async function toggleMovieStatus(movieId, enabled) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.patch(`/admin/movies/${movieId}`, { enabled });
  return res.data;
}

// pricing_rule 목록(또는 페이지네이션 content)을 통일된 배열로 리턴
export async function getPricingRules(screenId) {
    try {
        const res = await api.get('/admin/pricing', { params: { screenId: Number(screenId) } });
        const raw = res?.data;
        if (Array.isArray(raw)) return raw;
        if (raw && Array.isArray(raw.content)) return raw.content;
        return [];
    } catch (e) {
        console.warn('[adminApi] getPricingRules failed', e?.response?.status, e?.response?.data || e);
        return []; // 프론트는 기본가로 폴백
    }
}