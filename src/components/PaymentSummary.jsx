import { useEffect, useState } from 'react';
import {getPriceQuote} from "../api/adminApi.js";

/*
Quote값이 세팅된 이후 결제 요약박스(정가,할인내역, 결제금액,배지) 적용
 */
export default function PaymentSummary({ screeningId, cartItems }) {
    // cartItems 예: [{kind:'ADULT', count:2}, {kind:'TEEN', count:1}]
    const [quote, setQuote] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!screeningId || !cartItems?.length) { setQuote(null); return; }
            const data = await getPriceQuote({ screeningId, items: cartItems });
            if (alive) setQuote(data);
        })();
        return () => { alive = false; };
    }, [screeningId, JSON.stringify(cartItems)]);

    if (!quote) return null;

    return (
        <div className="pay-box">
            <div>정가 합계: {quote.originalTotal.toLocaleString()}원</div>
            {quote.discounts?.map(d => (
                <div key={d.code}>− {d.name}{d.percent ? ` (${d.percent}%)` : ''}: {d.amount.toLocaleString()}원</div>
            ))}
            <div className="pay-total"><b>결제 금액: {quote.finalTotal.toLocaleString()}원</b></div>

            {/* 배지/뱃지 */}
            {quote.discounts?.some(d => d.code === 'GLOBAL_WED_DISCOUNT') && (
                <span className="badge">수요일 할인 적용</span>
            )}
        </div>
    );
}