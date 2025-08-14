import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {login} from "../api/memberApi.js";
import "./Login.css";

const Login = () => {
    const navigate = useNavigate();
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await login({loginId, password});
            // 로그인 성공 시 토큰 저장
            localStorage.setItem("accessToken", response.data.accessToken);
            navigate("/"); // 로그인 후 홈화면 이동
        } catch (error) {
            console.error(error);
            setErrorMsg("로그인 실패. 아이디와 비밀번호를 확인하세요.");
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2 className="login-title">로그인</h2>
                {errorMsg && <p className="error-message">{errorMsg}</p>}
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="loginId" className="form-label">아이디</label>
                        <input
                            id="loginId"
                            name="loginId"
                            type="email"
                            value={loginId}
                            placeholder="로그인 아이디"
                            onChange={(e) => setLoginId(e.target.value)}
                            className="form-input"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password" className="form-label">비밀번호</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="비밀번호"
                            className="form-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                    >
                        로그인
                    </button>
                </form>
                <p className="signup-text">
                    계정이 없으신가요?{" "}
                    <span
                        className="signup-link"
                        onClick={() => navigate("/signup")}
                    >
            회원가입
          </span>
                </p>
            </div>
        </div>
    );
};

export default Login;