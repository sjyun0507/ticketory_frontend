import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {getBookingDetail, getMemberBookings, getBookingQr} from "../../api/bookingApi.js";
import {useAuthStore} from "../../store/useAuthStore.js";

const MyBookings = () => {
  // 스토어/토큰에서 memberId를 최대한 안전하게 파생
  const storeSnap = typeof useAuthStore?.getState === "function" ? useAuthStore.getState() : {};

  // 1) 토큰 우선순위: Zustand -> localStorage -> sessionStorage
  const tokenFromStore = storeSnap.token || storeSnap.accessToken || null;
  const tokenFromStorage = (typeof window !== "undefined" && (localStorage.getItem("token") || sessionStorage.getItem("token"))) || null;
  const token = tokenFromStore || tokenFromStorage || null;

  // 2) JWT 디코딩 (Base64URL)
  const decodeJwt = (t) => {
    try {
      const base64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
      return JSON.parse(json);
    } catch { return null; }
  };
  const claims = token ? decodeJwt(token) : null;

  // 3) memberId 파생: store -> claims(sub|id|memberId) → 숫자만 허용(백엔드 PathVariable Long 대응)
  const memberIdRaw = (
    storeSnap.memberId ??
    storeSnap.user?.memberId ??
    storeSnap.user?.id ??
    storeSnap.profile?.memberId ??
    storeSnap.profile?.id ??
    (claims && (claims.memberId || claims.id || claims.userId || claims.uid || claims.sub)) ??
    null
  );

  const memberId = (() => {
    if (typeof memberIdRaw === "number") return memberIdRaw;
    if (typeof memberIdRaw === "string") {
      // 숫자만 허용: 잘못된 sub(예: "com...CustomUserPrincipal@1234") 방지
      const m = memberIdRaw.match(/^\d+$/);
      if (m) return Number(memberIdRaw);
      console.warn("[MyBookings] 비정상 memberId 문자열 감지 (숫자 아님):", memberIdRaw);
      return null;
    }
    return null;
  })();

  console.log("[MyBookings] store keys:", Object.keys(storeSnap || {}));
  console.log("[MyBookings] store.user:", storeSnap?.user);
  console.log("[MyBookings] store.profile:", storeSnap?.profile);
  console.log("[MyBookings] token present?", !!token, "claims:", claims);
  console.log("[MyBookings] derived memberId:", memberId);
  if (claims && typeof claims.sub === "string" && !/^\d+$/.test(claims.sub)) {
    console.warn("[MyBookings] claims.sub 가 숫자가 아닙니다:", claims.sub);
  }

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 상세 선택 상태
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // QR 관리: dataUri 캐시와 열림 상태
  const [qrMap, setQrMap] = useState({});      // { [bookingId]: dataUri }
  const [qrOpen, setQrOpen] = useState({});    // { [bookingId]: boolean }

  // QR 토글 + 필요 시 fetch
  const handleToggleQr = async (bookingId) => {
    setQrOpen((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
    if (!qrMap[bookingId]) {
      try {
        const resp = await getBookingQr(bookingId);
        const dataUri = typeof resp === 'string' ? resp : resp?.data;
        if (typeof dataUri === 'string' && dataUri.startsWith('data:')) {
          setQrMap((prev) => ({ ...prev, [bookingId]: dataUri }));
        } else {
          console.warn('[MyBookings] QR 응답이 Data URI가 아닙니다:', resp);
        }
      } catch (e) {
        console.error('[MyBookings] QR 로드 실패:', e);
      }
    }
  };

  // 예매 상세 로드
  const handleSelectDetail = async (bookingId) => {
    if (!bookingId) return;
    setSelectedId(bookingId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await getBookingDetail(bookingId);
      const data = res?.data ?? res; // 함수가 data만 반환하는 버전/axios 응답 모두 호환
      setDetail(data);
      // 상세 열 때 QR도 없으면 미리 로드
      if (!qrMap[bookingId]) {
        try {
          const qrResp = await getBookingQr(bookingId);
          const dataUri = typeof qrResp === 'string' ? qrResp : qrResp?.data;
          if (typeof dataUri === 'string' && dataUri.startsWith('data:')) {
            setQrMap((prev) => ({ ...prev, [bookingId]: dataUri }));
            setQrOpen((prev) => ({ ...prev, [bookingId]: true }));
          }
        } catch (e) {
          // QR 실패는 상세와 별개로 무시
        }
      }
    } catch (e) {
      console.error('[MyBookings] 예매 상세 로드 실패:', e);
      const status = e?.response?.status;
      const message = e?.response?.data?.message || e?.message;
      setDetailError(`예매 상세를 불러오는 중 오류(${status ?? '네트워크'}): ${message ?? '알 수 없는 오류'}`);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      console.warn("[MyBookings] 토큰이 없습니다. 로그인 상태를 확인하세요.", { storeSnap });
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
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
        const res = await getMemberBookings(memberId);
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
                const detailRes = await getBookingDetail(booking.bookingId || booking.id);
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
        if (err && /Invalid memberId/i.test(String(err.message))) {
          setError('사용자 정보가 올바르지 않습니다. 다시 로그인해 주세요.');
          setLoading(false);
          return;
        }
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
                  <div style={{ marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleToggleQr(keyId)}
                      style={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        background: "#f8f8f8",
                        cursor: "pointer"
                      }}
                    >
                      {qrOpen[keyId] ? 'QR 숨기기' : 'QR 보기'}
                    </button>
                  </div>
                  {qrOpen[keyId] && qrMap[keyId] && (
                    <div style={{ marginTop: "10px" }}>
                      <img
                        src={qrMap[keyId]}
                        alt={`Booking ${keyId} QR`}
                        style={{ width: "120px", height: "120px" }}
                      />
                    </div>
                  )}
                  <div style={{ marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleSelectDetail(keyId)}
                      style={{
                        fontSize: "12px",
                        padding: "6px 10px",
                        border: "1px solid #bbb",
                        borderRadius: "6px",
                        background: selectedId === keyId ? "#e8f0fe" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      {selectedId === keyId ? '상세 열림' : '상세 보기'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedId && (
        <section style={{ marginTop: "24px", padding: "16px", border: "1px solid #ddd", borderRadius: "8px" }}>
          <h3 style={{ marginTop: 0 }}>예매 상세</h3>
          {detailLoading ? (
            <p>상세 로딩 중...</p>
          ) : detailError ? (
            <p>{detailError}</p>
          ) : !detail ? (
            <p>상세 정보를 찾을 수 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {(() => {
                const poster = detail?.movie?.posterUrl || detail?.posterUrl || '';
                return poster ? (
                  <img src={poster} alt={detail?.movie?.title || '포스터'} style={{ width: 120, height: 180, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 120, height: 180, background: '#ccc', borderRadius: 4 }} />
                );
              })()}
              <div style={{ flex: 1 }}>
                <p style={{ margin: '4px 0' }}><strong>제목:</strong> {detail?.movie?.title || detail?.movieTitle || '제목 없음'}</p>
                <p style={{ margin: '4px 0' }}><strong>결제상태:</strong> {detail?.paymentStatus || detail?.status || '-'}</p>
                <p style={{ margin: '4px 0' }}><strong>총액:</strong> {typeof detail?.totalPrice === 'number' ? detail.totalPrice.toLocaleString() + '원' : (detail?.totalPrice || '-')}</p>
                <p style={{ margin: '4px 0' }}><strong>상영:</strong> {detail?.screening?.screen?.name ? `${detail.screening.screen.name}` : ''} {detail?.screening?.startAt ? ` | ${detail.screening.startAt}` : ''}</p>
                <p style={{ margin: '4px 0' }}><strong>좌석:</strong> {Array.isArray(detail?.seats) ? detail.seats.join(', ') : (detail?.seatInfo || '-')}</p>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleQr(selectedId)}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, background: '#f8f8f8', cursor: 'pointer' }}
                  >
                    {qrOpen[selectedId] ? 'QR 숨기기' : 'QR 보기'}
                  </button>
                </div>
                {qrOpen[selectedId] && qrMap[selectedId] && (
                  <div style={{ marginTop: 10 }}>
                    <img src={qrMap[selectedId]} alt={`Booking ${selectedId} QR`} style={{ width: 140, height: 140 }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default MyBookings;
