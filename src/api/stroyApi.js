import api from './axiosInstance';

// 스토리용 프로필 조회
export const getProfile = async () => {
    const res = await api.get('/members/me');
    return res.data;
};

//지불처리된 부킹정보 확인
export const getEligibleBookings = async (memberId, { page = 0, size = 10, sort } = {}) => {
    const res = await api.get(`/members/${memberId}/eligible-bookings`, {
        params: {
            page,
            size,
            ...(sort ? { sort } : {}),
        },
    });
    return res.data?.content ?? res.data ?? [];
};

// 스토리 목록 조회
export const getStories = async () => {
    const res = await api.get('/stories');
    return res.data.content ?? [];
};
//내 스토리 목록
export const getMyStories = async (memberId) => {
    const res = await api.get(`/members/${memberId}/stories`);
    return res.data;
};

// 스토리 생성
export const createStory = async (storyData) => {
    const res = await api.post('/stories', storyData);
    return res.data;
};

//스토리 수정
export const updateStory = async (storyId, storyData) => {
    const res = await api.put(`/stories/${storyId}`, storyData);
    return res.data;
};

//스토리 삭제
export const deleteStory = async (storyId) => {
    const res = await api.delete(`/stories/${storyId}`);
    return res.data;
};

// 좋아요 생성
export const likeStory = async (storyId) => {
    const res = await api.post(`/stories/${storyId}/like`);
    return res.data;
};

// 좋아요 취소
export const unlikeStory = async (storyId) => {
    const res = await api.delete(`/stories/${storyId}/like`);
    return res.data;
};

// 북마크 생성
export const bookmarkStory = async (storyId) => {
    const res = await api.post(`/stories/${storyId}/bookmark`);
    return res.data;
};

// 북마크 취소
export const unbookmarkStory = async (storyId) => {
    const res = await api.delete(`/stories/${storyId}/bookmark`);
    return res.data;
};
// 북마크 내역 불러오기
export const getMyBookmarkedStories = async (
    memberId,
    { page, size, limit, sort = 'RECENT' } = {}
) => {
    const res = await api.get(`/members/${memberId}/bookmarked-stories`, {
        params: {
            ...(typeof page === 'number' ? { page } : {}),
            ...(typeof size === 'number' ? { size } : {}),
            ...(typeof limit === 'number' ? { limit } : {}),
            sort,
        },
    });
    return res.data;
};


// 댓글 목록
export const getComments = async (storyId) => {
    const res = await api.get(`/stories/${storyId}/comments`);
    return res.data;
};

// 댓글 생성
export const addComment = async (storyId, commentData) => {
    const res = await api.post(`/stories/${storyId}/comments`, commentData);
    return res.data;
};

// 댓글 수정
export const updateComment = async (storyId, commentId, commentData) => {
    const res = await api.put(`/stories/${storyId}/comments/${commentId}`, commentData);
    return res.data;
};

// 댓글 삭제
export const deleteComment = async (storyId, commentId) => {
    const res = await api.delete(`/stories/${storyId}/comments/${commentId}`);
    return res.data;
};