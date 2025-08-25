import api from './axiosInstance.js';

// 좌석맵 조회 (screeningId 기준)
// GET /api/seats/map?screeningId=123
export const getSeatMap = (screeningId) =>
    api.get("/seats/map", { params: { screeningId } });

// 좌석 임시 선점(홀드) - 좌석코드가 아니라 seat_id(number[])로 전달
// POST /api/seat-holds { screeningId, seatIds: [101,102], holdSeconds?: number }
export const holdSeats = (screeningId, seatIds, holdSeconds = 300) =>
    api.post("/seats/hold", { screeningId, seatIds, holdSeconds });

// 좌석 홀드 해제
// DELETE /api/seat-holds/{holdId}
export const releaseHold = (holdId) =>
    api.delete(`/seats/hold/${holdId}`);

// 좌석 홀드 연장 (남은시간 연장)
// PATCH /api/seat-holds/{holdId}
// body: { extraSeconds: number }
export const extendHold = (holdId, extraSeconds = 120) =>
    api.patch(`/seats/hold/${holdId}`, { extraSeconds });

// *   movieId: 1,
// *   screeningId: 10,
// *   seatIds: [101, 102],
// *   counts: { adult: 2, teen: 0 },
// *   status: "HOLD"

// 예약 초기화 (Booking+Payment+SeatHold 생성)
export async function initBooking({ screeningId, seatIds, counts, holdSeconds = 120, provider = "TOSS" }) {
    const res = await api.post("/bookings", {
        screeningId,
        seatIds,       // [101, 102] 숫자 seat_id 배열
        counts,
        holdSeconds,
        provider
    }, {
        headers: { "Idempotency-Key": crypto?.randomUUID?.() ?? String(Date.now()) }
    });
    return res.data;
}