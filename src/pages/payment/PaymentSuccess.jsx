import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmPayment } from '../../api/paymentApi.js';
import { getMemberBookings } from '../../api/bookingApi.js';
import {useAuthStore} from "../../store/useAuthStore.js";


export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [receipt, setReceipt] = useState(null);

  // 인증/멤버 ID 가져오기 (store → JWT → localStorage 폴백)
  const getToken = () => {
    try {
      return useAuthStore.getState()?.token || localStorage.getItem('accessToken') || localStorage.getItem('token');
    } catch { return null; }
  };
  const parseJwt = (t) => {
    try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
  };
  const storeMemberId = (() => { try { return useAuthStore.getState()?.user?.memberId || useAuthStore.getState()?.memberId; } catch { return null; } })();
  const tokenMemberId = (() => { const tok = getToken(); const p = tok ? parseJwt(tok) : null; return p?.memberId || p?.id || p?.sub || null; })();
  const fallbackMemberId = (() => { try { return Number(localStorage.getItem('memberId')) || null; } catch { return null; } })();
  const memberId = storeMemberId || tokenMemberId || fallbackMemberId;

  // 쿼리 파라미터 파싱
  const params = new URLSearchParams(window.location.search);
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount') || 0);

  const [preview, setPreview] = useState(null);
  const toSeatLabel = (s) => {
    if (!s) return null;
    if (typeof s === 'string') return s;
    const row = s.row || s.rowLabel || s.rowName || s.r;
    const col = s.col || s.number || s.seatNumber || s.c;
    const label = s.label || (row && col ? `${row}${col}` : undefined);
    return label ?? String(col ?? '').trim();
  };

  useEffect(() => {
    async function run() {
      console.log('[PaymentSuccess] mount/run start', { paymentKey, orderId, amount, memberId });
      if (!memberId) {
        console.warn('[PaymentSuccess] memberId is NULL. Check auth store/JWT/localStorage. Skipping bookings fetch.');
      }
      // 필수 파라미터 누락
      if (!paymentKey || !orderId || !amount) {
        setStatus('error');
        setMsg('잘못된 접근입니다. 결제 정보가 없습니다.');
        return;
      }

      setStatus('loading');
      try {
        // 서버에 최종 승인 요청
        const res = await confirmPayment({ paymentKey, orderId, amount });
        // res.data 안에 영수증/결제 결과가 들어왔다고 가정
        setReceipt(res?.data || res);
        setStatus('ok');
        console.log('[PaymentSuccess] confirmPayment OK, proceeding to fetch bookings');

        // Toss orderId 저장 (티켓 모달 등에서 판매번호로 사용)
        try {
          const confirmed = res?.data || res;
          const confirmedOrderId = confirmed?.orderId || confirmed?.payment?.orderId || orderId;
          if (confirmedOrderId) {
            localStorage.setItem('lastOrderId', confirmedOrderId);
          }
        } catch {}

        // 결제 후 최신 예매 1건 불러와서 화면 구성 (요약 API)
        try {
          if (memberId) {
            const page = await getMemberBookings(memberId); // 페이지 객체 또는 배열
            console.log('[PaymentSuccess] bookings(list/page):', page);
            const rows = Array.isArray(page) ? page : (Array.isArray(page?.content) ? page.content : []);
            console.log('[PaymentSuccess] rows.length:', rows.length);
            const b = rows.length > 0 ? rows[0] : null;
            if (b) {
              console.log('[PaymentSuccess] first booking keys:', Object.keys(b || {}));
              setPreview({
                movieTitle: b.movieTitle ?? '-',
                posterUrl: b.posterUrl ?? null,
                screenName: b.screenName ?? '',
                seats: Array.isArray(b.seats) ? b.seats : [],
                screeningStartAt: b.screeningStartAt ?? null,
                screeningEndAt: b.screeningEndAt ?? null,
              });
            } else {
              console.warn('[PaymentSuccess] bookings empty for memberId', memberId);
            }
          }
        } catch (e) {
          console.error('[PaymentSuccess] failed to fetch bookings via getMemberBookings', e);
          console.warn('[PaymentSuccess] 예매 정보 불러오기 실패', e);
        }

        // 클라이언트 장바구니 정리(선택)
        try { localStorage.removeItem('cartItems'); } catch {}
      } catch (e) {
        console.error('[confirmPayment] 실패:', e?.response?.status, e?.response?.data || e);
        setMsg(e?.response?.data?.message || '결제 승인에 실패했습니다.');
        setStatus('error');
      }
    }
    run();
  }, [paymentKey, orderId, amount, memberId]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl bg-amber-50 text-amber-800">
        결제 내용을 확인하고 있습니다…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto mt-16 p-6 rounded-xl bg-red-50 text-red-700 space-y-3">
        <h2 className="text-xl font-bold">결제 승인 실패</h2>
        <p className="whitespace-pre-wrap">{msg}</p>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/payment')}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white"
          >
            결제 화면으로
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // status === 'ok'
  const total = receipt?.totalAmount ?? amount;
  const approvedAt = receipt?.approvedAt || receipt?.approved_at;

  return (
    <div className="max-w-3xl mx-auto mt-16 space-y-8">
      {/* 상단 완료 헤더 */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 grid place-items-center text-white text-3xl shadow-md">
          ✓
        </div>
        <h2 className="text-2xl font-bold">영화 예매 완료</h2>
        <p className="text-gray-500">영화 예매가 완료되었습니다.</p>
      </div>

      {/* 본문 카드 래퍼 (연한 회색 배경) */}
      <div className="rounded-2xl bg-gray-100 p-4 md:p-6 space-y-4">
        {/* 영화예매 카드 */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold mb-3">영화예매</h3>
          <div className="space-y-2">
            <div className="font-semibold">{preview?.movieTitle || '-'}</div>
            <div className="text-gray-700">
              {preview?.screeningStartAt ? new Date(preview.screeningStartAt).toLocaleString() : '-'}
              {preview?.screeningEndAt ? ` ~ ${new Date(preview.screeningEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
            {preview?.screenName && (
              <div className="text-gray-700">{preview.screenName}</div>
            )}
            <div className="text-gray-700">일반 {Array.isArray(preview?.seats) ? preview.seats.length : 0}</div>
          </div>
        </div>

        {/* 결제정보 카드 */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold mb-3">결제정보</h3>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-gray-800">
                {receipt?.easyPay?.provider || (receipt?.card ? '카드결제' : '카카오페이')}
              </div>
              <div className="text-indigo-500 text-sm mt-1">영화 문화비 소득공제 대상 (변경불가)</div>
            </div>
            <div className="text-red-500 font-extrabold text-xl">
              {Number(total).toLocaleString()}원
            </div>
          </div>

          {/* 하단 디테일 라인 */}
          <div className="flex justify-between mt-3">
            <span className="text-gray-500">주문번호</span>
            <span className="font-medium">{orderId}</span>
          </div>
          {approvedAt && (
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">승인시간</span>
              <span className="font-medium">{approvedAt}</span>
            </div>
          )}
        </div>
      </div>

      {/* 이동 버튼 */}
      <div className="flex gap-2 justify-center pb-8">
        <button
          onClick={() => navigate('/mypage/bookings')}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800"
        >
          예매내역 보기
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200 border border-gray-300"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}