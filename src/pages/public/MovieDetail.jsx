import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams} from 'react-router-dom';
import { useMovieDetail } from '../../hooks/useMovies.js';

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
    } catch (_) {/* 공백 */}

    return s;
};

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const toArray = (v) =>
    Array.isArray(v)
        ? v.filter(Boolean)
        : typeof v === 'string'
            ? (() => {
                const s = v.trim();
                if (!s) return [];
                // If the string contains commas, pipes or newlines/tabs, split on those.
                // Otherwise, treat it as a single item and keep spaces inside names intact.
                return /[\,\|\n\r\t]/.test(s)
                    ? s.split(/[\,\|\n\r\t]+/).map((x) => x.trim()).filter(Boolean)
                    : [s];
              })()
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
// image helpers: detect images & collect from movie_media / variants
const isProbablyImage = (u) => {
    if (!u) return false;
    try {
        const base = String(u).split(/[?#]/)[0].toLowerCase();
        return /\.(jpg|jpeg|png|webp|gif|bmp|jfif|pjpeg|pjp)$/i.test(base);
    } catch { return false; }
};
const getYouTubeId = (u) => {
    try {
        const s = String(u);
        const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
        return m ? m[1] : null;
    } catch { return null; }
};

const toYouTubeEmbed = (u) => {
    const s = String(u || '');
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    const id = m ? m[1] : null;
    if (!id) return null;
    let origin = '';
    try { origin = encodeURIComponent(window.location.origin); } catch {}
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1${origin ? `&origin=${origin}` : ''}`;
};

// --- Loader for YouTube Iframe API ---
let __ytApiPromise;
const loadYouTubeIframeAPI = () => {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (__ytApiPromise) return __ytApiPromise;
    __ytApiPromise = new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        tag.onload = () => {
            // YT fires global callback when ready
        };
        tag.onerror = reject;
        document.head.appendChild(tag);
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
            prev && prev();
            resolve(window.YT);
        };
    });
    return __ytApiPromise;
};
const collectMediaImageUrls = (m) => {
    const out = [];
    if (!m) return out;


    const candidates = [];
    if (Array.isArray(m.movie_media)) candidates.push(...m.movie_media);
    if (Array.isArray(m.movieMedia)) candidates.push(...m.movieMedia);
    if (Array.isArray(m.media)) candidates.push(...m.media);
    if (Array.isArray(m?.media?.items)) candidates.push(...m.media.items);
    if (Array.isArray(m?.images?.posters)) candidates.push(...m.images.posters);
    if (Array.isArray(m?.images?.stills)) candidates.push(...m.images.stills);

    const pushFrom = (x) => {
        if (!x) return;
        const primary =
            pickUrl(x) ||
            x?.posterUrl || x?.stillcutUrl || x?.stillUrl ||
            x?.image_url || x?.imageUrl ||
            x?.url_path || x?.file_path || x?.path || x?.link ||
            x?.original || x?.full || x?.large || x?.medium || x?.small || x?.thumbnail || x?.thumb ||
            null;

        if (primary) out.push(primary);

        // additionally scan some known alt fields if object groups them
        ['original','full','large','medium','small','thumbnail','thumb','src','href'].forEach((k) => {
            if (x && x[k]) out.push(x[k]);
        });
    };
    candidates.forEach(pushFrom);

    // also allow raw string arrays (e.g., movie_media is ['a.jpg', 'b.png'])
    if (Array.isArray(m.movie_media) && typeof m.movie_media[0] === 'string') {
        out.push(...m.movie_media);
    }
    // normalize, uniq, and keep only image-like urls
    return Array.from(new Set(out.filter(Boolean).map(normalizeUrl))).filter(isProbablyImage);
};

const asName = (x) =>
    typeof x === 'string'
        ? x
        : x?.name || x?.personName || x?.fullName || x?.korName || x?.enName || x?.actor || x?.director || '';

// ===== Component =====
export default function MovieDetail() {
    const navigate = useNavigate();
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

    // 포스터 목록: 메인은 posterUrl, 추가 목록은 posterUrls/posters/이미지/아이템, snake_case 및 movie_media 포함
    const posterList = useMemo(() => {
        const a = [];
        // camelCase 우선
        a.push(movie?.posterUrl);
        a.push(...toArray(movie?.posterUrls));
        a.push(...toArray(movie?.posters));

        // snake_case 및 기타 변형 키들도 수집
        a.push(movie?.poster_url);
        a.push(...toArray(movie?.poster_urls));
        a.push(...toArray(movie?.poster_list));
        a.push(...toArray(movie?.posters_url));

        // nested images/posters
        if (Array.isArray(movie?.images?.posters)) a.push(...movie.images.posters.map(pickUrl));

        // media.items 내 POSTER 타입
        if (Array.isArray(movie?.media?.items)) {
            const postersFromItems = movie.media.items
                .filter((x) => String(x?.type || x?.category || x?.kind).toUpperCase().includes('POSTER'))
                .map(pickUrl);
            a.push(...postersFromItems);
        }

        // movie_media 테이블 기반(POSTER만)
        if (Array.isArray(movie?.movie_media)) {
            const postersFromMedia = movie.movie_media
                .filter((x) => String(x?.media_type || x?.type || x?.category || x?.kind).toUpperCase().includes('POSTER'))
                .map(pickUrl);
            a.push(...postersFromMedia);
        }

        return uniq(a.map(pickUrl).map(normalizeUrl));
    }, [movie]);

    const posterSrc = posterList[0] || '/images/placeholder-poster.jpg';

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

    // movie_media 에서 모든 이미지 수집 (포맷 제한: jpg/png/webp/gif 등)
    const mediaImages = useMemo(() => collectMediaImageUrls(movie), [movie]);
    // 대표 포스터 여부와 무관하게 모든 포스터를 포함
    const galleryImages = useMemo(
        () => uniq([ ...posterList, ...stills, ...mediaImages ]),
        [posterList, stills, mediaImages]
    );


    // 예고편: trailerUrl 우선
    const rawTrailers = useMemo(() => {
        const t = movie?.trailerUrl;
        if (!t) return [];
        let s = String(t).trim();
        if (/youtu(?:\.be|be\.com)/i.test(s)) {
            // leave YouTube URLs as-is (just ensure https)
            if (!/^https?:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
            return [s];
        }
        return [normalizeUrl(s)].filter(Boolean);
    }, [movie]);

    const trailers = useMemo(() => {
        const detect = (u) => {
            const raw = String(u || '');
            if (/youtu(?:\.be|be\.com)/i.test(raw)) return 'youtube';
            const cleaned = raw.toLowerCase().split(/[?#]/)[0];
            if (cleaned.endsWith('.m3u8')) return 'hls';
            if (cleaned.endsWith('.mp4'))  return 'mp4';
            if (cleaned.endsWith('.webm')) return 'webm';
            return 'file';
        };
        return rawTrailers.map((u) => {
            const id = getYouTubeId(u);
            return {
                url: u,
                kind: detect(u),
                ytId: id,
                embedUrl: toYouTubeEmbed(u),
                watchUrl: id ? `https://www.youtube.com/watch?v=${id}` : u,
            };
        });
    }, [rawTrailers]);

    // HLS(.m3u8)
    const videoRef = useRef(null);
    const primaryTrailer = trailers[0];
    const [ytError, setYtError] = useState(null);
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

    useEffect(() => {
        setYtError(null);
        if (!primaryTrailer || primaryTrailer.kind !== 'youtube' || !primaryTrailer.embedUrl) return;
        let player;
        (async () => {
            try {
                const YT = await loadYouTubeIframeAPI();
                player = new YT.Player('yt-player', {
                    events: {
                        onReady: () => {/* no-op */},
                        onError: (e) => {
                            // e.data: 2 (bad params), 5 (html5 error), 100 (removed/private), 101/150 (embedding disabled)
                            setYtError(e?.data || 'unknown');
                        },
                    },
                });
            } catch (err) {
                setYtError('api-load-failed');
            }
        })();
        return () => { try { player && player.destroy && player.destroy(); } catch {} };
    }, [primaryTrailer]);

    if (loading) return <div className="p-6">불러오는 중…</div>;
    if (err) return <div className="p-6 text-red-600">{String(err)}</div>;
    if (!movieId) return <div className="p-6 text-red-600">URL 파라미터(movieId)가 없어 상세 페이지를 표시할 수 없습니다.</div>;
    if (!movie) return <div className="p-6 text-gray-700">영화 데이터를 찾을 수 없습니다. (id: {movieId})</div>;

    return (
        <div className="mx-auto max-w-[1200px] p-4">
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
                                } catch { /*  */}
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
                                } catch { /*  */}
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
                            img.src = `/proxy/img?url=${encodeURIComponent(urlNow)}`;
                        }}
                    />

                </div>

                {/* 우: 텍스트/메타/예고편/갤러리 */}
                <div className="md:col-span-2">
                    <h1 className="text-3xl font-bold mb-1">{title}</h1>
                    {subtitle && <p className="text-xl font-semibold text-gray-600 mb-2">{subtitle}</p>}

                    <p className="text-base text-gray-800 font-semibold mt-4 mb-4">
                        {releaseDate} 개봉
                        {genreText && <> | {genreText}</>}
                        <span className="text-base text-yellow-500 font-semibold mt-4 mb-4">
                            {rating && <>  |  {rating}</>}</span>
                        {runningMinutes && <>  |  {runningMinutes}분</>}
                    </p>

                    {overview && <p className="leading-7 text-gray-800 mb-6">{overview}</p>}

                    {/* 감독/출연 */}
                    {(toArray(movie?.director).length > 0 || toArray(movie?.actors).length > 0) && (
                        <div className="mb-6 space-y-1 text-base text-gray-600">
                            {toArray(movie?.director).length > 0 && (
                                <div><span className="font-semibold">감독:</span> {toArray(movie.director).map(asName).join(', ')}</div>
                            )}
                            {toArray(movie?.actors).length > 0 && (
                                <div><span className="font-semibold">출연:</span> {toArray(movie.actors).map(asName).join(', ')}</div>
                            )}
                        </div>
                    )}

                    <div className="p-3 pt-2">
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/booking?movieId=${movieId}`); }}
                            className="w-1/3 bg-sky-600  text-white py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                            aria-label={`${title} 예매하기`}
                        >
                            예매하기
                        </button>
                    </div>

                    {/* 예고편: 중앙 정렬 + 너비 통일 */}
                    {primaryTrailer ? (
                        <div className="mt-4 mx-auto max-w-3xl">
                            <SectionTitle>예고편</SectionTitle>
                            <div className="relative pt-[56.25%]">
                                {primaryTrailer.kind === 'youtube' && primaryTrailer.embedUrl ? (
                                    <>
                                        <iframe
                                            id="yt-player"
                                            className="absolute inset-0 h-full w-full rounded-xl"
                                            src={primaryTrailer.embedUrl}
                                            title="YouTube video player"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        />
                                        <div className="absolute -bottom-10 left-0 right-0 flex items-center justify-between">
                                            <div className="text-xs text-gray-500">
                                                {ytError === 101 || ytError === 150 ? '업로더가 임베드를 차단한 영상입니다.' : ytError ? `재생 오류 (코드: ${ytError})` : ''}
                                            </div>
                                            <a
                                                href={primaryTrailer.watchUrl || primaryTrailer.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-sky-600 hover:underline"
                                            >
                                                YouTube에서 열기
                                            </a>
                                        </div>
                                    </>
                                ) : (
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
                                        브라우저가 비디오 태그를 지원하지 않습니다{" "}
                                        <a href={primaryTrailer.url} target="_blank" rel="noreferrer">영상 열기</a>
                                    </video>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 text-sm text-gray-500 mx-auto max-w-3xl text-center">예고편이 없습니다.</div>
                    )}

                    {/* 스틸컷 & 포스터: 중앙 정렬 + 너비 통일 */}
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
                    {/*<div className="mt-4 text-xs text-gray-400 text-center">*/}
                    {/*    DEBUG: movieId = {movieId} | posters={posterList.length} | stills={stills.length} | gallery={galleryImages.length} | trailer={primaryTrailer ? primaryTrailer.kind : 'none'}*/}
                    {/*</div>*/}
                </div>
            </div>
        </div>
    );
}