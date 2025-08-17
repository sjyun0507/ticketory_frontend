import React from 'react';
import {useMovieList} from "../../hooks/useMovies.js";
import MovieList from "../../components/MovieList.jsx";



export default function Home() {
    const { data, loading, err } = useMovieList(0, 24);

    if (loading) return <div className="p-6">불러오는 중…</div>;
    if (err) return <div className="p-6 text-red-600">{err}</div>;

    return (
        <main className="max-w-[1200px] mx-auto px-4 py-16 min-h-[75vh] flex items-center justify-center">
            <div className="mx-auto max-w-6xl p-4">
                <h2 className="mb-4 text-xl font-bold">지금 상영중</h2>
                <MovieList movies={data.content} />
            </div>
        </main>
    );
}

