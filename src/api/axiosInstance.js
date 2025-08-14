import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "http://localhost:8080/api", // 백엔드 기본 경로
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true // 쿠키/세션 같이 전송
});

export default axiosInstance;