import { useSearchParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSeatMap } from "../api/seatApi";

const Seat = () => {
    const [params] = useSearchParams();
    const movieId = params.get('movieId');
    const screeningId = params.get('screeningId');
    const date = params.get('date');
    const start = params.get('start');
    const auditorium = params.get('auditorium');
    const title = params.get('title');

    // 인원 수 및 선택 좌석 상태
    const [people, setPeople] = useState({ adult: 0, teen: 0 });
    const [selected, setSelected] = useState([]); // ["A1","A2"]

    const totalPeople = useMemo(() => people.adult + people.teen, [people]);

    // 좌석 맵 조회 (screeningId 기준)
    const { data, isLoading, isError } = useQuery({
        queryKey: ["seat-map", screeningId],
        queryFn: () => getSeatMap(Number(screeningId)).then(res => res.data),
        enabled: !!screeningId,
    });

    const toggleSeat = (id) => {
        if (!data) return;
        const seat = data.seats?.find(s => s.id === id);
        if (!seat) return;
        if (["SOLD", "BLOCKED", "HELD"].includes(seat.status)) return;
        // 인원 수 제한: 선택 좌석 수는 총 인원 수 이하여야 함
        const willSelect = !selected.includes(id);
        if (willSelect && totalPeople > 0 && selected.length >= totalPeople) return;
        setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            <h1 className="text-2xl font-semibold mb-1">빠른예매</h1>
            <p className="text-sm text-gray-600 mb-4">{title} · {auditorium} · {date} {start}</p>

            {/* 관람 인원 선택 */}
            <div className="border rounded-xl p-4 mb-4 bg-white">
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
                <div className="text-xs text-gray-500 mt-2">선택 좌석 수는 총 인원 수({totalPeople}) 이하여야 합니다.</div>
            </div>

            {/* 좌석 영역 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 border rounded-xl bg-white p-4">
                    {isLoading && <div className="py-14 text-center text-gray-500">좌석 정보를 불러오는 중…</div>}
                    {isError && <div className="py-14 text-center text-red-600">좌석 정보를 불러오지 못했습니다.</div>}
                    {!isLoading && !isError && data && (
                        <div>
                            {/* SCREEN 바 */}
                            <div className="mx-auto mb-6 w-2/3 h-3 bg-gray-200 rounded-full" title="SCREEN" />

                            {/* 좌석 그리드 */}
                            <div className="overflow-auto border rounded-xl p-3">
                                <div className="inline-block">
                                    {data.rows?.map((r) => (
                                        <div key={r} className="flex items-center gap-2 mb-2">
                                            <div className="w-6 text-xs text-gray-500 text-right">{r}</div>
                                            {[...Array(data.cols || 0)].map((_, idx) => {
                                                const c = idx + 1;
                                                const id = `${r}${c}`;
                                                const s = data.seats?.find(x => x.id === id);
                                                const isSel = selected.includes(id);
                                                const base = "relative w-8 h-8 rounded-md text-xs flex items-center justify-center border transition select-none";
                                                let cls = "bg-white border-gray-300 hover:border-blue-600 cursor-pointer";
                                                let overlay = null;
                                                if (!s || s.status === "BLOCKED") {
                                                  cls = "bg-gray-100 border-gray-200 cursor-not-allowed";
                                                } else if (s.status === "SOLD") {
                                                  cls = "bg-gray-300 border-gray-300 cursor-not-allowed";
                                                  overlay = (
                                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3.5 h-3.5 text-gray-700 opacity-70 pointer-events-none">
                                                      <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" />
                                                      <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" />
                                                    </svg>
                                                  );
                                                } else if (s.status === "HELD") {
                                                  cls = "bg-amber-100 border-amber-300 cursor-not-allowed";
                                                  overlay = (
                                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3.5 h-3.5 text-amber-700 opacity-80 pointer-events-none">
                                                      <line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" />
                                                    </svg>
                                                  );
                                                } else if (isSel) {
                                                  cls = "bg-blue-600 text-white border-blue-600";
                                                }
                                                return (
                                                    <button
                                                        key={id}
                                                        className={`${base} ${cls}`}
                                                        onClick={() => toggleSeat(id)}
                                                        title={s ? `${id} · ${s.type}` : id}
                                                    >
                                                        <span className="relative z-10">{c}</span>
                                                        {overlay}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {/* 하단 열 번호 */}
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-6" />
                                        {[...Array(data.cols || 0)].map((_, idx) => (
                                            <div key={idx} className="w-8 text-[10px] text-center text-gray-500">{idx + 1}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 우측 요약/전설 */}
                <aside className="border rounded-xl bg-white p-4 flex flex-col">
                    <div className="text-sm font-medium mb-3">선택좌석</div>
                    <div className="min-h-[72px] text-sm text-gray-700 border rounded p-2 mb-3">
                        {selected.length ? selected.join(", ") : "-"}
                    </div>

                    <ul className="text-xs text-gray-600 space-y-2 mb-4">
                      <li className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 rounded-sm bg-blue-600"></span>선택 좌석</li>
                      <li className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 rounded-sm border border-gray-300"></span>선택 가능</li>
                      <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-gray-300"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-gray-700 opacity-70"><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" strokeWidth="2" /></svg></span>예매완료</li>
                      <li className="flex items-center gap-2"><span className="relative inline-block w-3.5 h-3.5 rounded-sm bg-amber-100 border border-amber-300"><svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 text-amber-700 opacity-80"><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" /></svg></span>임시선점</li>
                      <li className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 rounded-sm bg-gray-100 border border-gray-200"></span>미운영/통로</li>
                    </ul>

                    <div className="mt-auto flex items-center justify-between">
                        <button type="button" className="px-4 py-2 rounded-lg border">이전</button>
                        <button
                            type="button"
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