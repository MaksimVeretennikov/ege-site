/* ===== PROGRESS API ===== */
// Работа с Supabase: user_state и practice_sessions.
// Вся бизнес-логика в app.js — этот модуль только читает/пишет.

import { supabase } from '../supabase.js';

/** Загрузить game state пользователя из user_state */
export async function getUserState(userId) {
    const { data, error } = await supabase
        .from('user_state')
        .select('state')
        .eq('user_id', userId)
        .maybeSingle();   // null вместо ошибки, если строки нет
    if (error) return { error: error.message };
    return { state: data?.state ?? null };
}

/** Сохранить game state в user_state (upsert по user_id) */
export async function saveUserState(userId, gameState) {
    const { error } = await supabase
        .from('user_state')
        .upsert({ user_id: userId, state: gameState }, { onConflict: 'user_id' });
    // updated_at обновляется триггером в БД, не передаём с клиента
    if (error) return { error: error.message };
    return { ok: true };
}

/** Записать одну сессию практики в practice_sessions */
export async function createPracticeSession(payload) {
    const { error } = await supabase
        .from('practice_sessions')
        .insert(payload);
    if (error) return { error: error.message };
    return { ok: true };
}

/** Загрузить последние сессии текущего пользователя */
export async function listMyPracticeSessions(limit = 200) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { sessions: [] };
    const { data, error } = await supabase
        .from('practice_sessions')
        .select('id, user_id, mode, status, started_at, finished_at, duration_sec, total_questions, correct_answers_count, accuracy, points_earned, xp_earned, items, meta, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return { sessions: [] };
    return { sessions: data || [] };
}
