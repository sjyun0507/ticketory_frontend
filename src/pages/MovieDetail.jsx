// --- file: src/pages/MovieDetail.jsx
import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useMovieDetail } from '../hooks/useMovies.js';

// ===== Helpers =====
// ===== UI Components =====
const SectionTitle = ({ children }) => (
    <div className="mb-3 flex items-center gap-3">
        <span className="block h-5 w-1.5 rounded-full bg-gradient-to-b from-blue-600 to-cyan-400" />
        <h2 className="text-lg font-bold tracking-tight text-gray-900">{children}</h2>
        <span className="ml-auto h-px flex-1 bg-gradient-to-r from-gray-300 to-transparent" />
    </div>
);
const ASSET_ORIGIN = import.meta?.env?.VITE_ASSET_ORIGIN || 'http://mybusiness.dothome.co.kr';

// URL을 절대경로로 만들고, 공백/한글/역슬래시/중복슬래시/이미-인코딩된 경우까지 안전 처리
const normalizeUrl = (u) => {
    if (u == null) return null;
    if (typeof u !== 'string') u = String(u);

    let s = u.trim().replace(/^['"]|['"]$/g, '');
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    if (s.startsWith('data:')) return s;

    // 경로 정리
    s = s.replace(/\\/g, '/');                 // 역슬래시 -> 슬래시
    if (s.startsWith('./')) s = s.slice(1);    // ./foo -> /foo
    if (s.startsWith('../')) s = s.replace(/^(\.\.\/)+/, '/');

    // 절대/상대/프로토콜 상대 처리
    if (s.startsWith('//')) s = `http:${s}`;
    else if (s.startsWith('/')) s = `${ASSET_ORIGIN}${s}`;
    else if (!/^https?:\/\//i.test(s)) s = `${ASSET_ORIGIN}/${s}`;

    // 중복 슬래시 정리 (스킴 제외)
    s = s.replace(/^(https?:\/\/[^/]+)\/+/, '$1/').replace(/([^:])\/\/+/g, '$1/');

    // 안전 인코딩 (이미 %가 있으면 건드리지 않음)
    try {
        if (!/%[0-9A-Fa-f]{2}/.test(s)) s = encodeURI(s);
    } catch (_) {}

    return s;
};

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const toArray = (v) =>
    Array.isArray(v)
        ? v
        : typeof v === 'string'
            ? v.split(/[\s,|\n\r\t]+/).map((x) => x.trim()).filter(Boolean)
            : v
                ? [v]
                : [];

const pickUrl = (item) => {
    if (!item) return null;
    if (typeof item === 'string') return item;
    const c = item || {};
    return (
        c.cdnUrl || c.url || c.src || c.href || c.path || c.file || c.original ||
        c.full || c.large || c.medium || c.small || c.image || c.img || c.asset || c.location ||
        c.imageUrl || c.fileUrl || c.file_path || c.image_path || null
    );
};

const asName = (x) =>
    typeof x === 'string'
        ? x
        : x?.name || x?.personName || x?.fullName || x?.korName || x?.enName || x?.actor || x?.director || '';

// ===== Component =====
export default function MovieDetail() {
    const params = useParams();
    const movieId = params.movieId ?? params.id;
    const { data: movie, loading, err } = useMovieDetail(movieId);

    // 백엔드 필드 그대로 매핑
    const title          = movie?.title ?? '제목 미정';
    const subtitle       = movie?.subtitle ?? '';
    const overview       = movie?.summary ?? '';
    const releaseDate    = movie?.releaseDate ?? '미정';
    const genreText      = Array.isArray(movie?.genre) ? movie.genre.join(', ')
        : typeof movie?.genre === 'string' ? movie.genre : '';
    const rating         = movie?.rating ?? '';
    const runningMinutes = movie?.runningMinutes ?? '';

    // 포스터 목록: 메인은 posterUrl, 추가 목록은 posterUrls/posters/이미지/아이템
    const posterList = useMemo(() => {
        const a = [];
        a.push(movie?.posterUrl);
        a.push(...toArray(movie?.posterUrls));
        a.push(...toArray(movie?.posters));
        if (Array.isArray(movie?.images?.posters)) a.push(...movie.images.posters.map(pickUrl));
        if (Array.isArray(movie?.media?.items)) {
            const postersFromItems = movie.media.items
                .filter((x) => String(x?.type || x?.category || x?.kind).toUpperCase().includes('POSTER'))
                .map(pickUrl);
            a.push(...postersFromItems);
        }
        return uniq(a.map(pickUrl).map(normalizeUrl));
    }, [movie]);

    const posterSrc = posterList[0] || '/images/placeholder-poster.jpg';

    // 스틸컷: stillcutUrls 우선 + items(STILL/BACKDROP/IMAGE)
    const stills = useMemo(() => {
        const buckets = [];
        buckets.push(toArray(movie?.stillcutUrls)); // ← backend exact field
        if (Array.isArray(movie?.media?.items)) {
            const items = movie.media.items
                .filter((x) => {
                    const t = String(x?.type || x?.category || x?.kind).toUpperCase();
                    return t.includes('STILL') || t.includes('BACKDROP') || t.includes('IMAGE');
                })
                .map(pickUrl);
            buckets.push(items);
        }
        return uniq(buckets.flat().map(normalizeUrl));
    }, [movie]);

    // 갤러리 = 스틸컷 + 추가 포스터(대표 제외)
    const galleryImages = useMemo(() => uniq([ ...stills, ...posterList.slice(1) ]), [stills, posterList]);

    // 예고편: trailerUrl 우선
    const rawTrailers = useMemo(
        () => uniq([ normalizeUrl(movie?.trailerUrl) ].filter(Boolean)),
        [movie]
    );

    const trailers = useMemo(() => {
        const typeOf = (u) => {
            const cleaned = (u || '').toLowerCase().split(/[?#]/)[0];
            if (cleaned.includes('.m3u8')) return 'hls';
            if (cleaned.includes('.mp4'))  return 'mp4';
            if (cleaned.includes('.webm')) return 'webm';
            return 'file';
        };
        return rawTrailers.map((u) => ({ url: u, kind: typeOf(u) }));
    }, [rawTrailers]);

    // HLS(.m3u8)
    const videoRef = useRef(null);
    const primaryTrailer = trailers[0];
    useEffect(() => {
        if (!videoRef.current) return;
        if (!primaryTrailer || primaryTrailer.kind !== 'hls') return;
        const video = videoRef.current;
        if (video.canPlayType('application/vnd.apple.mpegURL')) return;
        let hls, script;
        (async () => {
            await new Promise((resolve, reject) => {
                script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
            if (window.Hls && window.Hls.isSupported()) {
                hls = new window.Hls();
                hls.loadSource(primaryTrailer.url);
                hls.attachMedia(video);
            }
        })();
        return () => { if (hls) hls.destroy(); if (script) script.remove(); };
    }, [primaryTrailer]);

    if (loading) return <div className="p-6">불러오는 중…</div>;
    if (err) return <div className="p-6 text-red-600">{String(err)}</div>;
    if (!movieId) return <div className="p-6 text-red-600">URL 파라미터(movieId)가 없어 상세 페이지를 표시할 수 없습니다.</div>;
    if (!movie) return <div className="p-6 text-gray-700">영화 데이터를 찾을 수 없습니다. (id: {movieId})</div>;

    return (
        <div className="mx-auto max-w-6xl p-4">
            <div className="grid gap-6 md:grid-cols-3">
                {/* 좌: 대표 포스터*/}
                <div className="md:col-span-1 md:sticky md:top-6 self-start">
                    <img
                        src={posterSrc}
                        alt={`${title} 포스터`}
                        className="w-full rounded-xl object-cover md:h-[520px]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            const img = e.currentTarget;
                            const tried = Number(img.dataset.retried || 0);
                            const urlNow = img.getAttribute('src') || '';

                            // 1) decodeURI 재시도 (이중 인코딩 케이스)
                            if (tried === 0) {
                                img.dataset.retried = '1';
                                try {
                                    const decoded = decodeURI(urlNow);
                                    if (decoded && decoded !== urlNow) {
                                        img.src = decoded;
                                        return;
                                    }
                                } catch {}
                            }
                            // 2) encodeURI 재시도 (공백/한글 미인코딩 케이스)
                            if (tried === 1) {
                                img.dataset.retried = '2';
                                try {
                                    const encoded = encodeURI(urlNow);
                                    if (encoded && encoded !== urlNow) {
                                        img.src = encoded;
                                        return;
                                    }
                                } catch {}
                            }
                            // 3) 확장자 케이스 스왑 (.jpg <-> .JPG)
                            if (tried === 2) {
                                img.dataset.retried = '3';
                                const swapped =
                                    urlNow.endsWith('.jpg') ? urlNow.slice(0, -4) + '.JPG'
                                        : urlNow.endsWith('.JPG') ? urlNow.slice(0, -4) + '.jpg'
                                            : null;
                                if (swapped) {
                                    img.src = swapped;
                                    return;
                                }
                            }

                            // 마지막 폴백
                            img.src = '/images/placeholder-poster.jpg';
                        }}
                    />
                </div>

                {/* 우: 텍스트/메타/예고편/갤러리 */}
                <div className="md:col-span-2">
                    <h1 className="text-2xl font-bold mb-1">{title}</h1>
                    {subtitle && <p className="text-base text-gray-600 mb-2">{subtitle}</p>}

                    <p className="text-sm text-gray-500 mb-4">
                        개봉일: {releaseDate}
                        {genreText && <> · 장르: {genreText}</>}
                        {rating && <> · 등급: {rating}</>}
                        {runningMinutes && <> · 상영시간: {runningMinutes}분</>}
                    </p>

                    {overview && <p className="leading-7 text-gray-800 mb-6">{overview}</p>}

                    {/* 감독/출연 */}
                    {(toArray(movie?.director).length > 0 || toArray(movie?.actors).length > 0) && (
                        <div className="mb-6 space-y-1 text-sm">
                            {toArray(movie?.director).length > 0 && (
                                <div><span className="font-semibold">감독:</span> {toArray(movie.director).map(asName).join(', ')}</div>
                            )}
                            {toArray(movie?.actors).length > 0 && (
                                <div><span className="font-semibold">출연:</span> {toArray(movie.actors).map(asName).join(', ')}</div>
                            )}
                        </div>
                    )}

                    {/* 예고편: 중앙 정렬 + 너비 통일 */}
                    {primaryTrailer ? (

                        <div className="mt-4 mx-auto max-w-3xl">
                            <SectionTitle>예고편</SectionTitle>
                            <div className="relative pt-[56.25%]">
                                <video
                                    ref={videoRef}
                                    className="absolute inset-0 h-full w-full rounded-xl"
                                    controls
                                    preload="metadata"
                                    poster={posterSrc}
                                >
                                    {primaryTrailer.kind === 'mp4'  && <source src={primaryTrailer.url} type="video/mp4" />}
                                    {primaryTrailer.kind === 'webm' && <source src={primaryTrailer.url} type="video/webm" />}
                                    {primaryTrailer.kind === 'hls'  && <source src={primaryTrailer.url} type="application/x-mpegURL" />}
                                    {(!primaryTrailer.kind || primaryTrailer.kind === 'file') && <source src={primaryTrailer.url} />}
                                    <track kind="captions" />
                                    브라우저가 비디오 태그를 지원하지 않습니다.{' '}
                                    <a href={primaryTrailer.url} target="_blank" rel="noreferrer">영상 열기</a>
                                </video>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 text-sm text-gray-500 mx-auto max-w-3xl text-center">예고편이 없습니다.</div>
                    )}

                    {/* 스틸컷 & 추가 포스터: 중앙 정렬 + 너비 통일 */}
                    {galleryImages.length > 0 && (
                        <div className="mt-8 mx-auto max-w-3xl">
                            <SectionTitle>포스터 & 스틸컷</SectionTitle>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {galleryImages.map((src, idx) => (
                                    <img
                                        key={idx}
                                        src={src}
                                        alt={`${title} 갤러리 ${idx + 1}`}
                                        className="h-full w-full rounded-lg object-cover"
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                            const img = e.currentTarget;
                                            const tried = Number(img.dataset.retried || 0);
                                            const urlNow = img.getAttribute('src') || '';

                                            if (tried === 0) {
                                                img.dataset.retried = '1';
                                                try {
                                                    const decoded = decodeURI(urlNow);
                                                    if (decoded && decoded !== urlNow) { img.src = decoded; return; }
                                                } catch {}
                                            }
                                            if (tried === 1) {
                                                img.dataset.retried = '2';
                                                try {
                                                    const encoded = encodeURI(urlNow);
                                                    if (encoded && encoded !== urlNow) { img.src = encoded; return; }
                                                } catch {}
                                            }
                                            if (tried === 2) {
                                                img.dataset.retried = '3';
                                                const swapped =
                                                    urlNow.endsWith('.jpg') ? urlNow.slice(0, -4) + '.JPG'
                                                        : urlNow.endsWith('.JPG') ? urlNow.slice(0, -4) + '.jpg'
                                                            : null;
                                                if (swapped) { img.src = swapped; return; }
                                            }

                                            img.style.display = 'none';
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 디버그 */}
                    <div className="mt-4 text-xs text-gray-400 text-center">
                        DEBUG: movieId = {movieId} | posters={posterList.length} | stills={stills.length} | gallery={galleryImages.length} | trailer={primaryTrailer ? primaryTrailer.kind : 'none'}
                    </div>
                </div>
            </div>
        </div>
    );
}