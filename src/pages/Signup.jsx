import {useState} from "react";
import {checkLoginId, signup} from "../api/memberApi.js";
import {useNavigate} from "react-router-dom";
import "./Signup.css";


export default function SignupPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        loginId: "",
        name: "",
        email: "",
        password: "",
        phone: "",
    });
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [isCheckingId, setIsCheckingId] = useState(false);
    const [isIdAvailable, setIsIdAvailable] = useState(null); // null: 미확인, true/false: 확인 결과
    const [idCheckMessage, setIdCheckMessage] = useState("");

    const handleChange = e => {
        const {name, value} = e.target;
        if (name === "passwordConfirm") {
            setPasswordConfirm(value);
        } else {
            setForm(prev => ({...prev, [name]: value}));
        }
        if (name === "loginId") {
            // 아이디가 바뀌면 이전 중복확인 결과는 무효화
            setIsIdAvailable(null);
            setIdCheckMessage("");
        }

    };

    const handleIdCheck = async () => {
        if (!form.loginId) {
            setIdCheckMessage("아이디(이메일)를 입력하세요.");
            setIsIdAvailable(null);
            return;
        }
        // 예: 이메일 형식 간단 검증(프로젝트 정책에 맞게 조정)
        const emailLike = /\S+@\S+\.\S+/.test(form.loginId);
        if (!emailLike) {
            setIdCheckMessage("올바른 이메일 형식이 아닙니다.");
            setIsIdAvailable(null);
            return;
        }

        try {
            setIsCheckingId(true);
            setIdCheckMessage("");

            const available = await checkLoginId(form.loginId);

            if (available) {
                setIsIdAvailable(true);
                setIdCheckMessage("사용 가능한 아이디입니다.");
            } else {
                setIsIdAvailable(false);
                setIdCheckMessage("이미 사용 중인 아이디입니다.");
            }
        } catch (e) {
            console.error(e);
            setIsIdAvailable(null);
            setIdCheckMessage("중복확인에 실패했습니다. 잠시 후 다시 시도하세요.");
        } finally {
            setIsCheckingId(false);
        }
    };


    const handleSubmit = async e => {
        e.preventDefault();
        if (form.password !== passwordConfirm) {
            alert("비밀번호가 일치하지 않습니다.");
            return;
        }
        try {
            const res = await signup(form); // API 호출
            alert("회원가입 성공!");
            console.log(res.data);
            navigate("/"); // 로그인 후 홈화면 이동
        } catch (error) {
            console.error(error);
            if (error.response) {
                const status = error.response.status;
                if (status === 409) {
                    alert("이미 사용 중인 아이디입니다. 다른 아이디를 입력하세요.");
                } else if (status === 401) {
                    alert("인증 오류: 관리자에게 문의하세요.");
                } else if (status === 400) {
                    alert("입력값이 잘못되었습니다.");
                } else {
                    alert("회원가입 실패: 서버 오류");
                }
            } else {
                alert("서버와 연결할 수 없습니다.");
            }
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <h2 className="signup-title">회원가입</h2>
                <div className="mb-1">
                    <div className={`min-h-10 transition-all`}>
                        {idCheckMessage && (
                            <div
                                aria-live="polite"
                                style={{marginTop: 4,
                                    color: isIdAvailable === true ? "green"
                                        : isIdAvailable === false ? "red" : "#666",
                                }}
                            >
                                {idCheckMessage}
                            </div>
                        )}
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="signup-form">


                    <label htmlFor="loginId" className="form-label">아이디</label>
                    <div className="id-check-group">
                        <input
                            id="loginId"
                            name="loginId"
                            value={form.loginId}
                            onChange={handleChange}
                            placeholder="이메일"
                            required
                            className="form-input"
                        />
                        <button type="button" className="id-check-button" onClick={handleIdCheck}
                                disabled={isCheckingId || !form.loginId}>
                            {isCheckingId ? "확인중..." : "중복확인"}</button>
                    </div>

                    <label htmlFor="password" className="form-label">비밀번호</label>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="비밀번호 8~24자"
                        autoComplete="new-password"
                        className="form-input"
                    />

                    <label htmlFor="passwordConfirm" className="form-label">비밀번호 확인</label>
                    <input
                        id="passwordConfirm"
                        type="password"
                        name="passwordConfirm"
                        value={passwordConfirm}
                        onChange={handleChange}
                        placeholder="비밀번호 확인"
                        autoComplete="new-password"
                        className="form-input"
                    />

                    <label htmlFor="name" className="form-label">이름</label>
                    <input
                        id="name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="이름"
                        required
                        className="form-input"
                    />

                    <label htmlFor="email" className="form-label">이메일</label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="추가 이메일(선택)"
                        className="form-input"
                    />

                    <label htmlFor="phone" className="form-label">휴대폰 번호</label>
                    <input
                        id="phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="휴대폰번호"
                        className="form-input"
                    />

                    <button
                        type="submit"
                        className="form-button"
                    >
                        회원가입
                    </button>
                </form>
                <p className="signup-footer">
                    이미 계정이 있으신가요? <a href="/login">로그인</a>
                </p>
            </div>
        </div>
    );
}
