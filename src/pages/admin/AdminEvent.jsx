// NoticeBoard & AdminBoard in one file
import React, { useEffect, useState } from "react";
import { getBoards, createBoard, updateBoard, deleteBoard } from "../../api/adminApi.js";
import { AdminLayout } from "../../components/AdminSidebar.jsx";

// ---- public read-only board (users see this) ----
export const PublicEventBoard = () => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getBoards();
        // data can be array or page object {content: [...]} depending on backend
        setPosts(Array.isArray(data) ? data : (data?.content ?? []));
      } catch (e) {
        console.error("[PublicEventBoard] load failed", e);
        setPosts([]);
      }
    })();
  }, []);

  // simple badge
  const Badge = ({ type }) => (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded-md font-semibold ${
        type === "NOTICE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
      }`}
    >
      {type === "NOTICE" ? "공지" : "이벤트"}
    </span>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">이벤트</h1>
      {/* hero (first card wide) */}
      {posts[0] && (
        <article className="mb-6 overflow-hidden rounded-2xl shadow bg-white">
          <div className="relative">
            <img
              src={posts[0].bannerUrl}
              alt={posts[0].title}
              className="w-full h-72 object-cover"
            />
            <div className="absolute left-4 top-4"><Badge type={posts[0].type} /></div>
            <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <h3 className="text-white text-xl font-semibold">{posts[0].title}</h3>
              <p className="text-white/90 text-sm mt-1 truncate">{posts[0].content}</p>
              <p className="text-white/70 text-xs mt-2">
                기간: {posts[0].startDate} ~ {posts[0].endDate}
              </p>
            </div>
          </div>
        </article>
      )}

      {/* grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {posts.slice(1).map((p) => (
          <article key={p.id} className="overflow-hidden rounded-2xl shadow bg-white">
            <div className="relative">
              <img src={p.bannerUrl} alt={p.title} className="w-full h-48 object-cover" />
              <div className="absolute left-3 top-3">
                <Badge type={p.type} />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold line-clamp-1">{p.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">{p.content}</p>
              <p className="text-xs text-gray-400 mt-2">
                기간: {p.startDate} ~ {p.endDate}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

const AdminEvent = () => {
  const [posts, setPosts] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    type: "EVENT",
    title: "",
    content: "",
    bannerUrl: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getBoards();
        setPosts(Array.isArray(data) ? data : (data?.content ?? []));
      } catch (e) {
        console.error("[AdminEvent] list load failed", e);
        setPosts([]);
      }
    })();
  }, []);

  const toPayload = (f) => ({
    type: f.type,
    title: f.title?.trim(),
    content: f.content?.trim(),
    bannerUrl: f.bannerUrl?.trim() || null,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const resetForm = () =>
    setForm({ type: "EVENT", title: "", content: "", bannerUrl: "", startDate: "", endDate: "" });

  const handleAdd = async () => {
    if (!form.title || !form.content) return alert("제목과 내용을 입력하세요!");
    try {
      const { data } = await createBoard(toPayload(form));
      setPosts((prev) => [data, ...prev]);
      resetForm();
    } catch (e) {
      console.error("[AdminEvent] create failed", e);
      alert("등록에 실패했습니다. 콘솔을 확인해주세요.");
    }
  };

  const handleEdit = (id) => {
    const target = posts.find((p) => p.id === id);
    if (!target) return;
    setForm({
      type: target.type,
      title: target.title,
      content: target.content,
      bannerUrl: target.bannerUrl ?? "",
      startDate: target.startDate ?? "",
      endDate: target.endDate ?? "",
    });
    setEditingId(id);
  };

  const handleSave = async () => {
    try {
      const { data } = await updateBoard(editingId, toPayload(form));
      setPosts((prev) => prev.map((p) => (p.id === editingId ? data : p)));
      resetForm();
      setEditingId(null);
    } catch (e) {
      console.error("[AdminEvent] update failed", e);
      alert("수정에 실패했습니다. 콘솔을 확인해주세요.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteBoard(id);
      setPosts((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("[AdminEvent] delete failed", e);
      alert("삭제에 실패했습니다. 콘솔을 확인해주세요.");
    }
  };

  const Badge = ({ type }) => (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded-md font-semibold ${
        type === "NOTICE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
      }`}
    >
      {type === "NOTICE" ? "공지" : "이벤트"}
    </span>
  );

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">공지/이벤트 게시판 관리</h1>

        {/* 작성/수정 폼 */}
        <div className="bg-white p-6 rounded-2xl shadow mb-8 border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "게시글 수정" : "새 게시글 작성"}
          </h2>

          {/* 유형 */}
          <div className="flex items-center gap-6 mb-4">
            <span className="text-sm font-medium text-gray-700 shrink-0">유형</span>
            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="EVENT"
                checked={form.type === "EVENT"}
                onChange={handleChange}
                className="accent-indigo-600"
              />
              이벤트
            </label>
            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="NOTICE"
                checked={form.type === "NOTICE"}
                onChange={handleChange}
                className="accent-indigo-600"
              />
              공지
            </label>
          </div>

          {/* 제목 */}
          <label className="flex flex-col gap-1 mb-4">
            <span className="text-xs text-gray-600">게시판 제목</span>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="제목을 입력하세요"
              className="w-full border border-gray-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </label>

          {/* 배너 이미지 */}
          <label className="flex flex-col gap-1 mb-4">
            <span className="text-xs text-gray-600">배너 이미지</span>
            <input
              type="url"
              name="bannerUrl"
              value={form.bannerUrl}
              onChange={handleChange}
              placeholder="배너 이미지 URL (선택)"
              className="w-full border border-gray-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </label>

          {/* 날짜 */}
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">시작일</span>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="border border-gray-200 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">종료일</span>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="border border-gray-200 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </label>
          </div>

          {/* 내용 */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">내용</span>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              placeholder="내용을 입력하세요"
              className="w-full border border-gray-200 p-3 rounded-lg h-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </label>

          {/* 액션 버튼 - 오른쪽 정렬 */}
          <div className="mt-5 flex justify-end gap-2">
            {editingId ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                >
                  수정 완료
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-200"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
              >
                등록
              </button>
            )}
          </div>
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-xl shadow divide-y">
          {posts.map((post) => (
            <div key={post.id} className="p-4 hover:bg-gray-50 transition">
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge type={post.type} />
                  <h3 className="font-semibold">{post.title}</h3>
                </div>
                <span className="text-sm text-gray-500">{post.createdDate || (post.createdAt?.slice ? post.createdAt.slice(0,10) : "")}</span>
              </div>
              {expandedId === post.id && (
                <div className="mt-3 grid md:grid-cols-4 gap-4 text-gray-700">
                  <div className="md:col-span-3">
                    <p className="whitespace-pre-line">{post.content}</p>
                    {(post.startDate || post.endDate) && (
                      <p className="text-xs text-gray-500 mt-2">
                        기간: {post.startDate || "-"} ~ {post.endDate || "-"}
                      </p>
                    )}
                  </div>
                  {post.bannerUrl && (
                    <img
                      src={post.bannerUrl}
                      alt={post.title}
                      className="w-full h-32 object-cover rounded"
                    />
                  )}
                  <div className="md:col-span-4 flex gap-2 mt-2 justify-end">
                    <button
                      onClick={() => handleEdit(post.id)}
                      className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="px-3 py-2 text-xs border rounded-lg text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && (
            <p className="p-4 text-center text-gray-500">등록된 게시글이 없습니다.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminEvent;