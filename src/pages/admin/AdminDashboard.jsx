import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminSidebar";
import { Link } from "react-router-dom";
import { getStatsSummary, getDailyRevenue, getTopMovies, fetchScreenings } from "../../api/adminApi.js";

function StatCard({ title, value, delta, positive, icon, to }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
            <div className="shrink-0 rounded-lg p-3 bg-blue-50 text-blue-600">{icon}</div>
            <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">{title}</p>
                <div className="mt-1 flex items-baseline gap-2">
                    <h3 className="text-2xl font-semibold text-slate-800">{value}</h3>
                    {typeof delta !== 'undefined' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${positive ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600"}`}>
                        {positive ? "▲" : "▼"} {delta}
                      </span>
                    )}
                </div>
                {to && (
                  <div className="mt-2">
                    <Link to={to} className="text-xs text-sky-600 hover:underline">바로가기 →</Link>
                  </div>
                )}
            </div>
        </div>
    );
}

/* ---------- 라인 차트 (SVG) ---------- */
function LineChart({ data, labels }) {
    // data: [series1, series2] 각 배열은 숫자
    const width = 720, height = 260, pad = 32;
    const safeData = Array.isArray(data) && data.length ? data : [[]];
    const safeLabels = Array.isArray(labels) ? labels : [];
    const flat = safeData.flat();
    const hasData = flat.length > 0;
    const min = hasData ? Math.min(...flat) : 0;
    const max = hasData ? Math.max(...flat) : 1;
    // Value axis ticks (match 5 grid lines)
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => min + ((max - min) * i) / (tickCount - 1));
    const fmtCompact = (v) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(Math.round(v));
    const x = (i) => pad + (i * (width - pad * 2)) / (safeLabels.length - 1 || 1);
    const y = (v) => height - pad - ((v - min) * (height - pad * 2)) / (max - min || 1);

    const paths = safeData.map((series, idx) => {
        const d = series.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
        return (
            <path
                key={idx}
                d={d}
                fill="none"
                strokeWidth="2.5"
                className={idx === 0 ? "stroke-sky-500" : "stroke-slate-400"}
            />
        );
    });

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">일자별 승인매출</h4>
                <div className="text-xs text-slate-500">{safeLabels?.[0] ?? ''} ~ {safeLabels?.[safeLabels.length-1] ?? ''}</div>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
                {/* grid */}
                {[0, 1, 2, 3, 4].map((g) => (
                    <line
                        key={g}
                        x1={pad}
                        x2={width - pad}
                        y1={pad + g * ((height - pad * 2) / 4)}
                        y2={pad + g * ((height - pad * 2) / 4)}
                        className="stroke-slate-100"
                    />
                ))}
                {/* left value axis */}
                <line x1={pad} x2={pad} y1={pad} y2={height - pad} className="stroke-slate-200" />
                {ticks.map((tv, i) => (
                  <text
                    key={`ly-${i}`}
                    x={pad - 8}
                    y={y(tv) + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px]"
                  >
                    ₩ {fmtCompact(tv)}
                  </text>
                ))}
                {paths}
                {/* points */}
                {safeData.map((series, sidx) =>
                    series.map((v, i) => (
                        <circle
                            key={`${sidx}-${i}`}
                            cx={x(i)}
                            cy={y(v)}
                            r="3"
                            className={sidx === 0 ? "fill-sky-500" : "fill-slate-400"}
                        />
                    ))
                )}
                {/* x labels */}
                {(safeLabels || []).map((lb, i) => (
                    <text key={lb} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                        {lb}
                    </text>
                ))}
            </svg>
            <div className="mt-3 flex gap-3 text-xs">
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span className="inline-block w-3 h-0.5 bg-sky-500" /> 승인매출
    </span>
  </div>
  {(!hasData) && (
    <p className="mt-2 text-xs text-slate-400">표시할 데이터가 없습니다.</p>
  )}
        </div>
    );
}

/* ---------- 막대 차트 (SVG) ---------- */
function BarChart({ data, labels }) {
    const width = 420, height = 260, pad = 28;
    const safeData = Array.isArray(data) && data.length ? data : [[]];
    const safeLabels = Array.isArray(labels) ? labels : [];
    const max = Math.max(...safeData.map((d) => Math.max(...(d.length ? d : [0]))));
    const hasBars = safeData.some(arr => (arr || []).some(v => (Number(v) || 0) > 0));
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => (max * i) / (tickCount - 1));
    const fmtCompact = (v) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(Math.round(v));
    const barW = (width - pad * 2) / (safeLabels.length * safeData.length + safeLabels.length);
    const x0 = (i) => pad + i * (safeData.length * barW + barW); // 그룹 시작 x
    const y = (v) => height - pad - (v * (height - pad * 2)) / (max || 1);

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">Top 매출 영화</h4>
                <Link to="/admin/movies" className="text-xs text-sky-600">관리로 이동</Link>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
                {[0, 1, 2, 3].map((g) => (
                    <line
                        key={g}
                        x1={pad}
                        x2={width - pad}
                        y1={pad + g * ((height - pad * 2) / 4)}
                        y2={pad + g * ((height - pad * 2) / 4)}
                        className="stroke-slate-100"
                    />
                ))}
                {/* left value axis */}
                <line x1={pad} x2={pad} y1={pad} y2={height - pad} className="stroke-slate-200" />
                {ticks.map((tv, i) => (
                  <text
                    key={`by-${i}`}
                    x={pad - 8}
                    y={y(tv) + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px]"
                  >
                    ₩ {fmtCompact(tv)}
                  </text>
                ))}
                {safeLabels.map((lb, i) =>
                    safeData.map((series, sidx) => {
                        const v = series[i];
                        const x = x0(i) + sidx * barW;
                        return (
                            <rect
                                key={`${sidx}-${i}`}
                                x={x}
                                y={y(v)}
                                width={barW - 3}
                                height={height - pad - y(v)}
                                className={sidx === 0 ? "fill-fuchsia-500/80" : "fill-sky-500/80"}
                                rx="2"
                            />
                        );
                    })
                )}
                {safeLabels.map((lb, i) => (
                    <text key={lb} x={x0(i) + (safeData.length * barW) / 2 - barW / 2} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                        {lb}
                    </text>
                ))}
            </svg>
            <div className="mt-3 flex gap-4 text-xs">
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span className="inline-block w-3 h-2 bg-fuchsia-500/80 rounded" /> 올해
    </span>
  </div>
  {(!hasBars) && (
    <p className="mt-2 text-xs text-slate-400">표시할 데이터가 없습니다.</p>
  )}
        </div>
    );
}

/* ---------- 간단 테이블 ---------- */
function MiniTable({ title, rows, columns, actionText, to }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">{title}</h4>
                {actionText && (to ? <Link to={to} className="text-xs text-sky-600">{actionText}</Link> : <button className="text-xs text-sky-600">{actionText}</button>)}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                        {columns.map((c) => (
                            <th key={c} className="py-2 pr-3 font-medium">{c}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {(Array.isArray(rows) ? rows : []).map((r, i) => (
                        <tr key={i} className="border-b last:border-0 border-slate-50">
                            {(Array.isArray(r) ? r : []).map((cell, j) => (
                                <td key={j} className="py-2 pr-3 text-slate-700">{cell}</td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ---------- 페이지 본문 ---------- */
export default function AdminDashboard() {
    // 더미 데이터
    const [summary, setSummary] = useState({ gross: 0, refunded: 0, net: 0, count: 0 });
    const [daily, setDaily] = useState([]); // [{date, revenue}]
    const [topMovies, setTopMovies] = useState([]); // [{movieId, title, revenue}]
    const [screenings, setScreenings] = useState([]); // upcoming screenings
    const [loading, setLoading] = useState(false);

    // 기간 기본값: 최근 30일
    const toISO = (d) => d.toISOString().slice(0,10);
    const end = toISO(new Date());
    const start = toISO(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

    useEffect(() => {
      (async () => {
        try {
          setLoading(true);
          const [sRes, d, tops, scr] = await Promise.all([
            getStatsSummary({ from: start, to: end }),
            getDailyRevenue({ from: start, to: end }),
            getTopMovies({ from: start, to: end, limit: 5 }),
            fetchScreenings({ page: 0, size: 5 }),
          ]);
          // --- Normalize list payloads first ---
          const dailyArr = Array.isArray(d?.content) ? d.content : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
          const topsArr = Array.isArray(tops?.content) ? tops.content : Array.isArray(tops?.data) ? tops.data : Array.isArray(tops) ? tops : [];
          const scrArr = Array.isArray(scr?.content) ? scr.content : Array.isArray(scr?.data) ? scr.data : Array.isArray(scr) ? scr : [];

          setDaily(dailyArr);
          setTopMovies(topsArr);
          setScreenings(scrArr);

          // --- Normalize summary keys for dashboard cards ---
          // Accept various wrappers: {data:{...}}, {summary:{...}}, or the object itself
          const sWrap = sRes && typeof sRes === 'object' ? sRes : {};
          const sRaw = (sWrap.data && typeof sWrap.data === 'object') ? sWrap.data
                      : (sWrap.summary && typeof sWrap.summary === 'object') ? sWrap.summary
                      : sWrap;

          const toNum = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
          let gross = sRaw.grossRevenue ?? sRaw.gross_revenue ?? sRaw.gross;
          let refunded = sRaw.refundedAmount ?? sRaw.refunded_amount ?? sRaw.refundAmount ?? sRaw.refund_amount ?? sRaw.refunded;
          let net = sRaw.netRevenue ?? sRaw.net_revenue;
          let count = sRaw.paymentCount ?? sRaw.payment_count ?? sRaw.count;

          gross = toNum(gross);
          refunded = toNum(refunded);
          // If net missing, compute from gross-refunded
          net = toNum(net != null ? net : gross - refunded);
          count = toNum(count);

          // --- Fallback: if summary is all zeros but daily has data, synthesize gross/net from daily ---
          const dailyTotal = dailyArr.reduce((sum, row) => sum + (toNum(row.revenue) || 0), 0);
          if (gross === 0 && net === 0 && count === 0 && dailyTotal > 0) {
            gross = toNum(dailyTotal);
            // Keep refunded as parsed (may be 0 if missing)
            net = toNum(gross - refunded);
          }

          setSummary({ gross, refunded, net, count });
          console.log('[Dashboard] summary raw', sRes);
          console.log('[Dashboard] summary computed ->', { gross, refunded, net, count });
          console.log('[Dashboard] daily raw', d);
          console.log('[Dashboard] top raw', tops);
          console.log('[Dashboard] screenings raw', scr);
        } catch (err) {
          console.error('[Dashboard] fetch error', err);
        } finally {
          setLoading(false);
        }
      })();
    }, []);

    const safeDaily = Array.isArray(daily) ? daily : [];
    const dailyLabels = useMemo(() => safeDaily.map(x => (x.date || '').slice(5).replace('-', '/')), [safeDaily]);
    const dailySeries = useMemo(() => [safeDaily.map(x => Number(x.revenue) || 0)], [safeDaily]);

    const safeTop = Array.isArray(topMovies) ? topMovies : [];
    const topLabels = useMemo(() => safeTop.map(x => (x.title || `#${x.movieId}`).slice(0,8)), [safeTop]);
    const topSeries = useMemo(() => [safeTop.map(x => Number(x.revenue) || 0)], [safeTop]);

    const screeningRows = useMemo(() => (
      Array.isArray(screenings)
        ? screenings.map(s => {
            const start = (s.startAt || s.start_at || s.startTime || '').toString();
            const end = (s.endAt || s.end_at || s.endTime || '').toString();
            const startTxt = start ? start.replace('T',' ').slice(0,16) : '-';
            const endTxt = end ? end.replace('T',' ').slice(0,16) : '';
            return [
              s.movieTitle || s.movie?.title || '-',
              s.screenName || s.screen?.name || '-',
              endTxt ? `${startTxt} ~ ${endTxt}` : startTxt,
            ];
          })
        : []
    ), [screenings]);

    return (
        <AdminLayout>
            {/* 상단 헤더 */}
            <div className="bg-sky-600 text-white">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-lg font-semibold tracking-wide">DASHBOARD</h1>
                    <div className="hidden md:flex items-center gap-3">
                        <input className="rounded-lg px-3 py-1.5 text-sm text-slate-900 outline-none" placeholder="Search..." />
                        <div className="w-8 h-8 rounded-full bg-white/20" />
                    </div>
                </div>
            </div>

            {/* 콘텐츠 */}
            <div className="max-w-7xl mx-auto px-6 -mt-10 pb-10">
                {/* 통계 카드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="승인매출(Gross)" value={`₩ ${(summary.gross ?? 0).toLocaleString('ko-KR')}`} icon={<span>💰</span>} to="/admin/stats" />
                    <StatCard title="환불금액" value={`₩ ${(summary.refunded ?? 0).toLocaleString('ko-KR')}`} icon={<span>↩️</span>} to="/admin/stats" />
                    <StatCard title="순매출(Net)" value={`₩ ${(summary.net ?? 0).toLocaleString('ko-KR')}`} icon={<span>✅</span>} to="/admin/stats" />
                    <StatCard title="승인 건수" value={`${(summary.count ?? 0).toLocaleString('ko-KR')}건`} icon={<span>🧾</span>} to="/admin/stats" />
                </div>

                {/* 그래프 영역 */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <LineChart data={dailySeries} labels={dailyLabels} />
                        <div className="mt-2 text-right">
                          <Link to="/admin/stats" className="text-xs text-sky-600">상세 통계 보기 →</Link>
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <BarChart data={topSeries} labels={topLabels} />
                        <div className="mt-2 text-right">
                          <Link to="/admin/stats" className="text-xs text-sky-600">Top-N 더보기 →</Link>
                        </div>
                    </div>
                </div>

                {/* 테이블 영역 */}
                <div className="mt-6 grid grid-cols-1 gap-6">
                    <MiniTable
                        title="다가오는 상영"
                        columns={["MOVIE", "SCREEN", "START"]}
                        rows={screeningRows}
                        actionText="상영 관리"
                        to="/admin/screenings"
                    />
                </div>
            </div>
        </AdminLayout>
    );
}