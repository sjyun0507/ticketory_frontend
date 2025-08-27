import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getBookingDetail, getMemberBookings, releaseBookingHold } from "../../api/bookingApi.js";
import Modal from "../../components/Modal.jsx";
import {useAuthStore} from "../../store/useAuthStore.js";
import axiosInstance from "../../api/axiosInstance.js";

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

    // 상세보기 모달 상태
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailData, setDetailData] = useState(null);

    // 취소 진행 상태
    const [cancelingId, setCancelingId] = useState(null);

    // 상영 시작 30분 전까지만 취소 가능
    const canCancel = (startAt) => {
        if (!startAt) return false;
        const start = new Date(startAt).getTime();
        if (Number.isNaN(start)) return false;
        const now = Date.now();
        const THIRTY_MIN = 30 * 60 * 1000;
        return now < (start - THIRTY_MIN);
    };

    const handleCancel = async (bk) => {
        try {
            if (!bk?.bookingId) {
                alert("예약 정보가 올바르지 않습니다.");
                return;
            }
            if (!canCancel(bk.screeningStartAt)) {
                alert("상영시간 30분 전까지만 취소할 수 있어요.");
                return;
            }
            const ok = window.confirm("정말 이 예매를 취소할까요?\n(취소 후 좌석은 해제됩니다)");
            if (!ok) return;
            setCancelingId(bk.bookingId);
            await releaseBookingHold(bk.bookingId);
            // 성공 시 목록에서 제거 (서버 재조회 전 UX 반영)
            setBookings(prev => prev.filter(item => item.bookingId !== bk.bookingId));
        } catch (e) {
            console.error("[MyBookings] 예매 취소 실패:", e);
            const msg = e?.response?.data?.message || e?.message || "취소 처리 중 오류가 발생했습니다.";
            alert(msg);
        } finally {
            setCancelingId(null);
        }
    };

    // 포스터 URL이 보호 자원(/api/...)이거나 상대경로인 경우, 토큰을 사용해 Blob으로 가져와서 ObjectURL로 변환
    const loadPosterBlobUrl = async (posterUrl) => {
        try {
            if (!posterUrl) return null;
            const isAbsolute = /^https?:\/\//i.test(posterUrl);
            const isApiPath = posterUrl.startsWith("/api");
            // 절대 URL이면서 공개 리소스면 그대로 사용
            if (isAbsolute && !isApiPath) return posterUrl;
            // 그 외에는 axiosInstance(Authorization 포함)로 Blob 요청
            const resp = await axiosInstance.get(posterUrl, { responseType: "blob" });
            const blobUrl = URL.createObjectURL(resp.data);
            return blobUrl;
        } catch (e) {
            console.warn("[MyBookings] 포스터 로드 실패:", posterUrl, e);
            return null;
        }
    };

    // 상세보기: 리스트 요약 + 상세 응답 병합 (요청 필드만 구성)
    const openDetail = async (bkOrId) => {
        try {
            const pre = (bkOrId && typeof bkOrId === 'object') ? bkOrId : null;
            const bookingId = pre?.bookingId ?? pre?.id ?? bkOrId;

            const detail = await getBookingDetail(bookingId);

            const qrCodeUrl = detail?.qrCodeUrl || detail?.qr_code_url || null;
            const movieTitle = detail?.movie?.title || detail?.movieTitle || pre?.movieTitle || "";

            // 상영시간/종료시간
            const screeningStartAt = detail?.screening?.startAt
                || detail?.screeningStartAt
                || pre?.screeningStartAt
                || null;
            const screeningEndAt = detail?.screening?.endAt
                || detail?.screeningEndAt
                || pre?.screeningEndAt
                || null;

            // bookingTime
            const bookingTime = detail?.bookingTime || detail?.booking_time || pre?.bookingTime || null;

            // 상영관 이름 (요약/상세 중 가용값)
            const screenName = detail?.screening?.screen?.name
                || detail?.screenName
                || pre?.screenName
                || "";

            // 좌석
            let seats = Array.isArray(detail?.seats) ? detail.seats
                : (Array.isArray(detail?.seatLabels) ? detail.seatLabels : undefined);
            if (!seats) {
                seats = Array.isArray(pre?.seats) ? pre.seats : [];
            }

            // 금액/상태
            const paymentStatus = detail?.paymentStatus || detail?.status || pre?.paymentStatus || "";
            const totalPrice = detail?.totalPrice ?? detail?.amount ?? pre?.totalPrice ?? 0;

            setDetailData({
                bookingId,
                qrCodeUrl,
                movieTitle,
                screeningStartAt,
                screeningEndAt,
                bookingTime,
                screenName,
                seats,
                paymentStatus,
                totalPrice,
            });
            setDetailOpen(true);
        } catch (e) {
            console.error("[MyBookings] 상세 불러오기 실패:", e);
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

                // Page<BookingSummaryDTO> 반환 (bookingApi에서 data만 반환)
                const page = await getMemberBookings(memberId, { status: "CONFIRMED" });

                const list = Array.isArray(page) ? page : (page?.content ?? []);
                const normalized = await Promise.all(list.map(async (b) => {
                    const poster = b.posterUrl || null;
                    let posterUrl = poster;
                    if (posterUrl) {
                        const usable = await loadPosterBlobUrl(posterUrl);
                        if (usable) posterUrl = usable;
                    }
                    return {
                        bookingId: b.bookingId ?? b.id,
                        movieTitle: b.movieTitle ?? "제목 없음",
                        screeningStartAt: b.screeningStartAt ?? b.startAt ?? b.start_at ?? null,
                        screeningEndAt: b.screeningEndAt ?? b.endAt ?? b.end_at ?? null,
                        screenName: b.screenName ?? b.screen?.name ?? "",
                        screenLocation: b.screenLocation ?? b.screen?.location ?? "",
                        seats: Array.isArray(b.seats) ? b.seats : (Array.isArray(b.seatLabels) ? b.seatLabels : []),
                        paymentStatus: b.paymentStatus ?? b.status ?? "",
                        totalPrice: b.totalPrice ?? b.amount ?? 0,
                        posterUrl,
                    };
                }));

                setBookings(normalized);
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

    // (이전 groupedBookings useMemo는 제거됨)

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
                    {bookings.map(bk => {
                        const when = bk.screeningStartAt ? new Date(bk.screeningStartAt) : null;
                        const endWhen = bk.screeningEndAt ? new Date(bk.screeningEndAt) : null;
                        const y = when?.getFullYear();
                        const m = when ? String(when.getMonth() + 1).padStart(2, "0") : "";
                        const d = when ? String(when.getDate()).padStart(2, "0") : "";
                        const hh = when ? String(when.getHours()).padStart(2, "0") : "";
                        const mi = when ? String(when.getMinutes()).padStart(2, "0") : "";
                        const eh = endWhen ? String(endWhen.getHours()).padStart(2, "0") : "";
                        const emi = endWhen ? String(endWhen.getMinutes()).padStart(2, "0") : "";
                        const seatsText = Array.isArray(bk.seats) ? bk.seats.join(", ") : "";
                        const cancellable = canCancel(bk.screeningStartAt);
                        return (
                            <div
                                key={bk.bookingId}
                                style={{
                                    display: "flex",
                                    gap: "20px",
                                    border: "1px solid #ddd",
                                    borderRadius: "8px",
                                    padding: "10px",
                                    alignItems: "center",
                                }}
                            >
                                {bk.posterUrl ? (
                                    <img
                                        src={bk.posterUrl}
                                        alt={bk.movieTitle}
                                        style={{ width: "100px", height: "150px", objectFit: "cover", borderRadius: "4px" }}
                                    />
                                ) : (
                                    <div style={{ width: "100px", height: "150px", backgroundColor: "#ccc", borderRadius: "4px" }} />
                                )}

                                <div>
                                    <h3 style={{ margin: "4px 0" }}><strong>영화제목 :</strong> {bk.movieTitle}</h3>
                                    <p style={{ margin: "4px 0" }}><strong>상영관 :</strong> {bk.screenName || "-"}</p>
                                    <p style={{ margin: "4px 0" }}><strong>좌석 :</strong> {seatsText || "-"}</p>
                                    <p style={{ margin: "4px 0" }}><strong>상영시간 :</strong> {when ? `${y}-${m}-${d} ${hh}:${mi}` : "-"}{endWhen ? ` ~ ${eh}:${emi}` : ""}</p>
                                    <div style={{ marginTop: "8px" }}>
                                        <button
                                            type="button"
                                            onClick={() => openDetail(bk)}
                                            style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#f8f8f8" }}
                                        >
                                            티켓보기
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCancel(bk)}
                                            disabled={!cancellable || cancelingId === bk.bookingId}
                                            title={!cancellable ? "상영 30분 전 이후에는 취소할 수 없습니다" : ""}
                                            style={{
                                                fontSize: 12,
                                                padding: "6px 10px",
                                                border: "1px solid #ddd",
                                                borderRadius: 6,
                                                background: (!cancellable || cancelingId === bk.bookingId) ? "#eee" : "#f8f8f8",
                                                color: (!cancellable || cancelingId === bk.bookingId) ? "#999" : "inherit",
                                                cursor: (!cancellable || cancelingId === bk.bookingId) ? "not-allowed" : "pointer"
                                            }}
                                        >
                                            {cancelingId === bk.bookingId ? "취소 중..." : "예매취소"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)}
                   contentStyle={{ width: "min(92vw, 720px)", padding: 20, borderRadius: 10, backgroundColor: "#fff" }}
            >
                {detailData ? (
                    <div style={{ maxWidth: 520 }}>
                        <p style={{ margin: "4px 0" }}>
                            <strong>제목 :</strong>{" "}
                            {detailData.movieTitle}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>상영관 :</strong>{" "}
                            {detailData.screenName || "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>좌석 :</strong>{" "}
                            {Array.isArray(detailData.seats) && detailData.seats.length > 0 ? detailData.seats.join(", ") : "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>상영시간 :</strong>{" "}
                            {detailData.screeningStartAt ? new Date(detailData.screeningStartAt).toLocaleString() : "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>종료시간 :</strong>{" "}
                            {detailData.screeningEndAt ? new Date(detailData.screeningEndAt).toLocaleString() : "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>예매일시 :</strong>{" "}
                            {detailData.bookingTime ? new Date(detailData.bookingTime).toLocaleString() : "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>총액 :</strong>{" "}{Number(detailData.totalPrice).toLocaleString()}원
                        </p>

                        <div style={{ marginTop: 12 }}>
                            {detailData.qrCodeUrl ? (
                                <img src={detailData.qrCodeUrl} alt="QR" style={{ width: 180, height: 180 }} />
                            ) : (
                                <p style={{ color: "#666" }}>QR을 불러오지 못했습니다.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <p>불러오는 중...</p>
                )}
            </Modal>
        </main>
    );
};

export default MyBookings;
