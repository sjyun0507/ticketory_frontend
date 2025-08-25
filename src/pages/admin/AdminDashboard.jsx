import React, { useMemo } from "react";
import { AdminLayout } from "../../components/AdminSidebar";

/* ---------- 작은 공통 카드 ---------- */
function StatCard({ title, value, delta, positive, icon }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
            <div className="shrink-0 rounded-lg p-3 bg-blue-50 text-blue-600">{icon}</div>
            <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">{title}</p>
                <div className="mt-1 flex items-baseline gap-2">
                    <h3 className="text-2xl font-semibold text-slate-800">{value}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${positive ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600"}`}>
            {positive ? "▲" : "▼"} {delta}
          </span>
                </div>
            </div>
        </div>
    );
}

/* ---------- 라인 차트 (SVG) ---------- */
function LineChart({ data, labels }) {
    // data: [series1, series2] 각 배열은 숫자
    const width = 720, height = 260, pad = 32;
    const flat = data.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);
    const x = (i) => pad + (i * (width - pad * 2)) / (labels.length - 1 || 1);
    const y = (v) => height - pad - ((v - min) * (height - pad * 2)) / (max - min || 1);

    const paths = data.map((series, idx) => {
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
                <h4 className="font-semibold text-slate-800">Sales value</h4>
                <div className="text-xs text-slate-500">{labels[0]} ~ {labels[labels.length-1]}</div>
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
                {paths}
                {/* points */}
                {data.map((series, sidx) =>
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
                {labels.map((lb, i) => (
                    <text key={lb} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                        {lb}
                    </text>
                ))}
            </svg>
            <div className="mt-3 flex gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-slate-500">
          <span className="inline-block w-3 h-0.5 bg-sky-500" /> 2025
        </span>
                <span className="inline-flex items-center gap-1 text-slate-500">
          <span className="inline-block w-3 h-0.5 bg-slate-400" /> 2024
        </span>
            </div>
        </div>
    );
}

/* ---------- 막대 차트 (SVG) ---------- */
function BarChart({ data, labels }) {
    const width = 420, height = 260, pad = 28;
    const max = Math.max(...data.map((d) => Math.max(...d)));
    const barW = (width - pad * 2) / (labels.length * data.length + labels.length);
    const x0 = (i) => pad + i * (data.length * barW + barW); // 그룹 시작 x
    const y = (v) => height - pad - (v * (height - pad * 2)) / (max || 1);

    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">Total orders</h4>
                <button className="text-xs text-sky-600">See all</button>
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
                {labels.map((lb, i) =>
                    data.map((series, sidx) => {
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
                {labels.map((lb, i) => (
                    <text key={lb} x={x0(i) + (data.length * barW) / 2 - barW / 2} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                        {lb}
                    </text>
                ))}
            </svg>
            <div className="mt-3 flex gap-4 text-xs">
        <span className="inline-flex items-center gap-1 text-slate-500">
          <span className="inline-block w-3 h-2 bg-fuchsia-500/80 rounded" /> 2025
        </span>
                <span className="inline-flex items-center gap-1 text-slate-500">
          <span className="inline-block w-3 h-2 bg-sky-500/80 rounded" /> 2024
        </span>
            </div>
        </div>
    );
}

/* ---------- 간단 테이블 ---------- */
function MiniTable({ title, rows, columns, actionText }) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">{title}</h4>
                {actionText && <button className="text-xs text-sky-600">{actionText}</button>}
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
                    {rows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 border-slate-50">
                            {r.map((cell, j) => (
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
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    const sales2025 = [22, 48, 67, 34, 42, 58, 92];
    const sales2024 = [60, 72, 51, 26, 39, 64, 71];

    const orders = [
        [65, 42, 78, 55, 63, 38, 92], // 2025
        [40, 30, 55, 60, 35, 42, 80], // 2024
    ];

    const visits = useMemo(
        () => [
            ["/", "4,569", "340", "46.53%"],
            ["/movies", "3,985", "319", "36.49%"],
            ["/charts", "3,513", "294", "50.87%"],
            ["/tables", "2,050", "147", "50.87%"],
        ],
        []
    );

    const social = useMemo(
        () => [
            ["Facebook", "1,480", "60%"],
            ["Google", "4,807", "80%"],
            ["Instagram", "3,678", "75%"],
            ["Twitter", "2,645", "30%"],
        ],
        []
    );

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
                    <StatCard title="Traffic" value="350,897" delta="3.48%" positive icon={<span>📈</span>} />
                    <StatCard title="New users" value="2,356" delta="3.48%" positive={false} icon={<span>👤</span>} />
                    <StatCard title="Sales" value="924" delta="1.10%" positive={false} icon={<span>🛒</span>} />
                    <StatCard title="Performance" value="49.65%" delta="12%" positive icon={<span>⚙️</span>} />
                </div>

                {/* 그래프 영역 */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <LineChart data={[sales2025, sales2024]} labels={months} />
                    </div>
                    <div className="lg:col-span-1">
                        <BarChart data={orders} labels={months} />
                    </div>
                </div>

                {/* 테이블 영역 */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <MiniTable
                            title="Page visits"
                            columns={["PAGE", "VISITORS", "UNIQUE", "BOUNCE"]}
                            rows={visits}
                            actionText="See all"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <MiniTable
                            title="Social traffic"
                            columns={["REFERRAL", "VISITORS", "RATE"]}
                            rows={social}
                            actionText="See all"
                        />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}