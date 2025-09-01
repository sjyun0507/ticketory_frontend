import api from './axiosInstance';

// 스토리용 프로필 조회
export const getProfile = async () => {
    const res = await api.get('/members/me');
    return res.data;
};

// Get eligible bookings for a member
export const getEligibleBookings = async (memberId) => {
    const res = await api.get(`/members/${memberId}/eligible-bookings`);
    return res.data;
};

// 스토리 목록 조회
export const getStories = async () => {
    const res = await api.get('/stories');
    return res.data.content ?? [];
};
// Get stories by a member
export const getMyStories = async (memberId) => {
    const res = await api.get(`/members/${memberId}/stories`);
    return res.data;
};

// Create a new story
export const createStory = async (storyData) => {
    const res = await api.post('/stories', storyData);
    return res.data;
};

// Update a story
export const updateStory = async (storyId, storyData) => {
    const res = await api.put(`/stories/${storyId}`, storyData);
    return res.data;
};

// Delete a story
export const deleteStory = async (storyId) => {
    const res = await api.delete(`/stories/${storyId}`);
    return res.data;
};

// Like a story
export const likeStory = async (storyId) => {
    const res = await api.post(`/stories/${storyId}/like`);
    return res.data;
};

// Unlike a story
export const unlikeStory = async (storyId) => {
    const res = await api.delete(`/stories/${storyId}/like`);
    return res.data;
};

// Bookmark a story
export const bookmarkStory = async (storyId) => {
    const res = await api.post(`/stories/${storyId}/bookmark`);
    return res.data;
};

// Unbookmark a story
export const unbookmarkStory = async (storyId) => {
    const res = await api.delete(`/stories/${storyId}/bookmark`);
    return res.data;
};

// Get comments for a story
export const getComments = async (storyId) => {
    const res = await api.get(`/stories/${storyId}/comments`);
    return res.data;
};

// Add a comment to a story
export const addComment = async (storyId, commentData) => {
    const res = await api.post(`/stories/${storyId}/comments`, commentData);
    return res.data;
};

// Update a comment
export const updateComment = async (storyId, commentId, commentData) => {
    const res = await api.put(`/stories/${storyId}/comments/${commentId}`, commentData);
    return res.data;
};

// Delete a comment
export const deleteComment = async (storyId, commentId) => {
    const res = await api.delete(`/stories/${storyId}/comments/${commentId}`);
    return res.data;
};