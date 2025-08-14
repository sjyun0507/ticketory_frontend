import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function KakaoRedirectHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        const token = new URL(window.location.href).searchParams.get("token");
        if (token) {
            localStorage.setItem("accessToken", token);
            navigate("/");
        } else {
            alert("카카오 로그인 실패");
            navigate("/login");
        }
    }, [navigate]);

    return <div>카카오 로그인 처리 중...</div>;
}