import api from "./axiosInstance.js";

// 예약 초기화 (Booking+Payment+SeatHold 통합 생성 API)
// screeningId: number,
// seatIds: number[],
// counts: { adult: number, teen: number, ... },
// holdSeconds?: number,
// provider?: string
// 이 API는 Booking, Payment, SeatHold를 한 번에 생성합니다.
export async function initBooking({ screeningId, seatIds, counts, holdSeconds = 120, provider = "TOSS" }) {
    const res = await api.post("/bookings", {
        screeningId,
        seatIds: Array.isArray(seatIds) ? seatIds.map(n => Number(n)) : [],
        counts,
        holdSeconds,
        provider
    }, {
        headers: { "Idempotency-Key": crypto?.randomUUID?.() ?? String(Date.now()) }
    });
    return res.data;
}

//예약 HOLD를 해제(취소)
export async function releaseBookingHold(bookingId) {
  if (!bookingId) return;
  return api.delete(`/bookings/${bookingId}/cancel`);
}

// 특정 회원의 예매 목록(상태/기간 필터 가능)
export const getMemberBookings = async (memberId, { status, from, to } = {}) => {
    if (memberId === null || memberId === undefined) throw new Error("memberId is required");
    const n = typeof memberId === 'number' ? memberId : (typeof memberId === 'string' ? Number(memberId) : NaN);
    if (!Number.isFinite(n) || String(n) !== String(memberId).trim()) {
        console.warn('[bookingApi] invalid memberId, must be numeric. got:', memberId, 'type:', typeof memberId);
        throw new Error('Invalid memberId: must be numeric');
    }
    const params = {};
    if (status) params.status = status;   // e.g., PENDING|CONFIRMED|CANCELLED
    if (from) params.from = from;         // ISO date or datetime
    if (to) params.to = to;               // ISO date or datetime

    const path = `/members/${n}/bookings`;
    console.log('[bookingApi] GET', path, { params, baseURL: api?.defaults?.baseURL });
    return await api.get(path, { params });
};

// 특정 예매 ID 하나에 대한 모든 상세(결제/상영/좌석/포스터 등)
export const getBookingDetail = async (bookingId) => {
    if (!bookingId && bookingId !== 0) throw new Error("bookingId is required");
    const path = `/bookings/${bookingId}`;
    console.log('[bookingApi] GET', path);
    const { data } = await api.get(path);
    return data;
};

// QR 코드 데이터 URI 가져오기
export const getBookingQr = async (bookingId) => {
    if (!bookingId && bookingId !== 0) throw new Error("bookingId is required");
    const res = await api.get(`/bookings/${bookingId}/qr`, {
        responseType: "text",
        transformResponse: [(data, headers) => {
            try {
                const ct = headers && (headers['content-type'] || headers['Content-Type']) || '';
                if (typeof data === 'string' && !ct.includes('application/json')) {
                    return data; // text/plain 등: 그대로 Data URI 문자열
                }
                const parsed = JSON.parse(data);
                return parsed?.dataUri || parsed?.qrCode || parsed;
            } catch (e) {
                return data; // 파싱 실패 시 원문 반환
            }
        }]
    });
    return res.data;
};