import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {getBookingDetail, getMemberBookings} from "../../api/bookingApi.js";
import {useAuthStore} from "../../store/useAuthStore.js";

const decodeJwt = (t) => {
  try {
    const base64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(json);
  } catch { return null; }
};

const MyBookings = () => {
  // 스토어/토큰에서 memberId를 최대한 안전하게 파생
  const storeSnap = typeof useAuthStore?.getState === "function" ? useAuthStore.getState() : {};
  const memberId =
    storeSnap.memberId ??
    storeSnap.user?.memberId ??
    storeSnap.user?.id ??
    storeSnap.profile?.memberId ??
    storeSnap.profile?.id ??
    null;

  const token = (typeof window !== "undefined" && (localStorage.getItem("token") || sessionStorage.getItem("token"))) || null;
  const claims = token ? decodeJwt(token) : null;
  console.log("[MyBookings] store keys:", Object.keys(storeSnap || {}));
  console.log("[MyBookings] store.user:", storeSnap?.user);
  console.log("[MyBookings] store.profile:", storeSnap?.profile);
  console.log("[MyBookings] derived memberId:", memberId);
  console.log("[MyBookings] token present?", !!token, "claims:", claims);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!memberId) {
      console.warn("[MyBookings] memberId가 없습니다. 로그인/스토어 상태를 확인하세요.", { storeSnap, tokenPresent: !!token, claims });
      setError("사용자 정보가 없습니다.");
      setLoading(false);
      return;
    }
    const fetchBookings = async () => {
      console.log("[MyBookings] fetchBookings() 호출, memberId:", memberId);
      try {
        setLoading(true);
        setError(null);
        const res = await getBookingDetail(memberId);
        const data = res?.data;
        console.log("[MyBookings] GET /api/{memberId}/booking 응답(raw):", data);
        // Normalize data to array
        const bookingArray = Array.isArray(data) ? data : data ? [data] : [];
        console.log("[MyBookings] bookingArray(normalized):", bookingArray);
        // For each booking, if posterUrl missing, fetch detail from getMemberBookings
        const bookingsWithPoster = await Promise.all(
          bookingArray.map(async (booking) => {
            if (!booking.posterUrl) {
              console.log("[MyBookings] posterUrl 누락 → 상세 보완조회 시도", { bookingId: booking.bookingId || booking.id });
              try {
                const detailRes = await getMemberBookings(booking.bookingId || booking.id);
                const detail = detailRes?.data;
                console.log("[MyBookings] GET /api/bookings/{bookingId} 응답(raw):", detail);
                if (detail && detail.movie && detail.movie.posterUrl) {
                  return { ...booking, posterUrl: detail.movie.posterUrl };
                }
              } catch {
                // ignore error and return original booking
              }
            }
            return booking;
          })
        );
        setBookings(bookingsWithPoster);
        console.log("[MyBookings] 최종 bookings 상태:", bookingsWithPoster);
      } catch (err) {
        console.error("[MyBookings] 예매 내역 로드 실패:", err, err?.response);
        const status = err?.response?.status;
        const message = err?.response?.data?.message || err?.message;
        setError(`예매 내역을 불러오는 중 오류(${status ?? "네트워크"}): ${message ?? "알 수 없는 오류"}`);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [memberId]);

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          to="/mypage"
          className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded border"
        >
          ← 마이페이지로
        </Link>
      </div>
      <h2>나의 예매 내역</h2>
      {loading ? (
        <p>로딩 중...</p>
      ) : error ? (
        <p>{error}</p>
      ) : bookings.length === 0 ? (
        <p>예매 내역이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
          {bookings.map(({ bookingId, id, movieTitle, bookingDate, theaterName, seatInfo, posterUrl, movie, theater, seats, bookingDateTime }) => {
            // Support fallback keys for API data
            const title = movieTitle || (movie && movie.title) || "제목 없음";
            const date = bookingDate || bookingDateTime || "";
            const theaterN = theaterName || (theater && theater.name) || "";
            const seatsInfo = seatInfo || (seats && seats.join(", ")) || "";
            const poster = posterUrl || (movie && movie.posterUrl) || "";
            const keyId = bookingId || id;
            return (
              <div
                key={keyId}
                style={{
                  display: "flex",
                  gap: "20px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "10px",
                  alignItems: "center",
                }}
              >
                {poster ? (
                  <img
                    src={poster}
                    alt={title}
                    style={{ width: "100px", height: "150px", objectFit: "cover", borderRadius: "4px" }}
                  />
                ) : (
                  <div style={{ width: "100px", height: "150px", backgroundColor: "#ccc", borderRadius: "4px" }} />
                )}
                <div>
                  <h3 style={{ margin: "0 0 10px 0" }}>{title}</h3>
                  <p style={{ margin: "4px 0" }}>
                    <strong>상영관:</strong> {theaterN}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <strong>예매일:</strong> {date}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    <strong>좌석:</strong> {seatsInfo}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default MyBookings;
