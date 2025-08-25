import api from './axiosInstance.js';

// 좌석맵 조회 (screeningId 기준)
// GET /api/seats/map?screeningId=123
export const getSeatMap = (screeningId) =>
    api.get("/seats/map", { params: { screeningId } });

// 좌석 임시 선점(홀드) - 좌석코드가 아니라 seat_id(number[])로 전달
// POST /api/seats/hold { screeningId, seatIds: [101,102], holdSeconds?: number }
export const holdSeats = (screeningId, seatIds, holdSeconds = 300) =>
    api.post("/seats/hold", {
      screeningId,
      seatIds: Array.isArray(seatIds) ? seatIds.map(n => Number(n)) : [],
      holdSeconds
    });

// 좌석 홀드 해제
// DELETE /api/seats/hold/{holdId}
export const releaseHold = (holdId) =>
    api.delete(`/seats/hold/${holdId}`);

// 좌석 홀드 연장 (남은시간 추가, 기본 120초)
// PATCH /api/seats/hold/{holdId}
// body: { extraSeconds: number }
export const extendHold = (holdId, extraSeconds = 120) =>
    api.patch(`/seats/hold/${holdId}`, { extraSeconds });


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