import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { createPaymentOrder } from '../api/paymentApi.js';

import {useAuthStore} from "../store/useAuthStore.js";

const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
const customerKey = "lIUt5JCR8vA3XOlDluVSz";

console.debug('[toss] clientKey:', import.meta.env.VITE_TOSS_CLIENT_KEY);
export default function Payment() {
    const location = useLocation();
    const navigate = useNavigate();
    const { cart = [], totalPrice = 0 } = location.state || {};

    const user = useAuthStore((s) => s.user);
    const memberId = user?.id ?? user?.memberId ?? null;

    const [usedPoints, setUsedPoints] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [orderId, setOrderId] = useState(null);

    const [widgets, setWidgets] = useState(null);
    const [amount, setAmount] = useState({ currency: 'KRW', value: totalPrice });
    const [ready, setReady] = useState(false);

    const [availablePoints, setAvailablePoints] = useState(0);

    useEffect(() => {
        async function loadWidgetsOnce() {
            const tossPayments = await loadTossPayments(clientKey);
            const w = tossPayments.widgets({ customerKey });
            setWidgets(w);
        }
        loadWidgetsOnce();
    }, []);

    useEffect(() => {
        async function render() {
            if (!widgets) return;
            await widgets.setAmount({ currency: 'KRW', value: amount.value });
            await Promise.all([
                widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
                widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
            ]);
            setReady(true);
        }
        render();
    }, [widgets]);

    useEffect(() => {
        if (!widgets) return;
        widgets.setAmount({ currency: 'KRW', value: amount.value });
    }, [amount, widgets]);

    useEffect(() => {
        const newValue = Math.max(0, totalPrice - usedPoints);
        setAmount({ currency: 'KRW', value: newValue });
    }, [usedPoints, totalPrice]);

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

    const handleBack = () => {
        localStorage.removeItem('cartItems');
        sessionStorage.removeItem('sessionId');
        window.location.replace('/');
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

            const orderRes = await createPaymentOrder(orderPayload);
            const orderIdFromServer = orderRes?.data?.orderId || uuidv4();
            setOrderId(orderIdFromServer);

            await widgets.setAmount({ currency: 'KRW', value: amount.value });
            await widgets.requestPayment({
                orderId: orderIdFromServer,
                orderName: 'Ticketory 영화 예매',
                successUrl: window.location.origin + '/success',
                failUrl: window.location.origin + '/fail',
                customerEmail: user?.email || 'member@ticketory.app',
                customerName: user?.name || '회원',
                customerMobilePhone: user?.phone || '',
            });

            setPaymentStatus('성공');
            localStorage.removeItem('cartItems');
        } catch (error) {
            console.error('결제 처리 실패:', error);
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
        <div className="min-h-screen bg-white p-8 font-sans">
            <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
                {/* 예매 정보 */}
                <div className="md:col-span-2 bg-white shadow-lg rounded-2xl p-6 space-y-6">
                    <h2 className="text-xl font-bold mb-4">예매정보</h2>
                    {cart.map((item, i) => (
                        <div key={i} className="flex items-start gap-4 border-b border-gray-200 pb-4">
                            <img src={item.posterUrl} alt="poster" className="w-20 h-28 rounded-md object-cover" />
                            <div className="flex-1">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-gray-600">{item.screeningInfo}</p>
                                <p className="text-sm text-gray-600">좌석: {item.seatLabel}</p>
                            </div>
                            <p className="font-medium">{(item.price * item.quantity).toLocaleString()}원</p>
                        </div>
                    ))}

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
                </div>

                {/* 결제 금액 박스 */}
                <div className="bg-gray-900 text-white rounded-2xl p-6 h-fit space-y-4">
                    <h3 className="text-lg font-semibold">결제금액</h3>
                    {cart.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span>{item.label || item.name}</span>
                            <span>{(item.price * item.quantity).toLocaleString()}원</span>
                        </div>
                    ))}
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
                    <div id="payment-method" className="mt-4" />
                    <div id="agreement" />
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleBack}
                            className="w-1/2 bg-gray-500 hover:bg-gray-600 py-2 rounded-lg"
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