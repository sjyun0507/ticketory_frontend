import api from './axiosInstance.js';


// 결제용 주문 생성
export const createPaymentOrder = (payload) =>
    api.post('/payments', payload);

// 결제 상태 조회
export const getPaymentStatus = (paymentId) =>
    api.get(`/payments/${paymentId}`);