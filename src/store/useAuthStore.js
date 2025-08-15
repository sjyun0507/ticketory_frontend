// src/store/useAuthStore.js
import { create } from "zustand";
import { saveToken, loadToken, clearToken, getUserFromToken, isTokenExpired } from "../utils/authHelper";

export const useAuthStore = create((set, get) => {
    const initToken = loadToken();
    let user = null;
    if (initToken && !isTokenExpired(initToken)) {
        user = getUserFromToken(initToken);
    } else {
        clearToken();
    }

    return {
        accessToken: initToken && !isTokenExpired(initToken) ? initToken : null,
        user, // { id, role, exp }

        login: (accessToken) => {
            saveToken(accessToken);
            set({
                accessToken,
                user: getUserFromToken(accessToken),
            });
        },

        logout: () => {
            clearToken();
            set({ accessToken: null, user: null });
        },
    };
});