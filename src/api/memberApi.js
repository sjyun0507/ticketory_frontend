import axiosInstance from "./axiosInstance";

// 회원가입 API
export const signup = (data) => {
    return axiosInstance.post("/members/", data);
};
// 로그인 API
export const login = (data) => {
    return axiosInstance.post("/members/login", data);
};
// 아이디(이메일) 중복확인 -> true: 사용 가능, false: 사용 불가
// export async function checkLoginId(loginId) {
//     const trimmed = (loginId ?? "").trim();
//     const { data } = await axiosInstance.get("/members/exists", {
//         params: { loginId: trimmed },
//     });
//     return Boolean(data?.available);
// }
