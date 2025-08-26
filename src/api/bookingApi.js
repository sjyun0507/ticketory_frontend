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

// 특정 예매 상세 정보 조회
export const getMemberBookings = async (bookingId) => {
    const { data } = await api.get(`/bookings/${bookingId}`);
    // 백엔드가 page형/배열형 모두 올 수 있으니 통일해서 반환
    return Array.isArray(data?.content) ? data.content
        : Array.isArray(data)          ? data
            : data?.items ?? [];
};

// 회원별 예매 상세 정보 조회
export const getBookingDetail = async (memberId) => {
    const { data } = await api.get(`/${memberId}/booking`);
    return data;
};