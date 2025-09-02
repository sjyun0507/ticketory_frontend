import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminSidebar";
import { Link } from "react-router-dom";
import { getStatsSummary, getDailyRevenue, getTopMovies, fetchScreenings } from "../../api/adminApi.js";
import { getScreenings as fetchPublicScreenings, getMovies as fetchMoviesList } from "../../api/movieApi.js";

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
    const width = 720, height = 260, pad = 32;
    const safeData = Array.isArray(data) && data.length ? data : [[]];
    const safeLabels = Array.isArray(labels) ? labels : [];
    const flat = safeData.flat();
    const hasData = flat.length > 0;
    const min = hasData ? Math.min(...flat) : 0;
    const max = hasData ? Math.max(...flat) : 1;
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => min + ((max - min) * i) / (tickCount - 1));
    const fmtCompact = (v) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(Math.round(v));
    const x = (i) => pad + (i * (width - pad * 2)) / (safeLabels.length - 1 || 1);
    const y = (v) => height - pad - ((v - min) * (height - pad * 2)) / (max - min || 1);
    const weeklyIdx = Array.from({ length: safeLabels.length }, (_, i) => i)
      .filter(i => i % 7 === 0 || i === safeLabels.length - 1);

    const paths = safeData.map((series, idx) => {
        const d = series.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
        return (
            <path
                key={idx}
                d={d}
                fill="none"
                strokeWidth="2.5"
                className={idx === 0 ? "stroke-indigo-500" : "stroke-slate-400"}
            />
        );
    });

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">월별 승인매출</h4>
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
                {weeklyIdx.map((i) => (
                  <line
                    key={`vx-${i}`}
                    x1={x(i)}
                    x2={x(i)}
                    y1={pad}
                    y2={height - pad}
                    className="stroke-slate-50"
                  />
                ))}
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
                {weeklyIdx.map((i) => (
                  <text
                    key={`xl-${i}`}
                    x={x(i)}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {safeLabels[i]}
                  </text>
                ))}
            </svg>
            <div className="mt-3 flex gap-3 text-xs">
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span className="inline-block w-3 h-0.5 bg-indigo-500" /> 승인매출
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

    // spacing: 더 넓은 그룹 간격 + 막대 간 미세 간격
    const groupGap = 12;           // 그룹 사이 간격(px)
    const innerGap = 4;            // 같은 그룹 내 막대 사이 간격(px)

    // 총 그려질 막대 개수와 간격을 고려해 barW 계산
    const totalInnerGaps = Math.max(0, safeLabels.length * (safeData.length - 1)) * innerGap;
    const totalGroupGaps = Math.max(0, (safeLabels.length - 1)) * groupGap;
    const plotWidth = (width - pad * 2) - totalInnerGaps - totalGroupGaps;
    const barW = plotWidth / Math.max(1, safeLabels.length * safeData.length);

    // 그룹 시작 x 좌표
    const x0 = (i) => {
      const barsPerGroup = safeData.length;
      const groupWidth = barsPerGroup * barW + Math.max(0, barsPerGroup - 1) * innerGap;
      return pad + i * (groupWidth + groupGap);
    };

    const y = (v) => height - pad - (v * (height - pad * 2)) / (max || 1);

    // 상위 1~3위 랭크 계산 (첫 번째 시리즈 기준)
    const rankMap = useMemo(() => {
      const primary = (safeData && safeData[0]) ? safeData[0] : [];
      const pairs = (primary || []).map((v, i) => ({ i, v: Number(v) || 0 }));
      pairs.sort((a, b) => b.v - a.v);
      const map = new Map();
      let rank = 1;
      for (const p of pairs) {
        if (p.v <= 0) break;
        map.set(p.i, rank);
        rank += 1;
      }
      return map;
    }, [safeData]);

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">Top 매출 영화</h4>
                <Link to="/admin/movies" className="text-xs text-sky-600">영화관리로 이동</Link>
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
                        const v = Number(series[i]) || 0;
                        const x = x0(i) + sidx * (barW + innerGap);
                        const h = Math.max(0, height - pad - y(v));
                        return (
                            <g key={`${sidx}-${i}`}>
                              <rect
                                x={x}
                                y={y(v)}
                                width={Math.max(1, barW)}
                                height={h}
                                className={(() => {
                                  if (sidx !== 0) return "fill-sky-500/60";
                                  const r = rankMap.get(i);
                                  if (r === 1) return "fill-amber-500/90";
                                  if (r === 2) return "fill-amber-400/80";
                                  if (r === 3) return "fill-amber-300/80";
                                  return "fill-slate-300/80";
                                })()}
                                rx="3"
                              />
                              {/* 값 라벨 (작은 값은 숨김) */}
                              {v > 0 && h > 14 && (
                                <text
                                  x={x + Math.max(1, barW) / 2}
                                  y={y(v) - 4}
                                  textAnchor="middle"
                                  className={(() => {
                                    if (sidx !== 0) return "fill-slate-500 text-[10px]";
                                    const r = rankMap.get(i);
                                    return r && r <= 3 ? "fill-amber-700 text-[10px]" : "fill-slate-500 text-[10px]";
                                  })()}
                                >
                                  {fmtCompact(v)}
                                </text>
                              )}
                            </g>
                        );
                    })
                )}
                {safeLabels.map((lb, i) => {
                  const barsPerGroup = safeData.length;
                  const groupWidth = barsPerGroup * barW + Math.max(0, barsPerGroup - 1) * innerGap;
                  return (
                    <text
                      key={lb}
                      x={x0(i) + groupWidth / 2}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px]"
                    >
                      {lb}
                    </text>
                  );
                })}
            </svg>
            <div className="mt-3 flex justify-end flex-wrap gap-4 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block w-3 h-2 bg-amber-500/90 rounded" /> 1위
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block w-3 h-2 bg-amber-400/80 rounded" /> 2위
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block w-3 h-2 bg-amber-300/80 rounded" /> 3위
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block w-3 h-2 bg-slate-300/80 rounded" /> 기타
              </span>
            </div>
  {(!hasBars) && (
    <p className="mt-2 text-xs text-slate-400">표시할 데이터가 없습니다.</p>
  )}
        </div>
    );
}

function MiniTable({ title, rows, columns, actionText, to }) {
  const hasRows = Array.isArray(rows) && rows.length > 0;
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
            {hasRows ? (
              (rows || []).map((r, i) => (
                <tr key={i} className="border-b last:border-0 border-slate-50">
                  {(Array.isArray(r) ? r : []).map((cell, j) => (
                    <td key={j} className="py-2 pr-3 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-slate-400">표시할 항목이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- 페이지 본문 ---------- */
export default function AdminDashboard() {
    const [summary, setSummary] = useState({ gross: 0, refunded: 0, net: 0, count: 0 });
    const [daily, setDaily] = useState([]); // [{date, revenue}]
    const [topMovies, setTopMovies] = useState([]); // [{movieId, title, revenue}]
    const [loading, setLoading] = useState(false);
    const [screenings, setScreenings] = useState([]); // upcoming screenings

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
            fetchScreenings({ page: 0, size: 100 }),
          ]);
          // --- Normalize list payloads ---
          const dailyArr = Array.isArray(d?.content) ? d.content : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
          const topsArr = Array.isArray(tops?.content) ? tops.content : Array.isArray(tops?.data) ? tops.data : Array.isArray(tops) ? tops : [];
          const scrArr  = Array.isArray(scr?.content) ? scr.content : Array.isArray(scr?.data) ? scr.data : Array.isArray(scr) ? scr : [];
          // Fallback: if admin endpoint returned nothing, try public screenings endpoint
          let scrAll = scrArr;
          if (!Array.isArray(scrAll) || scrAll.length === 0) {
            try {
              const pub = await fetchPublicScreenings();
              const pubArr = Array.isArray(pub?.content) ? pub.content : Array.isArray(pub?.data) ? pub.data : Array.isArray(pub) ? pub : [];
              if (Array.isArray(pubArr) && pubArr.length > 0) {
                scrAll = pubArr.slice(0,200);
              }
            } catch (e) {

            }
          }
          let titleMap = new Map();
          try {
            const mv = await fetchMoviesList({ page: 0, size: 500 });
            const mvArr = Array.isArray(mv?.content) ? mv.content : Array.isArray(mv?.data) ? mv.data : Array.isArray(mv) ? mv : [];
            (mvArr || []).forEach(m => {
              const mid = (m.id ?? m.movieId ?? m.movie_id);
              const mtitle = (m.title ?? m.movieTitle ?? m.movie_title);
              if (mid != null && mtitle) titleMap.set(String(mid), String(mtitle));
            });
          } catch (e) {
          }
          setDaily(dailyArr);
          setTopMovies(topsArr);

          const parseStart = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            const val =
              obj.startAt ?? obj.start_at ?? obj.startTime ?? obj.start_time ??
              obj.startsAt ?? obj.starts_at ?? obj.start ?? obj.startDateTime ??
              obj.start_date_time ?? obj.startDate ?? obj.start_date ?? null;
            if (!val) return null;
            const dt = new Date(val);
            return isNaN(dt) ? null : dt;
          };
          const now = new Date();
          const withStart = (scrAll || []).map(s => ({ s, st: parseStart(s) })).filter(x => !!x.st);
          let upcoming = [];
          if (withStart.length > 0) {
            upcoming = withStart
              .filter(x => x.st.getTime() > now.getTime())
              .sort((a, b) => a.st.getTime() - b.st.getTime())
              .map(x => x.s)
              .slice(0, 5);
            if (upcoming.length === 0) {
              upcoming = withStart
                .sort((a, b) => a.st.getTime() - b.st.getTime())
                .map(x => x.s)
                .slice(-5);
            }
          } else {
            upcoming = (scrAll || []).slice(0, 5);
          }
          const upcomingResolved = (upcoming || []).map(s => {
            const rawTitle = (s.movieTitle ?? s.movie_title ?? s.movie?.title ?? '');
            const rawId = (s.movieId ?? s.movie_id ?? s.movie?.id ?? null);
            const mapped = rawId != null ? (titleMap.get(String(rawId)) ?? '') : '';
            return { ...s, _resolvedTitle: (rawTitle && String(rawTitle).trim()) || mapped || '' };
          });
          setScreenings(upcomingResolved);
          const sWrap = sRes && typeof sRes === 'object' ? sRes : {};
          const sRaw =
            (sWrap.data && typeof sWrap.data === 'object') ? sWrap.data :
            (sWrap.summary && typeof sWrap.summary === 'object') ? sWrap.summary :
            sWrap;
          const toNum = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
          let gross = toNum(sRaw.grossRevenue ?? sRaw.gross_revenue ?? sRaw.gross);
          let refunded = toNum(sRaw.refundedAmount ?? sRaw.refunded_amount ?? sRaw.refundAmount ?? sRaw.refund_amount ?? sRaw.refunded);
          let net = toNum(sRaw.netRevenue ?? sRaw.net_revenue);
          let count = toNum(sRaw.paymentCount ?? sRaw.payment_count ?? sRaw.count);
          if (net === 0) net = toNum(gross - refunded);
          const dailyTotal = dailyArr.reduce((sum, row) => sum + (toNum(row.revenue) || 0), 0);
          if (gross === 0 && net === 0 && count === 0 && dailyTotal > 0) {
            gross = toNum(dailyTotal);
            net = toNum(gross - refunded);
          }
          setSummary({ gross, refunded, net, count });
          const __DEV__ = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE !== 'production');
          if (__DEV__) {
            console.log('[Dashboard] summary computed ->', { gross, refunded, net, count });
            console.log('[Dashboard] screenings parsed -> total:', (scrAll || []).length, 'withStart:', withStart?.length ?? 0, 'upcomingShown:', upcoming.length);
          }
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
            const start = (
              s.startAt ?? s.start_at ?? s.startTime ?? s.start_time ??
              s.startsAt ?? s.starts_at ?? s.start ?? s.startDateTime ??
              s.start_date_time ?? s.startDate ?? s.start_date ?? ''
            ).toString();
            const end = (
              s.endAt ?? s.end_at ?? s.endTime ?? s.end_time ??
              s.endsAt ?? s.ends_at ?? s.end ?? s.endDateTime ??
              s.end_date_time ?? s.endDate ?? s.end_date ?? ''
            ).toString();
            const toLocal = (iso) => {
              const d = new Date(iso);
              if (isNaN(d)) return '-';
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const hh = String(d.getHours()).padStart(2, '0');
              const mi = String(d.getMinutes()).padStart(2, '0');
              return `${y}-${m}-${dd} ${hh}:${mi}`;
            };
            const startTxt = start ? toLocal(start) : '-';
            const endTxt = end ? toLocal(end) : '-';
            const rawTitle = (s._resolvedTitle ?? s.movieTitle ?? s.movie_title ?? s.movie?.title ?? s.title ?? '');
            const title = (typeof rawTitle === 'string' ? rawTitle : String(rawTitle || '')).trim() || '-';
            const rawId = (s.movieId ?? s.movie_id ?? s.movie?.id ?? null);
            const idStr = (rawId != null && rawId !== '') ? String(rawId) : '';
            const movieCell = idStr ? `#${idStr} - ${title}` : title;
            return [
              movieCell,
              (s.screenName ?? s.screen_name ?? s.screen?.name ?? '-') || '-',
              startTxt,
              endTxt,
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
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="lg:col-span-1">
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

                {/* 곧 시작하는 회차 */}
                <div className="mt-6 grid grid-cols-1 gap-6">
                  <MiniTable
                    title="곧 시작하는 회차(예정)"
                    columns={["영화(ID+제목)", "상영관", "시작시간", "종료시간"]}
                    rows={screeningRows}
                    actionText="상영 관리"
                    to="/admin/screenings"
                  />
                </div>

            </div>
        </AdminLayout>
    );
}