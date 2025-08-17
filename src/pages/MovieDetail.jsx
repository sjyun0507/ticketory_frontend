import { useParams } from 'react-router-dom';
import { useMovieDetail } from '../hooks/useMovies.js';

export default function MovieDetail() {
    const { movieId } = useParams();
    const { data: movie, loading, err } = useMovieDetail(movieId);

    if (loading) return <div className="p-6">불러오는 중…</div>;
    if (err) return <div className="p-6 text-red-600">{err}</div>;
    if (!movie) return null;

    // derive trailer url from movie_media (flexible keys)
    const trailerUrl =
      movie?.media?.trailer?.url ||
      movie?.media?.trailer?.cdnUrl ||
      movie?.media?.trailerUrl ||
      movie?.trailerUrl ||
      (Array.isArray(movie?.media?.items)
        ? movie.media.items.find((x) => x.type === 'TRAILER')?.cdnUrl
        : null);

    const trailerType = trailerUrl
      ? (trailerUrl.endsWith('.mp4')
          ? 'video/mp4'
          : trailerUrl.endsWith('.webm')
          ? 'video/webm'
          : trailerUrl.endsWith('.m3u8')
          ? 'application/x-mpegURL'
          : undefined)
      : undefined;

    return (
        <div className="mx-auto max-w-6xl p-4">
            <div className="grid gap-6 md:grid-cols-3">
                {/* 좌: 대표 포스터 */}
                <div className="md:col-span-1">
                    <img src={movie.media?.poster?.[0]?.cdnUrl} alt={`${movie.title} 포스터`} className="w-full rounded-xl" />
                </div>

                {/* 우: 타이틀 등 기본 정보 */}
                <div className="md:col-span-2">
                    <h1 className="mb-2 text-2xl font-bold">{movie.title}</h1>
                    <p className="text-gray-700">{movie.summary}</p>

                    {/* 예고편 */}
                    {trailerUrl && (
                        <div className="mt-6">
                            <div className="relative pt-[56.25%]">
                                <video
                                    className="absolute inset-0 h-full w-full rounded-xl"
                                    controls
                                    preload="metadata"
                                    poster={movie.media?.poster?.[0]?.cdnUrl}
                                >
                                    {trailerType ? (
                                        <source src={trailerUrl} type={trailerType} />
                                    ) : (
                                        <source src={trailerUrl} />
                                    )}
                                    브라우저가 비디오 태그를 지원하지 않습니다.{' '}
                                    <a href={trailerUrl} target="_blank" rel="noreferrer">
                                        영상 열기
                                    </a>
                                </video>
                            </div>
                            {trailerType === 'application/x-mpegURL' && (
                                <p className="mt-2 text-xs text-gray-500">
                                    일부 브라우저에서는 HLS(.m3u8) 재생을 위해 보조 스크립트가 필요할 수 있어요.
                                </p>
                            )}
                        </div>
                    )}

                    {/* 스틸컷 갤러리 */}
                    {Array.isArray(movie.media?.stills) && movie.media.stills.length > 0 && (
                        <div className="mt-8">
                            <h2 className="mb-3 text-lg font-semibold">스틸컷</h2>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                {movie.media.stills.map((s, idx) => (
                                    <img key={idx} src={s.cdnUrl} alt={`${movie.title} 스틸컷 ${idx + 1}`} className="h-full w-full rounded-lg object-cover" loading="lazy" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}