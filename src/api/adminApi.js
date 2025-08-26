import api from "./axiosInstance";

//영화 목록 (Admin) GET /admin/movies
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
 *
 * 사용 예:
 *  uploadMovieImage(12, file, "POSTER")
 *  uploadMovieImage(12, file, { type: "STILL", title: "Scene 1" })
 *  uploadMovieImage(12, file, { kind: "OTHER" }) // kind도 허용(서버는 type 필수)
 *
 * @param {number|string} movieId
 * @param {File|Blob}     file
 * @param {string|object} typeOrOptions  - "POSTER" | "STILL" | "OTHER" 또는 옵션 객체({ type|kind, title, extra })
 * @param {object}        [maybeOptions] - 세 번째 인자를 문자열로 넘긴 경우 추가 옵션({ title, extra })
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

// 단건 조회
export async function getAdminMovieById(movieId) {
  if (!movieId) throw new Error("movieId is required");
  const res = await api.get(`/admin/movies/${movieId}`);
  return res.data;
}

// status: true(상영중) / false(상영종료)
// 백엔드: PATCH /api/admin/movies/{id}  Body: { status: boolean }
export async function toggleMovieStatus(movieId, status) {
    const { data } = await api.patch(`/admin/movies/${movieId}`, { status });
    return data;
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