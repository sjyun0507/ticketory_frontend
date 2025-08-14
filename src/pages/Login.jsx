import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {login} from "../api/memberApi.js";

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
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded shadow">
                <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>
                {errorMsg && <p className="text-red-500 mb-4">{errorMsg}</p>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block mb-1 font-semibold">아이디</label>
                        <input
                            type="email"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-semibold">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition"
                    >
                        로그인
                    </button>
                </form>
                <p className="mt-4 text-center text-gray-600">
                    계정이 없으신가요?{" "}
                    <span
                        className="text-blue-500 cursor-pointer"
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