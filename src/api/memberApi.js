import api from "./axiosInstance";

// 회원가입 API
export const memberSignup = (data) => api.post("/members/signup", data);

// 로그인 API
export const memberLogin = (data) => api.post("/members/login", data);

// 아이디(이메일) 중복확인 -> true: 사용 가능, false: 사용 불가
export const checkLoginId = (loginId) =>
    api.get("/members/exists", { params: { loginId: (loginId ?? "").trim() } })
        .then(({ data }) => Boolean(data?.available));

// 카카오 로그인 API
export const kakaoLogin = (data) => api.post("/members/kakao", data);

// 카카오 로그인 시작
export const startKakaoLogin = () =>
    window.location.href = new URL("/oauth2/authorization/kakao",
        import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8080"
    ).toString();

// 마이페이지 API
export const getMyInfo = (memberId) => api.get(`/members/${memberId}`).then(res => res.data);

// 로그아웃 API
export const memberLogout = () => api.post("/members/logout");

// 내 정보 수정
export const updateMember = async (memberId, payload) => {
    const { data } = await api.put(`/members/${memberId}`, payload);
    return data;
};

// 내 정보 삭제
export const deleteMember = async (memberId,payload) => {
    const { data } = await api.delete(`/members/${memberId}`,payload);
    return data;
};

// 회원 ID로 포인트 조회
export const getMemberPoints = async ({
                                          memberId,
                                          page = 0,
                                          size = 10,
                                          type,       // optional
                                          from,       // optional
                                          to,         // optional
                                          sort = "createdAt,desc",
                                      }) => {
    const params = { page, size, sort };
    if (type) params.type = type;
    if (from) params.from = from;
    if (to) params.to = to;

    const { data } = await api.get(`/members/${memberId}/points`, { params });
    return data;
};

