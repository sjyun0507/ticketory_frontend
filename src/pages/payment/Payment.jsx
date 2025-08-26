import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { createPaymentOrder } from '../../api/paymentApi.js';
import {useAuthStore} from "../../store/useAuthStore.js";
import { releaseBookingHold } from '../../api/bookingApi.js';
import { getMovieDetail } from '../../api/movieApi.js';

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
const customerKey = "lIUt5JCR8vA3XOlDluVSz";

console.debug('[toss] clientKey:', import.meta.env.VITE_TOSS_CLIENT_KEY);
export default function Payment() {
    const location = useLocation();
    const navigate = useNavigate();
    const { cart: cartFromState = [], totalPrice, amount: amountState, bookingId: bookingIdFromState } = location.state || {};
    const bookingIdFromQuery = new URLSearchParams(location.search).get('bookingId');
    const bookingId = bookingIdFromState || bookingIdFromQuery || null;
    // 좌석 페이지로 돌아갈 때 사용할 screeningId를 파생
    const screeningIdFromState = location.state?.screeningId || (Array.isArray(cart) && cart[0]?.screeningId) || null;
    const screeningIdFromQuery = new URLSearchParams(location.search).get('screeningId');
    const screeningId = screeningIdFromState || screeningIdFromQuery || null;
    // 새로고침 대비 폴백
    const cartFromStorage = (() => {
      try { return JSON.parse(localStorage.getItem('cartItems') || '[]'); } catch { return []; }
    })();
    const cart = cartFromState.length ? cartFromState : cartFromStorage;
    const primaryMovieId = (Array.isArray(cart) && cart[0]?.movieId) || null;
    // 초기 결제금액 결정: state.amount.value > state.totalPrice > cart 합계
    const initialAmountValue = (() => {
      if (amountState && typeof amountState.value === 'number') return amountState.value;
      if (typeof totalPrice === 'number') return totalPrice;
      const sum = Array.isArray(cart) ? cart.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0) : 0;
      return sum;
    })();

    const user = useAuthStore((s) => s.user);
    const memberId = user?.id ?? user?.memberId ?? null;

    const [usedPoints, setUsedPoints] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [orderId, setOrderId] = useState(null);

    const [widgets, setWidgets] = useState(null);
    const [amount, setAmount] = useState({ currency: 'KRW', value: initialAmountValue });
    const [ready, setReady] = useState(false);

    const [availablePoints, setAvailablePoints] = useState(0);

    const [posterMap, setPosterMap] = useState({});

    // 중복 뒤로가기 방지
    const [releasing, setReleasing] = useState(false);

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
      const base = typeof totalPrice === 'number' ? totalPrice : initialAmountValue;
      const newValue = Math.max(0, base - usedPoints);
      setAmount({ currency: 'KRW', value: newValue });
    }, [usedPoints, totalPrice, initialAmountValue]);

    // useEffect(() => {
    //     if (!memberId) return;
    //     (async () => {
    //         try {
    //             const { data } = await getMemberPoints(memberId);
    //             const bal = (data && (data.balance ?? data.pointBalance ?? data.points)) || 0;
    //             setAvailablePoints(bal);
    //         } catch (e) {
    //             console.error('내 포인트 잔액 조회 실패:', e);
    //             setAvailablePoints(0);
    //         }
    //     })();
    // }, [memberId]);

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
        if (!ready) return alert('결제 수단 준비 중입니다.');
        try {
            const finalAmount = amount.value;
            localStorage.setItem('cartItems', JSON.stringify(cart));

            const orderPayload = {
                memberId: memberId ?? undefined,
                totalAmount: finalAmount || 0,
                usedPoint: usedPoints || 0,
                orderMethod: 'movie',
                orderTime: new Date().toISOString(),
                status: 'waiting',
                earnedPoint: Math.floor((finalAmount || 0) * 0.05),
                items: cart.map(({ id, movieId, screeningId, seatId, name, price, quantity }) => ({
                    id,
                    movieId,
                    screeningId,
                    seatId,
                    name,
                    price,
                    quantity,
                })),
            };

            console.debug('[order:create:payload]', orderPayload);

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
            await widgets.requestPayment({
                orderId: orderIdToUse,
                orderName: 'Ticketory 영화 예매',
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
                    {cart.map((item, i) => {
                      const qty = Number(item.quantity || 1);
                      const lineTotal = Number(item.price || 0) * qty;
                      return (
                        <div key={i} className="flex items-start gap-4 border-b border-gray-200 pb-4">
                          {posterMap[item.movieId] && (
                            <img
                              src={posterMap[item.movieId]}
                              alt="poster"
                              className="w-20 h-28 rounded-md object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">{item.name || item.label || '영화'}</p>
                            {item.screeningInfo && <p className="text-sm text-gray-600">{item.screeningInfo}</p>}
                            {item.seatLabel && <p className="text-sm text-gray-600">좌석: {item.seatLabel}</p>}
                          </div>
                          <p className="font-medium">{lineTotal.toLocaleString()}원</p>
                        </div>
                      );
                    })}

                    {/* 할인 적용 - 포인트만 */}
                    <div>
                        <h3 className="text-lg font-semibold mb-2">할인 적용</h3>
                        <div className="bg-gray-50 border rounded-lg p-4">
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
                <div className="flex flex-col items-start mt-6">
                  <div id="payment-method" className="w-full max-w-md" />
                  <div id="agreement" className="mt-2" />
                </div>
                </div>

                {/* 결제 금액 박스 */}
                <div className="bg-zinc-700 text-white rounded-2xl p-6 h-fit space-y-4">
                    <h3 className="text-lg font-semibold">결제금액</h3>
                    {cart.map((item, i) => {
                      const qty = Number(item.quantity || 1);
                      const lineTotal = Number(item.price || 0) * qty;
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{item.label || item.name || '항목'}</span>
                          <span>{lineTotal.toLocaleString()}원</span>
                        </div>
                      );
                    })}
                    {usedPoints > 0 && (
                        <div className="flex justify-between text-sm text-amber-400">
                            <span>포인트 사용</span>
                            <span>-{usedPoints.toLocaleString()}원</span>
                        </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-700 pt-2">
                        <span>최종결제금액</span>
                        <span>{amount.value.toLocaleString()}원</span>
                    </div>
                    {/* Toss 결제 위젯 영역이 좌측으로 이동됨 */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleBack}
                            disabled={releasing}
                            className="w-1/2 bg-gray-500 hover:bg-gray-600 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            이전
                        </button>
                        <button
                            onClick={handlePayment}
                            disabled={!ready}
                            className="w-1/2 bg-teal-600 hover:bg-teal-700 py-2 rounded-lg"
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