import {Link} from "react-router-dom";

function formatDate(input, pattern = "YYYY.MM.DD HH:mm") {
  if (!input) return "";
  const d = (typeof input === "string" || typeof input === "number") ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";

  const YYYY = String(d.getFullYear());
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  return pattern
    .replace("YYYY", YYYY)
    .replace("MM", MM)
    .replace("DD", DD)
    .replace("HH", HH)
    .replace("mm", mm)
    .replace("ss", ss);
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("ko-KR");
}


import React, { useEffect, useMemo, useState } from "react";
import {useAuthStore} from "../../store/useAuthStore.js";
import {useMemberPoints} from "../../hooks/usePoints.js";

const TYPE_OPTIONS = [
    { label: "전체", value: "" },
    { label: "적립(EARN)", value: "EARN" },
    { label: "사용(USE)", value: "USE" },
    { label: "취소/환급(CANCEL)", value: "CANCEL" },
];

export default function PointsHistory() {
    const memberId = useAuthStore((s) => s.user?.memberId);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [type, setType] = useState("");
    const [from, setFrom] = useState(""); // YYYY-MM-DD
    const [to, setTo] = useState("");     // YYYY-MM-DD

    const { data, isLoading, isError, error, refetch } = useMemberPoints({
        memberId,
        page,
        size,
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
    });


    useEffect(() => {
        // 필터 변경 시 첫 페이지로
        setPage(0);
    }, [type, from, to, size]);

    const items = data?.content ?? [];
    const totalElements = data?.totalElements ?? 0;
    const totalPages = data?.totalPages ?? 0;
    const first = data?.first ?? true;
    const last = data?.last ?? true;

    // 현재 페이지 합계(시각적 요약)
    const pageSum = useMemo(() => {
        return items.reduce((acc, cur) => acc + (cur.amount || 0), 0);
    }, [items]);

    // 잔액 API가 없을 때: 첫 페이지에서만 최신 레코드의 balanceAfter 사용
    const isFirstPage = page === 0;
    const latestBalanceOnThisPage = items.length > 0 ? items[0].balanceAfter : undefined;
    const balance = isFirstPage ? latestBalanceOnThisPage : undefined;

    return (
            <div className="max-w-[1200px] mx-auto px-4 py-6">
                <div className="mb-4">
                    <Link
                        to="/mypage"
                        className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded border"
                    >
                        ← 마이페이지로
                    </Link>
                </div>
            <h1 className="text-xl md:text-2xl font-bold mb-4">포인트 내역</h1>

            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <SummaryCard title="현재 잔액(최근 내역 기준)">
                    {typeof balance === "number" ? (
                        <strong className="text-xl">{formatCurrency(balance)}P</strong>
                    ) : (
                        <span className="text-gray-500">-</span>
                    )}
                </SummaryCard>
                <SummaryCard title="현재 페이지 합계">
                    <strong className={`text-xl ${pageSum >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {pageSum >= 0 ? "+" : ""}
                        {formatCurrency(pageSum)}P
                    </strong>
                </SummaryCard>
                <SummaryCard title="전체 건수">
                    <strong className="text-xl">{totalElements.toLocaleString()}건</strong>
                </SummaryCard>
            </div>

            {/* 필터 */}
            <div className="rounded-2xl border p-3 md:p-4 mb-4">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-sm mb-1">유형</label>
                        <select
                            className="w-full border rounded-lg px-3 py-2"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            {TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value || "ALL"} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm mb-1">시작일</label>
                        <input
                            type="date"
                            className="border rounded-lg px-3 py-2"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">종료일</label>
                        <input
                            type="date"
                            className="border rounded-lg px-3 py-2"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1">페이지 크기</label>
                        <select
                            className="border rounded-lg px-3 py-2"
                            value={size}
                            onChange={(e) => setSize(Number(e.target.value))}
                        >
                            {[10, 20, 50].map((n) => (
                                <option key={n} value={n}>
                                    {n}개
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        className="h-10 px-4 rounded-xl bg-black text-white md:self-end"
                        onClick={() => refetch()}
                    >
                        검색
                    </button>
                </div>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto rounded-2xl border">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                    <tr>
                        <Th>일시</Th>
                        <Th>유형</Th>
                        <Th className="text-right">변동</Th>
                        <Th className="text-right">잔액</Th>
                        <Th>설명</Th>
                        <Th>연결(예매/결제)</Th>
                    </tr>
                    </thead>
                    <tbody>
                    {isLoading && (
                        <tr>
                            <td colSpan={6} className="p-5 text-center text-gray-500">
                                불러오는 중…
                            </td>
                        </tr>
                    )}
                    {isError && (
                        <tr>
                            <td colSpan={6} className="p-5 text-center text-red-600">
                                포인트 내역을 불러오는 중 오류가 발생했습니다: {String(error?.message || "")}
                            </td>
                        </tr>
                    )}
                    {!isLoading && !isError && items.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500">
                                포인트 내역이 없습니다.
                            </td>
                        </tr>
                    )}

                    {items.map((row) => (
                        <tr key={row.id} className="border-t">
                            <Td>{formatDate(row.createdAt, "YYYY.MM.DD HH:mm")}</Td>
                            <Td>
                                <TypeBadge type={row.changeType} />
                            </Td>
                            <Td className="text-right">
                                <AmountText amount={row.amount} />
                            </Td>
                            <Td className="text-right">{formatCurrency(row.balanceAfter)}P</Td>
                            <Td>{row.description || "-"}</Td>
                            <Td>
                                {row.bookingId ? `B#${row.bookingId}` : "-"}{" "}
                                {row.paymentId ? ` / P#${row.paymentId}` : ""}
                            </Td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                    페이지 {totalPages === 0 ? 0 : page + 1} / {totalPages}
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={first}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className={`px-3 py-2 rounded-lg border ${first ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        이전
                    </button>
                    <button
                        disabled={last}
                        onClick={() => setPage((p) => p + 1)}
                        className={`px-3 py-2 rounded-lg border ${last ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        다음
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- 소형 컴포넌트들 ---------- */

function SummaryCard({ title, children }) {
    return (
        <div className="rounded-2xl border p-4">
            <div className="text-sm text-gray-500 mb-1">{title}</div>
            <div>{children}</div>
        </div>
    );
}

function Th({ children, className = "" }) {
    return <th className={`text-left px-4 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }) {
    return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function TypeBadge({ type }) {
    const map = {
        EARN: { label: "적립", cls: "bg-green-100 text-green-700" },
        USE: { label: "사용", cls: "bg-red-100 text-red-700" },
        CANCEL: { label: "취소/환급", cls: "bg-gray-100 text-gray-700" },
    };
    const info = map[type] || { label: type, cls: "bg-gray-100 text-gray-700" };
    return (
        <span className={`inline-block px-2 py-1 rounded-full text-xs ${info.cls}`}>{info.label}</span>
    );
}

function AmountText({ amount }) {
    const isPlus = amount >= 0;
    return (
        <span className={isPlus ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
      {isPlus ? "+" : ""}
            {formatCurrency(amount)}P
    </span>
    );
}