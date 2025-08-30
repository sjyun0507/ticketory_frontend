import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminSidebar.jsx";
import { upsertAdminPricing, deleteAdminPricing, getAdminPricing, createWednesdayDiscount } from "../../api/adminApi.js";

const OPS = ["SET", "PLUS", "MINUS", "PCT_PLUS", "PCT_MINUS"];
const KINDS = ["ADULT", "TEEN", "ALL", "CHILD", "UNKNOWN"];
const CURRENCIES = ["KRW", "USD", "JPY"];

const toDateTimeLocal = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const fromDateTimeLocalToMySQL = (v) => {
  if (!v) return null; // treat blank as null
  // v like "2025-08-28T12:34"
  return v.replace("T", " ") + ":00"; // seconds default
};

const num = (v, def = 0) => (v === undefined || v === null || v === "" ? def : Number(v));

const toBoolNum = (v) => {
  if (v === undefined || v === null) return 1;
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['1','true','y','yes','enable','enabled','active','on'].includes(s)) return 1;
    if (['0','false','n','no','disable','disabled','inactive','off'].includes(s)) return 0;
  }
  return v ? 1 : 0;
};
const isEnabledFlag = (v) => toBoolNum(v) === 1;

export default function AdminPricing() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [qScreen, setQScreen] = useState("");
  const [qEnabled, setQEnabled] = useState("ALL");
  const [qKind, setQKind] = useState("ALL");

  // editor modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: null,
    screen_id: "",
    kind: "ADULT",
    op: "SET",
    amount: 0,
    priority: 1,
    valid_from: "",
    valid_to: "",
    enabled: true,
    currency: "KRW",
  });

  // Global Wednesday Discount (inline admin tool)
  const [wedFrom, setWedFrom] = useState("");     // yyyy-mm-dd
  const [wedTo, setWedTo] = useState("");         // yyyy-mm-dd
  const [wedPercent, setWedPercent] = useState(20);
  const [wedKinds, setWedKinds] = useState([]);    // empty => all kinds on server

  const toggleWedKind = (k) => {
    setWedKinds((prev) => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
  };

  const submitWedDiscount = async (e) => {
    e?.preventDefault?.();
    if (!wedFrom || !wedTo) return alert('기간을 선택해 주세요.');
    if (!wedPercent || Number(wedPercent) <= 0) return alert('할인율(%)을 입력해 주세요.');
    try {
      const params = { from: wedFrom, to: wedTo, percent: Number(wedPercent) };
      if (wedKinds && wedKinds.length) params.kinds = wedKinds; // 빈 배열이면 전체 적용
      const { data } = await createWednesdayDiscount(params);
      alert(`수요일 할인 규칙 적용 완료 (created=${data?.created ?? 0})`);
      await load(); // 목록 갱신 (전역 규칙이 보이도록)
    } catch (err) {
      console.error(err);
      alert('수요일 할인 생성/갱신에 실패했습니다. 콘솔을 확인하세요.');
    }
  };

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (qScreen && String(r.screen_id ?? r.screenId) !== String(qScreen)) return false;
      if (qEnabled !== "ALL") {
        const want = qEnabled === "ENABLED" ? 1 : 0;
        if (toBoolNum(r.enabled) !== want) return false;
      }
      if (qKind !== "ALL") {
        const k = String(r.kind ?? r.KIND ?? "").toUpperCase();
        if (k !== qKind) return false;
      }
      return true;
    });
  }, [items, qScreen, qEnabled, qKind]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminPricing(); //관리자 전용 API 호출
      const norm = (data?.content ?? data ?? []).map((r) => ({
        id: r.id ?? r.ID,
        screen_id: r.screen_id ?? r.screenId,
        kind: r.kind ?? r.KIND,
        op: r.op ?? r.OP,
        amount: Number(r.amount ?? r.AMOUNT ?? 0),
        priority: Number(r.priority ?? r.PRIORITY ?? 1),
        valid_from: r.valid_from ?? r.validFrom ?? null,
        valid_to: r.valid_to ?? r.validTo ?? null,
        enabled: toBoolNum(
          r.enabled ?? r.ENABLED ?? r.is_enabled ?? r.isEnabled ?? r.active ?? r.ACTIVE ?? r.status ?? r.STATUS
        ),
        currency: r.currency ?? r.CURRENCY ?? "KRW",
        created_at: r.created_at ?? r.createdAt,
        updated_at: r.updated_at ?? r.updatedAt,
      }));
      setItems(norm);
      console.log('[AdminPricing] loaded', { count: norm.length, samples: norm.slice(0,5).map(x=>({id:x.id, enabled:x.enabled})) });
    } catch (e) {
      console.error(e);
      alert("가격 규칙 목록을 불러오지 못했습니다. 콘솔을 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onEdit = (r) => {
    setForm({
      id: r?.id ?? null,
      screen_id: r?.screen_id ?? "",
      kind: (r?.kind ?? "ADULT").toUpperCase(),
      op: (r?.op ?? "SET").toUpperCase(),
      amount: r?.amount ?? 0,
      priority: r?.priority ?? 1,
      valid_from: toDateTimeLocal(r?.valid_from),
      valid_to: toDateTimeLocal(r?.valid_to),
      enabled: isEnabledFlag(r?.enabled),
      currency: r?.currency ?? "KRW",
    });
    setOpen(true);
  };

  const onNew = () => onEdit(null);

  const onDelete = async (id) => {
    if (!confirm(`해당 규칙(ID=${id})을 삭제할까요?`)) return;
    try {
      await deleteAdminPricing(id);
      await load();
      alert("삭제되었습니다.");
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다. 콘솔을 확인하세요.");
    }
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    const payload = {
      id: form.id ?? undefined,
      screen_id: num(form.screen_id, undefined),
      kind: form.kind,
      op: form.op,
      amount: num(form.amount, 0),
      priority: num(form.priority, 1),
      valid_from: fromDateTimeLocalToMySQL(form.valid_from),
      valid_to: fromDateTimeLocalToMySQL(form.valid_to),
      enabled: toBoolNum(form.enabled),
      currency: form.currency || "KRW",
    };

    if (!payload.screen_id) return alert("screen_id는 필수입니다.");
    if (!payload.kind) return alert("kind는 필수입니다.");
    if (!payload.op) return alert("op는 필수입니다.");

    try {
      await upsertAdminPricing(payload);
      setOpen(false);
      await load();
      alert("저장되었습니다.");
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다. 콘솔을 확인하세요.");
    }
  };

  return (
    <AdminLayout>
      <main className="max-w-[1200px] mx-auto px-4 py-10 min-h-[75vh]">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl sm:text-3xl font-semibold">상영관 요금/프로모션 관리</h2>
          <div className="flex items-center gap-2">
            <button onClick={onNew} className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm">+ 새 규칙</button>
            <button onClick={load} className="px-3 py-2 rounded border text-sm">새로고침</button>
          </div>
        </header>

        {/* Global Wednesday Discount (Inline Tool) */}
        <section className="mb-6 p-4 border rounded-lg bg-white">
          <h3 className="text-base font-semibold mb-3">전역 수요일 할인 생성/갱신</h3>
          <form onSubmit={submitWedDiscount} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">기간 From</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={wedFrom} onChange={(e)=>setWedFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">기간 To</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={wedTo} onChange={(e)=>setWedTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">할인율(%)</label>
              <input type="number" min="1" max="100" className="w-full border rounded px-3 py-2" value={wedPercent} onChange={(e)=>setWedPercent(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">대상 요금종류 (비우면 전체)</label>
              <div className="flex flex-wrap gap-2">
                {['ADULT','TEEN','CHILD'].map(k => (
                  <label key={k} className="inline-flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={wedKinds.includes(k)} onChange={()=>toggleWedKind(k)} />
                    <span>{k}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">수요일 할인 생성/갱신</button>
            </div>
          </form>
        </section>

        {/* Filters */}
        <section className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Screen ID</label>
            <input value={qScreen} onChange={(e)=>setQScreen(e.target.value)} placeholder="예: 1" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Kind</label>
            <select value={qKind} onChange={(e)=>setQKind(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="ALL">ALL</option>
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">상태</label>
            <select value={qEnabled} onChange={(e)=>setQEnabled(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="ALL">전체</option>
              <option value="ENABLED">사용</option>
              <option value="DISABLED">중지</option>
            </select>
          </div>
        </section>

        {/* Table */}
        <section className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr className="text-center">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Screen</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Op</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Valid From</th>
                  <th className="px-3 py-2">Valid To</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-500">불러오는 중...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">규칙이 없습니다.</td></tr>
                ) : (
                  filtered.sort((a,b)=> (a.priority-b.priority) || ((a.id??0)-(b.id??0))).map((r)=> (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.id}</td>
                      <td className="px-3 py-2">{r.screen_id}</td>
                      <td className="px-3 py-2">{r.kind}</td>
                      <td className="px-3 py-2">{r.op}</td>
                      <td className="px-3 py-2">{Number(r.amount).toLocaleString()}</td>
                      <td className="px-3 py-2">{r.priority}</td>
                      <td className="px-3 py-2">{r.valid_from ? String(r.valid_from).replace('T',' ').slice(0,19) : '-'}</td>
                      <td className="px-3 py-2">{r.valid_to ? String(r.valid_to).replace('T',' ').slice(0,19) : '-'}</td>
                      <td className="px-3 py-2">
                        <span className={isEnabledFlag(r.enabled) ? 'inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700' : 'inline-block px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700'}>
                          {isEnabledFlag(r.enabled) ? '사용' : '중지'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.currency || 'KRW'}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={()=>onEdit(r)} className="px-2 py-1 text-xs border rounded mr-1 hover:bg-gray-50">수정</button>
                        <button onClick={()=>onDelete(r.id)} className="px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50">삭제</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)} />
            <div className="relative bg-white w-full max-w-[720px] rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">{form.id ? `규칙 수정 #${form.id}` : '새 규칙 추가'}</h3>
              <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Screen ID *</label>
                  <input type="number" className="w-full border rounded px-3 py-2" value={form.screen_id}
                         onChange={(e)=>setForm(f=>({...f, screen_id:e.target.value}))} required/>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Kind *</label>
                  <select className="w-full border rounded px-3 py-2" value={form.kind}
                          onChange={(e)=>setForm(f=>({...f, kind:e.target.value}))}>
                    {KINDS.map(k=> <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Op *</label>
                  <select className="w-full border rounded px-3 py-2" value={form.op}
                          onChange={(e)=>setForm(f=>({...f, op:e.target.value}))}>
                    {OPS.map(k=> <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Amount *</label>
                  <input type="number" className="w-full border rounded px-3 py-2" value={form.amount}
                         onChange={(e)=>setForm(f=>({...f, amount:e.target.value}))} required/>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Priority *</label>
                  <input type="number" className="w-full border rounded px-3 py-2" value={form.priority}
                         onChange={(e)=>setForm(f=>({...f, priority:e.target.value}))} required/>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Currency</label>
                  <select className="w-full border rounded px-3 py-2" value={form.currency}
                          onChange={(e)=>setForm(f=>({...f, currency:e.target.value}))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Valid From</label>
                  <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.valid_from}
                         onChange={(e)=>setForm(f=>({...f, valid_from:e.target.value}))}/>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Valid To</label>
                  <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.valid_to}
                         onChange={(e)=>setForm(f=>({...f, valid_to:e.target.value}))}/>
                </div>

                <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                  <input id="enabled" type="checkbox" checked={!!form.enabled}
                         onChange={(e)=>setForm(f=>({...f, enabled:e.target.checked}))}/>
                  <label htmlFor="enabled" className="text-sm">Enabled</label>
                </div>

                <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 mt-2">
                  <button type="button" onClick={()=>setOpen(false)} className="px-4 py-2 border rounded">취소</button>
                  <button type="submit" className="px-4 py-2 bg-black text-white rounded">저장</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}