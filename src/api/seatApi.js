import api from './axiosInstance.js';


// 좌석맵 조회 (screeningId 기준)
// GET /api/seats/map?screeningId=123
export const getSeatMap = (screeningId) =>
    api.get("/seats/map", { params: { screeningId } });

// 좌석 임시 선점(홀드)
// POST /api/seats/hold { screeningId, seats: ["A5","A6"] }
export const holdSeats = (screeningId, seats) =>
    api.post("/seats/hold", { screeningId, seats });

// 좌석 홀드 해제
// DELETE /api/seats/hold/{holdId}
export const releaseHold = (holdId) =>
    api.delete(`/seats/hold/${holdId}`);

// 좌석 홀드 연장 (남은시간 연장)
// PATCH /api/seats/hold/{holdId}
export const extendHold = (holdId) =>
    api.patch(`/seats/hold/${holdId}`);

// (선택) 예매 확정(결제 시뮬레이션용)
// POST /api/bookings
export const createBooking = (payload) =>
    api.post("/bookings", payload);