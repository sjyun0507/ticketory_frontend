import { useEffect, useState } from 'react';
import { getMovies, getMovieDetail } from '../api/movieApi.js';
import { useQuery } from '@tanstack/react-query';

export function useMovieList({
                                 page = 0,
                                 size = 24,
                                 status,
                                 releasedFrom,
                                 releasedTo,
                             } = {}) {
    return useQuery({
        queryKey: ['movies', page, size, status ?? null, releasedFrom ?? null, releasedTo ?? null],
        queryFn: async () => {
            const params = { page, size };
            if (status) params.status = status;
            if (releasedFrom && releasedTo) {
                params.releasedFrom = releasedFrom;
                params.releasedTo = releasedTo;
            }
            // getMovies는 axios 응답을 반환한다고 가정
            const res = await getMovies(params);
            const data = res?.data ?? res;
            // 배열이면 그대로, Page 형태면 content, 그 외/빈값은 [] 반환
            if (Array.isArray(data)) return data;
            if (data && Array.isArray(data.content)) return data.content;
            return [];
        },
        placeholderData: [],
        keepPreviousData: true,
        staleTime: 60_000,
        retry: 1,
    });
}
export const useMovieDetail = (movieId) => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['movie', movieId],
        enabled: !!movieId,
        queryFn: async () => {
            const res = await getMovieDetail(movieId);
            const payload = res?.data ?? res ?? null;
            return payload ?? null; // 항상 정의된 값 반환
        },
        placeholderData: null,
        staleTime: 60_000,
        retry: 1,
    });

    return {
        data: data ?? null,
        loading: isLoading,
        err: isError ? '영화 상세 정보를 불러오지 못했어요.' : '',
    };
};
