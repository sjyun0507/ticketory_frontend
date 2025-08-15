import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { memberLogin, startKakaoLogin } from "../../api/memberApi.js";
import "./Login.css";
import kakaoLogin from "../../assets/styles/kakao_login_medium_narrow.png";
import { useAuthStore } from '../../store/useAuthStore.js';


const Login = () => {
    const navigate = useNavigate();
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const { data } = await memberLogin({ loginId, password });
            localStorage.setItem("accessToken", data.accessToken);
            useAuthStore.getState().login(data.accessToken);
            navigate("/");
        } catch (err) {
            const status = err?.response?.status;
            const backendMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message;

            if (status === 400 || status === 401) {
                setErrorMsg("아이디 또는 비밀번호가 올바르지 않습니다.");
            } else if (status === 403) {
                setErrorMsg("접근 권한이 없습니다. 관리자에게 문의하세요.");
            } else if (status === 429) {
                setErrorMsg("요청이 너무 잦습니다. 잠시 후 다시 시도하세요.");
            } else if (status >= 500) {
                setErrorMsg("서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
            } else if (err?.request && !err?.response) {
                setErrorMsg("네트워크 오류입니다. 인터넷 연결을 확인하세요.");
            } else {
                setErrorMsg(backendMsg || "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleKakaoLoginClick = () => {
        startKakaoLogin(); // 백엔드 카카오 로그인 시작
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2 className="login-title">로그인</h2>
                {errorMsg && <p className="error-message" role="alert">{errorMsg}</p>}
                <form onSubmit={handleLogin}>
                    <div className="form-group">

                        <input
                            id="loginId"
                            name="loginId"
                            type="email"
                            value={loginId}
                            placeholder="로그인 아이디"
                            onChange={(e) => { setErrorMsg(""); setLoginId(e.target.value); }}
                            className="form-input"
                            required
                        />
                    </div>
                    <div className="form-group">

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => { setErrorMsg(""); setPassword(e.target.value); }}
                            placeholder="비밀번호"
                            className="form-input"
                            required
                        />
                    </div>

                    <button type="submit" className="login-button" disabled={submitting}>
                        {submitting ? "로그인 중..." : "로그인"}
                    </button>
                </form>
                <p className="signup-text">
                    계정이 없으신가요?{" "}
                    <span
                        className="signup-link"
                        onClick={() => navigate("/signup")}
                    >
            회원가입</span>
                </p>
                {/* 소셜 로그인 구분선 */}
                <div className="social-login-separator">소셜 로그인</div>

                {/* 카카오 로그인 버튼 */}
                <div>
                    <button onClick={handleKakaoLoginClick} className="kakao-login-button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        <img src={kakaoLogin} alt="카카오 로그인" style={{ display: "block" }} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;