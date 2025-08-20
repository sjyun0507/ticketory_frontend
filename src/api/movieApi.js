import api from './axiosInstance.js';

//영화 기본정보
export const getMovies = async ({ page = 0, size = 20 } = {}) => {
    const { data } = await api.get('/movies', { params: { page, size } });
    return data;
};

//영화 상세정보 + 미디어
export const getMovieDetail = async (movieId) => {
    const { data } = await api.get(`/movies/${movieId}`);
    return data;
};

//영화 찾기
export const searchMovies = async (q) => {
    const res = await api.get(`/movies/search`, { params: { q } });
    return res.data?.content ?? res.data ?? [];
};