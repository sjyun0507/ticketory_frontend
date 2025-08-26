import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PaymentFail() {
    const navigate = useNavigate();
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || 'UNKNOWN';
    const message = params.get('message') || '결제가 취소되었거나 실패했습니다.';

    // 사용자 친화적 설명(간단 예시)
    const hint = useMemo(() => {
        if (code.includes('USER_CANCEL')) return '사용자에 의해 결제가 취소되었습니다.';
        if (code.includes('DUPLICATED')) return '중복 요청으로 차단되었습니다. 잠시 후 다시 시도해 주세요.';
        if (code.includes('EXCEED')) return '한도 초과 혹은 승인 제한으로 실패했습니다.';
        return '잠시 후 다시 시도하거나 다른 결제 수단을 선택해 보세요.';
    }, [code]);

    return (
        <div className="max-w-xl mx-auto mt-16 p-6 rounded-2xl bg-gray-100 text-gray-800 space-y-4">
            <h2 className="text-2xl font-bold">결제 실패</h2>
            <div className="bg-white rounded-xl p-4 shadow">
                <div className="flex justify-between py-1">
                    <span className="text-gray-500">오류 코드</span>
                    <span className="font-mono font-semibold">{code}</span>
                </div>
                <div className="py-2 text-gray-700 whitespace-pre-wrap">
                    {message}
                </div>
                <div className="text-sm text-gray-500">{hint}</div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => navigate('/payment')}
                    className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white"
                >
                    결제 다시 시도
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