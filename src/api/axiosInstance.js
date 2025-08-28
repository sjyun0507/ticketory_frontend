import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

export const apiClient = axios.create({
    baseURL: DEFAULT_BASE_URL,   // 상대경로에만 적용됨
    withCredentials: false,      // 쿠키/세션 미사용(JWT 헤더 방식이면 false가 맞음)
    timeout: 10000,
});

// 요청 인터셉터: 토큰 자동 주입 + 절대 URL은 baseURL 미적용
apiClient.interceptors.request.use((config) => {
    // 1) URL 정리: '/api/...' 형태만 baseURL 적용되게. (절대 URL 그대로)
    if (isAbsoluteUrl(config.url)) {
        // 절대경로면 baseURL 영향 없음
    } else {
        // 혹시 실수로 'api/api' 되는 케이스 방지 (앞뒤 슬래시 정리)
        const path = config.url?.replace(/\/{2,}/g, "/");
        config.url = path.startsWith("/") ? path : `/${path}`;
    }

    // 2) Authorization 헤더
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers = config.headers || {};
        // 백엔드가 'Bearer ' 접두사 기대하는지 확인! (보통 기대함)
        if (!/^Bearer\s+/i.test(token)) {
            config.headers.Authorization = `Bearer ${token}`;
        } else {
            config.headers.Authorization = token;
        }
    }

    return config;
});

// 응답 인터셉터(선택): 401 시 처리(여기선 일단 로그만)
apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) {
            // 여기서 토큰 만료 처리/로그아웃/리프레시 트리거 가능
            // useAuthStore.getState().logout();
        }
        return Promise.reject(err);
    }
);

export default apiClient;