// src/api/storyApi.js
import api from "./axiosInstance";

// 프로필(me)
export const getProfile = async () => {
    const res = await api.get("/members/me");
    return res.data;
};

// 최근 결제완료 예매
export const getEligibleBookings = async (memberId, { page = 0, size = 10, sort } = {}) => {
    const res = await api.get(`/members/${memberId}/eligible-bookings`, {
        params: { page, size, ...(sort ? { sort } : {}) },
    });
    return res.data?.content ?? res.data ?? [];
};

// 공개 스토리 피드
export const getStories = async () => {
    const res = await api.get("/stories");
    return res.data?.content ?? res.data ?? [];
};

// 내 스토리(페이지)
export const getMyStories = async (memberId, { page = 0, size = 5 } = {}) => {
    const res = await api.get(`/members/${memberId}/stories`, { params: { page, size } });
    return res.data;
};

// 스토리 CRUD
export const createStory = async (payload) => (await api.post("/stories", payload)).data;
export const updateStory = async (storyId, payload) => (await api.put(`/stories/${storyId}`, payload)).data;
export const deleteStory = async (storyId) => (await api.delete(`/stories/${storyId}`)).data;

// 좋아요/북마크
export const likeStory = async (storyId) => (await api.post(`/stories/${storyId}/like`)).data;
export const unlikeStory = async (storyId) => (await api.delete(`/stories/${storyId}/like`)).data;
export const bookmarkStory = async (storyId) => (await api.post(`/stories/${storyId}/bookmark`)).data;
export const unbookmarkStory = async (storyId) => (await api.delete(`/stories/${storyId}/bookmark`)).data;

// 내 북마크 스토리
export const getMyBookmarkedStories = async (memberId, { page, size, limit, sort = "RECENT" } = {}) => {
    const res = await api.get(`/members/${memberId}/bookmarked-stories`, {
        params: {
            ...(typeof page === "number" ? { page } : {}),
            ...(typeof size === "number" ? { size } : {}),
            ...(typeof limit === "number" ? { limit } : {}),
            sort,
        },
    });
    return res.data;
};

// 댓글
export const getComments = async (storyId) => (await api.get(`/stories/${storyId}/comments`)).data;
export const addComment = async (storyId, payload) => (await api.post(`/stories/${storyId}/comments`, payload)).data;
export const updateComment = async (storyId, commentId, payload) =>
    (await api.put(`/stories/${storyId}/comments/${commentId}`, payload)).data;
export const deleteComment = async (storyId, commentId) =>
    (await api.delete(`/stories/${storyId}/comments/${commentId}`)).data;