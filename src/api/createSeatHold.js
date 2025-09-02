import axios from "axios";

export const createSeatHold = (payload) =>
    axios.post("/api/seats/hold", payload, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
    });