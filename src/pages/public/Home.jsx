import React from 'react';
import {useMovieList} from "../../hooks/useMovies.js";
import MovieList from "../../components/MovieList.jsx";



export default function Home() {
    const { data, loading, err } = useMovieList(0, 24);

    if (loading) return <div className="p-6">불러오는 중…</div>;
    if (err) return <div className="p-6 text-red-600">{err}</div>;

    // 응답 형태가 배열이거나 Page<{content: []}> 둘 다 안전하게 처리
    const movies = Array.isArray(data) ? data : (data?.content ?? []);

    return (
        <main className="max-w-[1200px] mx-auto px-4 py-16 min-h-[75vh]">
            <div className="mx-auto max-w-6xl p-4">
                <div className="mb-4 flex items-end justify-between">
                    <h2 className="text-xl font-bold">지금 상영중</h2>
                    <span className="text-sm text-gray-500">{Array.isArray(movies) ? movies.length : 0}건</span>
                </div>
                <MovieList movies={movies} />
            </div>
        </main>
    );
}

