import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyInfo, updateMember, deleteMember } from "../../api/memberApi.js";
import { useAuthStore } from "../../store/useAuthStore.js";

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const memberId = user?.memberId ?? user?.id ?? null;
  const memberIdStr = memberId != null ? String(memberId) : null;

  const [form, setForm] = useState({
    id: '',              // 로그인 아이디(수정 불가)
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',       // ← 프로필 이미지 URL
    currentPassword: '', // 비밀번호 변경 시 필요
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (!memberIdStr) return; // 로그인 전이라면 대기
    (async () => {
      try {
        setLoading(true);
        const data = await getMyInfo(memberIdStr);
        setForm((prev) => ({
          ...prev,
          id: (data?.loginId ?? data?.id ?? ''),
          name: data?.name ?? '',
          email: data?.email ?? '',
          phone: data?.phone ?? '',
          avatarUrl: data?.avatarUrl ?? data?.avatar_url ?? '',
        }));
      } catch (e) {
        setErr('회원 정보를 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [memberIdStr]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');

    if (!memberIdStr) {
      setErr('로그인 후 이용해 주세요.');
      return;
    }

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setErr('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (form.newPassword && !form.currentPassword) {
      setErr('비밀번호를 변경하려면 현재 비밀번호를 입력해 주세요.');
      return;
    }

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      avatarUrl: form.avatarUrl || null,
      // 비밀번호 변경 시 현재 비밀번호와 새 비밀번호 함께 전달
      ...(form.newPassword
        ? { currentPassword: form.currentPassword, newPassword: form.newPassword }
        : {}),
    };

    try {
      setLoading(true);
      await updateMember(memberIdStr, payload);
      setOk('수정이 완료되었습니다.');
      // 필요 시 마이페이지로 이동
      // navigate('/mypage');
    } catch (e) {
      setErr(e?.response?.data?.message || '수정에 실패했어요. 입력값을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!memberIdStr) return;
    const confirmText = '정말 회원 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.';
    if (!window.confirm(confirmText)) return;
    try {
      setLoading(true);
      await deleteMember(memberIdStr);
      // 토큰/스토어 완전 초기화
      localStorage.removeItem('accessToken');
      if (typeof clearAuth === 'function') clearAuth();
      const st = useAuthStore?.getState?.();
      if (st && typeof st.logout === 'function') st.logout();
      // 인증 상태 초기화 및 홈으로 이동
      navigate('/', { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.message || '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (!memberIdStr) {
    return (
      <div className="max-w-[1200px] mx-auto mt-10 p-5">
        <h2 className="mb-3 text-xl font-semibold">회원정보 수정</h2>
        <p className="text-gray-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] min-h-[85vh] mx-auto mt-10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/mypage"
          className="inline-block rounded border border-gray-300 bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          ← 마이페이지로
        </Link>
      </div>

      <h2 className="mb-2 text-2xl font-semibold">회원정보 수정</h2>
      <p className="mb-6 text-gray-600">프로필 정보를 업데이트하세요.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* 2-컬럼 레이아웃: 왼쪽 정보, 오른쪽 비밀번호 변경 */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* LEFT: 기본 정보 */}
          <div className="space-y-4">
            {/* 상단 아바타 프리뷰 */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                {form.avatarUrl ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img
                    src={form.avatarUrl}
                    alt="프로필 미리보기 이미지"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No Image</div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                프로필 사진은 공개 프로필과 마이페이지에 사용돼요.
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="loginId" className="block font-semibold">로그인 아이디 (수정 불가)</label>
              <input
                id="loginId"
                name="id"
                type="text"
                value={form.id}
                readOnly
                disabled
                placeholder="로그인 시 사용한 이메일"
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="name" className="block font-semibold">이름</label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={onChange}
                required
                placeholder="이름"
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="block font-semibold">이메일</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="user@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="block font-semibold">휴대폰 번호</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={onChange}
                placeholder="010-1234-5678"
                autoComplete="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="avatarUrl" className="block font-semibold">프로필 이미지 URL</label>
              <input
                id="avatarUrl"
                name="avatarUrl"
                type="url"
                value={form.avatarUrl}
                onChange={onChange}
                placeholder="https://... (정사각형 권장)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
              />
              <p className="text-xs text-gray-500">이미지 주소를 입력하면 위에 미리보기가 표시됩니다.</p>
            </div>
          </div>

          {/* RIGHT: 비밀번호 변경 카드 */}
          <aside className="h-max rounded-xl border border-gray-200 p-4 bg-white">
            <fieldset>
              <legend className="mb-3 px-1 font-semibold text-gray-800">비밀번호 변경 (선택)</legend>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="currentPassword" className="block text-sm font-medium">현재 비밀번호</label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={form.currentPassword}
                    onChange={onChange}
                    placeholder="현재 비밀번호"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
                  />
                  <p className="text-xs text-gray-500">비밀번호를 변경하려면 현재 비밀번호가 필요합니다.</p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="newPassword" className="block text-sm font-medium">새 비밀번호</label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={onChange}
                    placeholder="8자 이상"
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium">새 비밀번호 확인</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={onChange}
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
                  />
                </div>
              </div>
            </fieldset>
          </aside>
        </div>

        {loading && (
          <div className="text-sm text-gray-700">처리 중...</div>
        )}

        {err && (
          <div
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {err}
          </div>
        )}

        {ok && (
          <div
            role="status"
            className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            {ok}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-lg border border-black bg-black px-4 py-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          >
            저장하기
          </button>
          <button
            type="button"
            onClick={() => navigate('/mypage', { replace: true })}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 hover:bg-gray-50"
          >
            취소
          </button>
          <div className="ml-auto" />
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-500 bg-white px-4 py-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          >
            회원 탈퇴
          </button>
        </div>
      </form>
    </div>
  );
}