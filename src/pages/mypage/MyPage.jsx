import React, { useEffect, useState } from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { getMyInfo } from '../../api/memberApi.js';
import { getMemberBookings } from '../../api/bookingApi.js';
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
                if (mounted && data) {
                  const normalized = {
                    name: data?.name ?? '',
                    grade: data?.grade ?? data?.memberGrade ?? '',
                    points: data?.points ?? data?.pointBalance ?? 0,
                    avatarUrl: data?.avatarUrl ?? data?.avatar_url ?? '',
                  };
                  setUser(prev => ({
                    ...prev,
                    ...normalized,
                    avatarUrl: (normalized.avatarUrl && String(normalized.avatarUrl).trim()) || prev.avatarUrl || defaultAvatar,
                  }));
                }

                // 최근 예매 1건 불러오기 (목록 API → 최신 1건 선별)
                try {
                    const page = await getMemberBookings(memberId, { status: 'CONFIRMED' });
                    const list = Array.isArray(page?.content) ? page.content : [];

                    const normalized = list
                        .map(b => {
                            const when = b.screeningStartAt ? new Date(b.screeningStartAt) : null;
                            return {
                                id: b.bookingId,
                                title: b.movieTitle ?? '제목 없음',
                                screen: b.screenName ?? '',
                                seats: Array.isArray(b.seats) ? b.seats.join(', ') : '',
                                when,
                                paymentStatus: b.paymentStatus,
                            };
                        })
                        .filter(x => x.when && !isNaN(x.when.getTime()))
                        .sort((a, b) => b.when - a.when);

                    if (normalized.length && mounted) {
                        const top = normalized[0];
                        const yyyy = top.when.getFullYear();
                        const mm = String(top.when.getMonth() + 1).padStart(2, '0');
                        const dd = String(top.when.getDate()).padStart(2, '0');
                        const hh = String(top.when.getHours()).padStart(2, '0');
                        const mi = String(top.when.getMinutes()).padStart(2, '0');
                        const future = top.when.getTime() > Date.now();

                        setRecentBookings([{
                            id: top.id,
                            title: top.title,
                            date: `${yyyy}-${mm}-${dd}`,
                            time: `${hh}:${mi}`,
                            screen: top.screen,
                            seats: top.seats,
                            cancellable: future && top.paymentStatus !== 'CANCELLED',
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
        { id: 'NT-01', type: 'event', text: '특별 상영 & 굿즈 증정 이벤트', link: '/events' },
        { id: 'NT-02', type: 'notice',  text: 'VIP 승급까지 12,000P 남았어요', link: '/mypage/points' },
    ];

    return (
        <main className="max-w-[1200px] min-h-[85vh] mx-auto px-4 py-8">
            {/* 헤더: 그라데이션 + 프로필 */}
            <section className="relative overflow-hidden rounded-2xl border bg-white mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-sky-50 to-teal-50" />
                <div className="relative p-6 sm:p-8">
                    <div className="flex items-start gap-5">
                        {/* 아바타 */}
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full ring-2 ring-white shadow-md overflow-hidden shrink-0">
                            <img
                                src={user?.avatarUrl ? user.avatarUrl : defaultAvatar}
                                alt="User avatar"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  if (e.currentTarget.src !== defaultAvatar) {
                                    e.currentTarget.src = defaultAvatar;
                                  }
                                }}
                            />
                        </div>

                        {/* 기본 정보 + 스탯 */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
                                    {user.name || '회원'}
                                </h1>
                                {user.grade && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-900/5 text-gray-700 border border-gray-200">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                        {user.grade}
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">반가워요! 오늘도 즐거운 관람 되세요 👋</p>

                            {/* 스탯 */}
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border bg-white/70 backdrop-blur p-3">
                                    <p className="text-xs text-gray-500">보유 포인트</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">{(user.points ?? 0).toLocaleString()}P</p>
                                </div>
                                <div className="rounded-xl border bg-white/70 backdrop-blur p-3">
                                    <p className="text-xs text-gray-500">회원 등급</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">{user.grade || '일반'}</p>
                                </div>
                                <div className="rounded-xl border bg-white/70 backdrop-blur p-3 hidden sm:block">
                                    <p className="text-xs text-gray-500">최근 예매</p>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">{recentBookings.length ? recentBookings[0].date : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 퀵 액션 */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                <QuickAction to="/mypage/bookings" label="예매 내역" icon="ticket" />
                <QuickAction to="/mypage/points" label="포인트 내역" icon="coin" />
                <QuickAction to="/mypage/reviews" label="내 리뷰" icon="review" />
                <QuickAction to="/mypage/settings" label="회원정보수정" icon="settings" />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 최근 예매 */}
                <section className="lg:col-span-1 bg-white border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50/60">
                        <h2 className="text-base font-semibold">최근 예매</h2>
                        <Link to="/mypage/bookings" className="text-sm text-gray-600 hover:text-gray-900">전체 보기</Link>
                    </div>

                    {recentBookings.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">
                            아직 예매 내역이 없어요.
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {recentBookings.map(b => (
                                <li key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{b.title}</p>
                                        <p className="mt-0.5 text-xs sm:text-sm text-gray-600 truncate">
                                            {b.date} • {b.time} • {b.screen} • 좌석 {b.seats}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* 알림 / 이벤트 */}
                <section className="bg-white border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50/60">
                        <h2 className="text-base font-semibold">알림 & 이벤트</h2>
                        <Link to="/events" className="text-sm text-gray-600 hover:text-gray-900">더 보기</Link>
                    </div>
                    {notifications.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">표시할 알림이 없습니다.</div>
                    ) : (
                        <ul className="divide-y">
                            {notifications.map(n => (
                                <li key={n.id} className="px-5 py-3 text-sm flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                                n.type === 'notice'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-purple-100 text-purple-700'
                                            }`}
                                        >
                                            {n.type === 'notice' ? '공지' : '이벤트'}
                                        </span>
                                        <span className="truncate">{n.text}</span>
                                    </div>
                                    <Link to={n.link} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50">바로가기</Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <Outlet />
        </main>
    );
}

function QuickAction({ to, label, icon }) {
    const Icon = () => {
        switch (icon) {
            case 'ticket':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeWidth="1.5" d="M5 7h14a1 1 0 0 1 1 1v2a2 2 0 1 0 0 4v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a2 2 0 1 0 0-4V8a1 1 0 0 1 1-1z"/></svg>
                );
            case 'coin':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><circle cx="12" cy="12" r="8" strokeWidth="1.5"/><path d="M8 12h8" strokeWidth="1.5"/><path d="M10 9h4" strokeWidth="1.5"/></svg>
                );
            case 'review':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path d="M4 6h16M4 12h10M4 18h7" strokeWidth="1.5"/></svg>
                );
            case 'settings':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.07a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 3.2 17.9l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.07a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 6.1 3.2l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.07a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 20.8 6.1l-.06.06a1.65 1.65 0 0 0-.33 1.82V8c0 .69.28 1.32.73 1.77.45.45 1.08.73 1.77.73H22a2 2 0 1 1 0 4h-.07a1.65 1.65 0 0 0-1.51 1z" strokeWidth="1.2"/></svg>
                );
            default:
                return null;
        }
    };

    return (
        <Link
            to={to}
            className="group border rounded-2xl h-24 sm:h-28 flex flex-col items-center justify-center gap-2 bg-white hover:bg-gray-50 transition-colors"
            aria-label={label}
        >
            <span className="inline-flex items-center justify-center rounded-xl border bg-white w-10 h-10 group-hover:shadow-sm">
                <Icon />
            </span>
            <span className="text-sm sm:text-base font-medium text-gray-900">{label}</span>
        </Link>
    );
}