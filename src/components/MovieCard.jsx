import { Link, useNavigate } from 'react-router-dom';

/* 영화목록 카드
* 포스터/제목/예매하기 버튼
*/
export default function MovieCard({ movie, computeMovieStatus }) {
    const { movieId, title, posterUrl } = movie;
    const navigate = useNavigate();
    const derivedStatus = typeof computeMovieStatus === 'function' ? computeMovieStatus(movie) : movie.status;
    const isFinished = derivedStatus === 'FINISHED' || derivedStatus === 'ENDED';

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
                    disabled={isFinished}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isFinished) navigate(`/booking?movieId=${movieId}`);
                    }}
                    className={`w-full py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-opacity-50 
                        ${isFinished
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-sky-600 text-white hover:bg-indigo-600 focus:ring-violet-500"}
                    `}
                    aria-label={isFinished ? `${title} 예매불가 (상영종료)` : `${title} 예매하기`}
                    data-status={derivedStatus}
                >
                    {isFinished ? "상영종료" : "예매하기"}
                </button>
            </div>
        </Link>
    );
}