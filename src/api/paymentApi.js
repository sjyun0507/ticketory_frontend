import api from './axiosInstance.js';


// 결제용 주문 생성
/*
 * 결제용 주문 생성 + 서버에서 최종가 재계산(수요일 할인 포함)
 * @param {Object} params
 * @param {number} params.screeningId             // 상영 ID
 * @param {Array<{kind:string, count:number}>} params.items  // 요금종류/수량
 * @param {Object} [params.bookingInfo]           // 좌석/연락처 등 부가정보 (백엔드 스펙에 맞춰 전달)
 */
export const createPaymentOrder = ({ screeningId, items, bookingInfo }) =>
    api.post('/payments', { screeningId, items, bookingInfo });
// 결제 상태 조회
export const getPaymentStatus = (paymentId) =>
    api.get(`/payments/${paymentId}`);

// 결제 승인(서버 → Toss 승인 API 연동)
export function confirmPayment({ paymentKey, orderId, amount }) {
    // 예: 백엔드 라우팅 POST /api/payments/confirm
    return api.post('/payments/confirm', { paymentKey, orderId, amount });
}