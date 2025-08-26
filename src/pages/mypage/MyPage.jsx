import React, { useEffect, useState } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { getMyInfo } from '../../api/memberApi.js';
import { getBookingDetail } from '../../api/bookingApi.js';
import defaultAvatar from '../../assets/styles/avatar-placeholder.png';
import {useAuthStore} from "../../store/useAuthStore.js";

// 마이페이지 홈
export default function MyPage() {
    const navigate = useNavigate();

    const [user, setUser] = useState({
        name: '',
        grade: '',
        points: 0,
        avatarUrl: defaultAvatar,
    });

    const [recentBookings, setRecentBookings] = useState([]);

    // ▼ 수정: memberId 계산을 useEffect 내부에서 “한 번만” 수행
    useEffect(() => {
        let mounted = true;

        const state = (useAuthStore.getState?.() || {});
        const storeId =
            state.user?.id ??
            state.member?.id ??
            state.userId ??
            null;

        const token =
            state.accessToken ||
            (typeof window !== 'undefined'
                ? localStorage.getItem('accessToken')
                : null);

        const memberId = (() => {
            if (storeId != null) return String(storeId);
            if (!token) return null;
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload?.sub ? String(payload.sub) : null;
            } catch {
                return null;
            }
        })();

        if (!memberId) {
            // 로그인 필요: 히스토리 오염 방지
            navigate('/login', { replace: true });
            return;
        }

        (async () => {
            try {
                const data = await getMyInfo(memberId);
                if (mounted && data) setUser(data);

                // 최근 예매 1건 불러오기
                try {
                    const res = await getBookingDetail(memberId); // GET /api/{memberId}/booking
                    const data = res?.data;
                    const list = Array.isArray(data) ? data : data ? [data] : [];
                    // 날짜 후보 필드 추출 & 정렬 (최신 1건)
                    const parseWhen = (b) => {
                        const raw =
                            b.screeningStartAt ||
                            b.bookedAt ||
                            b.createdAt ||
                            b.bookingDate ||
                            b.showTime ||
                            null;
                        const dt = raw ? new Date(raw) : null;
                        return dt && !isNaN(dt.getTime()) ? dt : null;
                    };
                    const sorted = list
                        .map((b) => ({ b, when: parseWhen(b) }))
                        .filter((x) => x.when)
                        .sort((a, b) => b.when - a.when);
                    if (sorted.length && mounted) {
                        const top = sorted[0].b;
                        const when = sorted[0].when;
                        // UI에 맞게 필드 매핑
                        const title =
                            top.movieTitle ||
                            top.movie?.title ||
                            top.title ||
                            '제목 없음';
                        const screen =
                            top.theaterName ||
                            top.screenName ||
                            top.screen?.name ||
                            top.theater ||
                            '';
                        const seatsStr = Array.isArray(top.seats)
                            ? top.seats.map((s) => s.label || s.name || s).join(', ')
                            : (top.seatInfo || top.seatLabels || top.seatNames || '');
                        const id = top.bookingId || top.id;
                        // 시간 포매팅 (간단 버전)
                        const yyyy = when.getFullYear();
                        const mm = String(when.getMonth() + 1).padStart(2, '0');
                        const dd = String(when.getDate()).padStart(2, '0');
                        const hh = String(when.getHours()).padStart(2, '0');
                        const mi = String(when.getMinutes()).padStart(2, '0');
                        const future = when.getTime() > Date.now();
                        setRecentBookings([{
                            id,
                            title,
                            date: `${yyyy}-${mm}-${dd}`,
                            time: `${hh}:${mi}`,
                            screen,
                            seats: seatsStr,
                            cancellable: future
                        }]);
                    } else if (mounted) {
                        setRecentBookings([]);
                    }
                } catch (e) {
                    console.error('최근 예매 불러오기 실패:', e);
                    if (mounted) setRecentBookings([]);
                }
            } catch (error) {
                console.error('마이페이지 사용자 정보 로드 실패:', error);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [navigate]);
    // ▲ 여기까지

    const notifications = [
        { id: 'NT-01', text: '9월 신작 예매 오픈! (듄 파트2, 위키드)', link: '/events' },
        { id: 'NT-02', text: 'VIP 승급까지 12,000P 남았어요', link: '/mypage/points' },
    ];

    return (
        <main className="max-w-[1200px] min-h-[85vh] mx-auto px-4 py-6">
            {/* 상단: 프로필 카드 */}
            <section className="bg-white border rounded-lg p-4 sm:p-5 mb-6">
                <div className="flex items-center gap-4">
                    {/* 아바타 */}
                    <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img
                            src={user.avatarUrl ? user.avatarUrl : defaultAvatar}
                            alt="User avatar"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    {/* 기본 정보 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-semibold truncate">{user.name || '회원'}</h1>
                            {user.grade && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{user.grade}</span>}
                        </div>
                        <div className="mt-1 text-sm text-gray-600 flex flex-wrap items-center gap-3">
                            <span>포인트 <b className="text-gray-900">{(user.points ?? 0).toLocaleString()}</b>P</span>
                        </div>
                    </div>
                    {/* 설정 바로가기 */}
                    <div className="hidden sm:flex items-center gap-2">
                        <Link to="/mypage/settings" className="text-sm underline underline-offset-2">설정</Link>
                    </div>
                </div>
            </section>

            {/* 퀵 액션 */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <QuickAction to="/mypage/bookings" label="예매 내역" />
                <QuickAction to="/mypage/points" label="포인트" />
                <QuickAction to="/mypage/reviews" label="내 리뷰" />
                <QuickAction to="/mypage/settings" label="설정" />
            </section>

            {/* 최근 예매 내역 미리보기 */}
            <section className="bg-white border rounded-lg mb-6">
                <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between">
                    <h2 className="text-sm sm:text-base font-semibold">최근 예매</h2>
                    <Link to="/mypage/bookings" className="text-xs sm:text-sm text-gray-600 hover:text-gray-900">전체 보기</Link>
                </div>
                {recentBookings.length === 0 ? (
                    <div className="px-4 sm:px-5 py-6 text-sm text-gray-500">최근 예매가 없습니다.</div>
                ) : (
                    <ul className="divide-y">
                        {recentBookings.map(b => (
                            <li key={b.id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <p className="text-sm sm:text-base font-medium">{b.title}</p>
                                    <p className="mt-0.5 text-xs sm:text-sm text-gray-600">
                                        {b.date} • {b.time} • {b.screen} • 좌석 {b.seats}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/tickets/${b.id}`)}
                                        className="text-xs sm:text-sm border px-3 py-1 rounded hover:bg-gray-50"
                                    >티켓 보기</button>
                                    {b.cancellable && (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/mypage/bookings/${b.id}/cancel`)}
                                            className="text-xs sm:text-sm border px-3 py-1 rounded hover:bg-gray-50"
                                        >예매 취소</button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* 알림 / 이벤트 */}
            <section className="bg-white border rounded-lg">
                <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between">
                    <h2 className="text-sm sm:text-base font-semibold">알림 & 이벤트</h2>
                    <Link to="/events" className="text-xs sm:text-sm text-gray-600 hover:text-gray-900">더 보기</Link>
                </div>
                {notifications.length === 0 ? (
                    <div className="px-4 sm:px-5 py-6 text-sm text-gray-500">표시할 알림이 없습니다.</div>
                ) : (
                    <ul className="divide-y">
                        {notifications.map(n => (
                            <li key={n.id} className="px-4 sm:px-5 py-3 text-sm flex items-center justify-between">
                                <span className="truncate pr-4">{n.text}</span>
                                <Link to={n.link} className="text-xs border px-3 py-1 rounded hover:bg-gray-50">바로가기</Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <Outlet />
        </main>
    );
}

function QuickAction({ to, label }) {
    return (
        <Link
            to={to}
            className="bg-white border rounded-lg h-20 sm:h-24 flex items-center justify-center text-sm sm:text-base font-medium hover:bg-gray-50"
            aria-label={label}
        >
            {label}
        </Link>
    );
}