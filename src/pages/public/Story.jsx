import React,{ useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Star } from "lucide-react";
import { getProfile, getStories, createStory, getEligibleBookings, getMyStories, likeStory, unlikeStory, bookmarkStory, unbookmarkStory, getMyBookmarkedStories, getComments, addComment,updateComment,deleteComment } from "../../api/storyApi.js";
import Modal from "../../components/Modal.jsx";
import { getMovieDetail } from "../../api/movieApi.js";
import defaultPoster from '../../assets/styles/poster-placeholder.png';
import defaultAvatar from '../../assets/styles/avatar-placeholder.png';
import { getMyInfo } from "../../api/memberApi.js";
/*
 StoryFeed - 카드형 실관람평 피드 (인스타그램 느낌)
 - 포스터: 세로 비율 유지 (2:3)
 - 버튼: 모던/중립 톤 (강조 색 사용 X)
 - 우측 여백(라이트 레일): 해시태그/빠른 필터/주간 픽/내 티켓 바로가기/가이드
 */

// 프론트 가드: 서버 컬럼 길이 보호용 (DB가 짧으면 이 값을 더 낮춰 쓰세요)
const MAX_STORY_LEN = 1000;

// --- error message extractor (HTTP) ---
function getErrMsg(err) {
  const res = err?.response;
  if (!res) return err?.message || '요청에 실패했어요';
  const data = res.data;
  if (typeof data === 'string') return data;
  return data?.message || data?.error || `HTTP ${res.status}`;
}

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

function LikeFxCSS() {
  return (
    <style>{`
      @keyframes heart-pop { 0% { transform: scale(0.95); } 45% { transform: scale(1.45); } 100% { transform: scale(1); } }
      @keyframes particle-burst { 0% { transform: translate(0,0) scale(0.85); opacity: 0; } 25% { opacity: 1; } 100% { transform: var(--tr) scale(0); opacity: 0; } }
      .like-pop { animation: heart-pop 450ms ease-out; }
      .like-glow { filter: drop-shadow(0 0 6px currentColor); }
      .particle { position: absolute; width: 9px; height: 9px; border-radius: 9999px; background: currentColor; opacity: 0; }
      .particle.burst { animation: particle-burst 800ms ease-out forwards; }
    `}</style>
  );
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
      <span className="text-sm w-10 text-right"> {Number.isFinite(value) ? value.toFixed(1) : '0.0'}</span>
    </div>
  );
}
// 작성자(멤버) 조회 캐시: 같은 ID 반복 호출 방지
const __memberCache = new Map();

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

    // 북마크 토글 시 우측 레일(북마크한 영화) 즉시 반영
    const handleBookmarkChange = (story, next) => {
      const storyId = story?.id ?? story?.storyId;
      if (!storyId) return;

      // 1) 피드 내 해당 카드의 bookmarked 플래그 동기화
      setStories((prev) => Array.isArray(prev)
        ? prev.map((s) => ((s?.id ?? s?.storyId) === storyId ? { ...s, bookmarked: next } : s))
        : prev);

      // 2) 우측 레일 "북마크한 영화" 목록에 즉시 반영 (optimistic)
      setBookmarkedStories((prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        if (next) {
          // 추가(중복 방지). 가능한 한 포스터/타이틀을 채움
          const exists = arr.some((x) => (x?.id ?? x?.storyId) === storyId);
          if (!exists) {
            const poster = story?.movie?.poster || story?.movie?.posterUrl || story?.posterUrl || story?.moviePoster;
            const title = story?.movie?.title || story?.movieTitle || '';
            const movieId = story?.movie?.id ?? story?.movieId;
            const enriched = {
              ...story,
              movie: { ...(story?.movie || {}), poster, title, id: movieId },
              id: storyId,
            };
            arr.unshift(enriched);
          }
          // 최대 12개 정도만 유지(가로 스크롤 과도 방지)
          return arr.slice(0, 12);
        }
        // 제거
        return arr.filter((x) => (x?.id ?? x?.storyId) !== storyId);
      });
    };

    useEffect(() => {
      (async () => {
        try {
          const p = await getProfile();
          setProfile(p);
        } catch (e) {
          console.error('[profile:load:error]', e);
        }
        try {
          const list = await getStories();
          if (Array.isArray(list?.content)) setStories(list.content);
          else setStories(Array.isArray(list) ? list : []);
        } catch (e) {
          console.error('[stories:load:error]', e);
          const msg = getErrMsg(e);
          // 사용자에게 간단 안내 (500 등)
          try { alert(`관람평 목록을 불러오지 못했어요.\n${msg}`); } catch {}
          setStories([]);
        }
      })();
    }, []);

    useEffect(() => {
      if (!profile?.memberId) return;
      (async () => {
        try {
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
          const res = await getMyStories(id, { page:0, size: 5 });
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
        <div className="min-h-screen bg-white">
            <LikeFxCSS />
            <main className="mx-auto max-w-6xl bg-neutral-100 px-4 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section className="lg:col-span-2 space-y-4 max-w-[640px] w-full mx-auto">
                    {Array.isArray(stories) && stories.map((s, idx) => {
                        const key = s?.id ?? s?.storyId ?? s?.uuid ?? `${s?.memberId ?? 'm'}-${s?.movie?.id ?? s?.movieId ?? 'mv'}-${s?.createdAt ?? idx}`;
                        return (
                          <StoryCard
                            key={key}
                            story={s}
                            loggedIn={loggedIn}
                            profile={profile}
                            onLoginRequired={() => {
                              const back = (location?.pathname || '/story') + (location?.search || '');
                              try { sessionStorage.setItem('postLoginRedirect', back); } catch {}
                              navigate(`/login?redirect=${encodeURIComponent(back)}`, { state: { from: back } });
                            }}
                            onBookmarkChange={handleBookmarkChange}
                          />
                        );
                    })}
                </section>

                <aside className="hidden lg:block pr-3 lg:pr-4">
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
                <img src={b.posterUrl || defaultPoster} alt={b.movieTitle}
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
      <label className="flex items-center justify-start gap-5">
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
          maxLength={MAX_STORY_LEN}
          onChange={(e) => {
            const v = (e.target.value || '').slice(0, MAX_STORY_LEN);
            setStoryForm(f => ({ ...f, content: v }));
          }}
        />
        <div className="mt-1 text-right text-[11px] text-neutral-500">{storyForm.content.length}/{MAX_STORY_LEN}</div>
      </label>
    </div>

    <div className="flex items-center justify-end gap-2 pt-2">
      <button onClick={() => setWriteOpen(false)} className="rounded-xl border px-4 py-2 text-sm">취소</button>
      <button
        disabled={!selectedBooking || submitting || !storyForm.content.trim()}
        onClick={async () => {
          if (!selectedBooking) return;
          if ((storyForm.content || '').length > MAX_STORY_LEN) {
            alert(`내용은 최대 ${MAX_STORY_LEN}자까지 입력할 수 있어요.`);
            setSubmitting(false);
            return;
          }
          setSubmitting(true);
          try {
            const payload = {
              bookingId: selectedBooking.bookingId,
              movieId: selectedBooking.movieId,
              rating: storyForm.rating,
              content: storyForm.content.trim().slice(0, MAX_STORY_LEN),
              tags: storyForm.tags ? storyForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
              hasProof: true,
            };
            console.debug('[story:create:req] payload', payload);
            const saved = await createStory(payload);

            // 보강: 응답에 member/movie 포스터가 비어있으면 각각 가져와서 채움
            let memberName = saved?.member?.name;
            let memberAvatar = saved?.member?.avatarUrl;
            if (!memberName || !memberAvatar) {
                try {
                    const p = await getProfile();
                    memberName = memberName || p?.name;
                    memberAvatar = memberAvatar || p?.avatarUrl || defaultAvatar;
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
                avatarUrl: memberAvatar || defaultAvatar,
                movie: { ...saved?.movie, poster: moviePoster },
            };

            setStories(prev => Array.isArray(prev) ? [normalized, ...prev] : [normalized]);
            setEligible(prev => prev.map(b => b.bookingId === selectedBooking.bookingId ? { ...b, hasStory: true } : b));
            setSelectedBooking(null);
            setStoryForm({ rating: 4.5, content: "", tags: "" });
            setWriteOpen(false);
          } catch (e) {
            console.error('[story:create:error]', e);
            const msg = getErrMsg(e);
            try { alert(`관람평 저장에 실패했어요.\n${msg}`); } catch {}
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
        // </div>
    );
}

function StoryCard({ story, loggedIn = false, onLoginRequired, profile, onBookmarkChange }) {
    const [liked, setLiked] = useState(!!story?.liked);
    const [likeCount, setLikeCount] = useState(
        Number.isFinite(story?.likeCount) ? story.likeCount :
            Number.isFinite(story?.likes) ? story.likes :
                Number.isFinite(story?.like_count) ? story.like_count : 0
    );
    const [bookmarked, setBookmarked] = useState(!!story?.bookmarked);
    const [likeBusy, setLikeBusy] = useState(false);
    const [bookmarkBusy, setBookmarkBusy] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [commentList, setCommentList] = useState(Array.isArray(story?.commentsList) ? story.commentsList : []);
    const [comments, setComments] = useState(
        Number.isFinite(story?.commentCount) ? story.commentCount :
            Number.isFinite(story?.comments) ? story.comments :
                Number.isFinite(story?.comment_count) ? story.comment_count : 0
    );
    const [commentDraft, setCommentDraft] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingDraft, setEditingDraft] = useState("");
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState("");
    const [posterSpin, setPosterSpin] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [likeBurst, setLikeBurst] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const nav = useNavigate();

    useEffect(() => {
      if (!commentsOpen) return;
      (async () => {
        setCommentsLoading(true);
        setCommentsError("");
        try {
          const res = await getComments(story.id ?? story.storyId, { page: 0, size: 50 });
          const rows = Array.isArray(res?.content) ? res.content : (Array.isArray(res) ? res : []);
          const me = profile?.memberId;
          const normalized = rows.map((r) => {
            const rMemberId = r?.memberId ?? r?.authorId ?? r?.author?.memberId;
            const isMine = r?.mine ?? r?.isMine ?? (me ? rMemberId === me : false);
            const authorName = r?.author?.name || r?.authorName || (isMine ? (profile?.name || '나') : '익명');
            const authorAvatar = r?.author?.avatarUrl || (isMine ? profile?.avatarUrl : undefined);
            return {
              ...r,
              memberId: rMemberId ?? r?.memberId,
              mine: isMine,
              author: r?.author || { name: authorName, avatarUrl: authorAvatar },
            };
          });
          setCommentList(normalized);
          setComments(typeof res?.totalElements === 'number' ? res.totalElements : normalized.length);
        } catch (e) {
          console.error('[comments:load:error]', e);
          setCommentsError('댓글을 불러오지 못했어요.');
        } finally {
          setCommentsLoading(false);
        }
      })();
    }, [commentsOpen, story.id, story.storyId]);

    const [author, setAuthor] = useState({
        name: story?.name,
        avatarUrl: story?.avatarUrl
    });
    const lastWatched = story?.lastWatchedAt || "";
    const ratingText = Number.isFinite(story?.rating) ? story.rating.toFixed(1) : "—";
    const poster = story?.movie?.poster || defaultPoster;
    const movieTitle = story?.movie?.title || "";
    const age = story?.movie?.age || "";
    const content = story?.content || "";
    const tags = Array.isArray(story?.tags) ? story.tags : [];


    useEffect(() => {
        let ignore = false;
        const id = story?.memberId;
        const hasName = !!author?.name;
        const hasAvatar = !!author?.avatarUrl;
        if (!id || (hasName && hasAvatar)) return;

        // 캐시 히트 시 즉시 적용
        if (__memberCache.has(id)) {
            const cached = __memberCache.get(id);
            if (!ignore) {
                setAuthor((prev) => ({
                    name: prev?.name || cached?.name,
                    avatarUrl: prev?.avatarUrl || cached?.avatarUrl,
                }));
            }
            return;
        }

        (async () => {
            if (profile?.memberId && profile.memberId === id) {
                const next = {
                  name: author?.name || profile?.name || "익명",
                  avatarUrl: author?.avatarUrl || profile?.avatarUrl || defaultAvatar,
                };
                __memberCache.set(id, next);
                if (!ignore) setAuthor(next);
                return;
            }

            try {
                const member = await getMyInfo(id);
                const next = {
                  name: author?.name || member?.name || "익명",
                  avatarUrl: author?.avatarUrl || member?.avatarUrl || defaultAvatar,
                };
                __memberCache.set(id, next);
                if (!ignore) setAuthor(next);
            } catch (err) {
                console.warn('[StoryCard] member fetch failed:', err);
                if (!ignore) {
                  setAuthor((prev) => ({
                    name: prev?.name || "익명",
                    avatarUrl: prev?.avatarUrl || defaultAvatar,
                  }));
                }
            }
        })();

        return () => { ignore = true; };
        // author는 채우기 용도라 의존성 최소화
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [story?.memberId]);
    return (
        <article className="rounded-2xl border bg-white/95 backdrop-blur-sm p-3 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all">
            {/* 상단: 사용자 정보 */}
            <div className="relative flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                    <img src={author?.avatarUrl || defaultAvatar} alt="avatar" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{author?.name || "익명"}</span>
                            <span className="text-[11px] text-neutral-500">{lastWatched}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Star className="w-3.5 h-3.5 fill-current" /> <span>{ratingText}</span>
                            <span className="mx-1">·</span>
                            <span>관람 인증</span>
                        </div>
                    </div>
                </div>
                <button
                  className="p-1 rounded-lg hover:bg-neutral-100"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
                >
                  <MoreHorizontal className="w-5 h-5"/>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-3 top-12 z-20 w-40 overflow-hidden rounded-md border bg-white shadow-lg"
                    onMouseDown={(e) => e.preventDefault()} // keep focus for click -> blur close after
                  >
                    {/* 내 글이면 수정/삭제 표시 */}
                    {(profile?.memberId && (profile.memberId === (story?.memberId))) && (
                      <>
                        <MenuItem onClick={() => {
                          setMenuOpen(false);
                          const sid = story?.id ?? story?.storyId;
                          if (!sid) return;
                          try { nav(`/mypage/myreviews?edit=${sid}`); } catch (e) { console.error('[menu:navigate:edit]', e); }
                        }}>수정</MenuItem>
                        <MenuItem onClick={() => {
                          setMenuOpen(false);
                          const sid = story?.id ?? story?.storyId;
                          if (!sid) return;
                          try { nav(`/mypage/myreviews?delete=${sid}`); } catch (e) { console.error('[menu:navigate:delete]', e); }
                        }}>삭제</MenuItem>
                        <Divider />
                      </>
                    )}
                    <MenuItem onClick={() => { setMenuOpen(false); alert('신고가 접수되었습니다.'); }}>신고</MenuItem>
                    <MenuItem onClick={() => { setMenuOpen(false); alert('공유 기능은 준비중입니다.'); }}>공유</MenuItem>
                  </div>
                )}
            </div>

            {/* 포스터 + 본문 */}
            <div className="px-3">
                <div className="grid grid-cols-[minmax(96px,136px)_1fr] gap-2.5">
                    {/* 포스터: 2:3 비율 고정 */}
                    <div className="relative" style={{ perspective: '1000px' }}>
                      <button
                        type="button"
                        className="group aspect-[2/3] w-full overflow-hidden rounded-lg border"
                        onClick={() => {
                          setPosterSpin(true);
                          setShowDetail(true);
                          setTimeout(() => setPosterSpin(false), 1200);
                          // 버튼은 조금 더 오래 유지
                          setTimeout(() => setShowDetail(false), 3000);
                        }}
                        aria-label={`${movieTitle} 포스터 회전`}
                      >
                        <img
                          src={poster}
                          alt={movieTitle}
                          style={{
                            transform: posterSpin ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            transition: 'transform 1200ms ease-in-out',
                            transformStyle: 'preserve-3d'
                          }}
                          className="h-full w-full object-cover transform-gpu motion-reduce:transition-none motion-reduce:transform-none"
                          loading="lazy"
                        />
                      </button>

                      {/* 연령 등급 배지 */}
                      <div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
                        {age}
                      </div>

                      {/* 상세보기 오버레이 버튼 */}
                      <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity ${showDetail ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            (e).stopPropagation();
                            const movieId = story?.movie?.id ?? story?.movieId ?? story?.movie?.movieId;
                            if (!movieId) {
                              console.error('[movie:navigate] movieId not found in story', story);
                              return;
                            }
                            // 기본 라우트 시도
                            try { nav(`/movies/${movieId}`); } catch {}

                            setTimeout(() => {
                              const path = (typeof window !== 'undefined' && window.location?.pathname) || '';
                              if (!path.includes(`/movies/${movieId}`)) {
                                try { nav(`/movie/${movieId}`); } catch {}
                              }
                            }, 150);
                          }}
                          className="pointer-events-auto rounded-full bg-black/70 px-4 py-2 text-xs sm:text-sm text-white shadow hover:bg-black/80"
                        >
                          영화 상세보기
                        </button>
                      </div>
                    </div>

                    {/* 텍스트 본문 */}
                    <div className="flex flex-col p-2.5 gap-2">
                        <h3 className="text-[16px] font-semibold leading-snug mb-1">{movieTitle}</h3>
                        <p className="text-[14px] leading-relaxed text-neutral-800 whitespace-pre-line">
                            {content}
                        </p>
                    </div>
                </div>
            </div>

            {/* 하단: 인터랙션 */}
            <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={
                          async () => {
                            if (!loggedIn) { onLoginRequired?.(); return; }
                            if (likeBusy) return;
                            setLikeBusy(true);
                            const next = !liked;
                            // optimistic update
                            setLiked(next);
                            setLikeCount((c) => c + (next ? 1 : -1));
                            if (next) {
                              // trigger a short pop + particle burst
                              setLikeBurst(true);
                              setTimeout(() => setLikeBurst(false), 800);
                            }
                            try {
                              if (next) await likeStory(story.id ?? story.storyId);
                              else await unlikeStory(story.id ?? story.storyId);
                            } catch (e) {
                              // rollback on error
                              setLiked(!next);
                              setLikeCount((c) => c + (next ? -1 : 1));
                              console.error('[story:like:error]', e);
                            } finally {
                              setLikeBusy(false);
                            }
                          }
                        }
                        className={`group flex items-center gap-1 text-sm transition-colors ${liked ? 'text-red-500' : 'text-neutral-600 hover:text-neutral-800'}`}
                        disabled={likeBusy}
                        aria-pressed={liked}
                        aria-busy={likeBusy}
                        title={liked ? '좋아요 취소' : '좋아요'}
                    >
                        <span className="relative inline-flex items-center">
                          <span className={`inline-block ${likeBurst ? 'like-pop like-glow' : ''}`}>
                            <Heart className={`w-6 h-6 ${liked ? 'fill-current' : ''}`} />
                          </span>
                          {likeBurst && (
                            <>
                              <span className="particle burst" style={{ ['--tr']: 'translate(-4px,-18px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(10px,-16px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(18px,-4px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(-16px,-6px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(0px,18px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(-12px,12px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(14px,10px)' }} />
                              <span className="particle burst" style={{ ['--tr']: 'translate(-8px,-14px)' }} />
                            </>
                          )}
                        </span>
                        <span>{likeCount}</span>
                    </button>
                    <button
                        onClick={() => setCommentsOpen(v => !v)}
                        className="flex items-center gap-1 text-sm text-neutral-600"
                        aria-expanded={commentsOpen}
                        title={commentsOpen ? '댓글 닫기' : '댓글 열기'}
                    >
                        <MessageCircle className="w-5 h-5" />
                        <span>{comments}</span>
                    </button>
                </div>
                <button
                  onClick={
                    async () => {
  if (!loggedIn) { onLoginRequired?.(); return; }
  if (bookmarkBusy) return;
  setBookmarkBusy(true);
  const next = !bookmarked;

  // optimistic: 카드 상태/우측 레일 동시 반영
  setBookmarked(next);
  try { onBookmarkChange?.(story, next); } catch {}

  try {
    const id = story.id ?? story.storyId;
    if (next) await bookmarkStory(id);
    else await unbookmarkStory(id);
  } catch (e) {
    // rollback both
    setBookmarked(!next);
    try { onBookmarkChange?.(story, !next); } catch {}
    console.error('[story:bookmark:error]', e);
  } finally {
    setBookmarkBusy(false);
  }
}
                  }
                  className={`transition-colors ${bookmarked ? 'text-indigo-500' : 'text-neutral-500 hover:text-neutral-800'}`}
                  aria-pressed={bookmarked}
                  aria-busy={bookmarkBusy}
                  title={bookmarked ? '북마크 취소' : '북마크'}
                  disabled={bookmarkBusy}
                >
                  <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
                </button>
            </div>

            {commentsOpen && (
                <div className="border-t bg-neutral-50/60 px-3 py-2.5">
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
          className="min-h-[34px] grow rounded-md border px-2 py-1 text-[13px]"
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
                                    const base = (saved && typeof saved === 'object') ? saved : {};
                                    const newItem = {
                                      ...base,
                                      id: base.id ?? base.commentId ?? Date.now(),
                                      content: base.content ?? text,
                                      memberId: base.memberId ?? profile?.memberId,
                                      mine: true,
                                      author: base.author ?? { name: profile?.name || '나', avatarUrl: (profile?.avatarUrl || defaultAvatar) },
                                      createdAt: base.createdAt ?? new Date().toISOString(),
                                    };
                                    setCommentList((prev) => [newItem, ...prev]);
                                    setCommentDraft("");
                                    setComments((c) => c + 1);
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
                                            <div className="text-[12px] text-neutral-500">{c.mine ? (profile?.name || '나') : (c.author?.name || c.authorName || '익명')} · {formatDateOnly(c.createdAt)}</div>
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
                                                            setComments((c) => Math.max(0, c -1));
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
                      <img src={profile?.avatarUrl || defaultAvatar} alt="avatar" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                      <div>
                        <div className="text-sm font-semibold">{profile?.name}</div>
                        <div className="text-[11px] text-neutral-500">최근 관람: {formatDateOnly(profile?.lastWatchedAt)}</div>
                      </div>
                    </div>
                    <button onClick={() => navigate('/mypage')} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-indigo-50">프로필</button>
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
            <Card bleed>
              <div className="bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-rose-500 p-5 text-white">
                <div className="text-sm/5 opacity-90">Ticketory — Ticket × Story</div>
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
                  <ul className="list-none divide-y divide-neutral-200">
                    {recentMyStories.map((s, i) => (
                        <li key={s.id ?? s.storyId ?? i} className="flex items-start gap-2 min-w-0 py-2 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{s.movieTitle || s.movie?.title || '제목 없음'}</div>
                                <div className="text-[12px] text-neutral-600 break-words overflow-hidden">{s.content || ''}</div>
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
                  <div className="grid grid-cols-4 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {myBookmarks.map((s, i) => {
                      const poster = s?.movie?.poster || s?.posterUrl || defaultPoster;
                      const title = s?.movie?.title || s?.movieTitle || '';
                      const movieId = s?.movie?.id ?? s?.movieId;
                      const storyId = s?.id ?? s?.storyId;
                      return (
                        <button
                          key={storyId ?? i}
                          className="aspect-[2/3] w-full overflow-hidden rounded-md border"
                          onClick={() => {
                            if (movieId) navigate(`/movies/${movieId}`); else if (storyId) navigate(`/stories/${storyId}`);
                          }}
                          title={title}
                        >
                          <img src={poster} alt={title} className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

        </div>
    );
}


function Card({ title, children, bleed = false, className = "" }) {
    const base = bleed
        ? "rounded-2xl overflow-hidden shadow-sm"
        : "rounded-2xl border bg-white p-4 shadow-sm";
    return (
        <div className={`${base} ${className}`.trim()}>
            {!bleed && title && <h4 className="mb-3 text-sm font-semibold">{title}</h4>}
            {bleed ? (
                // When bleeding, children should render edge-to-edge (e.g., gradients)
                children
            ) : (
                children
            )}
        </div>
    );
}

// --- Popup menu helpers for StoryCard ---
function MenuItem({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-[13px] hover:bg-neutral-50"
      role="menuitem"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-neutral-200" />;
}