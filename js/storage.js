/* ===== STORAGE MODULE ===== */
// Единственное место, где знают про ключи и localStorage.
// Бизнес-логика живёт в app.js — этот модуль только читает/пишет.
// Game state хранится в Supabase (user_state). Здесь — только тема.

const KEYS = {
    THEME: 'ege_theme',
};

export const Storage = {
    // --- Theme ---
    getTheme()       { return localStorage.getItem(KEYS.THEME) || 'dark'; },
    saveTheme(t)     { localStorage.setItem(KEYS.THEME, t); },
};
