// src/api/axiosInstance.js
import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);
const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

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

    // Authorization 주입
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) {
            // 필요시 여기서 로그아웃/리프레시 처리
            // useAuthStore.getState().logout();
        }
        return Promise.reject(err);
    }
);

export default apiClient;