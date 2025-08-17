import api from './axiosInstance.js';

export const getMovies = async ({ page = 0, size = 20 } = {}) => {
    const { data } = await api.get('/movies', { params: { page, size } });
    return data;
};

export const getMovieById = async (movieId) => {
    const { data } = await api.get(`/movies/${movieId}`);
    return data;
};