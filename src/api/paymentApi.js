import api from './axiosInstance.js';


// 결제용 주문 생성
export function createPaymentOrder(orderPayload) {
    const body = {
        bookingId: orderPayload?.bookingId ?? null,
        memberId: orderPayload?.memberId ?? null,
        orderId: orderPayload?.orderId ?? null,
        totalAmount: Number(orderPayload?.totalAmount ?? 0),
        usedPoint: Number(orderPayload?.usedPoint ?? 0),
        orderMethod: orderPayload?.orderMethod ?? 'movie',
        orderTime: orderPayload?.orderTime ?? new Date().toISOString(),
        status: orderPayload?.status ?? 'waiting',
        earnedPoint: Number(orderPayload?.earnedPoint ?? 0),
        items: Array.isArray(orderPayload?.items) ? orderPayload.items.map(it => ({
            id: it?.id ?? null,
            movieId: it?.movieId ?? null,
            screeningId: it?.screeningId ?? null,
            seatId: it?.seatId ?? null,
            name: it?.name ?? null,
            price: Number(it?.price ?? 0),
            quantity: Number(it?.quantity ?? 1),
        })) : [],
    };

    return api.post('/payments', body, {
        headers: { 'Content-Type': 'application/json' },
    });
}
// 결제 상태 조회
export const getPaymentStatus = (paymentId) =>
    api.get(`/payments/${paymentId}`);

// 결제 승인(서버 → Toss 승인 API 연동)
export function confirmPayment({ paymentKey, orderId, amount }) {
    // 예: 백엔드 라우팅 POST /api/payments/confirm
    return api.post('/payments/confirm', { paymentKey, orderId, amount });
}