import React,{ useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Star, Film } from "lucide-react";
import { getProfile, getStories, createStory, getEligibleBookings } from "../../api/stroyApi.js";
import Modal from "../../components/Modal.jsx";
import { getMovieDetail } from "../../api/movieApi.js";

/*
 StoryFeed - 카드형 실관람평 피드 (인스타그램 느낌)
 - 포스터: 세로 비율 유지 (2:3)
 - 버튼: 모던/중립 톤 (강조 색 사용 X)
 - 우측 여백(라이트 레일): 해시태그/빠른 필터/주간 픽/내 티켓 바로가기/가이드
 */
export default function StoryFeed() {
    const [stories, setStories] = useState([]);
    const [profile, setProfile] = useState(null);
    const [writeOpen, setWriteOpen] = useState(false);
    const [eligible, setEligible] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [storyForm, setStoryForm] = useState({ rating: 4.5, content: "", tags: "" });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getProfile().then(setProfile);
        getStories().then(data => setStories(data));
    }, []);

    useEffect(() => {
      if (!profile?.memberId) return;
      (async () => {
        try {
          const page = await getEligibleBookings(profile.memberId);
          const rows = Array.isArray(page?.content) ? page.content : (Array.isArray(page) ? page : []);
          // filter paid & no existing story
          const paid = rows.filter(r => r?.paymentStatus === 'PAID' && !r?.hasStory);
          // hydrate posterUrl if missing
          const withPosters = await Promise.all(paid.map(async (r) => {
            if (r.posterUrl) return r;
            try {
              const detail = await getMovieDetail(r.movieId);
              return { ...r, posterUrl: detail?.posterUrl || detail?.poster || detail?.images?.poster };
            } catch {
              return r;
            }
          }));
          setEligible(withPosters);
        } catch (e) {
          console.error('[eligible:load:error]', e);
          setEligible([]);
        }
      })();
    }, [profile?.memberId]);

    return (
        <div className="min-h-screen bg-neutral-50">

            <main className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <section className="lg:col-span-2 space-y-6">
                    {Array.isArray(stories) && stories.map((s) => (
                        <StoryCard key={s.id} story={s} />
                    ))}
                </section>

                <aside className="hidden lg:block">
                    <RightRail profile={profile} onOpenWrite={() => setWriteOpen(true)} />
                </aside>
            </main>

            <Modal isOpen={writeOpen} onClose={() => setWriteOpen(false)} title="관람평 작성">
  <div className="space-y-4">
    {/* Step 1: 결제 완료된 예매 선택 (포스터 그리드) */}
    <div>
      <div className="mb-2 text-sm font-semibold">내 최근 예매 (결제완료만)</div>
      {eligible.length === 0 ? (
        <div className="text-sm text-neutral-500">작성 가능한 예매가 없어요.</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {eligible.map(b => (
            <button
              key={b.bookingId}
              type="button"
              onClick={() => setSelectedBooking(b)}
              className={`group relative overflow-hidden rounded-lg border ${selectedBooking?.bookingId === b.bookingId ? 'ring-2 ring-black' : ''}`}
            >
              <div className="aspect-[2/3] w-full overflow-hidden">
                <img src={b.posterUrl || '/images/poster-placeholder.png'} alt={b.movieTitle}
                     className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <div className="p-2 text-left">
                <div className="truncate text-[13px] font-medium">{b.movieTitle}</div>
                <div className="text-[11px] text-neutral-500">{new Date(b.screeningStartAt).toLocaleString('ko-KR')}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Step 2: 평점/내용/태그 */}
    <div className="grid grid-cols-1 gap-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-700">평점</span>
        <input
          type="range"
          min="0" max="5" step="0.5"
          value={storyForm.rating}
          onChange={(e) => setStoryForm(f => ({ ...f, rating: parseFloat(e.target.value) }))}
          className="w-40"
        />
        <span className="text-sm w-8 text-right">{Number.isFinite(storyForm.rating) ? storyForm.rating.toFixed(1) : '0.0'}</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-700">내용</span>
        <textarea
          rows={5}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="영화 어땠어요? 스포는 자제!"
          value={storyForm.content}
          onChange={(e) => setStoryForm(f => ({ ...f, content: e.target.value }))}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-700">태그 (쉼표로 구분)</span>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="레이싱, IMAX추천"
          value={storyForm.tags}
          onChange={(e) => setStoryForm(f => ({ ...f, tags: e.target.value }))}
        />
      </label>
    </div>

    <div className="flex items-center justify-end gap-2 pt-2">
      <button onClick={() => setWriteOpen(false)} className="rounded-xl border px-4 py-2 text-sm">취소</button>
      <button
        disabled={!selectedBooking || submitting || !storyForm.content.trim()}
        onClick={async () => {
          if (!selectedBooking) return;
          setSubmitting(true);
          try {
            const payload = {
              bookingId: selectedBooking.bookingId,
              rating: storyForm.rating,
              content: storyForm.content.trim(),
              tags: storyForm.tags.split(',').map(t => t.trim()).filter(Boolean),
            };
            const saved = await createStory(payload);
            // normalize for feed card expectations
            const normalized = {
              ...saved,
              name: saved?.member?.name,
              avatarUrl: saved?.member?.avatarUrl,
              movie: { ...saved?.movie, poster: saved?.movie?.poster || saved?.movie?.posterUrl },
            };
            // prepend to feed
            setStories(prev => Array.isArray(prev) ? [normalized, ...prev] : [normalized]);
            // reset & close
            setSelectedBooking(null);
            setStoryForm({ rating: 4.5, content: "", tags: "" });
            setWriteOpen(false);
          } catch (e) {
            console.error('[story:create:error]', e);
            alert('관람평 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
          } finally {
            setSubmitting(false);
          }
        }}
        className="rounded-xl bg-black px-4 py-2 text-white text-sm disabled:opacity-50"
      >
        {submitting ? '저장 중…' : '저장'}
      </button>
    </div>
  </div>
</Modal>
        </div>
    );
}

function StoryCard({ story }) {
    const [liked, setLiked] = useState(false);

    const avatar = story?.avatarUrl || "/images/avatar-placeholder.png";
    const name = story?.name || "익명";
    const lastWatched = story?.lastWatchedAt || "";
    const ratingText = Number.isFinite(story?.rating) ? story.rating.toFixed(1) : "—";
    const poster = story?.movie?.poster || "/images/poster-placeholder.png";
    const movieTitle = story?.movie?.title || "";
    const age = story?.movie?.age || "";
    const content = story?.content || "";
    const tags = Array.isArray(story?.tags) ? story.tags : [];
    const likes = Number.isFinite(story?.likes) ? story.likes : 0;
    const comments = Number.isFinite(story?.comments) ? story.comments : 0;

    return (

        <article className="rounded-2xl border bg-white shadow-sm hover:shadow transition-shadow">
            {/* 상단: 사용자 정보 */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                    <img src={avatar} alt="avatar" className="h-9 w-9 rounded-full object-cover" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{name}</span>
                            <span className="text-[11px] text-neutral-500">{lastWatched}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Star className="w-3.5 h-3.5 fill-current" /> <span>{ratingText}</span>
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
                            <img src={poster} alt={movieTitle}
                                 className="h-full w-full object-cover" />
                        </div>
                        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                            {age}
                        </div>
                    </div>

                    {/* 텍스트 본문 */}
                    <div className="flex flex-col">
                        <h3 className="text-[15px] font-semibold leading-tight mb-1">{movieTitle}</h3>
                        <p className="text-sm text-neutral-800 whitespace-pre-line">
                            {content}
                        </p>

                        {/* 해시태그 */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.map((t) => (
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
                        <span>{liked ? likes + 1 : likes}</span>
                    </button>
                    <button className="flex items-center gap-1 text-sm text-neutral-600">
                        <MessageCircle className="w-5 h-5" />
                        <span>{comments}</span>
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

function RightRail({ profile, onOpenWrite }) {
    const navigate = useNavigate();
    return (
        <div className="sticky top-16 space-y-4">
            {/* 내 활동 요약 */}
            <Card>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={profile?.avatarUrl} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                        <div>
                            <div className="text-sm font-semibold">{profile?.name}</div>
                            <div className="text-[11px] text-neutral-500">최근 관람: {profile?.lastWatchedAt}</div>
                        </div>
                    </div>
                    <button onClick={() => navigate('/mypage')} className="rounded-xl border px-3 py-1.5 text-sm">프로필</button>
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
                    <button onClick={onOpenWrite} className="mt-3 w-full rounded-xl bg-white/90 px-3 py-2 text-sm text-neutral-900 hover:bg-white">관람평 쓰기</button>
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
