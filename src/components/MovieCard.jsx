import { Link } from 'react-router-dom';

export default function MovieCard({ movie }) {
    const { movieId, title, posterUrl } = movie;

    return (
        <Link
            to={`/movies/${movieId}`}
            className="block overflow-hidden rounded-xl border border-gray-200 hover:shadow-md"
            aria-label={`${title} 상세보기`}
        >
            <div className="aspect-[2/3] bg-gray-100">
                {posterUrl ? (
                    <img
                        src={posterUrl}
                        alt={`${title} 포스터`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">No Image</div>
                )}
            </div>
            <div className="p-3">
                <h3 className="line-clamp-1 text-sm font-semibold">{title}</h3>
            </div>
        </Link>
    );
}