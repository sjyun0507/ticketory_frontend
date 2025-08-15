export const saveToken = (accessToken) => {
    localStorage.setItem("accessToken", accessToken);
};

export const loadToken = () => localStorage.getItem("accessToken") || null;

export const clearToken = () => {
    localStorage.removeItem("accessToken");
};

export const parseJwt = (token) => {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
        return null;
    }
};

export const getUserFromToken = (token) => {
    const payload = parseJwt(token);
    if (!payload) return null;
    // 예: sub=회원ID, role=권한
    return {
        id: payload.sub ? String(payload.sub) : null,
        role: payload.role || "USER",
        exp: payload.exp ? Number(payload.exp) : null,
    };
};

export const isTokenExpired = (token) => {
    const { exp } = getUserFromToken(token) || {};
    if (!exp) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return exp <= nowSec;
};