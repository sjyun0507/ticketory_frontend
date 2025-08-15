import React from 'react';

const Home = () => {
  return (
    <main className="max-w-[1200px] mx-auto px-4 py-16 min-h-[70vh] flex items-center justify-center">
      <section className="w-full">
        <div className="border rounded-lg bg-white/80 backdrop-blur p-10 text-center shadow-sm">
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="text-2xl sm:text-3xl font-semibold mb-3">홈 페이지는 현재 작업 중입니다</h2>
          <p className="text-gray-600 mb-8">기능을 준비하고 있어요. 조금만 기다려 주세요.</p>

        </div>
      </section>
    </main>
  );
};

export default Home;