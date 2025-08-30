import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminSidebar.jsx";
import api from "../../api/axiosInstance.js";

const AdminBookings = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(""); // '', REQUESTED, DONE, FAILED
  const [q, setQ] = useState(""); // keyword (reason / pgRefundTid / paymentId)

  useEffect(() => {
    let ignore = false;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await api.get("/cancel-logs");
        if (!ignore) {
          // Expect either an array or a paged object with `content`
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
    return () => {
      ignore = true;
    };
  }, []);

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
        it?.processedByAdminName ?? it?.processedByAdmin?.name ?? it?.processedByAdmin?.memberName ?? "",
      ]
        .join(" ")
        .toLowerCase();
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
              <h2 className="text-2xl sm:text-3xl font-semibold">예매 취소 내역 </h2>
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
                    <th className="px-4 py-3 text-left font-medium">처리자(관리자)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>표시할 취소 로그가 없습니다.</td>
                    </tr>
                  ) : (
                    filtered.map((row) => {
                      const paymentId =
                        row?.paymentId ?? row?.payment?.paymentId ?? row?.payment?.id ?? "-";
                      const adminName =
                        row?.processedByAdminName ??
                        row?.processedByAdmin?.name ??
                        row?.processedByAdmin?.memberName ??
                        row?.processedByAdmin?.username ??
                        "-";
                      return (
                        <tr key={row?.refundId ?? JSON.stringify(row)} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{row?.refundId}</td>
                          <td className="px-4 py-3">{paymentId}</td>
                          <td className="px-4 py-3">
                            {typeof row?.refundAmount === "number"
                              ? row.refundAmount.toLocaleString()
                              : row?.refundAmount ?? "-"}
                          </td>
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