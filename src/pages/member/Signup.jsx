import {useState} from "react";
import { checkLoginId, memberSignup } from "../../api/memberApi.js";
import {useNavigate} from "react-router-dom";
import "./Signup.css";

export default function Signup() {
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
    const [submitting, setSubmitting] = useState(false);
    const [idCheckMessage, setIdCheckMessage] = useState("");

    // 동의 항목 상태 추가
    const [agreements, setAgreements] = useState({
        age: false,       // [필수] 만 14세 이상
        terms: false,     // [필수] 이용약관 동의
        marketing: false, // [선택] 마케팅 정보 수신 동의
    });

    // 파생 상태
    const requiredOk = agreements.age && agreements.terms;
    const allAgree = agreements.age && agreements.terms && agreements.marketing;

    const handleChange = e => {
        const {name, value} = e.target;
        if (name === "passwordConfirm") {
            setPasswordConfirm(value);
        } else {
            if (name === "loginId") {
                const normalized = value.trim().toLowerCase();
                setForm(prev => ({ ...prev, loginId: normalized }));
                // 아이디가 바뀌면 이전 중복확인 결과는 무효화
                setIsIdAvailable(null);
                setIdCheckMessage("");
                return;
            }
            setForm(prev => ({...prev, [name]: value}));
        }

    };

    // 전체 동의 토글
    const handleToggleAllAgree = (e) => {
        const checked = e.target.checked;
        setAgreements({
            age: checked,
            terms: checked,
            marketing: checked,
        });
    };

    // 개별 항목 토글
    const handleToggleAgreement = (key) => (e) => {
        const checked = e.target.checked;
        setAgreements(prev => ({ ...prev, [key]: checked }));
    };

    const handleIdCheck = async () => {
        if (!form.loginId) {
            setIdCheckMessage("아이디(이메일)를 입력하세요.");
            setIsIdAvailable(null);
            return;
        }
        // 이메일 형식 검증 (간단 버전)
        const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.loginId);
        if (!emailLike) {
            setIdCheckMessage("올바른 이메일 형식이 아닙니다.");
            setIsIdAvailable(false);
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

        if (submitting) return;

        // 필수 동의 체크
        if (!requiredOk) {
            alert("필수 항목(만 14세 이상, 이용약관)에 동의해 주세요.");
            return;
        }

        // 값 정리
        const payload = {
            ...form,
            loginId: (form.loginId || "").trim().toLowerCase(),
            name: (form.name || "").trim(),
            email: (form.email || "").trim(),
            phone: (form.phone || "").trim(),
        };

        // 기본 검증
        const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.loginId);
        if (!emailLike) {
            alert("아이디는 이메일 형식이어야 합니다.");
            return;
        }

        if (!payload.password || payload.password.length < 8 || payload.password.length > 24) {
            alert("비밀번호는 8~24자여야 합니다.");
            return;
        }

        if (payload.password !== passwordConfirm) {
            alert("비밀번호가 일치하지 않습니다.");
            return;
        }

        // 중복확인 통과 필요
        if (isIdAvailable !== true) {
            alert("아이디 중복확인을 먼저 진행해 주세요.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await memberSignup(payload); // API 호출
            alert("회원가입 성공! 로그인 후 이용해주세요");
            console.log(res.data);
            navigate("/Login"); // 로그인화면 이동
        } catch (error) {
            console.error(error);
            if (error.response) {
                const status = error.response.status;
                if (status === 409) {
                    alert("이미 사용 중인 아이디입니다. 다른 아이디를 입력하세요.");
                    setIsIdAvailable(false);
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
        } finally {
            setSubmitting(false);
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
                                role="status"
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


                    <label htmlFor="loginId" className="form-label">아이디(이메일)</label>
                    <div className="id-check-group">
                      <input
                          id="loginId"
                          name="loginId"
                          type="email"
                          inputMode="email"
                          autoComplete="username"
                          value={form.loginId}
                          onChange={handleChange}
                          placeholder="아이디(이메일)"
                          required
                          aria-invalid={isIdAvailable === false}
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
                        minLength={8}
                        maxLength={24}
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

                    <label htmlFor="phone" className="form-label">휴대폰 번호</label>
                    <input
                        id="phone"
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="휴대폰번호(필수)"
                        className="form-input"
                        required
                    />

                    <label htmlFor="email" className="form-label">이메일</label>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="이메일추가(선택)"
                        className="form-input"
                    />
                    <div className="agreement-container">
                        <h3 className="agreement-title">개인정보 수집 이용 동의 안내</h3>

                        <p className="subtext">
                            전체 동의에는 필수 및 선택 정보에 대한 동의가 포함되어 있으며, 선택 항목에 대한 동의를 거부하시는 경우에도 서비스 이용이 가능합니다.
                        </p>
                        <label className="check-all">
                            <input
                                type="checkbox"
                                id="all-agree"
                                checked={allAgree}
                                onChange={handleToggleAllAgree}
                            />{" "}
                            <strong>모두 확인하였으며 동의합니다.</strong>
                        </label>
                        <div className="agreement-box">
                            <label htmlFor="agree-age">
                                <input
                                    id="agree-age"
                                    type="checkbox"
                                    className="agree"
                                    checked={agreements.age}
                                    onChange={handleToggleAgreement("age")}
                                />{" "}
                                [필수] 만 14세 이상입니다
                            </label>

                            <label htmlFor="agree-terms">
                                <input
                                    id="agree-terms"
                                    type="checkbox"
                                    className="agree"
                                    checked={agreements.terms}
                                    onChange={handleToggleAgreement("terms")}
                                />{" "}
                                [필수] 이용약관 동의
                            </label>

                            <label htmlFor="agree-marketing">
                                <input
                                    id="agree-marketing"
                                    type="checkbox"
                                    className="agree"
                                    checked={agreements.marketing}
                                    onChange={handleToggleAgreement("marketing")}
                                />{" "}
                                [선택] 마케팅 정보 수신 동의
                            </label>

                        </div>
                    </div>
                    <button
                        type="submit"
                        className="form-button"
                        disabled={submitting || isIdAvailable !== true || !requiredOk}
                    >
                        {submitting ? "가입 중..." : "회원가입"}
                    </button>
                </form>
                <p className="signup-footer">
                    이미 계정이 있으신가요? <a href="/member/Login">로그인</a>
                </p>
            </div>
        </div>
    );
}
