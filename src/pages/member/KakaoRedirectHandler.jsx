import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore.js";

export default function KakaoRedirectHandler() {
  const navigate = useNavigate();
  const didRun = useRef(false); // React 18 StrictMode에서 이펙트 2회 호출 방지

  useEffect(() => {
    if (didRun.current) return; // ⛔ 중복 실행 방지
    didRun.current = true;

    try {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("token");

      if (token) {
        // 로컬 저장 (선택)
        localStorage.setItem("accessToken", token);

        // 전역 인증 상태 갱신 (Header 등 구독자들이 반응)
        const store = useAuthStore.getState();
        if (typeof store.login === "function") {
          store.login(token); // 내부에서 set({ token, user ... }) 등 수행한다고 가정
        } else if (typeof store.setToken === "function") {
          store.setToken(token);
        }

        // 성공 시 한 번만 이동
        navigate("/mypage", { replace: true });
      } else {
        console.warn("카카오 로그인 토큰이 없습니다.");
        navigate("/login", { replace: true });
      }
    } catch (e) {
      navigate("/login?error=social", { replace: true });
    }
  }, [navigate]);

  return null; // 필요 시 로딩 UI로 교체 가능
}