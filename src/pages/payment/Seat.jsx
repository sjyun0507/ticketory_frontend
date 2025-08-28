import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {getSeatMap} from "../../api/seatApi.js";
import { getMovieDetail } from "../../api/movieApi.js";
import enter from '../../assets/styles/enter.png';
import exit from '../../assets/styles/exit.png';
import {initBooking} from "../../api/bookingApi.js";
import api from "../../api/axiosInstance.js";
import {getPricingRules} from "../../api/adminApi.js";

/* 좌석 선택 & 페이
screeningId를 param으로 불러와서 좌석배치 불러옴 {available, hold, booked} (백엔드) -> 프론트에서는 AVAILABLE/HELD/SOLD 로 변환하여 사용)
*/

// 백엔드 상태(normalize): {available, hold, booked} -> {AVAILABLE, HELD, SOLD}
const normalizeStatus = (s) => {
  if (!s) return "AVAILABLE";
  const v = String(s).toLowerCase();
  if (v === "booked" || v === "sold") return "SOLD";
  if (v === "hold" || v === "held") return "HELD";
  if (v === "blocked" || v === "block") return "BLOCKED";
  if (v === "available" || v === "avail") return "AVAILABLE";
  return String(s).toUpperCase();
};


// 가격 정책 (기본값)
const DEFAULT_PRICE = { adult: 14000, teen: 11000 };

// ----- Pricing helpers (pricing_rule: op, amount, priority, valid window, enabled) -----
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim();
  // Accept both "YYYY-MM-DDTHH:mm:ss" and "YYYY-MM-DD HH:mm:ss"
  const isoLike = s.includes('T') ? s : s.replace(' ', 'T');
  let d = new Date(isoLike);
  if (!isNaN(d.getTime())) return d;
  // Fallback manual parse
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, da, h, mi, sec] = m;
    d = new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(sec || '0'));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const nowIsBetween = (from, to) => {
  const now = new Date();
  const f = toDate(from);
  const t = toDate(to);
  const fromOk = !f || f <= now;
  const toOk = !t || now <= t;
  return fromOk && toOk;
};

const normalizeKind = (k) => (k ?? "").toString().toUpperCase();
const normalizeOp = (op) => (op ?? "").toString().toUpperCase();

/**
 * Apply a list of pricing rules to a base price.
 * Supports ops: SET, PLUS, MINUS, PCT_PLUS, PCT_MINUS
 * Percent ops treat amount as percentage number (e.g., 10 => 10%).
 * Rules are applied in ascending priority (smaller number first), then by created_at ascending if present.
 */
const applyPricingRules = (basePrice, rules) => {
  if (!Array.isArray(rules) || rules.length === 0) return basePrice;

  const ordered = [...rules]
    .map(r => ({
      ...r,
      priority: Number(r.priority ?? r.PRIORITY ?? 9999),
      amount: Number(r.amount ?? r.AMOUNT ?? 0),
      valid_from: r.valid_from ?? r.validFrom ?? r.VALID_FROM,
      valid_to: r.valid_to ?? r.validTo ?? r.VALID_TO,
      enabled: (r.enabled ?? r.ENABLED ?? 1) ? 1 : 0,
      created_at: r.created_at ?? r.createdAt ?? r.CREATED_AT ?? 0,
      id: r.id ?? r.ID,
      ID: r.ID ?? r.id,
    }))
    .filter(r => r.enabled === 1 && nowIsBetween(r.valid_from, r.valid_to))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const ia = (a.id ?? a.ID) ?? 0;
      const ib = (b.id ?? b.ID) ?? 0;
      if (ia !== ib) return ia - ib;
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return da - db;
    });

  let price = Number(basePrice);
  for (const r of ordered) {
    const op = normalizeOp(r.op ?? r.OP);
    const amt = Number(r.amount);
    switch (op) {
      case 'SET':
        price = amt;
        break;
      case 'PLUS':
        price += amt;
        break;
      case 'MINUS':
        price -= amt;
        break;
      case 'PCT_PLUS':
        price += price * (amt / 100);
        break;
      case 'PCT_MINUS':
        price -= price * (amt / 100);
        break;
      default:
        // Unknown op: ignore
        break;
    }
  }
  // Guardrails: no negative price
  return Math.max(0, Math.round(price));
};

// Traced variant: returns { price, trace[] }
const applyPricingRulesWithTrace = (basePrice, rules) => {
  if (!Array.isArray(rules) || rules.length === 0) return { price: Math.max(0, Math.round(basePrice)), trace: [] };

  const ordered = [...rules]
    .map(r => ({
      ...r,
      priority: Number(r.priority ?? r.PRIORITY ?? 9999),
      amount: Number(r.amount ?? r.AMOUNT ?? 0),
      valid_from: r.valid_from ?? r.validFrom ?? r.VALID_FROM,
      valid_to: r.valid_to ?? r.validTo ?? r.VALID_TO,
      enabled: (r.enabled ?? r.ENABLED ?? 1) ? 1 : 0,
      created_at: r.created_at ?? r.createdAt ?? r.CREATED_AT ?? 0,
      id: r.id ?? r.ID,
      ID: r.ID ?? r.id,
    }))
    .filter(r => r.enabled === 1 && nowIsBetween(r.valid_from, r.valid_to))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const ia = (a.id ?? a.ID) ?? 0;
      const ib = (b.id ?? b.ID) ?? 0;
      if (ia !== ib) return ia - ib;
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return da - db;
    });

  let price = Number(basePrice);
  const trace = [];
  for (const r of ordered) {
    const op = normalizeOp(r.op ?? r.OP);
    const amt = Number(r.amount);
    const before = price;
    switch (op) {
      case 'SET':
        price = amt; break;
      case 'PLUS':
        price += amt; break;
      case 'MINUS':
        price -= amt; break;
      case 'PCT_PLUS':
        price += price * (amt / 100); break;
      case 'PCT_MINUS':
        price -= price * (amt / 100); break;
      default:
        // ignore unknown op
        break;
    }
    trace.push({ id: r.id, op, amount: amt, priority: r.priority, before, after: price });
  }
  price = Math.max(0, Math.round(price));
  return { price, trace };
};

const formatOpLabel = (op, amount) => {
  switch (normalizeOp(op)) {
    case 'SET': return `정가 ${Number(amount).toLocaleString()}원`;
    case 'PLUS': return `가산 ${Number(amount).toLocaleString()}원`;
    case 'MINUS': return `프로모션 할인 ${Number(amount).toLocaleString()}원`;
    case 'PCT_PLUS': return `가산 ${Number(amount)}%`;
    case 'PCT_MINUS': return `프로모션 할인 ${Number(amount)}%`;
    default: return `${op} ${amount}`;
  }
};

const Seat = () => {
  // 동적 가격: screen_id + kind(ADULT/TEEN) 기반
  const [price, setPrice] = useState(DEFAULT_PRICE);
  const [promo, setPromo] = useState({ adult: [], teen: [] });

  // seat-map 응답에서 screen_id 추출 시도
  const resolveScreenId = React.useCallback((payload) => {
    if (!payload) return undefined;
    // 가능성 있는 경로를 차례로 확인
    return (
      payload.screenId ??
      payload.screen_id ??
      payload.screen?.id ??
      payload.auditorium?.id ??
      payload.auditoriumId ??
      undefined
    );
  }, []);
    const [params] = useSearchParams();
    const location = useLocation();
    const movieId = params.get('movieId') ?? location.state?.movieId ?? undefined;
    const screeningId = params.get('screeningId') ?? location.state?.screeningId ?? undefined;
    const date = params.get('date') ?? location.state?.date ?? undefined;
    const start = params.get('start') ?? location.state?.start ?? undefined;
    const auditorium = params.get('auditorium') ?? location.state?.auditorium ?? undefined;
    const title = params.get('title') ?? location.state?.title ?? undefined;
    const cameFromPayment = (location.state?.from === 'payment') || !!params.get('refresh');

    // Fallbacks: restore summary from localStorage if params/state are missing
    let savedSummary = {};
    try {
      const raw = localStorage.getItem('seatSummary');
      if (raw) savedSummary = JSON.parse(raw);
    } catch (_) {}

    const resolvedAuditorium = auditorium ?? savedSummary.auditorium;
    const resolvedDate = date ?? savedSummary.date;
    const resolvedStart = start ?? savedSummary.start;
    const resolvedTitle = (title ?? savedSummary.title) || '';
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // 인원 수 및 선택 좌석 상태
    const [people, setPeople] = useState({ adult: 0, teen: 0 });
    const [selected, setSelected] = useState([]); // [101, 102] 숫자로 매핑
    const [submitting, setSubmitting] = useState(false);
    const [movieDetail, setMovieDetail] = useState(null);
    useEffect(() => {
      let cancel = false;
      (async () => {
        if (!movieId) return;
        try {
          const res = await getMovieDetail(Number(movieId));
          const raw = res?.data ?? res;
          if (!cancel) setMovieDetail(raw);
        } catch (e) {
          console.warn('[seat] movie detail load failed', e?.response?.status, e?.response?.data || e);
        }
      })();
      return () => { cancel = true; };
    }, [movieId]);
    const displayTitle = resolvedTitle || movieDetail?.title || movieDetail?.name || '';
    const totalPeople = useMemo(() => people.adult + people.teen, [people]);
    const totalAmount = useMemo(() => (people.adult * price.adult) + (people.teen * price.teen), [people, price]);

    // 좌석 맵 조회 (screeningId 기준)
    const { data, isLoading, isError } = useQuery({
        queryKey: ["seat-map", screeningId],
        queryFn: () => getSeatMap(Number(screeningId)).then(res => res.data),
        enabled: !!screeningId,
    });

    // 가격 정책 불러오기: screen_id 기준
    useEffect(() => {
      let cancel = false;
      async function loadPricing() {
        try {
          const sid = resolveScreenId(data);
          if (!sid) return; // 좌석 데이터에 screen_id가 없으면 기본가 유지

          const list = await getPricingRules(Number(sid));
          try {
            console.groupCollapsed('[pricing] rules raw');
            console.table(list.map(r => ({ id: r.id ?? r.ID, kind: r.kind ?? r.KIND, op: r.op ?? r.OP, amount: r.amount, priority: r.priority, valid_from: r.valid_from ?? r.validFrom, valid_to: r.valid_to ?? r.validTo, enabled: r.enabled })));
            console.groupEnd();
          } catch (_) {}

          // Group rules by kind and apply ops in priority order
          const byKind = list.reduce((acc, r) => {
            const k = normalizeKind(r.kind ?? r.KIND);
            (acc[k] ||= []).push(r);
            return acc;
          }, {});

          const adultBase = DEFAULT_PRICE.adult;
          const teenBase = DEFAULT_PRICE.teen;

          // Backend: null/ALL/CHILD/UNKNOWN are treated as global rules
          const common = [
            ...(byKind[''] || []),
            ...(byKind['ALL'] || []),
            ...(byKind['CHILD'] || []),
            ...(byKind['UNKNOWN'] || []),
          ];

          const adultRes = applyPricingRulesWithTrace(adultBase, [...common, ...(byKind['ADULT'] || [])]);
          const teenRes  = applyPricingRulesWithTrace(teenBase,  [...common, ...(byKind['TEEN']  || [])]);

          const next = { adult: adultRes.price, teen: teenRes.price };
          if (!cancel) {
            setPrice(next);
            setPromo({ adult: adultRes.trace, teen: teenRes.trace });
          }

          // Console diagnostics
          try {
            console.groupCollapsed('[pricing] 계산 결과 (screen_id=' + sid + ')');
            console.log('기본가(adult):', adultBase.toLocaleString(), '원');
            adultRes.trace.forEach((t, i) => console.log(`ADULT #${i+1}`, t.op, t.amount, '→', Math.round(t.after).toLocaleString()));
            console.log('최종(adult):', adultRes.price.toLocaleString(), '원');
            console.log('기본가(teen):', teenBase.toLocaleString(), '원');
            teenRes.trace.forEach((t, i) => console.log(`TEEN  #${i+1}`, t.op, t.amount, '→', Math.round(t.after).toLocaleString()));
            console.log('최종(teen):', teenRes.price.toLocaleString(), '원');
            console.groupEnd();
          } catch (_) {}
        } catch (e) {
          console.warn("[pricing] load failed, fallback to default", e?.response?.status, e?.response?.data || e);
          if (!cancel) setPrice(DEFAULT_PRICE);
        }
      }
      if (data && !isLoading && !isError) {
        loadPricing();
      }
      return () => { cancel = true; };
    }, [data, isLoading, isError, resolveScreenId]);

    // 좌석 id -> 좌석 객체 / 상태 맵
    // code("A1") -> seat_id, seat_id -> code, seat_id -> status
    const codeToSeatId = useMemo(() => {
        const m = new Map();
        data?.seats?.forEach((s) => {
            const seatId = s.seatId ?? s.id;
            const row = s.rowLabel ?? s.row_label ?? s.row;
            const col = s.colNumber ?? s.col_number ?? s.col;
            if (seatId != null && row != null && col != null) {
                m.set(`${row}${col}`, Number(seatId));
            }
        });
        return m;
    }, [data]);

    const seatIdToCode = useMemo(() => {
        const m = new Map();
        data?.seats?.forEach((s) => {
            const seatId = s.seatId ?? s.id;
            const row = s.rowLabel ?? s.row_label ?? s.row;
            const col = s.colNumber ?? s.col_number ?? s.col;
            if (seatId != null && row != null && col != null) {
                m.set(Number(seatId), `${row}${col}`);
            }
        });
        return m;
    }, [data]);

    const seatStatusBySeatId = useMemo(() => {
        const m = new Map();
        data?.seats?.forEach((s) => {
            const seatId = Number(s.seatId ?? s.id);
            m.set(seatId, normalizeStatus(s.status));
        });
        return m;
    }, [data]);

    const toggleSeat = (seatId) => {
        if (!seatId) return;
        // 인원 미선택 시 좌석 선택 제한
        if (totalPeople === 0) {
          alert("관람 인원을 먼저 선택해주세요.");
          return;
        }
        if (!data) return;
        const status = seatStatusBySeatId.get(Number(seatId)) || "AVAILABLE";
        if (["SOLD", "BLOCKED", "HELD","HOLD","EXPIRED"].includes(status)) return;
        // 인원 수 제한: 선택 좌석 수는 총 인원 수 이하여야 함
        const willSelect = !selected.includes(Number(seatId));
        if (willSelect && totalPeople > 0 && selected.length >= totalPeople) {
          alert("좌석 선택이 완료되었습니다.");
          return;
        }
        setSelected(prev => {
          const sid = Number(seatId);
          return prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid];
        });
    };

    async function handleNext() {
        if (submitting) return;
        const screeningIdNum = Number(screeningId);
        const seatIds = Array.from(new Set(selected.map(Number)));

        // Basic validations to avoid server 500s
        if (!screeningId) {
            alert("상영 회차 정보가 없습니다.");
            return;
        }
        if (!seatIds.length) {
            alert("선택된 좌석이 없습니다.");
            return;
        }
        if (totalPeople === 0 || selected.length !== totalPeople) {
            alert("관람 인원과 선택 좌석 수가 일치해야 합니다.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                screeningId: Number.isNaN(screeningIdNum) ? screeningId : screeningIdNum,
                seatIds,
                counts: { adult: people.adult, teen: people.teen },
                holdSeconds: 200,
            };
            console.log('[HOLD:req]', payload);

            // Preflight: ensure all selected seats are AVAILABLE at this moment
            const unavailable = seatIds.filter((sid) => {
              const st = seatStatusBySeatId.get(Number(sid)) || "AVAILABLE";
              return st !== "AVAILABLE";
            });
            if (unavailable.length > 0) {
              const codes = unavailable.map((sid) => seatIdToCode.get(Number(sid)) ?? String(sid));
              alert(`다음 좌석은 현재 선택할 수 없습니다: ${codes.join(", ")}`);
              // 선택 목록에서 제거
              setSelected((prev) => prev.filter((sid) => !unavailable.includes(sid)));
              // 최신 상태로 새로고침
              await queryClient.invalidateQueries({queryKey: ["seat-map", screeningId]});
              return;
            }

            const res = await initBooking(payload);
            console.log('[HOLD:res raw]', res);
            const out = res?.data ?? res;

            const bookingId = out?.bookingId ?? out?.id;
            const paymentId = out?.paymentId ?? out?.payment?.id;
            if (!bookingId) {
              throw new Error('bookingId가 응답에 없습니다.');
            }
            // --- Build cart items from selected seats (assign adult first, then teen)
            const cartItems = seatIds.map((sid, idx) => {
              const isAdult = idx < people.adult;
              const type = isAdult ? 'ADULT' : 'TEEN';
              const unitPrice = isAdult ? price.adult : price.teen;
              const code = seatIdToCode.get(Number(sid)) ?? String(sid);
              return {
                // 결제/주문 처리용
                seatId: Number(sid),
                movieId: Number(movieId) || undefined,
                screeningId: screeningIdNum,
                type,
                price: unitPrice,
                quantity: 1,
                // 화면 표시용
                name: displayTitle || title || '',
                label: displayTitle || title || '',
                screeningInfo: `${resolvedAuditorium ?? ''} · ${resolvedDate ?? ''} ${resolvedStart ?? ''}`.trim(),
                seatLabel: code,
                code, // 호환성 유지
              };
            });
            const amountValue = cartItems.reduce((sum, it) => sum + Number(it.price || 0), 0);
            const state = {
              cart: cartItems,
              amount: { value: amountValue },
              bookingId,
              screeningId: screeningIdNum,
              movieId: Number(movieId) || undefined,
              title: displayTitle || resolvedTitle || '',
              auditorium: resolvedAuditorium,
              date: resolvedDate,
              start: resolvedStart,
            };
            // Optional: backup for refresh
            try {
              localStorage.setItem('cartItems', JSON.stringify(cartItems));
              localStorage.setItem('cartAmount', String(amountValue));
              localStorage.setItem('seatSummary', JSON.stringify({
                movieId: Number(movieId) || undefined,
                screeningId: screeningIdNum,
                title: displayTitle || title || '',
                auditorium: resolvedAuditorium,
                date: resolvedDate,
                start: resolvedStart,
              }));
            } catch (_) {}
            const qs = new URLSearchParams({ bookingId: String(bookingId) });
            if (paymentId != null) qs.set('paymentId', String(paymentId));
            if (movieId) qs.set('movieId', String(movieId));
            if (screeningIdNum) qs.set('screeningId', String(screeningIdNum));
            navigate(`/payment?${qs.toString()}`, { state });
        } catch (e) {
          const status = e?.response?.status ?? 0;
          const data = e?.response?.data;
          console.error('[HOLD:error]', { status, data, error: e });
          if (!status) {
            // Network/JS error (no HTTP response)
            if (typeof window !== 'undefined' && !navigator.onLine) {
              alert('네트워크 연결이 없어 예약을 진행할 수 없습니다. 인터넷 연결을 확인해주세요.');
            } else {
              alert(e?.message || '예약 생성 중 알 수 없는 오류가 발생했습니다.');
            }
            return;
          }
          // HTTP error path
          const msg = (data?.message || data?.error || e.message || '').toString();
          if (msg.includes('이미 예매 완료된 좌석') || msg.includes('이미 예매') || status === 409) {
            await queryClient.invalidateQueries({ queryKey: ["seat-map", screeningId] });
            alert('선택하신 좌석 중 일부가 이미 예매/선점 되었습니다. 좌석 상태를 새로고침했어요. 다시 선택해주세요.');
          } else {
            alert(data?.message ?? data?.error ?? `예약 생성 중 오류가 발생했습니다. (코드 ${status})`);
          }
        } finally {
          setSubmitting(false);
        }
    }

    return (

        <div className="max-w-[1200px]  mx-auto mb-6 px-4 py-6 ">
            <div className="flex justify-between items-center gap-4 mb-4">
                <h1 className="text-2xl font-semibold">좌석 선택</h1>
            </div>
            {/* 메인 레이아웃: 좌측(관람인원+좌석) vs 우측 요약 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              {/* 좌측: 관람 인원 + 좌석 영역 (같은 너비) */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {/* 관람 인원 선택 */}
                <div className="border rounded-xl p-4 bg-white">
                  <div className="text-sm font-medium mb-3">관람인원선택</div>
                  <div className="grid grid-cols-2 gap-4">
                    {[{k:"adult",label:"성인"},{k:"teen",label:"청소년"}].map(item => (
                      <div key={item.k} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <span className="text-sm">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" className="w-7 h-7 border rounded" onClick={() => setPeople(p => ({...p, [item.k]: Math.max(0, p[item.k]-1)}))}>-</button>
                          <span className="w-5 text-center text-sm">{people[item.k]}</span>
                          <button type="button" className="w-7 h-7 border rounded" onClick={() => setPeople(p => ({...p, [item.k]: p[item.k]+1}))}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">선택 좌석 수는 총 인원 수({totalPeople}) 만큼 선택하셔야 합니다.</div>
                </div>

                {/* 좌석 영역 */}
                <div className="border rounded-xl bg-zinc-700  p-4">
                  {isLoading && <div className="py-14 text-center text-gray-500">좌석 정보를 불러오는 중…</div>}
                  {isError && <div className="py-14 text-center text-red-600">좌석 정보를 불러오지 못했습니다.</div>}
                  {!isLoading && !isError && data && (
                    <div>
                      {/* SCREEN 바 */}
                      <div className="mx-auto mb-2 w-2/3 h-3 bg-gray-200 rounded-full" title="SCREEN" />
                      <h2 className="text-center mb-3 font-semibold text-gray-200 text-xl">SCREEN</h2>

                      {/* 좌석 그리드 */}
                      <div className="overflow-auto bg-zinc-300 text-center justify-center border rounded-xl p-3 ">

                        <div className="flex">
                          <div className="h-6 w-6 overflow-hidden ml-auto">
                            <img
                              src={exit}
                              alt="Exit"
                              className="h-full object-contain"
                            />
                          </div>
                        </div>

                        <div className="inline-block ">
                          {data.rows?.map((r) => (
                            <div key={r} className="flex items-center gap-2 mb-2">
                              <div className="w-6 text-xs text-gray-800 text-right">{r}</div>
                              {[...Array(data.cols || 0)].map((_, idx) => {
                                const c = idx + 1;
                                const code = `${r}${c}`; // A1
                                const seatId = codeToSeatId.get(code); //number | undefined
                                const status = seatId? (seatStatusBySeatId.get(seatId) || "AVAILABLE") : "BLOCKED";
                                const isSel = seatId? selected.includes(seatId) : false;
                                const base = "relative w-8 h-8 rounded-md text-xs flex items-center justify-center border transition select-none";
                                let overlay = null;

                                const clsParts = ["cursor-pointer", "bg-white", "border-gray-300", "hover:border-blue-600"];

                                if (status === "BLOCKED") {
                                  // 통로/미운영: 연한 회색 배경 + 대각선 표시
                                  clsParts.splice(0, clsParts.length, "cursor-pointer", "bg-gray-600");
                                  overlay = (
                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3.5 h-3.5 text-white border-gray-300 pointer-events-none">
                                      <line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                  );
                                } else if (status === "SOLD") {
                                  clsParts.splice(0, clsParts.length, "cursor-pointer", "bg-stone-500", "border-gray-300");
                                  overlay = (
                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3.5 h-3.5 text-white opacity-100 pointer-events-none">
                                      <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" />
                                      <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                  );
                                } else if (status === "HELD") {
                                  clsParts.splice(0, clsParts.length, "cursor-pointer", "bg-amber-100", "border-amber-300");
                                  overlay = (
                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3.5 h-3.5 text-amber-700 opacity-80 pointer-events-none">
                                      <line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                  );
                                } else if (totalPeople === 0) {
                                  // 인원 미선택 시 AVAILABLE 좌석은 비활성화로 표시
                                  clsParts.splice(0, clsParts.length, "cursor-pointer", "bg-gray-50", "border-gray-200", "opacity-70");
                                }

                                // 마지막에 선택 좌석 스타일을 강제 적용 (항상 우선 적용)
                                if (isSel) {
                                  clsParts.push("!bg-blue-600", "!text-white", "!border-blue-600");
                                }

                                // 커서 규칙: 선택 가능(AVAILABLE & 인원 선택됨) 또는 이미 선택된 좌석은 항상 포인터
                                // Removed addition of !cursor-pointer since cursor-pointer is always present

                                const cls = clsParts.join(" ");

                                return (
                                  <button
                                    key={code}
                                    className={`${base} ${cls}`}
                                    onClick={() => toggleSeat(seatId)}
                                    title={code}
                                    aria-pressed={isSel}
                                    data-selected={isSel ? '1' : '0'}
                                  >
                                    <span className="relative z-10">{c}</span>
                                    {overlay}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        <div className="h-6 w-6 overflow-hidden">
                          <img
                            src={enter}
                            alt="Enter"
                            className="h-full w-full object-cover"
                          />
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 요약/전설 (좌측 전체 높이에 맞춤) */}
              <aside className="border rounded-xl bg-white p-4 flex flex-col h-full self-stretch">
                <div className="flex flex-col gap-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="pr-3">
                      <p className="text-base font-semibold">{displayTitle}</p>
                      <p className="text-sm text-gray-600">{resolvedAuditorium ?? ''} · {resolvedDate ?? ''} {resolvedStart ?? ''}</p>
                    </div>
                  </div>

                  <div>
                    <div className="text-base font-semibold mb-2">선택좌석</div>
                    <div className="min-h-[72px] text-sm text-gray-700  bg-gray-100 border rounded p-2">
                      {selected.length ? selected.map((sid) => seatIdToCode.get(Number(sid)) ?? String(sid)).join(', ') : "_"}
                    </div>
                  </div>

                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 rounded-sm bg-blue-600"></span>선택 좌석</li>
                    <li className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 rounded-sm border border-gray-300"></span>선택 가능</li>
                    <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-stone-500"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-white opacity-70"><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" /></svg></span>예매완료</li>
                    <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-amber-100 border border-amber-300"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-amber-700 opacity-80"><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" /></svg></span>임시선점</li>
                    <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-gray-600 border"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-white opacity-80"><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" /></svg></span>미운영/통로</li>
                  </ul>
                </div>

                {/* 가격 요약 (하단 고정) */}
                <div className="text-sm border rounded p-3 mb-4 mt-auto  bg-gray-100">
                  <div className="flex justify-between mb-1"><span>성인 × {people.adult}</span><span>{(people.adult * price.adult).toLocaleString()}원</span></div>
                  {promo.adult?.length > 0 && (
                    <div className="text-xs text-gray-600 mb-2 pl-1">
                      <div className="flex items-start gap-1">
                        <span className="inline-block mt-0.5">•</span>
                        <span>금액 : {promo.adult.map(p => formatOpLabel(p.op, p.amount)).join(', ')}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mb-2"><span>청소년 × {people.teen}</span><span>{(people.teen * price.teen).toLocaleString()}원</span></div>
                  {promo.teen?.length > 0 && (
                    <div className="text-xs text-gray-600 mb-2 pl-1">
                      <div className="flex items-start gap-1">
                        <span className="inline-block mt-0.5">•</span>
                        <span>금액 : {promo.teen.map(p => formatOpLabel(p.op, p.amount)).join(', ')}</span>
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-gray-200 my-2" />
                  <div className="flex justify-between font-semibold text-base"><span>합계</span><span>{totalAmount.toLocaleString()}원</span></div>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                        if (submitting) return;
                        if (cameFromPayment) {
                            if (window.history.length > 2) {
                                navigate(-2); // skip the payment page in the history stack
                            } else {
                                navigate('/'); // fallback if history is too short
                            }
                        } else {
                            navigate(-1);
                        }
                    }}
                    disabled={submitting}
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={submitting || totalPeople === 0 || selected.length === 0 || (totalPeople > 0 && selected.length !== totalPeople)}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 active:bg-indigo-800"
                  >
                    예매
                  </button>
                </div>
              </aside>
            </div>
        </div>

    );
};
export default Seat;