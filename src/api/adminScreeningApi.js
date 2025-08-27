import api from "./axiosInstance";

export const fetchScreenings = () =>
    api.get("/admin/screenings", { params: { page: 0, size: 100 } });

export const createScreening = (payload) =>
    api.post("/admin/screenings", payload);

export const updateScreening = (id, payload) =>
    api.put(`/admin/screenings/${id}`, payload);

export const deleteScreening = (id) =>
    api.delete(`/admin/screenings/${id}`);