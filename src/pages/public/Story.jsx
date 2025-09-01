import React,{ useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Star, Film } from "lucide-react";
import { getProfile, getStories, createStory, getEligibleBookings, getMyStories, likeStory, unlikeStory, bookmarkStory, unbookmarkStory, getMyBookmarkedStories, getComments, addComment,updateComment,deleteComment } from "../../api/stroyApi.js";
import Modal from "../../components/Modal.jsx";
import { getMovieDetail } from "../../api/movieApi.js";

/*
 StoryFeed - 카드형 실관람평 피드 (인스타그램 느낌)
 - 포스터: 세로 비율 유지 (2:3)
 - 버튼: 모던/중립 톤 (강조 색 사용 X)
 - 우측 여백(라이트 레일): 해시태그/빠른 필터/주간 픽/내 티켓 바로가기/가이드
 */

// util: 날짜만 표시 (시간 제거)
function formatDateOnly(v) {
    if (!v) return '';
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('ko-KR'); // 예: 2025. 8. 27.
    }
    // ISO가 아니거나 파싱 실패 시 안전 분기: 'T' 또는 공백 앞까지
    const s = String(v);
    return s.includes('T') ? s.split('T')[0] : s.split(' ')[0];
}

// 별점 컴포넌트 (0.5 단위)
function StarRating({ value = 0, onChange }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {stars.map((i) => {
          const full = value >= i;
          const half = !full && value >= i - 0.5;
          const width = full ? '100%' : half ? '50%' : '0%';
          return (
            <div key={i} className="relative w-7 h-7">
              {/* 바닥: 비활성 별 */}
              <Star className="w-7 h-7 text-neutral-300" />
              {/* 위: 채워지는 별 (가변 폭) */}
              <div className="absolute inset-0 overflow-hidden" style={{ width }}>
                <Star className="w-7 h-7 text-amber-500 fill-current" />
              </div>
              {/* 클릭 영역: 좌/우 0.5 단위 */}
              <button type="button" aria-label={`${i - 0.5}점`} className="absolute left-0 top-0 h-full w-1/2"
                      onClick={() => onChange?.(i - 0.5)} />
              <button type="button" aria-label={`${i}점`} className="absolute right-0 top-0 h-full w-1/2"
                      onClick={() => onChange?.(i)} />
            </div>
          );
        })}
      </div>
      <span className="text-sm w-10 text-right">{Number.isFinite(value) ? value.toFixed(1) : '0.0'}</span>
    </div>
  );
}
export default function StoryFeed() {
    const [stories, setStories] = useState([]);
    const [profile, setProfile] = useState(null);
    const [writeOpen, setWriteOpen] = useState(false);
    const [eligible, setEligible] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [storyForm, setStoryForm] = useState({ rating: 4.5, content: "", tags: "" });
    const [submitting, setSubmitting] = useState(false);

    const [myRecentStories, setMyRecentStories] = useState([]);
    const [bookmarkedStories, setBookmarkedStories] = useState([]);

    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = !!profile?.memberId;

    useEffect(() => {
        getProfile().then(setProfile);
        getStories().then(data => setStories(data));
    }, []);

    useEffect(() => {
      if (!profile?.memberId) return;
      (async () => {
        try {
          // getEligibleBookings now returns an ARRAY (not a Page)
          const rows = await getEligibleBookings(profile.memberId, { page: 0, size: 10, sort: 'RECENT' });
          const paid = (Array.isArray(rows) ? rows : []).filter(r => r?.paymentStatus === 'PAID' && !r?.hasStory);
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
          // If backend currently 404s due to JPQL error, fail soft
          if (e?.response?.status === 404) {
            console.warn('[eligible:load] 404 from API, showing empty list until backend fix');
            setEligible([]);
            return;
          }
          console.error('[eligible:load:error]', e);
          setEligible([]);
        }
      })();
    }, [profile?.memberId]);

    useEffect(() => {
      const id = profile?.memberId;
      if (!id) return;
      (async () => {
        try {
          const res = await getMyStories(id, { limit: 5, sort: 'RECENT' });
          const rows = Array.isArray(res?.content) ? res.content : (Array.isArray(res) ? res : []);
          setMyRecentStories(rows);
        } catch (e) {
          console.error('[story:my-recent:error]', e);
          setMyRecentStories([]);
        }
      })();
    }, [profile?.memberId]);

    useEffect(() => {
      const id = profile?.memberId;
      if (!id) return;
      (async () => {
        try {
          const res = await getMyBookmarkedStories(id, { limit: 12, sort: 'RECENT' });
          const rows = Array.isArray(res?.content) ? res.content : (Array.isArray(res) ? res : []);
          setBookmarkedStories(rows);
        } catch (e) {
          console.error('[story:my-bookmarks:error]', e);
          setBookmarkedStories([]);
        }
      })();
    }, [profile?.memberId]);

    return (
        <div className="min-h-screen bg-neutral-50">

            <main className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <section className="lg:col-span-2 space-y-6">
                    {Array.isArray(stories) && stories.map((s, idx) => {
                        const key = s?.id ?? s?.storyId ?? s?.uuid ?? `${s?.memberId ?? 'm'}-${s?.movie?.id ?? s?.movieId ?? 'mv'}-${s?.createdAt ?? idx}`;
                        return (
                          <StoryCard
                            key={key}
                            story={s}
                            loggedIn={loggedIn}
                            onLoginRequired={() => {
                              const back = (location?.pathname || '/story') + (location?.search || '');
                              try { sessionStorage.setItem('postLoginRedirect', back); } catch {}
                              navigate(`/login?redirect=${encodeURIComponent(back)}`, { state: { from: back } });
                            }}
                          />
                        );
                    })}
                </section>

                <aside className="hidden lg:block">
                    <RightRail profile={profile} recentMyStories={myRecentStories} myBookmarks={bookmarkedStories} onOpenWrite={() => setWriteOpen(true)} />
                </aside>
            </main>

            <Modal isOpen={writeOpen} onClose={() => setWriteOpen(false)} title="관람평 작성"  contentClassName="w-[1000px] max-w-[95vw]">
  <div className="space-y-4 w-full">
    {/* Step 1: 결제 완료된 예매 선택 (포스터 그리드) */}
    <div>
      <div className="mb-2 text-sm font-semibold">내 최근 예매 (결제완료)</div>
      {eligible.length === 0 ? (
        <div className="text-sm text-neutral-500">작성 가능한 예매가 없어요</div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
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
                <div className="text-[11px] text-neutral-500">{formatDateOnly(b.screeningStartAt)}</div>
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
        <StarRating value={storyForm.rating} onChange={(v) => setStoryForm(f => ({ ...f, rating: v }))} />
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
              movieId: selectedBooking.movieId,
              rating: storyForm.rating,
              content: storyForm.content.trim(),
              tags: storyForm.tags ? storyForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
              hasProof: true,
            };
              const saved = await createStory(payload);

              // 보강: 응답에 member/movie 포스터가 비어있으면 각각 가져와서 채움
              let memberName = saved?.member?.name;
              let memberAvatar = saved?.member?.avatarUrl;
              if (!memberName || !memberAvatar) {
                  try {
                      const p = await getProfile();
                      memberName = memberName || p?.name;
                      memberAvatar = memberAvatar || p?.avatarUrl;
                  } catch {}
              }
              let moviePoster = saved?.movie?.poster || saved?.movie?.posterUrl;
              if (!moviePoster) {
                  try {
                      const detail = await getMovieDetail(saved?.movieId || payload.movieId);
                      moviePoster = detail?.posterUrl || detail?.poster || detail?.images?.poster;
                  } catch {}
              }

              const normalized = {
                  ...saved,
                  name: memberName,
                  avatarUrl: memberAvatar,
                  movie: { ...saved?.movie, poster: moviePoster },
              };


            setStories(prev => Array.isArray(prev) ? [normalized, ...prev] : [normalized]);
            setEligible(prev => prev.map(b => b.bookingId === selectedBooking.bookingId ? { ...b, hasStory: true } : b));
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
        className="rounded-xl bg-indigo-600 px-4 py-2 text-white text-sm disabled:opacity-50"
      >
        {submitting ? '저장 중…' : '저장'}
      </button>
    </div>
  </div>
</Modal>
        </div>
    );
}

function StoryCard({ story, loggedIn = false, onLoginRequired }) {
    const [liked, setLiked] = useState(!!story?.liked);
    const [likeCount, setLikeCount] = useState(Number.isFinite(story?.likes) ? story.likes : 0);
    const [bookmarked, setBookmarked] = useState(!!story?.bookmarked);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentList, setCommentList] = useState(Array.isArray(story?.commentsList) ? story.commentsList : []);
    const [commentDraft, setCommentDraft] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingDraft, setEditingDraft] = useState("");
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState("");

    useEffect(() => {
      if (!commentsOpen) return;
      (async () => {
        setCommentsLoading(true);
        setCommentsError("");
        try {
          // Try to fetch; supports Page or Array responses
          const res = await getComments(story.id ?? story.storyId, { page: 0, size: 50 });
          const rows = Array.isArray(res?.content) ? res.content : (Array.isArray(res) ? res : []);
          setCommentList(rows);
        } catch (e) {
          console.error('[comments:load:error]', e);
          setCommentsError('댓글을 불러오지 못했어요.');
          // keep any existing list; do not clear hard
        } finally {
          setCommentsLoading(false);
        }
      })();
    }, [commentsOpen, story.id, story.storyId]);

    const avatar = story?.avatarUrl || "/images/avatar-placeholder.png";
    const name = story?.name || "익명";
    const lastWatched = story?.lastWatchedAt || "";
    const ratingText = Number.isFinite(story?.rating) ? story.rating.toFixed(1) : "—";
    const poster = story?.movie?.poster || "/images/poster-placeholder.png";
    const movieTitle = story?.movie?.title || "";
    const age = story?.movie?.age || "";
    const content = story?.content || "";
    const tags = Array.isArray(story?.tags) ? story.tags : [];
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
                            <button className="h-9 rounded-xl border px-3 text-sm hover:bg-neutral-50">상세보기</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 하단: 인터랙션 */}
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                      onClick={async () => {
                        if (!loggedIn) { onLoginRequired?.(); return; }
                        const next = !liked;
                        // optimistic update
                        setLiked(next);
                        setLikeCount((c) => c + (next ? 1 : -1));
                        try {
                          if (next) await likeStory(story.id ?? story.storyId);
                          else await unlikeStory(story.id ?? story.storyId);
                        } catch (e) {
                          // rollback on error
                          setLiked(!next);
                          setLikeCount((c) => c + (next ? -1 : 1));
                          console.error('[story:like:error]', e);
                        }
                      }}
                      className={`group flex items-center gap-1 text-sm ${liked ? 'text-neutral-900' : 'text-neutral-600'}`}
                    >
                      <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                      <span>{likeCount}</span>
                    </button>
                    <button
                        onClick={() => setCommentsOpen(v => !v)}
                        className="flex items-center gap-1 text-sm text-neutral-600"
                    >
                        <MessageCircle className="w-5 h-5" />
                        <span>{commentsOpen ? commentList.length : comments}</span>
                    </button>
                </div>
                <button
                  onClick={async () => {
                    if (!loggedIn) { onLoginRequired?.(); return; }
                    const next = !bookmarked;
                    setBookmarked(next);
                    try {
                      const id = story.id ?? story.storyId;
                      if (next) await bookmarkStory(id);
                      else await unbookmarkStory(id);
                    } catch (e) {
                      setBookmarked(!next);
                      console.error('[story:bookmark:error]', e);
                    }
                  }}
                  className={`transition-colors ${bookmarked ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}
                  aria-pressed={bookmarked}
                  aria-label={bookmarked ? '북마크 취소' : '북마크'}
                >
                  <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
                </button>
            </div>

            {commentsOpen && (
                <div className="border-t bg-neutral-50/60 px-4 py-3">
                    {commentsLoading && (
                        <div className="mb-2 text-[12px] text-neutral-500">불러오는 중…</div>
                    )}
                    {commentsError && (
                        <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-[12px] text-red-700">{commentsError}</div>
                    )}

                    {/* 입력 영역 */}
                    <div className="mb-3 flex items-start gap-2">
      <textarea
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          rows={2}
          className="min-h-[36px] grow rounded-md border px-2 py-1 text-sm"
          placeholder="댓글을 입력하세요"
      />
                        <button
                            className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
                            onClick={async () => {
                                if (!loggedIn) { onLoginRequired?.(); return; }
                                const text = commentDraft.trim();
                                if (!text) return;
                                try {
                                    const saved = await addComment(story.id ?? story.storyId, { content: text });
                                    const newItem = saved || { id: Date.now(), content: text, mine: true, createdAt: new Date().toISOString() };
                                    setCommentList((prev) => [newItem, ...prev]);
                                    setCommentDraft("");
                                } catch (e) {
                                    console.error('[comment:add:error]', e);
                                    alert('댓글 저장에 실패했어요.');
                                }
                            }}
                        >등록</button>
                    </div>

                    {/* 리스트 */}
                    <ul className="space-y-2">
                        {commentList.map((c) => (
                            <li key={c.id ?? c.commentId ?? `${c.createdAt}-${(c.content || '').slice(0,8)}`} className="rounded-md border bg-white px-3 py-2">
                                {editingId === (c.id ?? c.commentId) ? (
                                    <div className="flex items-start gap-2">
              <textarea
                  className="min-h-[36px] grow rounded-md border px-2 py-1 text-sm"
                  rows={2}
                  value={editingDraft}
                  onChange={(e) => setEditingDraft(e.target.value)}
              />
                                        <div className="flex shrink-0 gap-1">
                                            <button
                                                className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs text-white hover:bg-indigo-700"
                                                onClick={async () => {
                                                    if (!loggedIn) { onLoginRequired?.(); return; }
                                                    const id = c.id ?? c.commentId;
                                                    const text = editingDraft.trim();
                                                    if (!id || !text) return;
                                                    try {
                                                        const updated = await updateComment(story.id ?? story.storyId, id, { content: text });
                                                        setCommentList((prev) => prev.map((x) => ((x.id ?? x.commentId) === id ? (updated || { ...x, content: text }) : x)));
                                                        setEditingId(null);
                                                        setEditingDraft("");
                                                    } catch (e) {
                                                        console.error('[comment:update:error]', e);
                                                        alert('댓글 수정에 실패했어요.');
                                                    }
                                                }}
                                            >저장</button>
                                            <button
                                                className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-neutral-50"
                                                onClick={() => { setEditingId(null); setEditingDraft(""); }}
                                            >취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-[12px] text-neutral-500">{c.author?.name || c.authorName || '익명'} · {formatDateOnly(c.createdAt)}</div>
                                            <div className="text-sm text-neutral-800 whitespace-pre-wrap">{c.content}</div>
                                        </div>
                                        {(c.mine || c.isMine) && (
                                            <div className="flex shrink-0 gap-1">
                                                <button
                                                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50"
                                                    onClick={() => { setEditingId(c.id ?? c.commentId); setEditingDraft(c.content || ""); }}
                                                >수정</button>
                                                <button
                                                    className="rounded-md border px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                                                    onClick={async () => {
                                                        if (!loggedIn) { onLoginRequired?.(); return; }
                                                        const id = c.id ?? c.commentId;
                                                        if (!id) return;
                                                        if (!confirm('댓글을 삭제할까요?')) return;
                                                        try {
                                                            await deleteComment(story.id ?? story.storyId, id);
                                                            setCommentList((prev) => prev.filter((x) => (x.id ?? x.commentId) !== id));
                                                        } catch (e) {
                                                            console.error('[comment:delete:error]', e);
                                                            alert('댓글 삭제에 실패했어요.');
                                                        }
                                                    }}
                                                >삭제</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </article>
    );
}

function RightRail({ profile, onOpenWrite, recentMyStories = [], myBookmarks = [] }) {
    const navigate = useNavigate();
    const location = useLocation();
    const isLoggedIn = !!profile?.memberId;
    return (
        <div className="sticky top-16 space-y-4">
            {/* 내 활동 요약 */}
            <Card>
              {isLoggedIn ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={profile?.avatarUrl} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                      <div>
                        <div className="text-sm font-semibold">{profile?.name}</div>
                        <div className="text-[11px] text-neutral-500">최근 관람: {formatDateOnly(profile?.lastWatchedAt)}</div>
                      </div>
                    </div>
                    <button onClick={() => navigate('/mypage')} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-indigo-50">프로필</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 text-center">
                    <Stat label="관람평" value="12" />
                    <Stat label="댓글" value="134" />
                    <Stat label="북마크" value="9" />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">로그인이 필요합니다</div>
                    <div className="text-[10px] text-neutral-600">관람평 쓰기, 북마크 등 기능을 사용하려면 로그인해 주세요.</div>
                  </div>
                  <button
                    onClick={() => {
                      const back = (location?.pathname || '/story') + (location?.search || '');
                      try { sessionStorage.setItem('postLoginRedirect', back); } catch {}
                      navigate(`/login?redirect=${encodeURIComponent(back)}`, { state: { from: back } });
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-1 text-sm text-white hover:bg-indigo-700"
                  >
                    로그인
                  </button>
                </div>
              )}
            </Card>
            {/* 브랜드/CTA: Ticket × Story 중심 페이지 강조 */}
            <Card>
                <div className="rounded-2xl bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-rose-500 p-4 text-white">
                    <div className="text-sm opacity-90">Ticketory — Ticket × Story</div>
                    <div className="mt-1 text-lg font-semibold leading-tight">당신의 관람이 이야기가 되는 곳</div>
                    <button onClick={onOpenWrite} className="mt-3 w-full rounded-xl bg-white/90 px-3 py-2 text-sm text-neutral-900 hover:bg-white">관람평 쓰기</button>
                </div>
            </Card>

            {/* 최근 남긴 관람평 (로그인 사용자 전용) */}
            {isLoggedIn && (
              <Card title="최근 남긴 관람평">
                {(!Array.isArray(recentMyStories) || recentMyStories.length === 0) ? (
                  <div className="text-[12px] text-neutral-500">아직 작성한 관람평이 없어요.</div>
                ) : (
                  <ul className="space-y-3">
                    {recentMyStories.map((s, i) => (
                      <li key={s.id ?? s.storyId ?? i} className="flex items-start gap-3">
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-neutral-400"></div>
                        <div>
                          <div className="text-sm font-medium">{s.movieTitle || s.movie?.title || '제목 없음'}</div>
                          <div className="text-[12px] text-neutral-600 overflow-hidden text-ellipsis whitespace-nowrap">{s.content || ''}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-right">
                  <button className="text-[12px] text-neutral-600 hover:text-neutral-900 underline" onClick={() => navigate('/mypage/myreviews')}>
                    리뷰 더 보기
                  </button>
                </div>
              </Card>
            )}

            {/* 북마크한 영화 (로그인 사용자 전용) */}
            {isLoggedIn && (
              <Card title="북마크한 영화">
                {(!Array.isArray(myBookmarks) || myBookmarks.length === 0) ? (
                  <div className="text-[12px] text-neutral-500">아직 북마크한 영화가 없어요.</div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pr-1">
                    {myBookmarks.map((s, i) => {
                      const poster = s?.movie?.poster || s?.posterUrl || '/images/poster-placeholder.png';
                      const title = s?.movie?.title || s?.movieTitle || '';
                      const movieId = s?.movie?.id ?? s?.movieId;
                      const storyId = s?.id ?? s?.storyId;
                      return (
                        <button
                          key={storyId ?? i}
                          className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md border"
                          onClick={() => {
                            if (movieId) navigate(`/movies/${movieId}`); else if (storyId) navigate(`/stories/${storyId}`);
                          }}
                          title={title}
                        >
                          <img src={poster} alt={title} className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

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
