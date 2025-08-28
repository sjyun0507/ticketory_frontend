// NoticeBoard.jsx
import React, { useState } from "react";
import {AdminLayout} from "../../components/AdminSidebar.jsx";

const AdminEvent = () => {
    // 초기 공지사항 데이터
    const [notices, setNotices] = useState([
        {
            id: 1,
            title: "🎬 8월 신규 영화 업데이트 안내",
            date: "2025-08-20",
            content:
                "8월 28일부터 F1: 더 무비, 인사이드 아웃2, 콘크리트 유토피아 등 다양한 작품이 상영됩니다.",
        },
        {
            id: 2,
            title: "📢 시스템 점검 안내",
            date: "2025-08-15",
            content:
                "8월 22일(금) 오전 2시 ~ 5시까지 시스템 점검으로 예매 서비스가 일시 중단됩니다.",
        },
    ]);

    // 글쓰기 / 수정 상태 관리
    const [form, setForm] = useState({ title: "", content: "" });
    const [editingId, setEditingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // 글쓰기 or 수정 입력 변경
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // 새 글 추가
    const handleAdd = () => {
        if (!form.title || !form.content) return alert("제목과 내용을 입력하세요!");
        const newNotice = {
            id: notices.length + 1,
            title: form.title,
            content: form.content,
            date: new Date().toISOString().slice(0, 10),
        };
        setNotices([newNotice, ...notices]);
        setForm({ title: "", content: "" });
    };

    // 글 수정 시작
    const handleEdit = (id) => {
        const target = notices.find((n) => n.id === id);
        setForm({ title: target.title, content: target.content });
        setEditingId(id);
    };

    // 글 수정 저장
    const handleSave = () => {
        setNotices(
            notices.map((n) =>
                n.id === editingId ? { ...n, title: form.title, content: form.content } : n
            )
        );
        setForm({ title: "", content: "" });
        setEditingId(null);
    };

    // 글 삭제
    const handleDelete = (id) => {
        if (window.confirm("정말 삭제하시겠습니까?")) {
            setNotices(notices.filter((n) => n.id !== id));
        }
    };

    return (
        <AdminLayout>
        <div className="max-w-4xl mx-auto px-6 py-10">
            <h1 className="text-3xl font-bold mb-6">공지사항 게시판</h1>

            {/* 글쓰기 / 수정 폼 */}
            <div className="bg-gray-50 p-4 rounded-xl shadow mb-6">
                <h2 className="text-xl font-semibold mb-3">
                    {editingId ? "공지사항 수정" : "새 공지사항 작성"}
                </h2>
                <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="제목을 입력하세요"
                    className="w-full border p-2 rounded mb-2"
                />
                <textarea
                    name="content"
                    value={form.content}
                    onChange={handleChange}
                    placeholder="내용을 입력하세요"
                    className="w-full border p-2 rounded mb-2 h-24"
                />
                {editingId ? (
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded mr-2"
                    >
                        수정 완료
                    </button>
                ) : (
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 bg-green-600 text-white rounded mr-2"
                    >
                        등록
                    </button>
                )}
                {editingId && (
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setForm({ title: "", content: "" });
                        }}
                        className="px-4 py-2 bg-gray-400 text-white rounded"
                    >
                        취소
                    </button>
                )}
            </div>

            {/* 공지사항 목록 */}
            <div className="bg-white rounded-xl shadow divide-y">
                {notices.map((notice) => (
                    <div
                        key={notice.id}
                        className="p-4 hover:bg-gray-50 transition cursor-pointer"
                    >
                        <div
                            className="flex justify-between items-center"
                            onClick={() =>
                                setExpandedId(expandedId === notice.id ? null : notice.id)
                            }
                        >
                            <h3 className="font-semibold">{notice.title}</h3>
                            <span className="text-sm text-gray-500">{notice.date}</span>
                        </div>
                        {/* 내용 펼치기 */}
                        {expandedId === notice.id && (
                            <div className="mt-2 text-gray-700">
                                <p>{notice.content}</p>
                                {/* 수정/삭제 버튼 */}
                                <div className="mt-3 space-x-2">
                                    <button
                                        onClick={() => handleEdit(notice.id)}
                                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDelete(notice.id)}
                                        className="px-3 py-1 bg-red-500 text-white text-sm rounded"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {notices.length === 0 && (
                    <p className="p-4 text-center text-gray-500">등록된 공지사항이 없습니다.</p>
                )}
            </div>
        </div>
        </AdminLayout>
    );
};

export default AdminEvent;