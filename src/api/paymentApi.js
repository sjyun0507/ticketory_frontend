import api from './axiosInstance.js';


// 결제용 주문 생성
export const createPaymentOrder = (payload) =>
    api.post('/payments', payload);

// 결제 상태 조회
export const getPaymentStatus = (paymentId) =>
    api.get(`/payments/${paymentId}`);

// 결제 승인(서버 → Toss 승인 API 연동)
export function confirmPayment({ paymentKey, orderId, amount }) {
    // 예: 백엔드 라우팅 POST /api/payments/confirm
    return api.post('/payments/confirm', { paymentKey, orderId, amount });
}