import { useAuthStore } from "../../store/useAuthStore.js";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function KakaoRedirectHandler() {
    const navigate = useNavigate();

    useEffect(() => {
      const token = new URL(window.location.href).searchParams.get("token");
      if (token) {
        localStorage.setItem("accessToken", token);
        // 전역 인증 상태 갱신 (Header가 즉시 반응)
        useAuthStore.getState().login(token);
        navigate("/", { replace: true });
      } else {
        console.warn("카카오 로그인 토큰이 없습니다.");
        navigate("/login", { replace: true });
      }
    }, [navigate]);

    return null;
}