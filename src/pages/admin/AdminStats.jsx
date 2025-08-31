import React, {useEffect, useMemo, useState} from "react";
import {AdminLayout} from "../../components/AdminSidebar.jsx";
import {getStatsSummary, getDailyRevenue, getTopMovies} from "../../api/adminApi.js";

// Helpers
const toDateInputValue = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const currency = (n) => {
    if (n === null || n === undefined || Number.isNaN(n)) return '-';
    return new Intl.NumberFormat('ko-KR').format(Math.round(n));
};

const StatCard = ({label, value, sub, icon}) => (
    <div className="rounded-xl border border-gray-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{label}</p>
            {icon}
        </div>
        <p className="mt-1 text-2xl font-semibold">₩ {currency(value)}</p>
        {typeof sub === 'number' && (
            <p className={`mt-1 text-xs ${sub >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{sub >= 0 ? '▲' : '▼'} {currency(Math.abs(sub))}</p>
        )}
    </div>
);

const BarRow = ({label, value, max}) => {
    const width = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-sm text-gray-600">{label}</div>
            <div className="relative h-7 w-full rounded bg-gray-100">
                <div className="absolute left-0 top-0 h-full rounded bg-gray-800/80" style={{width: `${width}%`}}/>
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-white/90">
                    <span>₩ {currency(value)}</span>
                    <span>{width}%</span>
                </div>
            </div>
        </div>
    );
};

const AreaChart = ({data = [], width = 640, height = 220, padding = 16}) => {
    const w = width, h = height, pad = padding;
    const xs = data.map((_, i) => i);
    const ys = data.map((d) => Number(d?.revenue) || 0);
    const n = Math.max(xs.length, 1);
    const maxY = Math.max(...ys, 0);

    // value axis ticks (0 ~ maxY) aligned with 4 grid lines + baseline
    const tickCount = 5;
    const ticks = Array.from({length: tickCount}, (_, i) => (maxY * i) / (tickCount - 1));
    const fmtCompact = (v) => new Intl.NumberFormat('ko-KR', {notation: 'compact'}).format(Math.round(v));

    const x = (i) => pad + (i * (w - pad * 2)) / Math.max(n - 1, 1);
    const y = (v) => (h - pad) - (maxY === 0 ? 0 : (v / maxY) * (h - pad * 2));

    const points = ys.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const areaPoints = `${pad},${h - pad} ${points} ${pad + (w - pad * 2)},${h - pad}`;

    const ma = ys.map((_, i) => {
        const start = Math.max(0, i - 6);
        const slice = ys.slice(start, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        return avg;
    });
    const pointsMA = ma.map((v, i) => `${x(i)},${y(v)}`).join(' ');

    const firstDate = data[0]?.date ? new Date(data[0].date) : null;
    const lastDate = data[data.length - 1]?.date ? new Date(data[data.length - 1].date) : null;

    // Interactive hover state
    const [hoverIdx, setHoverIdx] = React.useState(null);

    // Mouse helpers for tooltip/crosshair
    const step = Math.max(1, (w - pad * 2) / Math.max(n - 1, 1));
    const xToIndex = (mx) => {
        const rel = Math.max(pad, Math.min(mx, w - pad)) - pad;
        const idx = Math.round(rel / step);
        return Math.max(0, Math.min(idx, n - 1));
    };

    const handleMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        setHoverIdx(xToIndex(mx));
    };
    const handleLeave = () => setHoverIdx(null);

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]" onMouseMove={handleMove} onMouseLeave={handleLeave}>
            <defs>
                <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopOpacity="0.35" stopColor="currentColor"/>
                    <stop offset="100%" stopOpacity="0.05" stopColor="currentColor"/>
                </linearGradient>
            </defs>
            {/* hover capture */}
            <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} fill="transparent"/>

            {hoverIdx != null && (
                <g>
                    {/* vertical guide */}
                    <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad} y2={h - pad} stroke="currentColor" opacity="0.2"/>
                    {/* focus point */}
                    <circle cx={x(hoverIdx)} cy={y(ys[hoverIdx])} r="3.5" className="fill-indigo-600"/>
                    {/* tooltip */}
                    {(() => {
                        const dv = data[hoverIdx];
                        const dt = dv?.date ? new Date(dv.date) : null;
                        const dateTxt = dt ? dt.toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'}) : '';
                        const valTxt = new Intl.NumberFormat('ko-KR').format(Math.round(ys[hoverIdx] || 0));
                        const tipW = 110, tipH = 44,
                            tx = Math.min(Math.max(x(hoverIdx) + 8, pad + 4), w - pad - tipW - 4),
                            ty = Math.max(y(ys[hoverIdx]) - tipH - 8, pad + 4);
                        return (
                            <g transform={`translate(${tx},${ty})`}>
                                <rect width={tipW} height={tipH} rx="6" className="fill-white" stroke="currentColor"
                                      opacity="1" strokeOpacity="0.12"/>
                                <text x={8} y={18} className="fill-gray-700" fontSize="11">{dateTxt}</text>
                                <text x={8} y={34} className="fill-gray-900" fontSize="12">₩ {valTxt}</text>
                            </g>
                        );
                    })()}
                </g>
            )}
            {/* grid lines */}
            {[0.25, 0.5, 0.75, 1].map((t) => (
                <line key={t} x1={pad} x2={w - pad} y1={pad + t * (h - pad * 2)} y2={pad + t * (h - pad * 2)}
                      stroke="currentColor" opacity="0.08"/>
            ))}
            {/* left value axis */}
            <line x1={pad} x2={pad} y1={pad} y2={h - pad} stroke="currentColor" opacity="0.2"/>
            {ticks.map((tv, i) => (
                <text
                    key={`ay-${i}`}
                    x={pad - 8}
                    y={y(tv) + 3}
                    textAnchor="end"
                    fontSize="10"
                    className="fill-gray-400"
                >
                    ₩ {fmtCompact(tv)}
                </text>
            ))}
            {/* area fill */}
            <polygon points={areaPoints} fill="url(#revGrad)" className="text-indigo-500"/>
            {/* line */}
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600"/>
            {/* 7-day moving average */}
            <polyline points={pointsMA} fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600"
                      strokeDasharray="4 3"/>
            {/* x-axis labels */}
            {firstDate && lastDate && (
                <>
                    <text x={pad} y={h - 2} fontSize="10" fill="currentColor" opacity="0.6">
                        {firstDate.toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
                    </text>
                    <text x={w - pad} y={h - 2} fontSize="10" textAnchor="end" fill="currentColor" opacity="0.6">
                        {lastDate.toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
                    </text>
                </>
            )}
        </svg>
    );
};

const DonutChart = ({net = 0, refunded = 0, size = 180, stroke = 18}) => {
    const total = Math.max((Number(net) || 0) + (Number(refunded) || 0), 1);
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const refundedLen = (refunded / total) * c;
    const netLen = (net / total) * c;
    const center = size / 2;

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
            {/* background ring */}
            <circle cx={center} cy={center} r={r} fill="none" stroke="currentColor" strokeOpacity="0.1"
                    strokeWidth={stroke}/>
            {/* refunded segment */}
            <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="currentColor"
                className="text-rose-500"
                strokeWidth={stroke}
                strokeDasharray={`${refundedLen} ${c - refundedLen}`}
                transform={`rotate(-90 ${center} ${center})`}
            />
            {/* net segment (placed after refunded) */}
            <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="currentColor"
                className="text-emerald-500"
                strokeWidth={stroke}
                strokeDasharray={`${netLen} ${c - netLen}`}
                strokeDashoffset={-refundedLen}
                transform={`rotate(-90 ${center} ${center})`}
            />
            <text x={center} y={center} textAnchor="middle" dominantBaseline="middle" className="fill-gray-700"
                  fontSize="14">
                {Math.round((net / total) * 100)}%
            </text>
        </svg>
    );
};

const AdminStats = () => {
    // default range: last 7 days (inclusive)
    const today = useMemo(() => new Date(), []);
    const defaultTo = useMemo(() => toDateInputValue(today), [today]);
    const defaultFrom = useMemo(() => toDateInputValue(addDays(today, -6)), [today]);

    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);

    const [summary, setSummary] = useState({grossRevenue: 0, refundedAmount: 0, netRevenue: 0, paymentCount: 0});
    const [daily, setDaily] = useState([]); // [{date, revenue}]
    const [topMovies, setTopMovies] = useState([]); // [{movieId, title, revenue}]

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchAll = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {from, to};
            const [sRes, dRes, tRes] = await Promise.all([
                getStatsSummary(params),
                getDailyRevenue(params),
                getTopMovies({...params, limit: 5}),
            ]);
            // 요약 키 정규화 (snake/camel 가리지 않고 받기)
            const sWrap = sRes && typeof sRes === 'object' ? sRes : {};
            const sRaw = (sWrap.data && typeof sWrap.data === 'object') ? sWrap.data
                : (sWrap.summary && typeof sWrap.summary === 'object') ? sWrap.summary
                    : sWrap;
            const toNum = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
            const gross = toNum(sRaw.grossRevenue ?? sRaw.gross_revenue ?? sRaw.gross);
            const refunded = toNum(sRaw.refundedAmount ?? sRaw.refunded_amount ?? sRaw.refundAmount ?? sRaw.refund_amount ?? sRaw.refunded);
            const net = toNum(sRaw.netRevenue ?? sRaw.net_revenue ?? (gross - refunded));
            const count = toNum(sRaw.paymentCount ?? sRaw.payment_count ?? sRaw.count);
            setSummary({grossRevenue: gross, refundedAmount: refunded, netRevenue: net, paymentCount: count});

            // 배열 래핑 대응: [], {data:[]}, {content:[]}
            const dailyData = Array.isArray(dRes?.content) ? dRes.content : Array.isArray(dRes?.data) ? dRes.data : Array.isArray(dRes) ? dRes : [];
            dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
            setDaily(dailyData);
            const topArr = Array.isArray(tRes?.content) ? tRes.content : Array.isArray(tRes?.data) ? tRes.data : Array.isArray(tRes) ? tRes : [];
            setTopMovies(topArr);
        } catch (e) {
            console.error('[AdminStats] fetch failed', e);
            const msg = e?.response?.data?.message || e?.message || '데이터를 불러오지 못했어요.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const maxDaily = useMemo(() => daily.reduce((m, d) => Math.max(m, d.revenue || 0), 0), [daily]);
    const maxTop = useMemo(() => topMovies.reduce((m, d) => Math.max(m, d.revenue || 0), 0), [topMovies]);
    const totalTop = useMemo(() => topMovies.reduce((s, m) => s + (m.revenue || 0), 0), [topMovies]);

    const exportCSV = () => {
        try {
            const lines = [];
            lines.push(`기간,${from}~${to}`);
            lines.push('');
            lines.push('요약,gross,refunded,net,count');
            lines.push(`summary,${summary.grossRevenue || 0},${summary.refundedAmount || 0},${summary.netRevenue || 0},${summary.paymentCount || 0}`);
            lines.push('');
            lines.push('일자별,date,revenue');
            (daily || []).forEach((d) => {
                lines.push(`daily,${d.date},${d.revenue || 0}`);
            });
            lines.push('');
            lines.push('TopN,movieId,title,revenue');
            (topMovies || []).forEach((m) => {
                const safeTitle = String(m.title || '').replace(/"/g, '""');
                lines.push(`top,${m.movieId},"${safeTitle}",${m.revenue || 0}`);
            });
            const csv = lines.join('\n');
            const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stats_${from}_${to}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[AdminStats] CSV export failed', err);
            alert('CSV 내보내기에 실패했어요. 콘솔을 확인해주세요.');
        }
    };

    return (
        <AdminLayout>
            <main className="mx-auto min-h-[75vh] max-w-[1200px] px-4 py-8">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <h1 className="text-3xl font-bold ">매출 통계</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            className="rounded border px-3 py-2 text-sm"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            max={to}
                        />
                        <span className="text-gray-500">~</span>
                        <input
                            type="date"
                            className="rounded border px-3 py-2 text-sm"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            min={from}
                        />
                        <button
                            onClick={fetchAll}
                            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? '불러오는 중...' : '조회'}
                        </button>
                        <button
                            onClick={exportCSV}
                            className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            disabled={loading}
                        >
                            CSV 내보내기
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>
                )}

                {/* Summary */}
                <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="총 승인매출(Gross)"
                        value={summary.grossRevenue}
                        icon={(
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <path d="M3 3h18v4H3z"/>
                                <path d="M8 21V7M16 21V7"/>
                            </svg>
                        )}
                    />
                    <StatCard
                        label="환불금액"
                        value={summary.refundedAmount}
                        icon={(
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <path d="M12 5v14"/>
                                <path d="M5 12h14"/>
                            </svg>
                        )}
                    />
                    <StatCard
                        label="순매출(Net)"
                        value={summary.netRevenue}
                        sub={-1 * (summary.refundedAmount ?? 0)}
                        icon={(
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <path d="M3 12l5 5L21 4"/>
                            </svg>
                        )}
                    />
                    <div className="rounded-xl border border-gray-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">승인 건수</p>
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <path d="M3 7h18M3 12h18M3 17h18"/>
                            </svg>
                        </div>
                        <p className="mt-1 text-2xl font-semibold">{summary.paymentCount ?? 0}건</p>
                    </div>
                </section>

                {/* Overview charts */}
                <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Area (spark) chart for daily revenue */}
                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">일자 추이 (Area)</h2>
                            <span className="text-xs text-gray-500">단위: 원 · 최대값 기준 정규화</span>
                        </div>
                        {daily.length === 0 ? (
                            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                        ) : (
                            <AreaChart data={daily}/>
                        )}
                    </div>

                    {/* Donut chart for net vs refund */}
                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">매출 구성 (Donut)</h2>
                            <span className="text-xs text-gray-500">순매출 vs 환불</span>
                        </div>
                        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                            <div className="mx-auto h-44 w-44">
                                <DonutChart net={summary.netRevenue || 0} refunded={summary.refundedAmount || 0}/>
                            </div>
                            <ul className="space-y-2">
                                <li className="flex items-center justify-between text-sm">
                                    <span className="inline-flex items-center gap-2"><span
                                        className="h-2 w-2 rounded-full bg-emerald-500"/>순매출</span>
                                    <span>₩ {currency(summary.netRevenue)}</span>
                                </li>
                                <li className="flex items-center justify-between text-sm">
                                    <span className="inline-flex items-center gap-2"><span
                                        className="h-2 w-2 rounded-full bg-rose-500"/>환불</span>
                                    <span>₩ {currency(summary.refundedAmount)}</span>
                                </li>
                                <li className="mt-2 flex items-center justify-between text-sm text-gray-600">
                                    <span>승인매출</span>
                                    <span>₩ {currency(summary.grossRevenue)}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Daily revenue */}
                <section className="mt-10">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">일자별 승인매출 합계</h2>
                        <span className="text-xs text-gray-500">단위: 원</span>
                    </div>
                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                        {daily.length === 0 ? (
                            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {daily.map((d) => (
                                    <BarRow key={d.date} label={new Date(d.date).toLocaleDateString('ko-KR', {
                                        month: '2-digit',
                                        day: '2-digit'
                                    })} value={d.revenue || 0} max={maxDaily}/>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Top movies */}
                <section className="mt-10">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">TOP 5 영화 (승인매출 기준)</h2>
                        <span className="text-xs text-gray-500">기간 내 합계</span>
                    </div>
                    <div className="rounded-xl border bg-white p-5 shadow-sm">
                        {topMovies.length === 0 ? (
                            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                        ) : (
                            <ol className="divide-y">
                                {topMovies.map((m, idx) => (
                                    <li key={m.movieId} className="flex items-center justify-between py-2">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-700'}`}>{idx + 1}</span>
                                            <span className="text-sm text-gray-800">{m.title || `#${m.movieId}`}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{totalTop ? Math.round(((m.revenue || 0) / totalTop) * 1000) / 10 : 0}%</span>
                                            <div className="text-sm font-medium">₩ {currency(m.revenue || 0)}</div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            </main>
        </AdminLayout>
    );
};

export default AdminStats;