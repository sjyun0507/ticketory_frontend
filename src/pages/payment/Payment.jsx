import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { createPaymentOrder } from '../../api/paymentApi.js';
import {useAuthStore} from "../../store/useAuthStore.js";
import { releaseBookingHold } from '../../api/bookingApi.js';
import { getMovieDetail } from '../../api/movieApi.js';
import { getMyInfo} from "../../api/memberApi.js";

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
const customerKey = "lIUt5JCR8vA3XOlDluVSz";

console.debug('[toss] clientKey:', import.meta.env.VITE_TOSS_CLIENT_KEY);
export default function Payment() {
    const location = useLocation();
    const navigate = useNavigate();
    const {
        cart: cartFromState = [],
        totalPrice,
        amount: amountState,
        bookingId: bookingIdFromState,
        payableAmount: payableAmountFromState,
        pointsUsed: pointsUsedFromState
    } = location.state || {};

    const cartFromStorage = (() => {
        try { return JSON.parse(localStorage.getItem('cartItems') || '[]'); } catch { return []; }
    })();

    const cart = (Array.isArray(cartFromState) && cartFromState.length > 0)
        ? cartFromState
        : cartFromStorage;
    const bookingIdFromQuery = new URLSearchParams(location.search).get('bookingId');
    const bookingId = bookingIdFromState || bookingIdFromQuery || null;
    // 좌석 페이지로 돌아갈 때 사용할 screeningId를 파생
    const screeningIdFromState = location.state?.screeningId || (Array.isArray(cart) && cart[0]?.screeningId) || null;
    const screeningIdFromQuery = new URLSearchParams(location.search).get('screeningId');
    const screeningId = screeningIdFromState || screeningIdFromQuery || null;
    // 새로고침 대비 폴백
    const primaryMovieId = (Array.isArray(cart) && cart[0]?.movieId) || null;
    // 장바구니 원가 합
    const cartSum = Array.isArray(cart)
        ? cart.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0)
        : 0;

    // 초기 결제금액 우선순위:
    // (1) 좌석/HOLD의 payableAmount > (2) state.amount.value > (3) totalPrice > (4) cart 합
    const initialAmountValue = (() => {
        if (typeof payableAmountFromState === 'number' && !Number.isNaN(payableAmountFromState)) return payableAmountFromState;
        if (amountState && typeof amountState.value === 'number') return amountState.value;
        if (typeof totalPrice === 'number') return totalPrice;
        return cartSum;
    })();

    // const user = useAuthStore((s) => s.user);
    // const memberId = user?.id ?? user?.memberId ?? null;

    const storeSnap = typeof useAuthStore?.getState === 'function' ? useAuthStore.getState() : {};
    const user = storeSnap.user;
    const memberIdFromStore = user?.id ?? user?.memberId ?? storeSnap.member?.id ?? storeSnap.userId ?? null;
    const tokenFromStorage =
        (typeof window !== 'undefined' && (localStorage.getItem('accessToken') || localStorage.getItem('token') || sessionStorage.getItem('token'))) || null;
    const memberIdFromToken = (() => {
        if (!tokenFromStorage) return null;
        try {
            const payload = JSON.parse(atob(tokenFromStorage.split('.')[1]));
            const raw = payload?.sub ?? payload?.memberId ?? payload?.id ?? null;
            if (raw == null) return null;
            return /^\d+$/.test(String(raw)) ? Number(raw) : null;
        } catch {
            return null;
        }
    })();

    const memberId = memberIdFromStore ?? memberIdFromToken ?? null;
    const [usedPoints, setUsedPoints] = useState(Number(pointsUsedFromState || 0));
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [orderId, setOrderId] = useState(null);

    const [widgets, setWidgets] = useState(null);
    const [amount, setAmount] = useState({ currency: 'KRW', value: initialAmountValue });
    const [ready, setReady] = useState(false);
    const [policyAgreed, setPolicyAgreed] = useState(false);

    const [availablePoints, setAvailablePoints] = useState(0);

    const [posterMap, setPosterMap] = useState({});

    // 중복 뒤로가기 방지
    const [releasing, setReleasing] = useState(false);

    useEffect(() => {
        if (!memberId) return;
        (async () => {
            try {
                const data = await getMyInfo(memberId);
                // DTO: { ..., points: number }
                const bal = (data && (data.points ?? data.pointBalance)) || 0;
                setAvailablePoints(bal);
            } catch (e) {
                console.error('[points] getMyInfo failed', e?.response?.status, e?.response?.data || e);
                setAvailablePoints(0);
            }
        })();
    }, [memberId]);

    const normalizeAge = (raw) => {
        if (!raw) return 'ETC';
        const s = String(raw).toUpperCase();
        if (s.includes('ADULT') || s.includes('성인')) return 'ADULT';
        if (s.includes('TEEN') || s.includes('TEENAGER') || s.includes('YOUTH') || s.includes('STUDENT') || s.includes('청소년')) return 'TEEN';
        if (s.includes('CHILD') || s.includes('KID') || s.includes('INFANT') || s.includes('어린이') || s.includes('아동')) return 'CHILD';
        return 'ETC';
    };

    const groupedCart = useMemo(() => {
        const m = new Map();
        (Array.isArray(cart) ? cart : []).forEach((it) => {
            const q = Number(it.quantity || 1);
            const key = [it.movieId, it.screeningId, it.name || it.label || '영화', it.price ?? 0].join('|');
            const prev = m.get(key) || {
                movieId: it.movieId,
                screeningId: it.screeningId,
                name: it.name || it.label || '영화',
                price: Number(it.price || 0),
                qty: 0,
                total: 0,
                age: { ADULT: 0, TEEN: 0, CHILD: 0, ETC: 0 },
                seats: new Set(),
                screeningInfo: it.screeningInfo,
            };
            prev.qty += q;
            prev.total += Number(it.price || 0) * q;
            // 좌석 라벨 추출 및 추가
            const seatLabel = it.seatLabel || it.seatName || it.seat || (Array.isArray(it.seatIds) ? it.seatIds.join(', ') : (typeof it.seatId === 'string' ? it.seatId : null));
            if (seatLabel) {
                // 쉼표로 넘어오는 경우 개별 좌석으로 분해하여 추가
                seatLabel.split(',').map(s => s.trim()).filter(Boolean).forEach(s => prev.seats.add(s));
            }
            const ageCandidate = it.ageGroup ?? it.kind ?? it.pricingKind ?? it.age ?? it.type;
            const ageKey = normalizeAge(ageCandidate);
            prev.age[ageKey] = (prev.age[ageKey] || 0) + q;
            m.set(key, prev);
        });
        return Array.from(m.values()).map(g => ({ ...g, seats: Array.from(g.seats || []) }));
    }, [cart]);

    const ageSummary = useMemo(() => {
        const sum = { ADULT: 0, TEEN: 0};
        groupedCart.forEach(g => {
            sum.ADULT += g.age.ADULT || 0;
            sum.TEEN += g.age.TEEN || 0;
        });
        const parts = [];
        if (sum.ADULT) parts.push(`성인 ${sum.ADULT}`);
        if (sum.TEEN) parts.push(`청소년 ${sum.TEEN}`);
        return parts.join(' · ');
    }, [groupedCart]);

    useEffect(() => {
        const ids = Array.from(new Set((cart || []).map(it => it.movieId).filter(Boolean)));
        if (ids.length === 0) return;
        let cancelled = false;
        (async () => {
            try {
                const pairs = await Promise.all(ids.map(async (id) => {
                    try {
                        const res = await getMovieDetail(id);
                        const raw = res?.data ?? res;
                        const mediaArr = Array.isArray(raw?.media)
                            ? raw.media
                            : Array.isArray(raw?.content)
                                ? raw.content
                                : Array.isArray(raw)
                                    ? raw
                                    : [];
                        const poster = mediaArr.find(m => (m.type || m.mediaType) === 'POSTER')?.url
                            || raw?.posterUrl
                            || raw?.posterURL
                            || null;
                        return [id, poster];
                    } catch (_) {
                        return [id, null];
                    }
                }));
                if (!cancelled) setPosterMap(Object.fromEntries(pairs));
            } catch (_) {}
        })();
        return () => { cancelled = true; };
    }, [cart]);

    useEffect(() => {
        async function loadWidgetsOnce() {
            const tossPayments = await loadTossPayments(clientKey);
            const w = tossPayments.widgets({ customerKey });
            setWidgets(w);
        }
        // 장바구니가 비어있으면 렌더 타겟이 없어 InvalidSelectorError가 발생할 수 있으므로, 비어있지 않을 때만 로드
        if (cart.length > 0) {
            loadWidgetsOnce();
        }
    }, [cart.length]);

    useEffect(() => {
        async function render() {
            if (!widgets) return;
            if (cart.length === 0) return;
            const pm = document.getElementById('payment-method');
            const ag = document.getElementById('agreement');
            if (!pm || !ag) return; // 타겟이 없으면 렌더 시도하지 않음
            await widgets.setAmount({ currency: 'KRW', value: amount.value });
            await Promise.all([
                widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
                widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
            ]);
            setReady(true);
        }
        render();
    }, [widgets, cart.length]);

    useEffect(() => {
        if (!widgets) return;
        widgets.setAmount({ currency: 'KRW', value: amount.value });
    }, [amount, widgets]);

useEffect(() => {
    const base = initialAmountValue; // 좌석/HOLD 금액을 일관된 기준으로 사용
    const newValue = Math.max(0, base - usedPoints);
    setAmount({ currency: 'KRW', value: newValue });
}, [usedPoints, initialAmountValue]);

    const handleBack = async () => {
        if (releasing) return;
        setReleasing(true);
        try {
            if (bookingId) {
                await releaseBookingHold(bookingId);
                console.debug('[booking:release] success', bookingId);
            } else {
                console.debug('[booking:release] skipped: no bookingId');
            }
        } catch (e) {
            console.error('[booking:release] failed', e?.response?.status, e?.response?.data || e);
            // 실패해도 사용자는 좌석 페이지로 돌아갈 수 있도록 진행
        } finally {
            try { localStorage.removeItem('cartItems'); } catch {}
            try { sessionStorage.removeItem('sessionId'); } catch {}
            // 좌석 페이지에 상영 회차 + 영화 ID를 전달해 즉시 좌석/영화 정보를 재조회하도록 유도
            if (screeningId) {
                const params = new URLSearchParams({ screeningId: String(screeningId), refresh: '1' });
                if (primaryMovieId) params.set('movieId', String(primaryMovieId));
                navigate(`/seat?${params.toString()}`, {
                    state: { screeningId, movieId: primaryMovieId, from: 'payment' },
                });
            } else {
                navigate('/');
            }
            setReleasing(false);
        }
    };

    const handlePayment = async () => {
        if (!policyAgreed) {
            return alert('취소/환불 정책에 동의해 주세요.');
        }
        if (!ready) return alert('결제 수단 준비 중입니다.');
        try {
            const finalAmount = amount.value;
            localStorage.setItem('cartItems', JSON.stringify(cart));

            const orderPayload = {
                bookingId: bookingId ?? null,
                memberId: memberId ?? null,
                orderId: null,
                totalAmount: Number(finalAmount || 0),
                usedPoint: Number(usedPoints || 0),
                orderMethod: 'movie',
                orderTime: new Date().toISOString(),
                status: 'waiting',
                earnedPoint: Math.floor(Number(finalAmount || 0) * 0.05),
                items: cart.map(({ id, movieId, screeningId, seatId, name, price, quantity }) => ({
                    id: id ?? null,
                    movieId,
                    screeningId,
                    seatId: seatId ?? null,
                    name,
                    price: Number(price ?? 0),
                    quantity: Number(quantity ?? 1),
                })),
            };
            console.debug('[order:create:payload:final]', JSON.stringify(orderPayload));


            // 1) 서버에 주문 선생성 (권장) - 404일 경우 클라이언트에서 생성한 주문번호로 결제 진행 허용
            let orderIdFromServer = null;
            try {
                const orderRes = await createPaymentOrder(orderPayload);
                orderIdFromServer = orderRes?.data?.orderId || orderRes?.orderId || null;
                console.debug('[order:create:res]', orderRes);
            } catch (e) {
                const status = e?.response?.status;
                const msg = e?.response?.data?.message || e?.message;
                console.error('[order:create:error]', status, msg, e?.response?.data);
                if (status === 404) {
                    // 엔드포인트 미구현/오경로인 경우에도 테스트 결제는 진행 가능하게
                    orderIdFromServer = uuidv4();
                    alert('서버 주문 API(404)가 아직 준비되지 않아 임시 주문번호로 결제를 진행합니다. 결제 성공 후 서버 연동을 점검하세요.');
                } else {
                    throw e;
                }
            }

            const orderIdToUse = orderIdFromServer || uuidv4();
            setOrderId(orderIdToUse);

            await widgets.setAmount({ currency: 'KRW', value: amount.value });
            const dynOrderName = ageSummary ? `영화 예매 (${ageSummary})` : '영화 예매';
            await widgets.requestPayment({
                orderId: orderIdToUse,
                orderName: dynOrderName,
                successUrl: window.location.origin + '/success',
                failUrl: window.location.origin + '/fail',
                customerEmail: user?.email || 'member@ticketory.app',
                customerName: user?.name || '회원',
                customerMobilePhone: user?.phone ? user.phone.replace(/\D/g, '') : undefined,
            });

            setPaymentStatus('성공');
            localStorage.removeItem('cartItems');
        } catch (error) {
            console.error('결제 처리 실패:', error?.response?.status, error?.response?.data || error);
            const status = error?.response?.status;
            if (status === 404) {
                alert('결제 요청 경로(404)가 올바르지 않습니다. paymentApi.js의 엔드포인트를 확인하세요.');
            }
            setPaymentStatus('실패');
        }
    };

    if (!cart.length) {
        return (
            <div className="text-center mt-20 text-lg">
                장바구니가 비어있습니다.
                <br />
                <button onClick={() => navigate('/')}>메인으로 돌아가기</button>
            </div>
        );
    }

    return (
        <div className="max-w-[1200px]  mx-auto mb-6 px-4 py-6 ">
            <div className="grid md:grid-cols-3 gap-8">
                {/* 예매 정보 */}
                <div className="md:col-span-2 bg-white shadow-lg rounded-2xl p-6 space-y-6">
                    <h2 className="text-xl font-bold mb-4">예매정보</h2>
                    {groupedCart.map((g, i) => {
                        const ageBits = [
                            g.age.ADULT ? `성인 ${g.age.ADULT}` : null,
                            g.age.TEEN ? `청소년 ${g.age.TEEN}` : null,
                            g.age.CHILD ? `어린이 ${g.age.CHILD}` : null,
                            g.age.ETC ? `기타 ${g.age.ETC}` : null,
                        ].filter(Boolean).join(' · ');
                        return (
                            <div key={i} className="flex items-start gap-4 border-b border-gray-200 pb-4">
                                {posterMap[g.movieId] && (
                                    <img
                                        src={posterMap[g.movieId]}
                                        alt="poster"
                                        className="w-20 h-28 rounded-md object-cover"
                                    />
                                )}
                                <div className="flex-1">
                                    <p className="font-semibold">{g.name}</p>
                                    {g.screeningInfo && <p className="text-sm text-gray-600">{g.screeningInfo}</p>}
                                    <p className="text-sm text-gray-600">인원: {ageBits || `${g.qty}명`}</p>
                                    {g.seats?.length > 0 && (
                                        <p className="text-sm text-gray-600">좌석: {g.seats.join(', ')}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="font-medium">{g.total.toLocaleString()}원</p>
                                    <p className="text-xs text-gray-500">(단가 {g.price.toLocaleString()}원 × {g.qty})</p>
                                </div>
                            </div>
                        );
                    })}

                    {/* 할인 적용 - 포인트만 */}
                    <div>
                        <h3 className="text-lg font-semibold mb-2">할인 적용</h3>
                        <div className="bg-white border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">보유 포인트</span>
                                <span className="text-amber-700 font-semibold">{availablePoints.toLocaleString()}점</span>
                            </div>
                            <input
                                type="number"
                                value={usedPoints}
                                min={0}
                                max={Math.min(availablePoints, amount.value)}
                                step={100}
                                onChange={(e) => {
                                    let val = Math.floor(Number(e.target.value) / 100) * 100;
                                    if (val > availablePoints) val = availablePoints;
                                    if (val > amount.value) val = amount.value;
                                    if (val < 0) val = 0;
                                    setUsedPoints(val);
                                }}
                                className="w-full md:w-40 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>
                    {/* 이동된 Toss 결제 위젯 영역 */}
                    <div className="flex flex-col items-stretch mt-6">
                        {/* 결제수단 영역: 상단 예매정보/할인영역과 동일 너비(full) */}
                        <div id="payment-method" className="w-full" />
                        {/* 약관 영역도 동일 폭 유지 */}
                        <div id="agreement" className="mt-4 w-full" />
                    </div>

                    {/* 취소/환불 정책 동의 */}
                    <div className="mt-4 bg-zinc-100/40 text-zinc-500 rounded-lg p-3">
                        <label className="flex items-start gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                className="ml-5 mt-1 w-6 h-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                checked={policyAgreed}
                                onChange={(e) => setPolicyAgreed(e.target.checked)}
                            />
                            <div>
                                <p className="font-xs"> [필수] 취소/환불 정책에 대한 동의</p>
                                <ul className="font-xs text-zinc-400 list-disc pl-5 space-y-1 pt-2">
                                    <li>온라인 예매는 영화 상영시간 30분전까지 취소 가능하며, 30분 이후 현장 취소만 가능합니다.</li>
                                    <li>현장 취소 시 영화 상영시간 이전까지만 가능합니다.</li>
                                </ul>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 결제 금액 박스 */}
                <div className="bg-zinc-700 text-white rounded-2xl p-6 h-fit space-y-4">
                    <h3 className="text-lg font-semibold">결제금액</h3>
                    {groupedCart.map((g, i) => {
                        const ageBits = [
                            g.age?.ADULT ? `성인 ${g.age.ADULT}` : null,
                            g.age?.TEEN ? `청소년 ${g.age.TEEN}` : null,
                            g.age?.CHILD ? `어린이 ${g.age.CHILD}` : null,
                            g.age?.ETC ? `기타 ${g.age.ETC}` : null,
                        ].filter(Boolean).join(' · ');
                        return (
                            <div key={i} className="flex justify-between text-sm">
                                <span>{g.name} ({ageBits || `${g.qty}명`})</span>
                                <span>{g.total.toLocaleString()}원</span>
                            </div>
                        );
                    })}
                    {/* 상영 규칙/프로모션 등으로 좌석 페이지에서 이미 할인된 경우 시각화 */}
                    {typeof payableAmountFromState === 'number' && payableAmountFromState < cartSum && (
                      <div className="flex justify-between text-sm text-amber-400">
                        <span>상영할인</span>
                        <span>-{(cartSum - payableAmountFromState).toLocaleString()}원</span>
                      </div>
                    )}
                    {usedPoints > 0 && (
                        <div className="flex justify-between text-sm text-amber-400">
                            <span>포인트 사용</span>
                            <span>-{usedPoints.toLocaleString()}원</span>
                        </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-500 pt-2">
                        <span>최종결제금액</span>
                        <span>{amount.value.toLocaleString()}원</span>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleBack}
                            disabled={releasing}
                            className="w-1/2 bg-white text-gray-700 hover:bg-gray-200 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            이전
                        </button>
                        <button
                            onClick={handlePayment}
                            disabled={!ready || !policyAgreed}
                            className="w-1/2 bg-indigo-600 text-white hover:bg-indigo-700 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!policyAgreed ? '취소/환불 정책에 동의해 주세요.': undefined}
                        >
                            결제
                        </button>
                    </div>
                </div>
            </div>

            {/* 결제 결과 */}
            {paymentStatus && (
                <div
                    className={`mt-6 py-4 px-6 rounded-xl text-center font-bold text-lg ${
                        paymentStatus === '성공' ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100'
                    }`}
                >
                    {paymentStatus === '성공' ? (
                        <p>
                            결제가 완료되었습니다.<br />주문번호: {orderId}
                        </p>
                    ) : (
                        <p>결제에 실패하였습니다.</p>
                    )}
                </div>
            )}
        </div>
    );
}