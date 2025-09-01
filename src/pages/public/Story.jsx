import React,{ useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Star, Film } from "lucide-react";
import {getStories} from "../../api/stroyApi.js";

/*
 StoryFeed - 카드형 실관람평 피드 (인스타그램 느낌)
 - 포스터: 세로 비율 유지 (2:3)
 - 버튼: 모던/중립 톤 (강조 색 사용 X)
 - 우측 여백(라이트 레일): 해시태그/빠른 필터/주간 픽/내 티켓 바로가기/가이드
 */
export default function StoryFeed() {
    const [stories, setStories] = useState([]);

    useEffect(() => {
        getStories().then(data => setStories(data));
    }, []);

    return (
        <div className="min-h-screen bg-neutral-50">

            <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <section className="lg:col-span-2 space-y-6">
                    {stories.map((s) => (
                        <StoryCard key={s.id} story={s} />
                    ))}
                </section>

                <aside className="hidden lg:block">
                    <RightRail />
                </aside>
            </main>
        </div>
    );
}

function StoryCard({ story }) {
    const [liked, setLiked] = useState(false);

    return (

        <article className="rounded-2xl border bg-white shadow-sm hover:shadow transition-shadow">
            {/* 상단: 사용자 정보 */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                    <img src={story.author.avatar} alt="avatar" className="h-9 w-9 rounded-full object-cover" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{story.author.name}</span>
                            <span className="text-[11px] text-neutral-500">{story.meta.theater} · {story.meta.when}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Star className="w-3.5 h-3.5 fill-current" /> <span>{story.rating.toFixed(1)}</span>
                            <span className="mx-1">·</span>
                            <span>관람 인증</span>
                        </div>
                    </div>
                </div>
                <button className="p-1 rounded-lg hover:bg-neutral-100"><MoreHorizontal className="w-5 h-5"/></button>
            </div>

            {/* 포스터 + 본문 */}
            <div className="px-4">
                <div className="grid grid-cols-[minmax(120px,180px)_1fr] gap-4">
                    {/* 포스터: 2:3 비율 고정 */}
                    <div className="relative">
                        <div className="aspect-[2/3] overflow-hidden rounded-xl border">
                            <img src={story.movie.poster} alt={story.movie.title}
                                 className="h-full w-full object-cover" />
                        </div>
                        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                            {story.movie.age}
                        </div>
                    </div>

                    {/* 텍스트 본문 */}
                    <div className="flex flex-col">
                        <h3 className="text-[15px] font-semibold leading-tight mb-1">{story.movie.title}</h3>
                        <p className="text-sm text-neutral-800 whitespace-pre-line">
                            {story.content}
                        </p>

                        {/* 해시태그 */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {(story.tags ?? []).map((t) => (
                                <span key={t} className="rounded-full border px-2 py-0.5 text-[11px] text-neutral-600">#{t}</span>
                            ))}
                        </div>

                        {/* 액션 버튼 */}
                        <div className="mt-4 flex items-center gap-2">
                            {/* 모던/중립 버튼 (강조색 X) */}
                            <button className="h-9 rounded-xl border px-3 text-sm hover:bg-neutral-50">예매하기</button>
                            <button className="h-9 rounded-xl border px-3 text-sm hover:bg-neutral-50">상세보기</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 하단: 인터랙션 */}
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => setLiked(!liked)} className={`group flex items-center gap-1 text-sm ${liked ? "text-neutral-900" : "text-neutral-600"}`}>
                        <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
                        <span>{liked ? story.likes + 1 : story.likes}</span>
                    </button>
                    <button className="flex items-center gap-1 text-sm text-neutral-600">
                        <MessageCircle className="w-5 h-5" />
                        <span>{story.comments}</span>
                    </button>
                    <button className="flex items-center gap-1 text-sm text-neutral-600">
                        <Share2 className="w-5 h-5" />
                        <span>공유</span>
                    </button>
                </div>
                <button className="text-neutral-500 hover:text-neutral-800"><Bookmark className="w-5 h-5" /></button>
            </div>
        </article>
    );
}

function RightRail() {
    return (
        <div className="sticky top-16 space-y-4">
            {/* 내 활동 요약 */}
            <Card>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39?q=80&w=300&auto=format&fit=crop" className="h-10 w-10 rounded-full object-cover" />
                        <div>
                            <div className="text-sm font-semibold">Rachel</div>
                            <div className="text-[11px] text-neutral-500">최근 관람: 8월 27일</div>
                        </div>
                    </div>
                    <button className="rounded-xl border px-3 py-1.5 text-sm">프로필</button>
                </div>
                <div className="mt-3 grid grid-cols-3 text-center">
                    <Stat label="좋아요" value="128" />
                    <Stat label="관람평" value="12" />
                    <Stat label="북마크" value="9" />
                </div>
            </Card>
            {/* 브랜드/CTA: Ticket × Story 중심 페이지 강조 */}
            <Card>
                <div className="rounded-2xl bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-rose-500 p-4 text-white">
                    <div className="text-sm opacity-90">Ticketory — Ticket × Story</div>
                    <div className="mt-1 text-lg font-semibold leading-tight">당신의 관람이 이야기가 되는 곳</div>
                    <button className="mt-3 w-full rounded-xl bg-white/90 px-3 py-2 text-sm text-neutral-900 hover:bg-white">관람평 쓰기</button>
                </div>
            </Card>

            {/* 최근 남긴 관람평 */}
            <Card title="최근 남긴 관람평">
                <ul className="space-y-3">
                    {[{t:'F1 더 무비',c:'레이스 몰입감 최고! IMAX 추천'}, {t:'해피엔드',c:'배우들 연기 합이 완벽'}].map((r, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-neutral-400"></div>
                            <div>
                                <div className="text-sm font-medium">{r.t}</div>
                                <div className="text-[12px] text-neutral-600 overflow-hidden text-ellipsis whitespace-nowrap">{r.c}</div>
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="mt-3 text-right">
                    <a className="text-[12px] text-neutral-600 hover:text-neutral-900" href="#">더 보기</a>
                </div>
            </Card>

            {/* 북마크한 영화 */}
            <Card title="북마크한 영화">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pr-1">
                    {[
                        'https://image.tmdb.org/t/p/w300/6dr8Lz4LZrQJ7sG0mq06R4G3Ecr.jpg',
                        'https://image.tmdb.org/t/p/w300/3xqJmXz3wQF8yZL1JqvQnZrX1qS.jpg',
                        'https://image.tmdb.org/t/p/w300/9dpjssW6XMYp3B5qScbwoCOAayG.jpg',
                    ].map((src, i) => (
                        <div key={i} className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md border">
                            <img src={src} className="h-full w-full object-cover" />
                        </div>
                    ))}
                </div>
            </Card>

            {/* 커뮤니티: 팔로우 추천 & 베스트 관람평 */}
            <Card title="커뮤니티 추천 계정">
                <div className="space-y-3">
                    {[{n:'movie_owl',a:'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=200&auto=format&fit=crop'}, {n:'cine_note',a:'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=200&auto=format&fit=crop'}].map((u) => (
                        <div key={u.n} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={u.a} className="h-7 w-7 rounded-full object-cover" />
                                <div className="text-sm">{u.n}</div>
                            </div>
                            <button className="rounded-lg border px-2 py-1 text-[12px]">팔로우</button>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="베스트 관람평 (주간)">
                <div className="space-y-2 text-[12px] text-neutral-700">
                    <p>“연출·음악·연기의 삼박자! 올해 최고의 스릴러.” — <span className="font-medium">@cine_note</span></p>
                    <p>“다큐 톤이지만 엔진음과 편집이 미쳤다.” — <span className="font-medium">@racer_j</span></p>
                </div>
            </Card>

        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div>
            <div className="text-sm font-semibold">{value}</div>
            <div className="text-[11px] text-neutral-500">{label}</div>
        </div>
    );
}

function Card({ title, children }) {
    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
            {title && <h4 className="mb-3 text-sm font-semibold">{title}</h4>}
            {children}
        </div>
    );
}
