import { supabase } from '../supabase.js';

async function fetchProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return { error: error.message };
    return { profile: data };
}

export async function fetchMyProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: 'Нет активной сессии' };
    return fetchProfile(session.user.id);
}

export async function signUpTeacher(email, password, name, classCode) {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return { error: authError.message };
    if (!authData?.user) return { error: 'Не удалось создать пользователя' };

    const uid = authData.user.id;

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({ id: uid, name, role: 'teacher', class_code: classCode })
        .select()
        .single();
    if (profileError) return { error: profileError.message };

    const { error: classError } = await supabase
        .from('classes')
        .insert({ teacher_id: uid, code: classCode, title: classCode });
    if (classError) {
        if (classError.code === '23505' || classError.message?.toLowerCase().includes('duplicate') || classError.message?.toLowerCase().includes('unique')) {
            return { error: 'Этот код класса уже занят. Придумайте другой.' };
        }
        return { error: classError.message };
    }

    return { user: authData.user, profile: profileData };
}

export async function signUpStudent(email, password, name, classCode) {
    // TODO: заменить на supabase.rpc('find_class_by_code', ...) когда будет создана RPC-функция.
    // ⚠️ Пока используется прямой SELECT с anon key — требует временной policy:
    //    CREATE POLICY "classes_select_anon_TEMP" ON classes FOR SELECT USING (true);
    //    Это dev/MVP компромисс. В prod заменить на RPC без широкого SELECT.
    const { data: classData, error: classLookupError } = await supabase
        .from('classes')
        .select('id')
        .eq('code', classCode)
        .single();

    if (classLookupError || !classData) {
        return { error: 'Класс с таким кодом не найден. Проверьте код у учителя.' };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return { error: authError.message };
    if (!authData?.user) return { error: 'Не удалось создать пользователя' };

    const uid = authData.user.id;

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({ id: uid, name, role: 'student', class_code: classCode })
        .select()
        .single();
    if (profileError) {
        console.error('[signUpStudent] auth user создан, но profile не создан:', profileError.message);
        return { error: 'Аккаунт создан частично. Попробуйте войти или обратитесь к администратору.', partial: true };
    }

    const { error: memberError } = await supabase
        .from('class_members')
        .insert({ class_id: classData.id, user_id: uid });
    if (memberError) {
        console.error('[signUpStudent] profile создан, но class_members не создан:', memberError.message);
        return { error: 'Аккаунт создан, но не удалось присоединиться к классу. Попробуйте войти или обратитесь к учителю.', partial: true };
    }

    return { user: authData.user, profile: profileData };
}

export async function signIn(email, password) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!authData?.user) return { error: 'Пользователь не найден' };

    const profileRes = await fetchProfile(authData.user.id);
    if (profileRes.error) return { error: profileRes.error };

    return { user: authData.user, profile: profileRes.profile };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    return { ok: true };
}

export async function restoreSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return null;

    const profileRes = await fetchProfile(session.user.id);
    if (profileRes.error) return null;

    return { user: session.user, profile: profileRes.profile };
}
