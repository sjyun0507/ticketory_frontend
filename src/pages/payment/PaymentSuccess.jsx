import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmPayment } from '../../api/paymentApi.js';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [receipt, setReceipt] = useState(null);

  // 쿼리 파라미터 파싱
  const params = new URLSearchParams(window.location.search);
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount') || 0);

  useEffect(() => {
    async function run() {
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

        // 클라이언트 장바구니 정리(선택)
        try { localStorage.removeItem('cartItems'); } catch {}
      } catch (e) {
        console.error('[confirmPayment] 실패:', e?.response?.status, e?.response?.data || e);
        setMsg(e?.response?.data?.message || '결제 승인에 실패했습니다.');
        setStatus('error');
      }
    }
    run();
  }, [paymentKey, orderId, amount]);

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
    <div className="max-w-xl mx-auto mt-16 p-6 rounded-2xl bg-emerald-50 text-emerald-800 space-y-4">
      <h2 className="text-2xl font-bold">결제가 완료되었습니다.</h2>
      <div className="bg-white rounded-xl p-4 shadow">
        <div className="flex justify-between py-1">
          <span className="text-gray-500">주문번호</span>
          <span className="font-medium">{orderId}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-500">결제금액</span>
          <span className="font-semibold">{Number(total).toLocaleString()}원</span>
        </div>
        {approvedAt && (
          <div className="flex justify-between py-1">
            <span className="text-gray-500">승인시간</span>
            <span className="font-medium">{approvedAt}</span>
          </div>
        )}
        {receipt?.card?.number && (
          <div className="flex justify-between py-1">
            <span className="text-gray-500">카드</span>
            <span className="font-medium">{receipt.card.number}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate('/mypage')}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          내 예매목록 보기
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