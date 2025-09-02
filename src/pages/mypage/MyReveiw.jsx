// src/pages/mypage/MyReveiw.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore.js";
import { getMyStories, updateStory, deleteStory } from "../../api/storyApi.js";
import { getProfile } from "../../api/storyApi.js";

// 날짜만 표시
function formatDateOnly(v) {
    if (!v) return "";
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("ko-KR");
    const s = String(v);
    return s.includes("T") ? s.split("T")[0] : s.split(" ")[0];
}

const PageSize = 10;

export default function MyReview() {
    const navigate = useNavigate();

    const [memberId, setMemberId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stories, setStories] = useState([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({ content: "", rating: 0, tags: "", visible: true });

    // 1) 로그인된 사용자 정보 불러오기
    useEffect(() => {
        (async () => {
            try {
                const me = await getProfile();
                setMemberId(me?.memberId ?? null);
            } catch (e) {
                console.error("[myreviews:me:error]", e);
                setMemberId(null);
            }
        })();
    }, []);

    // 2) memberId가 생기면 관람평 목록 불러오기
    useEffect(() => {
        if (!memberId) return;
        (async () => {
            setLoading(true);
            try {
                const res = await getMyStories(memberId, { page, size: PageSize });
                const rows = Array.isArray(res?.content) ? res.content : [];
                setStories(rows);
                setTotalPages(typeof res?.totalPages === "number" ? res.totalPages : 1);
            } catch (e) {
                console.error("[myreviews:load:error]", e);
                setError("목록을 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        })();
    }, [memberId, page]);

    const startEdit = (s) => {
        setEditingId(s.id ?? s.storyId);
        setDraft({
            content: s.content ?? "",
            rating: s.rating ?? 0,
            tags: Array.isArray(s.tags) ? s.tags.join(", ") : s.tags || "",
            visible: s.visible ?? s.isVisible ?? s.status === "PUBLISHED",
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft({ content: "", rating: 0, tags: "", visible: true });
    };

    const applyUpdate = async (id) => {
        try {
            const payload = {
                content: draft.content,
                rating: Number(draft.rating) || 0,
                tags: draft.tags
                    ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean)
                    : [],
                visible: !!draft.visible,
            };
            await updateStory(id, payload);
            // 낙관적 반영
            setStories((prev) => prev.map((s) => (s.id === id || s.storyId === id ? { ...s, ...payload } : s)));
            cancelEdit();
        } catch (e) {
            console.error("[myreviews:update:error]", e);
            alert("수정에 실패했습니다.");
        }
    };

    const removeStory = async (id) => {
        if (!confirm("이 관람평을 삭제할까요? (되돌릴 수 없습니다)")) return;
        const backup = stories;
        try {
            setStories((prev) => prev.filter((s) => (s.id ?? s.storyId) !== id));
            await deleteStory(id, { soft: true });
        } catch (e) {
            console.error("[myreviews:delete:error]", e);
            alert("삭제에 실패했습니다.");
            setStories(backup);
        }
    };

    const keyOf = (s, idx) =>
        s?.id ?? s?.storyId ?? s?.uuid ?? `${s?.movieId ?? "m"}-${s?.memberId ?? "u"}-${s?.createdAt ?? idx}`;

    // 로그인 안 된 경우 UX
    if (!memberId) {
        return (
            <div className="mx-auto max-w-5xl px-4 py-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-xl font-semibold">내 관람평</h1>
                    <button onClick={() => navigate("/story")} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-indigo-50">
                        스토리 피드로
                    </button>
                </div>
                <div className="rounded-xl border bg-white p-10 text-center text-sm text-neutral-600">
                    로그인 후 이용할 수 있습니다.
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-xl font-semibold">내 관람평</h1>
                <button onClick={() => navigate("/story")} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-indigo-50">
                    스토리 피드로
                </button>
            </div>

            {error && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div className="divide-y rounded-xl border bg-white">
                {loading && <div className="p-6 text-sm text-neutral-500">불러오는 중…</div>}

                {!loading && stories.length === 0 && (
                    <div className="p-10 text-center text-sm text-neutral-500">작성한 관람평이 없어요.</div>
                )}

                {stories.map((s, idx) => {
                    const id = s.id ?? s.storyId;
                    const isEditing = editingId === id;
                    return (
                        <div key={keyOf(s, idx)} className="grid grid-cols-[80px,1fr] gap-4 p-4">
                            <img
                                src={s.posterUrl || s.movie?.posterUrl}
                                alt="poster"
                                className="h-24 w-16 rounded object-cover"
                            />
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium">{s.movieTitle || s.movie?.title}</div>
                                        <div className="text-xs text-neutral-500">{formatDateOnly(s.createdAt || s.updatedAt)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => applyUpdate(id)}
                                                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
                                                >
                                                    취소
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => startEdit(s)}
                                                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => removeStory(id)}
                                                    className="rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    삭제
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isEditing ? (
                                    <div className="space-y-2">
                    <textarea
                        className="h-28 w-full rounded-md border p-2 text-sm"
                        value={draft.content}
                        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                        placeholder="관람평 내용을 입력하세요"
                    />
                                        <div className="flex items-center gap-3 text-sm">
                                            <label className="flex items-center gap-2">
                                                <span className="text-neutral-600">평점</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={10}
                                                    step={0.5}
                                                    className="w-20 rounded border px-2 py-1"
                                                    value={draft.rating}
                                                    onChange={(e) => setDraft({ ...draft, rating: e.target.value })}
                                                />
                                            </label>
                                            <label className="flex grow items-center gap-2">
                                                <span className="text-neutral-600">태그</span>
                                                <input
                                                    type="text"
                                                    className="grow rounded border px-2 py-1"
                                                    placeholder="예: 액션, 감동"
                                                    value={draft.tags}
                                                    onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                                                />
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!draft.visible}
                                                    onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
                                                />
                                                <span className="text-neutral-600">공개</span>
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap text-sm text-neutral-800">{s.content}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                        disabled={page <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                        이전
                    </button>
                    <div className="text-sm text-neutral-600">
                        {page + 1} / {totalPages}
                    </div>
                    <button
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                        다음
                    </button>
                </div>
            )}
        </div>
    );
}