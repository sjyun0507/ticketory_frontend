import React from "react";

const Screenings = () => {
    return (
        <main className="max-w-[1200px] mx-auto px-4 py-16 min-h-[85vh] flex items-center justify-center">
            <section className="w-full">
                <div className="border rounded-lg bg-white/80 backdrop-blur p-10 text-center shadow-sm">
                    <div className="text-5xl mb-4">🚧</div>
                    <h2 className="text-2xl sm:text-3xl font-semibold mb-3">상영시간표 페이지는 현재 작업 중입니다</h2>
                    <p className="text-gray-600 mb-8">기능을 준비하고 있어요. 조금만 기다려 주세요.</p>
                    <div className="flex items-center justify-center gap-3">
                        <a href="/public" className="border px-4 py-2 rounded hover:bg-gray-50">홈으로</a>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Screenings;