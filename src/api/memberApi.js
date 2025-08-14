import axiosInstance from "./axiosInstance";

// 회원가입 API
export const signup = (data) => {
    return axiosInstance.post("/members/signup", data);
};
// 로그인 API
export const login = (data) => {
    return axiosInstance.post("/members/login", data);
};
// 아이디(이메일) 중복확인 -> true: 사용 가능, false: 사용 불가
export async function checkLoginId(loginId) {
    const trimmed = (loginId ?? "").trim();
    const { data } = await axiosInstance.get("/members/exists", {
        params: { loginId: trimmed },
    });
    return Boolean(data?.available);
}

//카카오 로그인 API
export const kakaoLogin = (data) => {
    return axiosInstance.post("/members/kakao", data);
};

export const startKakaoLogin = () => {
    // 브라우저를 백엔드 카카오 로그인 시작 URL로 이동 (전체 페이지 이동)
    const backendHost = import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8080";
    const authUrl = `${backendHost}/oauth2/authorization/kakao`;
    window.location.href = authUrl;
};
