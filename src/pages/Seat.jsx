import { useSearchParams, useNavigate } from "react-router-dom";
import React, { useState, useMemo} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {getSeatMap, initBooking} from "../api/seatApi";
import enter from '../assets/styles/enter.png';
import exit from '../assets/styles/exit.png';

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

// 가격 정책
const PRICE = { adult: 14000, teen: 11000 };

const Seat = () => {
    const [params] = useSearchParams();
    const movieId = params.get('movieId');
    const screeningId = params.get('screeningId');
    const date = params.get('date');
    const start = params.get('start');
    const auditorium = params.get('auditorium');
    const title = params.get('title');
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // 인원 수 및 선택 좌석 상태
    const [people, setPeople] = useState({ adult: 0, teen: 0 });
    const [selected, setSelected] = useState([]); // [101, 102] 숫자로 매핑
    const totalPeople = useMemo(() => people.adult + people.teen, [people]);
    const totalAmount = useMemo(() => (people.adult * PRICE.adult) + (people.teen * PRICE.teen), [people]);

    // 좌석 맵 조회 (screeningId 기준)
    const { data, isLoading, isError } = useQuery({
        queryKey: ["seat-map", screeningId],
        queryFn: () => getSeatMap(Number(screeningId)).then(res => res.data),
        enabled: !!screeningId,
    });

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
        if (["SOLD", "BLOCKED", "HELD"].includes(status)) return;
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
        const screeningIdNum = Number(screeningId);
        const seatIds = [...selected];

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
              queryClient.invalidateQueries({ queryKey: ["seat-map", screeningId] });
              return;
            }

            const res = await initBooking(payload);
            console.log('[HOLD:res]', res);

            const bookingId = res?.bookingId ?? res?.id ?? res?.data?.bookingId;
            const paymentId = res?.paymentId ?? res?.data?.paymentId;
            if (!bookingId) {
              throw new Error('bookingId가 응답에 없습니다.');
            }
            // --- Build cart items from selected seats (assign adult first, then teen)
            const cartItems = seatIds.map((sid, idx) => {
              const isAdult = idx < people.adult;
              const type = isAdult ? 'ADULT' : 'TEEN';
              const price = isAdult ? PRICE.adult : PRICE.teen;
              const code = seatIdToCode.get(Number(sid)) ?? String(sid);
              return {
                // 결제/주문 처리용
                seatId: Number(sid),
                movieId: Number(movieId) || undefined,
                screeningId: screeningIdNum,
                type,
                price,
                quantity: 1,
                // 화면 표시용
                name: title,
                label: title, // 우측 금액 박스에서 label || name 사용
                posterUrl: posterUrl || undefined,
                screeningInfo: `${auditorium} · ${date} ${start}`,
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
              title,
              auditorium,
              date,
              start,
            };
            // Optional: backup for refresh
            try {
              localStorage.setItem('cartItems', JSON.stringify(cartItems));
              localStorage.setItem('cartAmount', String(amountValue));
            } catch (_) {}
            const qs = new URLSearchParams({ bookingId: String(bookingId) });
            if (paymentId != null) qs.set('paymentId', String(paymentId));
            navigate(`/payment?${qs.toString()}`, { state });
        } catch (e) {
          const status = e.response?.status;
          const data = e.response?.data;
          console.error('[HOLD:error]', status, data);
          // 409(CONFLICT) 또는 400류로 내려오는 게 이상적이지만, 현재는 500을 받는 경우가 있음
          const msg = (data?.message || data?.error || e.message || '').toString();
          if (msg.includes('이미 예매 완료된 좌석') || msg.includes('이미 예매') || status === 409) {
            // 서버가 좌석 목록을 제공하지 않는다면 전체 좌석 맵을 갱신
            await queryClient.invalidateQueries({ queryKey: ["seat-map", screeningId] });
            alert('선택하신 좌석 중 일부가 이미 예매/선점 되었습니다. 좌석 상태를 새로고침했어요. 다시 선택해주세요.');
          } else {
            alert(data?.message ?? data?.error ?? '예약 생성 중 오류가 발생했습니다.');
          }
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <div className="border rounded-xl bg-white p-4">
                  {isLoading && <div className="py-14 text-center text-gray-500">좌석 정보를 불러오는 중…</div>}
                  {isError && <div className="py-14 text-center text-red-600">좌석 정보를 불러오지 못했습니다.</div>}
                  {!isLoading && !isError && data && (
                    <div>
                      {/* SCREEN 바 */}
                      <div className="mx-auto mb-2 w-2/3 h-3 bg-gray-200 rounded-full" title="SCREEN" />
                      <h2 className="text-center mb-3 font-semibold text-xl">SCREEN</h2>

                      {/* 좌석 그리드 */}
                      <div className="overflow-auto text-center justify-center border rounded-xl p-3 ">

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
                              <div className="w-6 text-xs text-gray-500 text-right">{r}</div>
                              {[...Array(data.cols || 0)].map((_, idx) => {
                                const c = idx + 1;
                                const code = `${r}${c}`; // A1
                                const seatId = codeToSeatId.get(code); //number | undefined
                                const status = seatId? (seatStatusBySeatId.get(seatId) || "AVAILABLE") : "BLOCKED";
                                const isSel = seatId? selected.includes(seatId) : false;
                                const base = "relative w-8 h-8 rounded-md text-xs flex items-center justify-center border transition select-none";
                                let overlay = null;

                                // Build classes so that the selected style is appended LAST and wins
                                const clsParts = ["cursor-pointer", "bg-white", "border-gray-300", "hover:border-blue-600"];

                                if (status === "BLOCKED") {
                                  // 통로/미운영
                                  clsParts.splice(0, clsParts.length, "cursor-pointer", "bg-gray-100", "border-gray-200");
                                } else if (status === "SOLD") {
                                  clsParts.splice(0, clsParts.length, "cursor-pointer", "bg-gray-300", "border-gray-300");
                                  overlay = (
                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3.5 h-3.5 text-gray-700 opacity-70 pointer-events-none">
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
                      <p className="text-base font-semibold">{title}</p>
                      <p className="text-sm text-gray-600">{auditorium} · {date} {start}</p>
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
                    <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-gray-300"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-gray-700 opacity-70"><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" /></svg></span>예매완료</li>
                    <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-amber-100 border border-amber-300"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-amber-700 opacity-80"><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" /></svg></span>임시선점</li>
                    <li className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 rounded-sm bg-gray-100 border border-gray-200"></span>미운영/통로</li>
                  </ul>
                </div>

                {/* 가격 요약 (하단 고정) */}
                <div className="text-sm border rounded p-3 mb-4 mt-auto  bg-gray-100">
                    <div className="flex justify-between mb-1"><span>성인 × {people.adult}</span><span>{(people.adult * PRICE.adult).toLocaleString()}원</span></div>
                    <div className="flex justify-between mb-2"><span>청소년 × {people.teen}</span><span>{(people.teen * PRICE.teen).toLocaleString()}원</span></div>
                    <div className="h-px bg-gray-200 my-2" />
                    <div className="flex justify-between font-semibold text-base"><span>합계</span><span>{totalAmount.toLocaleString()}원</span></div>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <button type="button" className="px-4 py-2 rounded-lg border"
                        onClick={() => navigate(-1)}>이전</button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={totalPeople === 0 || selected.length === 0 || (totalPeople > 0 && selected.length !== totalPeople)}
                    className="px-5 py-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed bg-black"
                  >
                    다음
                  </button>
                </div>
              </aside>
            </div>
        </div>

    );
};
export default Seat;