import MovieCard from './MovieCard.jsx';

export default function MovieList({ movies = [] }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
    );
}