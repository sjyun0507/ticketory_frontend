import { useEffect, useState } from 'react';
import { getMovies, getMovieById } from '../api/movieApi.js';

export const useMovieList = (page = 0, size = 20) => {
    const [data, setData] = useState({ content: [], page: 0, size, totalElements: 0 });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setErr('');
                const res = await getMovies({ page, size });
                setData(res);
            } catch (e) {
                setErr('영화 목록을 불러오지 못했어요.');
            } finally {
                setLoading(false);
            }
        })();
    }, [page, size]);

    return { data, loading, err };
};

export const useMovieDetail = (movieId) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!movieId) return;
        (async () => {
            try {
                setLoading(true);
                setErr('');
                const res = await getMovieById(movieId);
                setData(res);
            } catch (e) {
                setErr('영화 상세 정보를 불러오지 못했어요.');
            } finally {
                setLoading(false);
            }
        })();
    }, [movieId]);

    return { data, loading, err };
};