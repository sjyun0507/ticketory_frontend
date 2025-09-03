import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminSidebar.jsx";
import api from "../../api/axiosInstance.js";

// [ADD] 공용 포맷터
const fmtMoney = (v) => {
    if (v == null) return "-";
    // 서버가 BigDecimal을 문자열로 줄 수도 있음
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n.toLocaleString() : String(v);
};
const fmtDateTime = (v) => {
    if (!v) return "-";
    try {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        // 로컬 보기 좋게
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} `
            + `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    } catch {
        return String(v);
    }
};

const AdminBookings = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // [KEEP] 클라이언트 필터 상태
    const [status, setStatus] = useState(""); // "", REQUESTED, DONE, FAILED
    const [q, setQ] = useState(""); // keyword (reason / pgRefundTid / paymentId)

    useEffect(() => {
        let ignore = false;

        const fetchLogs = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // [OPT] 서버 필터/검색 쓰고 싶으면 아래처럼 파라미터 추가
                // const params = { status: status || undefined, q: q || undefined, page: 0, size: 100 };
                // const { data } = await api.get("/cancel-logs", { params });
                const { data } = await api.get("/cancel-logs");
                if (!ignore) {
                    const items = Array.isArray(data) ? data : (data?.content ?? []);
                    setLogs(items);
                }
            } catch (e) {
                console.error("[AdminBookings] cancel-logs fetch error:", e);
                setError(e?.response?.data?.message || e?.message || "취소 로그를 불러올 수 없습니다.");
            } finally {
                if (!ignore) setIsLoading(false);
            }
        };

        fetchLogs();
        return () => { ignore = true; };
        // [NOTE] 서버 필터를 쓰려면 의존성에 status/q 추가하고 위 get에 params 사용
    }, []);

    // [CHANGE] DTO 필드명에 맞춰 검색 소스 정리
    const filtered = useMemo(() => {
        return logs.filter((it) => {
            const matchStatus = status ? (String(it?.status ?? "").toUpperCase() === status) : true;
            if (!q) return matchStatus;
            const keyword = q.trim().toLowerCase();
            const paymentId = (it?.paymentId ?? it?.payment?.paymentId ?? it?.payment?.id ?? "").toString();
            const textBlob = [
                it?.reason ?? "",
                it?.pgRefundTid ?? "",
                paymentId,
                it?.canceledByAdminName ?? "", // [FIX] DTO 필드명
            ].join(" ").toLowerCase();
            return matchStatus && textBlob.includes(keyword);
        });
    }, [logs, status, q]);

    const renderPgTid = (row) => {
        const tid = row?.pgRefundTid;
        const st = String(row?.status || "").toUpperCase();
        if (!tid) {
            const titleText =
                st === "DONE"
                    ? "PG에서 환불 TID 미수신(테스트/샌드박스 또는 비동기 지연 가능)"
                    : "환불 진행 중이거나 실패 상태일 수 있습니다.";
            return (
                <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500"
                    title={titleText}
                >
          미발급
        </span>
            );
        }
        return <span className="font-mono text-[12px]">{tid}</span>;
    };

    return (
        <AdminLayout>
            <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
                <section className="w-full">
                    <div className="mb-6 flex flex-col sm:items-start sm:justify-between gap-4">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-semibold">예매 취소 내역</h2>
                        </div>

                        <div className="flex gap-2">
                            <select
                                className="border rounded-md px-3 py-2"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="">전체 상태</option>
                                <option value="REQUESTED">REQUESTED</option>
                                <option value="DONE">DONE</option>
                                <option value="FAILED">FAILED</option>
                            </select>

                            <input
                                type="text"
                                placeholder="사유/PG TID/결제ID 검색"
                                className="border rounded-md px-3 py-2 w-56"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            테스트/샌드박스 환경에서는 PG Refund TID가 비어 있을 수 있어요. 환불 상태가 <b>DONE</b>이어도
                            비동기 지연으로 나중에 수신될 수 있습니다.
                        </p>
                    </div>

                    {isLoading && (
                        <div className="border rounded-lg bg-white/80 backdrop-blur p-10 text-center shadow-sm">
                            <div className="text-4xl mb-3">⏳</div>
                            <p className="text-gray-700">취소 로그를 불러오는 중...</p>
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="border rounded-lg bg-red-50 p-5 text-red-700">{error}</div>
                    )}

                    {!isLoading && !error && (
                        <div className="overflow-x-auto border rounded-lg bg-white/90 shadow-sm">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">ID</th>
                                    <th className="px-4 py-3 text-left font-medium">결제ID</th>
                                    <th className="px-4 py-3 text-left font-medium">환불금액</th>
                                    <th className="px-4 py-3 text-left font-medium">상태</th>
                                    <th className="px-4 py-3 text-left font-medium">사유</th>
                                    <th className="px-4 py-3 text-left font-medium">PG Refund TID</th>
                                    {/* [ADD] 시간 컬럼 */}
                                    <th className="px-4 py-3 text-left font-medium">예매시각</th>
                                    <th className="px-4 py-3 text-left font-medium">취소시각</th>
                                    <th className="px-4 py-3 text-left font-medium">처리자(관리자)</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-6 text-center text-gray-500" colSpan={10}>
                                            표시할 취소 로그가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((row) => {
                                        // [FIX] cancelId 사용
                                        const key = row?.cancelId ?? `${row?.paymentId}-${row?.pgRefundTid ?? ""}`;
                                        const paymentId = row?.paymentId ?? row?.payment?.paymentId ?? row?.payment?.id ?? "-";
                                        const adminName =
                                            row?.canceledByAdminName ??
                                            row?.processedByAdminName ?? // 백엔드가 아직 이전 필드명일 수도 있으니 폴백
                                            "-";

                                        return (
                                            <tr key={key} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">{row?.cancelId ?? "-"}</td>
                                                <td className="px-4 py-3">{paymentId}</td>
                                                <td className="px-4 py-3">{fmtMoney(row?.refundAmount)}</td>
                                                <td className="px-4 py-3">
                            <span
                                className={
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium " +
                                    (String(row?.status).toUpperCase() === "DONE"
                                        ? "bg-green-100 text-green-700"
                                        : String(row?.status).toUpperCase() === "FAILED"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-yellow-100 text-yellow-800")
                                }
                            >
                              {row?.status ?? "-"}
                            </span>
                                                </td>
                                                <td className="px-4 py-3 max-w-[320px]">
                                                    <div className="truncate" title={row?.reason || ""}>{row?.reason ?? "-"}</div>
                                                </td>
                                                <td className="px-4 py-3">{renderPgTid(row)}</td>

                                                {/* [ADD] 시간 출력 */}
                                                <td className="px-4 py-3">{fmtDateTime(row?.bookingTime)}</td>
                                                <td className="px-4 py-3">{fmtDateTime(row?.canceledAt)}</td>

                                                <td className="px-4 py-3">{adminName}</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </AdminLayout>
    );
};

export default AdminBookings;