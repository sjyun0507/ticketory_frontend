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

    // 취소 모달 상태 및 사유 선택
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null); // 선택된 예약(bk)
    const [cancelReason, setCancelReason] = useState("CHANGE_OF_PLANS");
    const cancelReasons = [
        { value: "CHANGE_OF_PLANS", label: "일정 변경" },
        { value: "MISTAKE", label: "잘못된 예매" },
        { value: "PRICE", label: "가격/좌석 재선택" },
        { value: "WEATHER", label: "날씨/이동 문제" },
        { value: "HEALTH", label: "건강 문제" },
        { value: "OTHER", label: "기타" },
    ];
    const [cancelEtc, setCancelEtc] = useState("");
    // 상단 탭(전체/결제완료/결제취소)
    const [tab, setTab] = useState("ALL"); // ALL | PAID | CANCELED
    // 방금 상태가 변경된 항목을 현재 뷰에서 유지하기 위한 로컬 스티키 세트
    const [stickyIds, setStickyIds] = useState(new Set());
    // 상영 시작 30분 전까지만 취소 가능
    const canCancel = (startAt) => {
        if (!startAt) return false;
        const start = new Date(startAt).getTime();
        if (Number.isNaN(start)) return false;
        const now = Date.now();
        const THIRTY_MIN = 30 * 60 * 1000;
        return now < (start - THIRTY_MIN);
    };

    // DTO seats: List<String> (fallback: comma-separated string)
    const normalizeSeatLabels = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
        }
        if (typeof raw === 'string') {
            return raw.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [];
    };

    // 문자열 LocalDateTime, epoch(ms), Date 모두 처리하는 파서 (Safari/WebKit 대응)
    const toDateSafe = (v) => {
        if (!v) return null;
        if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
        if (typeof v === 'number') {
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof v === 'string') {
            let s = v.trim();
            // "YYYY-MM-DD HH:mm[:ss]" → "YYYY-MM-DDTHH:mm[:ss]"
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(s)) {
                s = s.replace(' ', 'T');
            }
            // 초가 없으면 ":00" 보강
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
                s = s + ':00';
            }
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d;
            console.warn('[MyBookings] toDateSafe: 파싱 실패 원본=', v);
            return null;
        }
        return null;
    };

    const handleCancel = async (bk) => {
        // 모달을 띄우는 경로로 변경
        try {
            if (!bk?.bookingId) {
                alert("예약 정보가 올바르지 않습니다.");
                return;
            }
            if (!canCancel(bk.screeningStartAt)) {
                alert("상영시간 30분 전까지만 취소할 수 있어요.");
                return;
            }
            setCancelTarget(bk);
            setCancelReason("CHANGE_OF_PLANS");
            setCancelEtc("");
            setCancelOpen(true);
        } catch (e) {
            console.error("[MyBookings] 취소 모달 오픈 실패:", e);
        }
    };

    // 실제 취소 확정
    const confirmCancel = async () => {
        const bk = cancelTarget;
        if (!bk?.bookingId) {
            setCancelOpen(false);
            return;
        }
        try {
            setCancelingId(bk.bookingId);

            // NOTE: 백엔드는 단일 사유와(선택) 비고 문자열을 받도록 전송합니다.
            if (cancelReason === "OTHER" && !cancelEtc.trim()) {
                alert("기타 사유를 입력해주세요.");
                setCancelingId(null);
                return;
            }

            await releaseBookingHold(bk.bookingId, {
                reason: cancelReason,                  // "CHANGE_OF_PLANS" | "MISTAKE" | "PRICE" | "WEATHER" | "HEALTH" | "OTHER"
                note: cancelReason === "OTHER" ? cancelEtc.trim() : ""  // 선택 입력
            });

            // 성공 시 상태를 "CANCELED"로 업데이트 (서버 재조회 전 UX 반영)
            setBookings(prev => prev.map(item =>
                item.bookingId === bk.bookingId
                    ? { ...item, paymentStatus: 'CANCELLED', uiStatus: 'CANCELED', uiStatusLabel: '예매취소' }
                    : item
            ));
            // 방금 취소한 항목을 stickyIds에 추가하여 현재 뷰에서 유지
            setStickyIds(prev => {
              const next = new Set(prev);
              next.add(bk.bookingId);
              return next;
            });
            setCancelOpen(false);
            setCancelTarget(null);
            setCancelEtc("");
        } catch (e) {
            console.error("[MyBookings] 예매 취소 실패:", e);
            const msg = e?.response?.data?.message || e?.message || "취소 처리 중 오류가 발생했습니다.";
            alert(msg);
        } finally {
            setCancelingId(null);
        }
    };

    const closeCancelModal = () => {
        setCancelOpen(false);
        setCancelTarget(null);
        setCancelEtc("");
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

            // Debug: raw detail
            console.groupCollapsed('[MyBookings] Booking detail raw');
            console.log('detail:', detail);
            console.groupEnd();

            const bookingIdNum = pre?.bookingId ?? pre?.id ?? bookingId;
            const movieTitle = detail?.movieTitle ?? '';
            // 상영일시: DTO(top-level) 우선, 없으면 nested(screening.startAt/endAt), 마지막으로 목록(pre)
            const screeningStartAt = (
              detail?.screeningStartAt ?? detail?.screening?.startAt ?? pre?.screeningStartAt ?? null
            );
            const screeningEndAt = (
              detail?.screeningEndAt ?? detail?.screening?.endAt ?? pre?.screeningEndAt ?? null
            );
            const bookingTime = detail?.bookingTime ?? null; // if DTO later includes it; otherwise remains null
            const screenName = detail?.screenName ?? '';
            const screenLocation = detail?.screenLocation ?? '';
            // 좌석: 상세 응답이 비어있으면 목록(pre)에서 폴백
            let seats = normalizeSeatLabels(detail?.seats);
            if ((!seats || seats.length === 0) && pre?.seats) {
              console.warn('[MyBookings] detail.seats 비어있음 → 목록 seats로 폴백');
              seats = normalizeSeatLabels(pre.seats);
            }
            const paymentStatus = detail?.paymentStatus ?? '';
            const totalPrice = detail?.totalPrice ?? 0;
            let posterUrl = detail?.posterUrl ?? pre?.posterUrl ?? null;

            // Optional debug log for date fields
            console.groupCollapsed('[MyBookings] detail date fields');
            console.log('screeningStartAt(raw):', screeningStartAt);
            console.log('screeningEndAt(raw):', screeningEndAt);
            console.log('screeningStartAt(parsed):', toDateSafe(screeningStartAt));
            console.log('screeningEndAt(parsed):', toDateSafe(screeningEndAt));
            console.groupEnd();

            // 보호 리소스인 경우 Blob URL 처리
            if (posterUrl) {
              try {
                const usable = await loadPosterBlobUrl(posterUrl);
                if (usable) posterUrl = usable;
              } catch (e) {
                console.warn('[MyBookings] poster load failed (detail):', e);
              }
            }

            // Debug: mapped detail
            console.groupCollapsed('[MyBookings] Booking detail mapped');
            console.log({ bookingId: bookingIdNum, movieTitle, screeningStartAt, screeningEndAt, screenName, screenLocation, seats, paymentStatus, totalPrice, posterUrl });
            console.groupEnd();

            setDetailData({
                bookingId: bookingIdNum,
                qrCodeUrl: detail?.qrCodeUrl || null,
                movieTitle,
                screeningStartAt,
                screeningEndAt,
                bookingTime,
                screenName,
                seats,
                paymentStatus,
                totalPrice,
                posterUrl,
                orderId: detail?.orderId || null,
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
          console.log("[MyBookings] fetchBookings() 호출, memberId:", memberId, "tab:", tab);
          try {
            setLoading(true);
            setError(null);

            // ---------- Helper: try multiple parameter shapes ----------
            const tryFetch = async (params) => {
              try {
                const page = await getMemberBookings(memberId, params);
                return Array.isArray(page) ? page : (page?.content ?? []);
              } catch (e) {
                console.warn("[MyBookings] getMemberBookings 실패 (params=)", params, e?.response || e);
                return null;
              }
            };

            let list = [];
            if (tab === 'PAID') {
              const paid = await tryFetch({ paymentStatus: 'PAID' }) || await tryFetch({ status: 'PAID' }) || [];
              list = paid;
            } else if (tab === 'CANCELED') {
              // Double-L 우선, 없으면 Single-L 시도
              let canceled = await tryFetch({ paymentStatus: 'CANCELLED' }) || await tryFetch({ status: 'CANCELLED' }) || [];
              if (!canceled || canceled.length === 0) {
                canceled = await tryFetch({ paymentStatus: 'CANCELED' }) || await tryFetch({ status: 'CANCELED' }) || [];
              }
              // 마지막 안전망: 전체 호출 후 클라 필터
              if (!canceled || canceled.length === 0) {
                const all = await tryFetch() || [];
                canceled = all.filter(b => {
                  const ps = (b.paymentStatus || b.status || '').toString().toUpperCase();
                  return ps === 'CANCELLED' || ps === 'CANCELED' || ps.includes('CANCEL');
                });
              }
              list = canceled;
            } else {
              // ALL: PAID + CANCELLED를 병합(중복 제거)
              const paid = await tryFetch({ paymentStatus: 'PAID' }) || await tryFetch({ status: 'PAID' }) || [];
              let canceled = await tryFetch({ paymentStatus: 'CANCELLED' }) || await tryFetch({ status: 'CANCELLED' }) || [];
              if (!canceled || canceled.length === 0) {
                canceled = await tryFetch({ paymentStatus: 'CANCELED' }) || await tryFetch({ status: 'CANCELED' }) || [];
              }
              const byId = new Map();
              [...paid, ...canceled].forEach(it => {
                const id = it.bookingId ?? it.id;
                if (!byId.has(id)) byId.set(id, it);
              });
              const merged = Array.from(byId.values());
              // 마지막 안전망: 둘 다 비었으면 기본 호출
              list = merged.length > 0 ? merged : (await tryFetch()) || [];
            }

            // Exclude FAILED payments from any tab
            const filteredList = (list || []).filter(b => {
              const ps = (b?.paymentStatus ?? b?.status ?? '').toString().toUpperCase();
              return ps !== 'FAILED';
            });

            // Log raw list for debugging
            console.groupCollapsed('[MyBookings] Bookings page raw');
            console.log('tab:', tab);
            console.log('list (after excluding FAILED):', filteredList);
            console.groupEnd();

            // ---------- Normalize ----------
            const normalized = await Promise.all(filteredList.map(async (b) => {
              const poster = b.posterUrl || null;
              let posterUrl = poster;
              if (posterUrl) {
                const usable = await loadPosterBlobUrl(posterUrl);
                if (usable) posterUrl = usable;
              }

              const rawStatus = (b.paymentStatus ?? b.status ?? "").toString().toUpperCase();
              // 서버 표준: PAID | CANCELLED (Double-L)
              let uiStatus;
              if (rawStatus === "PAID") uiStatus = "PAID";
              else if (rawStatus === "CANCELLED") uiStatus = "CANCELED"; // UI 표기 통일(미국식 철자)
              else if (rawStatus.includes("CANCEL")) uiStatus = "CANCELED"; // 안전망
              else uiStatus = "PAID"; // 기본값
              const uiStatusLabel = uiStatus === "CANCELED" ? "예매취소" : (uiStatus === "PAID" ? "결제완료" : uiStatus);

              return {
                bookingId: b.bookingId ?? b.id,
                movieTitle: b.movieTitle ?? '',
                screeningStartAt: b.screeningStartAt ?? null,
                screeningEndAt: b.screeningEndAt ?? null,
                screenName: b.screenName ?? '',
                screenLocation: b.screenLocation ?? '',
                seats: normalizeSeatLabels(b.seats),
                paymentStatus: b.paymentStatus ?? '',
                totalPrice: b.totalPrice ?? 0,
                posterUrl,
                uiStatus,
                uiStatusLabel,
              };
            }));

            setBookings(normalized);
            // Debug: normalized bookings
            console.groupCollapsed('[MyBookings] Bookings normalized');
            console.table(normalized.map(n => ({ id: n.bookingId, title: n.movieTitle, start: n.screeningStartAt, seats: n.seats?.join(', '), status: n.paymentStatus, price: n.totalPrice })));
            console.groupEnd();
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
    }, [memberId, tab]);

    const filteredBookings = useMemo(() => {
      const toPS = (b) => (b.paymentStatus || '').toString().toUpperCase();
      const isSticky = (b) => stickyIds.has(b.bookingId);
      // Base: exclude FAILED for all views
      const base = bookings.filter(b => toPS(b) !== 'FAILED');

      if (tab === 'PAID') return base.filter(b => toPS(b) === 'PAID' || isSticky(b));

      if (tab === 'CANCELED') return base.filter(b => {
        const ps = toPS(b);
        return ps === 'CANCELLED' || ps === 'CANCELED';
      });

      // ALL
      return base;
    }, [bookings, tab, stickyIds]);

    // PAID 탭이 아닐 때 stickyIds를 비움 (UX: 무한 스티키 방지)
    useEffect(() => {
      if (tab !== 'PAID' && stickyIds.size) {
        setStickyIds(new Set());
      }
    }, [tab]);

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
            <h1 className="text-xl md:text-2xl font-bold mb-4">예매 내역</h1>

            <div className="mb-4 inline-flex rounded-2xl bg-gray-100 p-1">
                <button
                    type="button"
                    onClick={() => setTab("ALL")}
                    className={`px-4 py-1.5 text-sm rounded-full border ${tab==='ALL'?'bg-gray-900 text-white border-gray-900':'bg-gray-100 text-gray-700 border-gray-200'}`}
                >전체</button>
                <button
                    type="button"
                    onClick={() => setTab("PAID")}
                    className={`px-4 py-1.5 text-sm rounded-full border ${tab==='PAID'?'bg-gray-900 text-white border-gray-900':'bg-gray-100 text-gray-700 border-gray-200'}`}
                >결제완료</button>
                <button
                    type="button"
                    onClick={() => setTab("CANCELED")}
                    className={`px-4 py-1.5 text-sm rounded-full border ${tab==='CANCELED'?'bg-gray-900 text-white border-gray-900':'bg-gray-100 text-gray-700 border-gray-200'}`}
                >결제취소</button>
            </div>
            {loading ? (
                <p>로딩 중...</p>
            ) : error ? (
                <p>{error}</p>
            ) : filteredBookings.length === 0 ? (
                <p>예매 내역이 없습니다.</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
                    {filteredBookings.map(bk => {
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
                                className={`flex items-center gap-5 border border-gray-200 rounded-lg p-3 ${bk.uiStatus==='CANCELED' ? 'bg-gray-50 opacity-80' : ''}`}
                            >
                                <div className="relative">
                                    {bk.posterUrl ? (
                                        <img
                                            src={bk.posterUrl}
                                            alt={bk.movieTitle}
                                            className="w-[100px] h-[150px] object-cover rounded"
                                        />
                                    ) : (
                                        <div className="w-[100px] h-[150px] bg-gray-300 rounded" />
                                    )}
                                    <span
                                        className={`absolute top-1 left-1 inline-block text-[11px] px-2 py-0.5 rounded-full border shadow ${bk.uiStatus==='CANCELED' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                                    >
                                        {bk.uiStatusLabel}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="my-1"><strong>영화제목 :</strong> {bk.movieTitle}</h3>
                                    <p className="my-1"><strong>상영관 :</strong> {bk.screenName || "-"}</p>
                                    <p className="my-1"><strong>좌석 :</strong> {seatsText || "-"}</p>
                                    <p className="my-1"><strong>상영시간 :</strong> {when ? `${y}-${m}-${d} ${hh}:${mi}` : "-"}{endWhen ? ` ~ ${eh}:${emi}` : ""}</p>
                                    <div className="mt-2">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openDetail(bk)}
                                                disabled={bk.uiStatus === 'CANCELED'}
                                                aria-disabled={bk.uiStatus === 'CANCELED'}
                                                title={bk.uiStatus === 'CANCELED' ? '결제 취소된 예매는 티켓을 볼 수 없습니다' : ''}
                                                className={`text-[12px] px-2.5 py-1.5 border border-gray-200 rounded 
                                                    ${bk.uiStatus === 'CANCELED' 
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                                        : 'bg-gray-50 hover:bg-gray-100'}`}
                                            >
                                                티켓보기
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCancel(bk)}
                                                disabled={!cancellable || cancelingId === bk.bookingId || bk.uiStatus === 'CANCELED'}
                                                title={!cancellable ? "상영 30분 전 이후에는 취소할 수 없습니다" : ""}
                                                className={`text-[12px] px-2.5 py-1.5 border border-gray-200 rounded ${(!cancellable || cancelingId === bk.bookingId || bk.uiStatus==='CANCELED') ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-indigo-100 hover:bg-indigo-200'}`}
                                            >
                                                {bk.uiStatus === 'CANCELED' ? '취소됨' : (cancelingId === bk.bookingId ? '취소 중...' : '예매취소')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* 취소 사유 선택 모달 */}
            <Modal
                isOpen={cancelOpen}
                onClose={cancelingId ? undefined : closeCancelModal}
                contentStyle={{ width: "min(92vw, 520px)", padding: "32px 28px 24px 24px", borderRadius: 10, backgroundColor: "#fff" }}
            >
                <div className="max-w-[600px] p-5 rounded-lg bg-white">
                    <h3 className="font-bold text-[18px] mb-3">예매 취소</h3>
                    <p className="text-gray-600 mb-3">
                        예매 취소 사유를 선택해 주세요. (서비스 개선에만 활용됩니다)
                    </p>

                    <label className="block text-sm mb-1">취소 사유</label>
                    <select
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        disabled={!!cancelingId}
                        className="w-full px-2.5 py-2 border border-gray-200 rounded"
                    >
                        {cancelReasons.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>

                    {cancelReason === "OTHER" && (
                        <div className="mt-2.5">
                            <label className="block text-sm mb-1">기타 사유 (선택)</label>
                            <textarea
                                value={cancelEtc}
                                onChange={(e) => setCancelEtc(e.target.value)}
                                maxLength={200}
                                placeholder="최대 200자"
                                disabled={!!cancelingId}
                                className="w-full min-h-20 p-2.5 border border-gray-200 rounded resize-y"
                            />
                        </div>
                    )}

                    <div className="flex gap-2.5 justify-end mt-4">
                        <button
                            type="button"
                            onClick={closeCancelModal}
                            disabled={!!cancelingId}
                            className="px-3 py-2 border border-gray-200 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
                        >
                            닫기
                        </button>
                        <button
                            type="button"
                            onClick={confirmCancel}
                            disabled={!!cancelingId}
                            className={`px-3 py-2 border border-gray-200 rounded ${cancelingId ? 'bg-gray-200' : 'bg-indigo-100 hover:bg-indigo-200'} disabled:opacity-60`}
                            title={!cancelTarget || !canCancel(cancelTarget?.screeningStartAt) ? "상영 30분 전 이후에는 취소할 수 없습니다" : ""}
                        >
                            {cancelingId ? "처리 중..." : "예매 취소"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)}
                   contentStyle={{ width: "min(92vw, 720px)", padding: "32px 28px 24px 24px", borderRadius: 10, backgroundColor: "#fff" }}
            >
                {detailData ? (
                  <div className="relative w-[640px] max-w-full mt-1.5">
                    <div className="relative bg-zinc-900 text-white rounded-2xl shadow-2xl overflow-hidden">
                      {/* 헤더: 포스터 배경 + 그라데이션 */}
                      <div
                        className="relative h-[220px]"
                        style={detailData.posterUrl ? { backgroundImage: `url(${detailData.posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/80" />

                        {/* 판매번호(샘플 포맷) */}
                        <div className="absolute top-3 left-4 text-[12px] opacity-90">
                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/10 ring-1 ring-white/20">
                            <span className="opacity-80">판매번호</span>
                            <span className="font-mono tracking-wide">{detailData.orderId || String(detailData.bookingId ?? '').padStart(4, '0')}</span>
                          </span>
                        </div>

                        {/* 제목/상영관 */}
                        <div className="absolute bottom-4 left-4 pr-36">
                          <h2 className="text-2xl font-extrabold drop-shadow">{detailData.movieTitle}</h2>
                          <p className="text-sm text-white/85 mt-1">Ticketory 대구 / {detailData.screenName || '-'}</p>
                        </div>

                        {/* QR (오버레이) */}
                        <div className="absolute bottom-4 right-4">
                          {detailData.qrCodeUrl ? (
                            <img src={detailData.qrCodeUrl} alt="QR" className="w-28 h-28 bg-white p-2 rounded-lg" />
                          ) : (
                            <div className="w-28 h-28 bg-white/10 rounded-lg grid place-items-center text-xs">QR N/A</div>
                          )}
                        </div>
                      </div>

                      {/* 구분선 */}
                      <div className="h-[1px] bg-white/10" />

                      {/* 본문 정보 */}
                      <div className="p-5 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <div className="text-white/60 text-sm">상영일시</div>
                            <div className="font-semibold mt-0.5">
                              {(() => {
                                const s = toDateSafe(detailData.screeningStartAt);
                                const e = toDateSafe(detailData.screeningEndAt);
                                if (!s) return '-';
                                const left = s.toLocaleString();
                                const right = e ? ' ~ ' + e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                return left + right;
                              })()}
                            </div>
                          </div>
                          <div>
                            <div className="text-white/60 text-sm">예매일시</div>
                            <div className="mt-0.5">{detailData.bookingTime ? new Date(detailData.bookingTime).toLocaleString() : '-'}</div>
                          </div>
                          <div>
                            <div className="text-white/60 text-sm">좌석</div>
                            <div className="mt-0.5 font-semibold">{Array.isArray(detailData.seats) && detailData.seats.length > 0 ? detailData.seats.join(', ') : '-'}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="text-white/60 text-sm">결제상태</div>
                            <div className="mt-0.5">
                              <span className={`inline-block px-2 py-1 rounded-md text-sm ${String(detailData.paymentStatus).toUpperCase()==='PAID' ? 'bg-emerald-500/20 ring-1 ring-emerald-400/50' : 'bg-red-500/20 ring-1 ring-red-400/50'}`}>
                                {String(detailData.paymentStatus).toUpperCase()==='PAID' ? '결제완료' : '예매취소'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="text-white/60 text-sm">총액</div>
                            <div className="mt-0.5 font-bold">{Number(detailData.totalPrice).toLocaleString()}원</div>
                          </div>
                        </div>
                      </div>
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
