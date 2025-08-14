import React from 'react';
import './Header.css';
import {Link, useNavigate} from "react-router-dom";
import logo from '../assets/styles/logo.png';
import user from '../assets/styles/users.png';
import magnifier from '../assets/styles/magnifier.png';

const Header = () => {
    const navigate = useNavigate();

    const isLoggedIn = Boolean(localStorage.getItem("accessToken"));

    const handleUserClick = () => {
        console.log("click", isLoggedIn)
        if (isLoggedIn) {
            navigate("/myPage");
        } else {
            navigate("/login");
        }
    };
    return (

        <header id="header">
            <header className="fixed top-0 w-full z-50">
                {/* Top Bar */}
                <div className="w-full bg-white shadow-sm">
                    <div className="max-w-[1200px] mx-auto px-4  mt-1.5 flex justify-end items-center space-x-2">
                        {isLoggedIn ? (
                            <button
                                onClick={() => {
                                    localStorage.removeItem("accessToken"); // 로그아웃 처리
                                    navigate("/"); // 홈으로 이동
                                }}
                                className="text-xs text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100"
                            >
                                로그아웃
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="text-xs text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100"
                                >
                                    회원가입
                                </button>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-xs text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100"
                                >
                                    로그인
                                </button>

                            </>
                        )}
                    </div>
                </div>

                {/* Main Header */}
                <div className="w-full bg-white shadow-sm">
                    <div className="max-w-[1200px] mx-auto px-4 py-1 flex items-center justify-between">
                        {/* 로고 */}
                        <div>
                            <img src={logo} alt="Ticketory" className="h-11 w-auto"/>
                        </div>

                        {/* 메뉴 */}
                        <nav className="flex items-center space-x-6  text-gray-700 text-xl">
                            <Link to="/">영화</Link>
                            <Link to="/booking">빠른예매</Link>
                            <Link to="/screenings/:id">상영시간표</Link>
                        </nav>

                        {/* 오른쪽 아이콘 */}
                        <div className="flex items-center space-x-2">
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <img src={magnifier} alt="검색" className="h-6 w-6"/>
                            </button>
                            <button onClick={handleUserClick} className="p-1 hover:bg-gray-100 rounded">
                                <img src={user} alt="사용자" className="h-6 w-6"/>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        </header>
    );
};

export default Header;