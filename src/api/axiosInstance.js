// src/api/axiosInstance.js
import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);
const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const apiClient = axios.create({
    baseURL: DEFAULT_BASE_URL,
    withCredentials: false,   // JWT 헤더 방식
    timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
    // 상대경로만 baseURL 적용되도록 정리
    if (!isAbsoluteUrl(config.url)) {
        const path = (config.url ?? "").replace(/\/{2,}/g, "/");
        config.url = path.startsWith("/") ? path : `/${path}`;
    }

    // Authorization 주입 (token | accessToken 지원)
    const { token, accessToken } = useAuthStore.getState();
    const t = token || accessToken;
    if (t) {
      config.headers = config.headers || {};
      config.headers.Authorization = /^Bearer\s+/i.test(t) ? t : `Bearer ${t}`;
    }
    // 개발용 요청 로그
    try {
      const method = (config.method || 'get').toUpperCase();
      const path = config.url;
      console.info('[HTTP:REQ]', method, path, 'auth=', !!t);
    } catch {}
    return config;
});

apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      const loc = err?.response?.headers?.location;
      const url = err?.config?.url;
      console.warn('[HTTP:ERR]', status ?? '-', 'url=', url ?? '-', 'location=', loc ?? '-');
      if (status === 401) {
        // 필요시 여기서 로그아웃/리프레시 처리
        // useAuthStore.getState().logout();
      }
      return Promise.reject(err);
    }
);

export default apiClient;