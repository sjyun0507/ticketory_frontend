import axiosInstance from "./axiosInstance.js";

// 상영 시간 조회 API
export const getScreenings = async (date, movieId) => {
    const { data } = await axiosInstance.get("/screenings", {
        params: { date, movieId },
    });
    const list = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.content)
            ? data.content
            : (Array.isArray(data) ? data : []);
    return list;
};