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
      // 로그아웃 후 홈으로 리다이렉트
      navigate('/', { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.message || '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (!memberIdStr) {
    return (
      <div className="max-w-[560px] mx-auto mt-10 p-5">
        <h2 className="mb-3 text-xl font-semibold">회원정보 수정</h2>
        <p className="text-gray-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[560px] min-h-[85vh] mx-auto mt-10 p-5">
      <div className="mb-4">
        <Link
          to="/mypage"
          className="inline-block rounded border border-gray-300 bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          ← 마이페이지로
        </Link>
      </div>

      <h2 className="mb-3 text-2xl font-semibold">회원정보 수정</h2>
      <p className="mb-6 text-gray-600">프로필 정보를 업데이트하세요.</p>

      <form onSubmit={onSubmit} className="space-y-4">
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

        <fieldset className="rounded-xl border border-gray-200 p-4">
          <legend className="px-1 text-gray-600">비밀번호 변경 (선택)</legend>
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="currentPassword" className="block font-semibold">현재 비밀번호</label>
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
              <label htmlFor="newPassword" className="block font-semibold">새 비밀번호</label>
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
              <label htmlFor="confirmPassword" className="block font-semibold">새 비밀번호 확인</label>
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

          {loading && (
              <div className="mb-3 text-sm text-gray-700">처리 중...</div>
          )}

          {err && (
              <div
                  role="alert"
                  className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                  {err}
              </div>
          )}

          {ok && (
              <div
                  role="status"
                  className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
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