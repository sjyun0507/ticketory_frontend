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