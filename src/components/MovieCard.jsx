import { Link, useNavigate } from 'react-router-dom';

export default function MovieCard({ movie }) {
    const { movieId, title, posterUrl } = movie;
    const navigate = useNavigate();

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
            <div className="p-3 pt-0">
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/booking?movieId=${movieId}`); }}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    aria-label={`${title} 예매하기`}
                    >
                    예매하기
                </button>
            </div>
        </Link>
    );
}