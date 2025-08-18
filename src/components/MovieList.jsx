import { Link } from "react-router-dom";
import MovieCard from "./MovieCard.jsx";

export default function MovieList({ movies = [] }) {
    // 개발 중 임시 체크
    if (!Array.isArray(movies)) {
        console.warn('MovieList: movies가 배열이 아님', movies);
    }

    if (Array.isArray(movies) && movies.length === 0) {
        return <div className="py-8 text-center text-sm text-gray-500">표시할 영화가 없어요.</div>;
    }

    return (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {movies.map((m) => (
                <div className="transform transition hover:scale-105" key={m.movieId}>
                    <MovieCard movie={m} />
                </div>
            ))}
        </div>
    );
}