import React, { useState } from 'react';
import {Link, useNavigate} from 'react-router-dom';
import logo from '../assets/styles/logo2.png';
import user from '../assets/styles/users.png';
import magnifier from '../assets/styles/magnifier.png';
import {useAuthStore} from '../store/useAuthStore.js';
import {memberLogout} from "../api/memberApi.js";

const Header = () => {
    const navigate = useNavigate();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const accessToken = useAuthStore((s) => s.accessToken);
    const isLoggedIn = Boolean(accessToken);

    const getRoleFromToken = () => {
        try {
            if (!accessToken) return null;
            const base64Url = accessToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            const payload = JSON.parse(jsonPayload);
            const claim = payload.role ?? payload.roles ?? payload.authorities;
            if (!claim) return null;
            if (Array.isArray(claim)) {
                const parts = claim.map(item => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object') {
                        return item.role || item.authority || item.name || '';
                    }
                    return String(item || '');
                });
                return parts.filter(Boolean).join(',');
            }
            if (typeof claim === 'object') {
                return claim.role || claim.authority || claim.name || null;
            }
            return String(claim);
        } catch (_) {
            return null;
        }
    };

    const roleStr = (getRoleFromToken() || '').trim().toUpperCase();
    const isAdmin = roleStr.includes('ADMIN');

    const NAV_LINK_CLS = "relative py-2 hover:text-gray-900 after:content-[''] after:absolute after:left-0 after:-bottom-2 after:h-0.5 after:w-0 after:bg-indigo-600 after:transition-all after:duration-200 hover:after:w-full";

    const MenuLink = ({ to, children }) => (
      <Link
        to={to}
        className={NAV_LINK_CLS}
      >
        {children}
      </Link>
    );

    const handleUserClick = () => {
        if (isLoggedIn) {
            navigate('/mypage');
        } else {
            navigate('/login');
        }
    };

    const handleLogout = async () => {
        if (isLoggingOut) return; // 중복 클릭 방지
        const ok = window.confirm('정말 로그아웃 하시겠습니까?');
        if (!ok) return;
        setIsLoggingOut(true);
        try {
            // 1) 서버에 로그아웃 요청 (토큰은 인터셉터로 자동 첨부)
            await memberLogout();
        } catch (e) {
            // 401/403/네트워크 오류여도 프론트 정리는 무조건 진행
            console.info("logout api skipped/failed", e?.response?.status);
        } finally {
            // 2) 로컬스토리지 토큰 제거
            localStorage.removeItem("accessToken");
            // 3) 프론트 정리 (스토어 단일 통로)
            const logout = useAuthStore?.getState?.()?.logout;
            if (typeof logout === 'function') logout();
            const st = useAuthStore?.getState?.();
            if (st) {
              if ('accessToken' in st) st.accessToken = null;
              if ('user' in st) st.user = null;
            }
            // 4) 이동
            navigate('/', { replace: true });
            setIsLoggingOut(false);
        }
    };
    return (
        <header id="header" className="sticky top-0 w-full z-50 bg-white shadow-sm leading-none">
            {/* Top Bar */}
            <div className="w-full">
                <div className="mx-auto max-w-[1200px] px-4 pt-4 mt-0 flex justify-end items-end space-x-2">
                    {isLoggedIn ? (
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            aria-disabled={isLoggingOut}
                            className={`text-xs text-gray-700 font-medium px-1 rounded hover:bg-gray-100 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            로그아웃
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/signup')}
                                className="text-xs text-gray-700 font-medium px-1 rounded hover:bg-gray-100"
                            >
                                회원가입
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="text-xs text-gray-700 font-medium px-1 rounded hover:bg-gray-100"
                            >
                                로그인
                            </button>
                        </>
                    )}
                    {isAdmin && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-xs text-rose-700 font-semibold px-1 rounded hover:bg-rose-50"
                        >
                            관리자
                        </button>
                    )}
                </div>
            </div>

            {/* Main Header */}
            <div className="w-full">
                <div className="max-w-[1200px] mx-auto px-4 pb-1 flex items-center justify-between">
                    {/* 로고 */}
                    <div >
                        <Link to="/" aria-label="홈으로 이동">
                            <img src={logo} alt="Ticketory" className="h-13 w-auto"/>
                        </Link>
                    </div>

                    {/* 메뉴 */}
                    <nav className="flex items-center space-x-9 text-gray-700 text-base md:text-xl font-medium">
                        <MenuLink to="/">영화</MenuLink>
                        <MenuLink to="/booking">예매</MenuLink>
                        <MenuLink to="/screenings">상영시간표</MenuLink>
                        <MenuLink to="/story">스토리</MenuLink>
                        <MenuLink to="/events">이벤트</MenuLink>
                    </nav>

                    {/* 오른쪽 아이콘 */}
                    <div className="flex items-center space-x-2">
                        <button
                            className="p-2 hover:bg-gray-100 rounded"
                            aria-label="검색 열기"
                            onClick={() => navigate('/search')}
                        >
                            <img src={magnifier} alt="검색" className="h-5 w-5"/>
                        </button>
                        <button
                            onClick={handleUserClick}
                            className="p-2 hover:bg-gray-100 rounded"
                            aria-label={isLoggedIn ? '마이페이지로 이동' : '로그인 페이지로 이동'}
                        >
                            <img src={user} alt="사용자" className="h-5 w-5"/>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;