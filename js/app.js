import { Storage } from './storage.js';
import { signIn, signUpTeacher, signUpStudent, signOut, restoreSession } from './auth.js';
import { getUserState, saveUserState, createPracticeSession, listMyPracticeSessions } from './progress-api.js';

/* ===== MAIN APP ===== */
(() => {
'use strict';

let state = { user: null, session: null, timer: null, timerSec: 0, variant: null, variantTimer: null, variantStartTime: null, flashcard: null };

/* ===== BOOT ===== */
document.addEventListener('DOMContentLoaded', async () => {
    const _missingGlobals = [];
    if (typeof TASKS_META === 'undefined' || typeof QUESTIONS === 'undefined')
        _missingGlobals.push('data.js (TASKS_META / QUESTIONS)');
    if (typeof CharRenderer === 'undefined')
        _missingGlobals.push('character.js (CharRenderer)');
    if (typeof SoundEngine === 'undefined')
        _missingGlobals.push('sounds.js (SoundEngine)');
    if (_missingGlobals.length) {
        console.error('[App] CRITICAL: failed to load global scripts:', _missingGlobals.join(', '));
        console.error('[App] Tasks, tests and character will not render. Check /js/ 404s in the Network tab.');
        setTimeout(() => document.getElementById('preloader').classList.add('done'), 1500);
        initTheme(); initLogin();
        return;
    }

    setTimeout(() => document.getElementById('preloader').classList.add('done'), 1500);
    initTheme(); initLogin(); initNav(); initModals(); initPractice(); initShop(); initStats(); initFlashcards();
    const session = await restoreSession();
    if (session) {
        const { profile } = session;
        state.user = await loadAndBuildUser(profile);
        profile.role === 'teacher' ? showTeacher() : showApp();
    }
    initParticles();
});

/* ===== THEME ===== */
function initTheme() {
    const saved = Storage.getTheme();
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeBtn(saved);
    ['btn-theme', 'btn-theme-t'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            Storage.saveTheme(next);
            updateThemeBtn(next);
        });
    });
}

function updateThemeBtn(theme) {
    ['btn-theme', 'btn-theme-t'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    });
}

/* ===== PARTICLES ON LOGIN ===== */
function initParticles() {
    const c = document.getElementById('login-particles');
    if (!c) return;
    for (let i = 0; i < 40; i++) {
        const d = document.createElement('div');
        d.style.cssText = `position:absolute;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;
            background:rgba(139,92,246,${.1+Math.random()*.3});border-radius:50%;
            left:${Math.random()*100}%;top:${Math.random()*100}%;
            animation:floatP ${5+Math.random()*10}s linear infinite;opacity:0;`;
        c.appendChild(d);
    }
    const style = document.createElement('style');
    style.textContent = `@keyframes floatP{0%{transform:translateY(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-100vh);opacity:0}}`;
    document.head.appendChild(style);
}

/* ===== LOGIN ===== */
function initLogin() {
    let authMode = 'signin';
    let role = 'student';

    // Auth mode tabs (Войти / Создать аккаунт)
    document.querySelectorAll('#auth-mode-tabs .tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('#auth-mode-tabs .tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            authMode = t.dataset.mode;
            toggle('signup-fields', authMode === 'signup');
            $('btn-login').textContent = authMode === 'signup' ? 'Создать аккаунт' : 'Войти';
            $('login-error').classList.add('hidden');
        });
    });

    // Role tabs (только для регистрации)
    document.querySelectorAll('.login-card .tab[data-tab]').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.login-card .tab[data-tab]').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); role = t.dataset.tab;
        toggle('teacher-code-group', role === 'teacher');
        toggle('student-code-group', role === 'student');
        toggle('role-hint-teacher', role === 'teacher');
        toggle('role-hint-student', role === 'student');
    }));

    $('btn-gen-code').addEventListener('click', () => {
        const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let code = ''; for (let i = 0; i < 6; i++) code += c[Math.floor(Math.random() * c.length)];
        $('teacher-code').value = code;
    });

    $('btn-login').addEventListener('click', async () => {
        const email = $('login-email').value.trim();
        const password = $('login-password').value;
        const err = $('login-error');
        err.classList.add('hidden');
        if (!email) return showErr(err, 'Введите email!');
        if (!password) return showErr(err, 'Введите пароль!');

        if (authMode === 'signin') {
            const result = await signIn(email, password);
            if (result.error) return showErr(err, result.error);
            const { profile } = result;
            state.user = await loadAndBuildUser(profile);
            profile.role === 'teacher' ? showTeacher() : showApp();
        } else {
            const name = $('login-name').value.trim();
            if (!name) return showErr(err, 'Введите имя!');
            const classCode = role === 'teacher' ? $('teacher-code').value.trim() : $('student-code').value.trim();
            if (!classCode) return showErr(err, role === 'teacher' ? 'Создайте код класса!' : 'Введите код класса!');
            const result = role === 'teacher'
                ? await signUpTeacher(email, password, name, classCode)
                : await signUpStudent(email, password, name, classCode);
            if (result.error) return showErr(err, result.error);
            const { profile } = result;
            const base = newUser();
            const saveRes = await saveUserState(profile.id, base);
            if (saveRes.error) return showErr(err, 'Аккаунт создан, но не удалось сохранить прогресс: ' + saveRes.error);
            state.user = { ...base, ...profile, classCode: profile.class_code };
            profile.role === 'teacher' ? showTeacher() : showApp();
        }
    });

    document.querySelectorAll('.login-card input').forEach(i => i.addEventListener('keypress', e => { if (e.key === 'Enter') $('btn-login').click(); }));
}

function newUser() {
    return {
        points: 0, totalPointsEarned: 0, xp: 0, level: 1,
        streak: 0, bestStreak: 0, totalSolved: 0, totalCorrect: 0, perfectSessions: 0,
        uniqueTasksTried: 0, tasksTried: [], dailyQuestsCompleted: 0, fastAnswers: 0, shopPurchases: 0,
        ownedItems: ['cl_default','cl_jeans','acc_none','hair_default','bg_default'],
        equipped: { top: 'cl_default', bottom: 'cl_jeans', accessory: 'acc_none', hair: 'hair_default', bg: 'bg_default' },
        taskStats: {}, achievements: [],
        dailyQuest: null, dailyQuestDate: null, dailyQuestProgress: 0, dailyCompleted: false,
        loginStreak: 0, lastLoginDate: null, loginDays: [],
        createdAt: new Date().toISOString()
    };
}

/* ===== LOAD & BUILD USER ===== */
async function loadAndBuildUser(profile) {
    const { state: remoteState, error } = await getUserState(profile.id);
    if (error) console.warn('[loadAndBuildUser] getUserState error:', error);
    const gameState = remoteState || newUser();
    if (!remoteState) await saveUserState(profile.id, gameState); // первый вход
    return { ...newUser(), ...gameState, ...profile, classCode: profile.class_code };
}

/* ===== SHOW APP ===== */
function showApp() {
    hide('screen-login'); hide('screen-teacher'); show('screen-app');
    processLoginStreak();
    updateTopbar(); updateDash(); renderTasks();
    CharRenderer.init($('char-canvas'));
    updateCharacter(); CharRenderer.startLoop();
    checkDailyQuest();
}

function showTeacher() {
    hide('screen-login'); hide('screen-app'); show('screen-teacher');
    $('t-name').textContent = state.user.name;
    $('t-code').textContent = state.user.classCode;
    renderTeacher();
}

/* ===== LOGIN STREAK ===== */
function processLoginStreak() {
    const u = state.user;
    const today = todayStr();
    if (u.lastLoginDate === today) { updateStreakUI(); return; } // already logged in today

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    if (u.lastLoginDate === yStr) {
        u.loginStreak++;
    } else if (u.lastLoginDate !== today) {
        u.loginStreak = 1;
    }
    u.lastLoginDate = today;
    if (!u.loginDays) u.loginDays = [];
    if (!u.loginDays.includes(today)) u.loginDays.push(today);
    if (u.loginDays.length > 30) u.loginDays = u.loginDays.slice(-30);

    // Streak reward
    const reward = Math.min(u.loginStreak * 5, 50);
    u.points += reward; u.totalPointsEarned += reward;
    save();

    // Show streak modal
    setTimeout(() => {
        $('streak-modal-title').textContent = `🔥 ${u.loginStreak} ${pluralDays(u.loginStreak)} подряд!`;
        $('streak-modal-text').textContent = u.loginStreak === 1 ? 'Добро пожаловать! Заходите каждый день для бонусов.' : 'Продолжайте заходить каждый день!';
        $('streak-modal-bonus').textContent = `+${reward} ⚡`;
        $('modal-streak').classList.remove('hidden');
    }, 600);

    updateStreakUI();
    checkAchievements();
}

function updateStreakUI() {
    const u = state.user;
    $('login-streak').textContent = u.loginStreak || 0;
    const bonus = Math.min((u.loginStreak || 0) * 5, 50);
    $('streak-bonus').textContent = `+${bonus} ⚡/день`;

    // Dots for last 7 days
    const dots = $('streak-dots');
    dots.innerHTML = '';
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const active = (u.loginDays || []).includes(ds);
        const isToday = i === 0;
        const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
        const dot = document.createElement('div');
        dot.className = `streak-dot${active ? ' active' : ''}${isToday ? ' today' : ''}`;
        dot.textContent = dayNames[d.getDay()];
        dots.appendChild(dot);
    }
}

function pluralDays(n) {
    const m = n % 10, c = n % 100;
    if (c >= 11 && c <= 19) return 'дней';
    if (m === 1) return 'день';
    if (m >= 2 && m <= 4) return 'дня';
    return 'дней';
}

/* ===== NAV ===== */
function initNav() {
    document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => {
        nav(b.dataset.view);
    }));
    $('btn-logout').addEventListener('click', logout);
    $('btn-t-logout').addEventListener('click', logout);
    $('btn-t-back').addEventListener('click', () => { $('t-detail').classList.add('hidden'); document.querySelector('.t-students').classList.remove('hidden'); });
    $('btn-random').addEventListener('click', () => {
        const t = TASKS_META[Math.floor(Math.random() * TASKS_META.length)];
        openConfig(t.id);
    });
    $('btn-weak').addEventListener('click', () => {
        const w = weakest(); openConfig(w || TASKS_META[0].id);
    });
    $('btn-compile').addEventListener('click', buildVariant);
    $('btn-full-variant').addEventListener('click', buildFullVariant);
    $('btn-variant-back').addEventListener('click', () => { clearVariantTimer(); nav('test'); });
    $('btn-finish-variant').addEventListener('click', finishVariant);
}

function nav(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const el = $(`view-${view}`); if (el) el.classList.add('active');
    const nb = document.querySelector(`.nav-btn[data-view="${view}"]`); if (nb) nb.classList.add('active');
    if (view === 'tasks') renderTasks();
    if (view === 'dashboard') { updateDash(); updateCharacter(); }
    if (view === 'stats') renderStats();
    if (view === 'shop') { syncShopTabs(); renderShop(currentShopCat); }
    if (view === 'achievements') renderAch();
    if (view === 'test') renderTest();
    if (view === 'variant') renderVariant();
    if (view === 'flashcards') showFcHub();
}

async function logout() {
    await signOut(); state.user = null; clearTimer();
    hide('screen-app'); hide('screen-teacher'); show('screen-login');
}

/* ===== TOPBAR ===== */
function updateTopbar() {
    if (!state.user) return;
    $('tb-points').textContent = state.user.points;
    $('tb-level').textContent = state.user.level;
    $('tb-streak').textContent = state.user.streak;
    $('tb-name').textContent = state.user.name;
}

/* ===== DASHBOARD ===== */
function updateDash() {
    const u = state.user; if (!u) return;
    $('char-name-display').textContent = u.name;
    $('dash-level').textContent = u.level;
    const xpN = xpForLevel(u.level);
    $('xp-fill').style.width = Math.min(100, (u.xp / xpN) * 100) + '%';
    $('xp-cur').textContent = u.xp; $('xp-max').textContent = xpN;
}

function updateCharacter() {
    const u = state.user; if (!u) return;
    const eq = u.equipped || {};
    const topItem = findItem(eq.top); const btmItem = findItem(eq.bottom);
    const hairItem = findItem(eq.hair); const bgItem = findItem(eq.bg);
    CharRenderer.setEquipped({
        top: topItem?.color || '#6366f1', bottom: btmItem?.color || '#3b82f6',
        hair: hairItem?.color || '#44403c', accessory: eq.accessory || '',
        bg: eq.bg || 'default'
    });
}

/* ===== DAILY QUEST ===== */
function checkDailyQuest() {
    const u = state.user; const today = todayStr();
    if (u.dailyQuestDate !== today) {
        u.dailyQuest = DAILY_QUESTS[Math.floor(Math.random() * DAILY_QUESTS.length)];
        u.dailyQuestDate = today; u.dailyQuestProgress = 0; u.dailyCompleted = false; save();
    }
    updateDailyUI();
}

function updateDailyUI() {
    const u = state.user; if (!u.dailyQuest) return;
    $('daily-text').textContent = u.dailyQuest.text;
    $('daily-reward-val').textContent = `+${u.dailyQuest.reward} ⚡`;
    const p = Math.min(u.dailyQuestProgress, u.dailyQuest.target);
    $('daily-fill').style.width = (p / u.dailyQuest.target * 100) + '%';
    $('daily-nums').textContent = `${p}/${u.dailyQuest.target}`;
}

function dailyProgress(type, val, taskId) {
    const u = state.user; if (!u.dailyQuest) return;
    const q = u.dailyQuest;
    if (q.type === 'solve_any' && type === 'solve') u.dailyQuestProgress++;
    else if (q.type === 'streak' && type === 'streak') u.dailyQuestProgress = Math.max(u.dailyQuestProgress, val);
    else if (q.type === 'solve_task' && type === 'solve' && q.taskId === taskId) u.dailyQuestProgress++;
    else if (q.type === 'accuracy' && type === 'accuracy') u.dailyQuestProgress = Math.max(u.dailyQuestProgress, val);
    if (u.dailyQuestProgress >= q.target && !u.dailyCompleted) {
        u.dailyCompleted = true; u.points += q.reward; u.totalPointsEarned += q.reward;
        u.dailyQuestsCompleted++; floatPts(innerWidth / 2, innerHeight / 2, q.reward);
    }
    updateDailyUI(); save();
}

/* ===== TASKS ===== */
function renderTasks() {
    const g = $('tasks-grid'); g.innerHTML = '';
    TASKS_META.forEach(t => {
        const s = state.user?.taskStats?.[t.id] || { solved: 0, correct: 0 };
        const pct = s.solved > 0 ? Math.round(s.correct / s.solved * 100) : 0;
        const accClr = s.solved > 0
            ? (pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)')
            : 'var(--text-muted)';
        const accText = s.solved > 0 ? pct + '%' : '—';
        const d = document.createElement('div'); d.className = 'task-card';
        d.innerHTML = `<div class="task-num">${t.id}</div>
            <div class="task-title">${t.title}</div>
            <div class="task-progress">
                <div class="task-progress-top">
                    <span class="task-progress-label">${s.correct} / ${s.solved}</span>
                    <span class="acc-val" style="color:${accClr}">${accText}</span>
                </div>
                <div class="acc-track"><div class="acc-fill" style="width:${pct}%;background:${accClr}"></div></div>
            </div>`;
        d.addEventListener('click', () => openConfig(t.id));
        g.appendChild(d);
    });
}

/* ===== CONFIG MODAL ===== */
let cfgTaskId = null, cfgQty = 10;
let testQty = {}; // { taskId: qty } — состояние конструктора варианта
function initModals() {
    $('modal-config').querySelector('.modal-bg').addEventListener('click', closeConfig);
    $('btn-cancel').addEventListener('click', closeConfig);
    $('btn-start').addEventListener('click', startSession);
    document.querySelectorAll('.pill').forEach(p => p.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active'); cfgQty = +p.dataset.q;
    }));
    $('btn-close-lvl').addEventListener('click', () => $('modal-lvl').classList.add('hidden'));
    $('modal-lvl').querySelector('.modal-bg').addEventListener('click', () => $('modal-lvl').classList.add('hidden'));
    $('btn-close-streak').addEventListener('click', () => $('modal-streak').classList.add('hidden'));
    $('modal-streak').querySelector('.modal-bg').addEventListener('click', () => $('modal-streak').classList.add('hidden'));
}

function openConfig(id) {
    cfgTaskId = id; const t = TASKS_META.find(x => x.id === id); if (!t) return;
    $('mc-title').textContent = `Задание ${t.id}`;
    $('mc-desc').textContent = t.desc;
    $('mc-pts').textContent = `+${t.pts} ⚡`;
    $('modal-config').classList.remove('hidden');
}
function closeConfig() { $('modal-config').classList.add('hidden'); cfgTaskId = null; }

/* ===== PRACTICE ===== */
function initPractice() {
    $('btn-check').addEventListener('click', checkAns);
    $('answer-input').addEventListener('keypress', e => { if (e.key === 'Enter') checkAns(); });
    $('btn-next').addEventListener('click', nextQ);
    $('btn-back').addEventListener('click', () => {
        if (state.session && !confirm('Прогресс будет потерян. Выйти?')) return;
        endSession(true);
    });
    $('btn-retry').addEventListener('click', () => { if (state.session) startWith(state.session.taskId, state.session.total, state.session.sessionType); });
    $('btn-go-tasks').addEventListener('click', () => nav('tasks'));
    $('btn-go-home').addEventListener('click', () => nav('dashboard'));
}

function startSession() {
    if (!cfgTaskId) return;
    const taskId = cfgTaskId;
    const qty = cfgQty;
    closeConfig();
    startWith(taskId, qty);
}

function startWith(taskId, qty, sessionType = 'task') {
    const t = TASKS_META.find(x => x.id === taskId);
    const qs = QUESTIONS[taskId];
    if (!t || !qs || !qs.length) return;
    let sel = [];
    while (sel.length < qty) sel = sel.concat([...qs].sort(() => Math.random() - .5));
    sel = sel.slice(0, qty);
    state.session = { taskId, task: t, questions: sel, idx: 0, total: qty, correct: 0, wrong: 0, pts: 0, xpE: 0, start: Date.now(), qStart: Date.now(), answers: [], sessionType };
    nav('practice'); $('pract-title').textContent = `Задание ${t.id}: ${t.title}`;
    startTimer(); showQ();
}

function showQ() {
    const s = state.session; if (!s || s.idx >= s.total) { endSession(); return; }
    const q = s.questions[s.idx];
    $('pract-progress').textContent = `${s.idx + 1} / ${s.total}`;
    $('pract-bar-fill').style.width = (s.idx / s.total * 100) + '%';
    $('pract-feedback').classList.add('hidden');
    $('pract-feedback').classList.remove('correct', 'wrong');

    let displayText = q.text;
    if (q.text_id) {
        const textEntry = TEXTS.find(t => t.id === q.text_id);
        if (textEntry) displayText = textEntry.text + '\n\n' + q.text;
    }

    $('pract-question').innerHTML = `<div class="q-text">${displayText.replace(/\n/g, '<br>')}</div>${q.hint ? `<div class="q-hint">💡 ${q.hint}</div>` : ''}`;
    if (q.type === 'multi' && q.options) {
        $('pract-input-area').classList.add('hidden');
        $('pract-options').classList.remove('hidden');
        $('pract-options').innerHTML = '';
        state.session.selected = new Set();
        q.options.forEach((o, i) => {
            const b = document.createElement('button'); b.className = 'opt-btn'; b.textContent = `${i + 1}) ${o}`;
            b.addEventListener('click', () => toggleOpt(i, b));
            $('pract-options').appendChild(b);
        });
        // Add confirm button for multi-select
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-glow opt-confirm';
        confirmBtn.textContent = 'Проверить выбор';
        confirmBtn.addEventListener('click', confirmMulti);
        $('pract-options').appendChild(confirmBtn);
    } else {
        $('pract-input-area').classList.remove('hidden');
        $('pract-options').classList.add('hidden');
        $('answer-input').value = ''; $('answer-input').disabled = false; $('answer-input').focus();
        $('btn-check').disabled = false;
    }
    s.qStart = Date.now();
}

function toggleOpt(i, btn) {
    const sel = state.session.selected;
    if (sel.has(i)) { sel.delete(i); btn.classList.remove('selected'); }
    else { sel.add(i); btn.classList.add('selected'); }
}



function confirmMulti() {
    const s = state.session; const q = s.questions[s.idx];
    const sel = s.selected;
    if (!sel || sel.size === 0) return;
    const userAnswer = [...sel].sort((a, b) => a - b).map(i => i + 1).join('');
    const correctAnswer = String(q.answer).trim();
    const isCorrect = Array.isArray(q.answer)
        ? q.answer.map(a => String(a).trim()).includes(userAnswer)
        : userAnswer === correctAnswer;
    const btns = $('pract-options').querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);
    const confirmBtn = $('pract-options').querySelector('.opt-confirm');
    if (confirmBtn) confirmBtn.disabled = true;
    sel.forEach(idx => {
        const isC = q.correct && q.correct.includes(idx);
        btns[idx]?.classList.add(isC ? 'correct' : 'wrong');
    });
    if (q.correct) q.correct.forEach(ci => btns[ci]?.classList.add('correct'));
    processAns(isCorrect, q);
}


function checkAns() {
    const s = state.session; if (!s) return;
    const q = s.questions[s.idx];
    const val = $('answer-input').value.trim().toLowerCase();
    if (!val) return;
    const isCorrect = Array.isArray(q.answer)
        ? q.answer.map(a => String(a).trim().toLowerCase()).includes(val)
        : val === String(q.answer).trim().toLowerCase();
    $('answer-input').disabled = true; $('btn-check').disabled = true;
    processAns(isCorrect, q);
}


function processAns(isCorrect, q) {
    const s = state.session; const u = state.user;
    const t = (Date.now() - s.qStart) / 1000;
    const correctAnswerDisplay = Array.isArray(q.answer) ? q.answer.join(' / ') : String(q.answer);
    if (isCorrect) {
        SoundEngine.correct(); u.streak++;
        if (u.streak > u.bestStreak) u.bestStreak = u.streak;
        s.correct++;
        const base = s.task.pts;
        const streakB = Math.min(u.streak - 1, 5) * 2;
        const speedB = t < 5 ? 5 : t < 10 ? 2 : 0;
        const total = base + streakB + speedB;
        s.pts += total; s.xpE += Math.round(total * .8);
        if (t < 5) u.fastAnswers++;
        showFB(true, q, total); floatPts(innerWidth / 2, innerHeight / 2 - 50, total);
        if (u.streak >= 3 && u.streak % 3 === 0) { showCombo(u.streak); SoundEngine.combo(); }
        dailyProgress('solve', 1, s.taskId); dailyProgress('streak', u.streak, s.taskId);
    } else {
        SoundEngine.wrong(); u.streak = 0; s.wrong++;
        showFB(false, q, 0);
    }
    const rawInput = $('answer-input').value.trim()
        || [...(s.selected||[])].sort((a,b)=>a-b).map(i=>i+1).join('')
        || '—';
    s.answers.push(normalizeSessionItem({
        idx: s.idx,
        taskId: s.taskId,
        taskTitle: s.task.title,
        q,
        userAnswer: rawInput,
        correctAnswer: correctAnswerDisplay,
        correct: isCorrect,
    }));
    $('tb-streak').textContent = u.streak;
}



function showFB(ok, q, pts) {
    const fb = $('pract-feedback');
    fb.classList.remove('hidden', 'correct', 'wrong');
    fb.classList.add(ok ? 'correct' : 'wrong');

    fb.querySelector('.fb-icon').textContent = ok ? '✅' : '❌';
    fb.querySelector('.fb-text').textContent = ok ? `Верно! +${pts} ⚡` : 'Неверно';

    const explainEl = fb.querySelector('.fb-explain');
    explainEl.innerHTML = (q.explanation || '').replace(/\n/g, '<br>');
}

function showCombo(n) {
    const el = $('combo-popup'); el.textContent = `🔥 x${n}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 800);
}

function nextQ() {
    state.session.idx++;
    $('answer-input').disabled = false; $('btn-check').disabled = false;
    state.session.idx >= state.session.total ? endSession() : showQ();
}

async function endSession(cancel) {
    clearTimer();
    if (cancel) { state.session = null; nav('tasks'); return; }
    const s = state.session; const u = state.user;
    u.points += s.pts; u.totalPointsEarned += s.pts; u.xp += s.xpE;
    u.totalSolved += s.total; u.totalCorrect += s.correct;
    if (!u.taskStats[s.taskId]) u.taskStats[s.taskId] = { solved: 0, correct: 0 };
    u.taskStats[s.taskId].solved += s.total; u.taskStats[s.taskId].correct += s.correct;
    if (!u.tasksTried.includes(s.taskId)) { u.tasksTried.push(s.taskId); u.uniqueTasksTried = u.tasksTried.length; }
    const acc = s.total > 0 ? s.correct / s.total * 100 : 0;
    if (s.correct === s.total && s.total >= 5) u.perfectSessions++;
    dailyProgress('accuracy', acc, s.taskId);
    // Запись сессии в Supabase (fire-and-forget)
    const now = new Date().toISOString();
    createPracticeSession({
        user_id: u.id,
        class_id: null,
        mode: s.sessionType || 'task',
        status: 'completed',
        started_at: new Date(s.start).toISOString(),
        finished_at: now,
        duration_sec: Math.floor((Date.now() - s.start) / 1000),
        total_questions: s.total,
        correct_answers_count: s.correct,
        accuracy: Math.round(acc),
        points_earned: s.pts,
        xp_earned: s.xpE,
        items: s.answers,
        meta: {
            schema_version: 2,
            session_type: 'task',
            source: 'practice',
            task_numbers: [s.taskId],
            label: `Задание ${s.taskId} · ${s.task.title}`,
        },
    });
    let lvlUp = false, newLvl = u.level;
    while (u.xp >= xpForLevel(u.level)) { u.xp -= xpForLevel(u.level); u.level++; lvlUp = true; newLvl = u.level; }
    save(); showResults(s, acc, lvlUp, newLvl);
    const newAch = checkAchievements();
    if (lvlUp) setTimeout(() => { SoundEngine.levelUp(); $('lvl-num').textContent = newLvl; $('lvl-reward').textContent = `Бонус: +${newLvl * 20} ⚡`; u.points += newLvl * 20; u.totalPointsEarned += newLvl * 20; save(); updateTopbar(); $('modal-lvl').classList.remove('hidden'); }, 800);
    if (newAch.length) setTimeout(() => SoundEngine.achievement(), lvlUp ? 2200 : 800);
}

function showResults(s, acc, lvlUp, newLvl) {
    nav('results');
    let em, ti;
    if (acc === 100) { em = '🏆'; ti = 'Безупречно!'; }
    else if (acc >= 80) { em = '🎉'; ti = 'Отлично!'; }
    else if (acc >= 60) { em = '👍'; ti = 'Хорошо!'; }
    else if (acc >= 40) { em = '💪'; ti = 'Можно лучше!'; }
    else { em = '📚'; ti = 'Продолжай работать!'; }
    $('res-emoji').textContent = em; $('res-title').textContent = ti;
    $('res-correct').textContent = s.correct; $('res-total').textContent = s.total;
    $('res-pct').textContent = Math.round(acc) + '%'; $('res-pts').textContent = s.pts;
    $('res-xp').textContent = s.xpE;
    if (lvlUp) { $('res-levelup').classList.remove('hidden'); $('res-newlvl').textContent = newLvl; }
    else $('res-levelup').classList.add('hidden');
}

/* ===== TIMER ===== */
function startTimer() {
    state.timerSec = 0; updTimer();
    state.timer = setInterval(() => { state.timerSec++; updTimer(); }, 1000);
}
function clearTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
function updTimer() {
    const m = String(Math.floor(state.timerSec / 60)).padStart(2, '0');
    const s = String(state.timerSec % 60).padStart(2, '0');
    $('timer-val').textContent = `${m}:${s}`;
}

/* ===== FLOATING PTS ===== */
function floatPts(x, y, amt) {
    const el = document.createElement('div');
    el.className = `fpt ${amt >= 0 ? 'pos' : 'neg'}`;
    el.textContent = `+${amt} ⚡`; el.style.left = x + 'px'; el.style.top = y + 'px';
    $('float-pts').appendChild(el); setTimeout(() => el.remove(), 1100);
}

/* ===== ACHIEVEMENTS ===== */
function checkAchievements() {
    const u = state.user; const unlocked = [];
    ACHIEVEMENTS.forEach(a => {
        if (!u.achievements.includes(a.id) && a.check(u)) {
            u.achievements.push(a.id); u.points += a.reward; u.totalPointsEarned += a.reward; unlocked.push(a);
        }
    });
    if (unlocked.length) { save(); updateTopbar(); }
    return unlocked;
}

function renderAch() {
    const g = $('ach-grid'); g.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
        const ok = state.user.achievements.includes(a.id);
        const c = document.createElement('div'); c.className = `ach-card ${ok ? 'unlocked' : 'locked'}`;
        c.innerHTML = `<div class="ach-icon">${ok ? a.icon : '🔒'}</div><div class="ach-info"><h4>${a.name}</h4><p>${a.desc}</p><div class="ach-reward">+${a.reward} ⚡</div></div>`;
        g.appendChild(c);
    });
}

/* ===== SHOP ===== */
let currentShopCat = 'clothing';
function initShop() {
    document.querySelectorAll('.stab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.stab').forEach(x => x.classList.remove('active'));
        t.classList.add('active'); currentShopCat = t.dataset.cat; renderShop(currentShopCat);
    }));
}

function syncShopTabs() {
    document.querySelectorAll('.stab').forEach(x => x.classList.remove('active'));
    const active = document.querySelector(`.stab[data-cat="${currentShopCat}"]`);
    if (active) active.classList.add('active');
}

function renderShop(cat) {
    if (!cat) cat = currentShopCat;
    currentShopCat = cat;
    const u = state.user; $('shop-bal').textContent = u.points;
    const items = SHOP_DATA[cat] || []; const g = $('shop-grid'); g.innerHTML = '';
    items.forEach(item => {
        const owned = u.ownedItems.includes(item.id);
        const eqKey = item.type === 'top' || item.type === 'bottom' ? item.type : item.type === 'hair' ? 'hair' : item.type === 'bg' ? 'bg' : 'accessory';
        const equipped = u.equipped[eqKey] === item.id;
        const d = document.createElement('div');
        d.className = `shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`;
        const isBg = item.type === 'bg';
        const equipLabel = isBg ? 'Выбрать' : 'Надеть';
        const equippedLabel = isBg ? 'Активен' : 'Надето';
        let btn = '';
        if (!owned) btn = `<button class="si-btn buy" data-id="${item.id}" data-cat="${cat}" ${u.points < item.price ? 'disabled' : ''}>Купить</button>`;
        else if (equipped) btn = `<button class="si-btn active-equip" disabled>${equippedLabel}</button>`;
        else btn = `<button class="si-btn equip" data-id="${item.id}" data-cat="${cat}">${equipLabel}</button>`;
        d.innerHTML = `<div class="si-icon">${item.icon}</div><div class="si-name">${item.name}</div>${!owned ? `<div class="si-price">${item.price} ⚡</div>` : '<div class="si-owned">✓</div>'}${btn}`;
        g.appendChild(d);
    });
    g.querySelectorAll('.si-btn.buy').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); buyItem(b.dataset.id, b.dataset.cat); }));
    g.querySelectorAll('.si-btn.equip').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); equipItem(b.dataset.id, b.dataset.cat); }));
}

function buyItem(id, cat) {
    const u = state.user; const item = SHOP_DATA[cat]?.find(i => i.id === id); if (!item || u.points < item.price) return;
    u.points -= item.price; u.ownedItems.push(id); u.shopPurchases++;
    SoundEngine.purchase(); save(); updateTopbar(); renderShop(cat); checkAchievements();
}

function equipItem(id, cat) {
    const u = state.user; const item = SHOP_DATA[cat]?.find(i => i.id === id); if (!item) return;
    const key = item.type === 'top' || item.type === 'bottom' ? item.type : item.type === 'hair' ? 'hair' : item.type === 'bg' ? 'bg' : 'accessory';
    u.equipped[key] = id; save(); renderShop(cat); updateCharacter();
}

/* ===== STATS ===== */
function initStats() {
    // period-btn удалены; рендер запускается из nav('stats')
}

async function renderStats() {
    const u = state.user; if (!u) return;
    const { sessions } = await listMyPracticeSessions(200);
    const mapped = sessions.map(s => ({
        id: s.id,
        mode: s.mode || 'task',
        meta: s.meta || {},
        date: s.created_at,
        total: s.total_questions,
        correct: s.correct_answers_count,
        accuracy: s.accuracy,
        pointsEarned: s.points_earned,
        xpEarned: s.xp_earned,
        duration: s.duration_sec,
        items: s.items || [],
        taskId: s.meta?.task_numbers?.[0] ?? null,
        startedAt: s.started_at,
        finishedAt: s.finished_at,
    }));
    window.__taskStatsModel = buildTaskStatsModel(mapped);
    renderNewStats(window.__taskStatsModel);
}

function drawChart(id, sessions, period) {
    const canvas = $(id); const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth - 48; canvas.width = W; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const dateMap = {};
    sessions.forEach(s => { const d = s.date.split('T')[0]; if (!dateMap[d]) dateMap[d] = 0; dateMap[d] += s.total; });
    const days = period === 'week' ? 7 : period === 'month' ? 30 : Math.min(60, Object.keys(dateMap).length || 7);
    const dates = []; for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dates.push(d.toISOString().split('T')[0]); }
    const vals = dates.map(d => dateMap[d] || 0); const max = Math.max(...vals, 1);
    const pad = { t: 15, r: 15, b: 30, l: 40 }; const cW = W - pad.l - pad.r; const cH = H - pad.t - pad.b;
    ctx.strokeStyle = 'rgba(139,92,246,.1)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.t + cH / 4 * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillStyle = '#64748b'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - max / 4 * i), pad.l - 6, y + 3);
    }
    const bw = Math.max(3, cW / dates.length - 3);
    vals.forEach((v, i) => {
        const x = pad.l + i / dates.length * cW + bw / 2;
        const bh = v / max * cH; const y = pad.t + cH - bh;
        const gr = ctx.createLinearGradient(x, y, x, pad.t + cH);
        gr.addColorStop(0, '#8b5cf6'); gr.addColorStop(1, '#6366f1');
        ctx.fillStyle = gr;
        ctx.beginPath();
        const r = Math.min(3, bw / 2);
        ctx.moveTo(x, pad.t + cH); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + bw - r, y); ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
        ctx.lineTo(x + bw, pad.t + cH); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = '#64748b'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(dates.length / 7));
    dates.forEach((d, i) => { if (i % step === 0 || i === dates.length - 1) { const x = pad.l + i / dates.length * cW + bw; const p = d.split('-'); ctx.fillText(`${p[2]}.${p[1]}`, x, H - 6); } });
}

function renderTaskStats(sessions) {
    const c = $('stats-bytask'); c.innerHTML = '';
    const agg = aggregateStatsByTask(sessions);
    TASKS_META.forEach(t => {
        const a = agg[t.id]; if (!a) return;
        const acc = a.solved > 0 ? Math.round(a.correct / a.solved * 100) : 0;
        const clr = acc >= 80 ? 'var(--green)' : acc >= 50 ? 'var(--amber)' : 'var(--red)';
        c.innerHTML += `<div class="st-row"><div class="st-num">${t.id}</div><div class="st-info"><div class="st-name">${t.title}</div><div class="st-detail">Решено: ${a.solved} · Верно: ${a.correct}</div></div><div class="st-acc" style="color:${clr}">${acc}%</div></div>`;
    });
    if (!c.innerHTML) c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Нет данных</p>';
}

function renderSessions(sessions) {
    const c = $('stats-sessions'); c.innerHTML = '';
    const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
    sorted.forEach((s, i) => {
        const d = new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const cls = s.accuracy >= 80 ? 'good' : s.accuracy >= 50 ? 'ok' : 'bad';
        const hasAnswers = s.items && s.items.length > 0;
        const sessLabel = buildSessionLabel(s);
        const taskNums = s.meta?.task_numbers;
        const subLabel = (s.mode === 'mixed' && taskNums?.length) ? taskNums.join(', ') : '';
        const row = document.createElement('div');
        row.className = `sess-row ${hasAnswers ? 'clickable' : ''}`;
        row.innerHTML = `<div><div class="sess-task">${sessLabel}</div><div class="sess-date">${subLabel ? subLabel + ' · ' : ''}${d}</div></div><div><div class="sess-result ${cls}">${s.correct}/${s.total} (${s.accuracy}%)</div><div class="sess-date">${hasAnswers ? '👁 подробнее' : `+${s.pointsEarned} ⚡`}</div></div>`;
        if (hasAnswers) row.addEventListener('click', () => showSessionDetail(s));
        c.appendChild(row);
    });
    if (!sorted.length) c.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Нет сессий</p>';
}

function showSessionDetail(s) {
    const d = new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const dur = s.duration ? `${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,'0')}` : '—';
    const label = buildSessionLabel(s);
    let html = `<div class="sd-head"><button class="btn btn-sm btn-ghost" id="btn-sd-close">← Назад</button><h3>${label}</h3></div>`;
    html += `<div class="sd-summary"><span>${d}</span><span>${s.correct}/${s.total} верно (${s.accuracy}%)</span><span>⏱ ${dur}</span><span>+${s.pointsEarned} ⚡</span></div>`;
    html += '<div class="sd-answers">';
    (s.items || []).forEach((a, i) => {
        const norm = normalizeLegacyItem(a, i);
        const taskLabel = norm.taskId
            ? `<div class="sd-task-label">Задание ${norm.taskId}${norm.taskTitle ? ' · ' + norm.taskTitle : ''}</div>`
            : '';
        const qTextHtml = norm.qText ? `<div class="sd-q-text">${norm.qText.replace(/\n/g, '<br>')}</div>` : '';
        html += `<div class="sd-answer ${norm.correct ? 'sd-correct' : 'sd-wrong'}">
            <div class="sd-q-num">${i + 1}</div>
            <div class="sd-q-body">
                ${taskLabel}
                ${qTextHtml}
                <div class="sd-q-result">
                    ${norm.correct ? '✅' : '❌'}
                    <span>Ваш ответ: <strong>${norm.userAnswer}</strong></span>
                    ${!norm.correct ? `<span class="sd-right-ans">Верно: <strong>${norm.correctAnswer}</strong></span>` : ''}
                </div>
                ${norm.explanation && !norm.correct ? `<div class="sd-explain">${norm.explanation.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
        </div>`;
    });
    html += '</div>';
    $('stats-sessions').innerHTML = html;
    $('btn-sd-close').addEventListener('click', () => renderStats());
}

/* ===== TEACHER ===== */
function renderTeacher() {
    const students = []; // TODO: перенести на Supabase (следующий этап)
    $('ts-count').textContent = students.length;
    const today = todayStr(); let todayS = 0, totAcc = 0, accN = 0;
    students.forEach(s => { todayS += (s.sessions || []).filter(x => x.date.startsWith(today)).length; if (s.totalSolved > 0) { totAcc += s.totalCorrect / s.totalSolved * 100; accN++; } });
    $('ts-today').textContent = todayS;
    $('ts-acc').textContent = accN > 0 ? Math.round(totAcc / accN) + '%' : '—';
    const list = $('t-students-list'); list.innerHTML = '';
    if (!students.length) { list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">Пока нет учеников. Поделитесь кодом класса!</p>'; return; }
    students.sort((a, b) => b.totalPointsEarned - a.totalPointsEarned);
    students.forEach((s, i) => {
        const acc = s.totalSolved > 0 ? Math.round(s.totalCorrect / s.totalSolved * 100) : 0;
        const r = document.createElement('div'); r.className = 'stu-row';
        r.innerHTML = `<div class="stu-info"><div class="stu-avatar">👤</div><div><div class="stu-name">${i + 1}. ${s.name}</div><div class="stu-level">Ур. ${s.level} · ${s.totalPointsEarned} ⚡</div></div></div><div class="stu-stats"><div class="stu-stat"><div class="stu-stat-val">${s.totalSolved}</div><div class="stu-stat-lbl">Решено</div></div><div class="stu-stat"><div class="stu-stat-val">${acc}%</div><div class="stu-stat-lbl">Точность</div></div><div class="stu-stat"><div class="stu-stat-val">${(s.sessions || []).length}</div><div class="stu-stat-lbl">Сессий</div></div></div>`;
        r.addEventListener('click', () => showDetail(s));
        list.appendChild(r);
    });
}

function showDetail(s) {
    document.querySelector('.t-students').classList.add('hidden');
    $('t-detail').classList.remove('hidden');
    $('td-name').textContent = `${s.name} · Ур. ${s.level}`;
    const acc = s.totalSolved > 0 ? Math.round(s.totalCorrect / s.totalSolved * 100) : 0;
    $('td-stats').innerHTML = `<div class="so-item"><div class="so-val">${s.totalSolved}</div><div class="so-lbl">Решено</div></div><div class="so-item"><div class="so-val">${acc}%</div><div class="so-lbl">Точность</div></div><div class="so-item"><div class="so-val">${s.totalPointsEarned}</div><div class="so-lbl">Очков</div></div><div class="so-item"><div class="so-val">${s.bestStreak}</div><div class="so-lbl">Лучшая серия</div></div>`;
    drawChart('td-chart', s.sessions, 'month');
    const tc = $('td-tasks'); tc.innerHTML = '<h3>По заданиям</h3>';
    TASKS_META.forEach(t => { const ts = s.taskStats[t.id]; if (!ts) return; const a = ts.solved > 0 ? Math.round(ts.correct / ts.solved * 100) : 0; const clr = a >= 80 ? 'var(--green)' : a >= 50 ? 'var(--amber)' : 'var(--red)'; tc.innerHTML += `<div class="st-row"><div class="st-num">${t.id}</div><div class="st-info"><div class="st-name">${t.title}</div><div class="st-detail">Решено: ${ts.solved} · Верно: ${ts.correct}</div></div><div class="st-acc" style="color:${clr}">${a}%</div></div>`; });
    const sc = $('td-sessions'); sc.innerHTML = '';
    [...s.sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30).forEach(x => {
        const d = new Date(x.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const cls = x.accuracy >= 80 ? 'good' : x.accuracy >= 50 ? 'ok' : 'bad';
        sc.innerHTML += `<div class="sess-row"><div><div class="sess-task">Зад. ${x.taskId}: ${x.taskTitle}</div><div class="sess-date">${d}</div></div><div><div class="sess-result ${cls}">${x.correct}/${x.total} (${x.accuracy}%)</div></div></div>`;
    });
}

/* ===== TEST BUILDER ===== */
function renderTest() {
    const rows = $('tb-rows'); rows.innerHTML = '';
    let total = 0;
    TASKS_META.forEach(t => {
        if (testQty[t.id] === undefined) testQty[t.id] = 0;
        const qty = testQty[t.id];
        total += qty;
        const row = document.createElement('div'); row.className = 'tb-row';
        row.innerHTML = `<div class="tb-row-num">${t.id}</div>
            <div class="tb-row-info"><div class="tb-row-name">${t.title}</div></div>
            <div class="tb-controls">
                <button class="tb-qty-btn" data-id="${t.id}" data-delta="-1">−</button>
                <input class="tb-qty-val" type="text" inputmode="numeric" value="${qty}" data-id="${t.id}">
                <button class="tb-qty-btn" data-id="${t.id}" data-delta="1">+</button>
            </div>`;
        rows.appendChild(row);
    });
    $('tb-total-val').textContent = total;
    $('btn-compile').disabled = total === 0;
    rows.querySelectorAll('.tb-qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const delta = +btn.dataset.delta;
            testQty[id] = Math.max(0, Math.min(20, (testQty[id] || 0) + delta));
            renderTest();
        });
    });
    rows.querySelectorAll('.tb-qty-val').forEach(input => {
        input.addEventListener('input', () => {
            const id = input.dataset.id;
            const raw = parseInt(input.value, 10);
            testQty[id] = isNaN(raw) ? 0 : Math.max(0, Math.min(20, raw));
            let t = 0; Object.values(testQty).forEach(v => t += v);
            $('tb-total-val').textContent = t;
            $('btn-compile').disabled = t === 0;
        });
        input.addEventListener('blur', () => {
            const id = input.dataset.id;
            const raw = parseInt(input.value, 10);
            testQty[id] = isNaN(raw) ? 0 : Math.max(0, Math.min(20, raw));
            renderTest();
        });
    });
}

/* ===== VARIANT ===== */
function buildVariant() {
    const items = [];
    TASKS_META.forEach(t => {
        const qty = testQty[t.id] || 0;
        if (!qty) return;
        const qs = QUESTIONS[t.id] || [];
        if (!qs.length) return;
        let pool = [...qs].sort(() => Math.random() - .5);
        while (pool.length < qty) pool = pool.concat([...qs].sort(() => Math.random() - .5));
        pool.slice(0, qty).forEach(q => items.push({ taskId: t.id, taskTitle: t.title, q }));
    });
    if (!items.length) return;
    const fmt = document.querySelector('input[name="tb-fmt"]:checked')?.value || 'text';
    state.variant = { items, fmt, answers: {}, sessionType: 'mixed' };
    nav('variant');
}

function buildFullVariant() {
    const rand = arr => arr[Math.floor(Math.random() * arr.length)];
    const items = [];

    // === Задания 1–3 (общий текст) ===
    const qs1 = QUESTIONS[1] || [], qs2 = QUESTIONS[2] || [], qs3 = QUESTIONS[3] || [];
    const t1 = TASKS_META.find(t => t.id === 1);
    const t2 = TASKS_META.find(t => t.id === 2);
    const t3 = TASKS_META.find(t => t.id === 3);
    const qs1WithText = qs1.filter(q => q.text_id);
    if (qs1WithText.length && t1 && t2 && t3) {
        const q1 = rand(qs1WithText);
        const tid = q1.text_id;
        const mq2 = qs2.filter(q => q.text_id === tid);
        const mq3 = qs3.filter(q => q.text_id === tid);
        const q2 = mq2.length ? rand(mq2) : (qs2.length ? rand(qs2) : null);
        const q3 = mq3.length ? rand(mq3) : (qs3.length ? rand(qs3) : null);
        items.push({ taskId: 1, taskTitle: t1.title, q: q1 });
        if (q2) items.push({ taskId: 2, taskTitle: t2.title, q: { ...q2, text_id: undefined } });
        if (q3) items.push({ taskId: 3, taskTitle: t3.title, q: { ...q3, text_id: undefined } });
    } else {
        if (t1 && qs1.length) items.push({ taskId: 1, taskTitle: t1.title, q: rand(qs1) });
        if (t2 && qs2.length) items.push({ taskId: 2, taskTitle: t2.title, q: rand(qs2) });
        if (t3 && qs3.length) items.push({ taskId: 3, taskTitle: t3.title, q: rand(qs3) });
    }

    // === Задания 4–22 (независимые) ===
    for (let id = 4; id <= 22; id++) {
        const t = TASKS_META.find(x => x.id === id);
        const qs = QUESTIONS[id] || [];
        if (t && qs.length) items.push({ taskId: id, taskTitle: t.title, q: rand(qs) });
    }

    // === Задания 23–26 (общий текст) ===
    const qs23 = QUESTIONS[23] || [], qs24 = QUESTIONS[24] || [];
    const qs25 = QUESTIONS[25] || [], qs26 = QUESTIONS[26] || [];
    const t23 = TASKS_META.find(t => t.id === 23);
    const t24 = TASKS_META.find(t => t.id === 24);
    const t25 = TASKS_META.find(t => t.id === 25);
    const t26 = TASKS_META.find(t => t.id === 26);
    const qs23WithText = qs23.filter(q => q.text_id);
    if (qs23WithText.length && t23 && t24 && t25 && t26) {
        const q23 = rand(qs23WithText);
        const tid = q23.text_id;
        const mq24 = qs24.filter(q => q.text_id === tid);
        const mq25 = qs25.filter(q => q.text_id === tid);
        const mq26 = qs26.filter(q => q.text_id === tid);
        const q24 = mq24.length ? rand(mq24) : (qs24.length ? rand(qs24) : null);
        const q25 = mq25.length ? rand(mq25) : (qs25.length ? rand(qs25) : null);
        const q26 = mq26.length ? rand(mq26) : (qs26.length ? rand(qs26) : null);
        items.push({ taskId: 23, taskTitle: t23.title, q: q23 });
        if (q24) items.push({ taskId: 24, taskTitle: t24.title, q: { ...q24, text_id: undefined } });
        if (q25) items.push({ taskId: 25, taskTitle: t25.title, q: { ...q25, text_id: undefined } });
        if (q26) items.push({ taskId: 26, taskTitle: t26.title, q: { ...q26, text_id: undefined } });
    } else {
        if (t23 && qs23.length) items.push({ taskId: 23, taskTitle: t23.title, q: rand(qs23) });
        if (t24 && qs24.length) items.push({ taskId: 24, taskTitle: t24.title, q: rand(qs24) });
        if (t25 && qs25.length) items.push({ taskId: 25, taskTitle: t25.title, q: rand(qs25) });
        if (t26 && qs26.length) items.push({ taskId: 26, taskTitle: t26.title, q: rand(qs26) });
    }

    if (!items.length) return;
    const fmt = document.querySelector('input[name="tb-fmt"]:checked')?.value || 'text';
    state.variant = { items, fmt, answers: {}, isFullVariant: true, sessionType: 'exam' };
    nav('variant');
    $('variant-title').textContent = 'Полный вариант ЕГЭ · 26 заданий';
}

const FV_LIMIT = 3 * 3600 + 30 * 60; // 3ч 30мин в секундах

function fmtVariantTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function clearVariantTimer() {
    if (state.variantTimer) { clearInterval(state.variantTimer); state.variantTimer = null; }
}

function renderVariant() {
    const v = state.variant;
    if (!v) return;
    v.startedAt = v.startedAt || Date.now(); // запоминаем время старта один раз
    v.answers = {};
    $('variant-counter').textContent = `${v.items.length} заданий`;
    $('variant-summary').classList.add('hidden');
    $('btn-finish-variant').disabled = false;
    $('variant-side').classList.add('hidden');
    $('variant-wrap').classList.remove('checked');
    const container = $('variant-questions');
    container.innerHTML = '';

    // Таймер полного варианта
    clearVariantTimer();
    const timerEl = $('variant-timer');
    if (v.isFullVariant) {
        timerEl.classList.remove('hidden');
        state.variantStartTime = Date.now();
        const tick = () => {
            const elapsed = Math.floor((Date.now() - state.variantStartTime) / 1000);
            const remaining = Math.max(0, FV_LIMIT - elapsed);
            $('vt-elapsed').textContent = fmtVariantTime(elapsed);
            $('vt-remaining').textContent = fmtVariantTime(remaining);
            const remEl = $('vt-remaining');
            if (remaining < 300) remEl.classList.add('vt-warn');
            else remEl.classList.remove('vt-warn');
        };
        tick();
        state.variantTimer = setInterval(tick, 1000);
    } else {
        timerEl.classList.add('hidden');
        state.variantStartTime = null;
    }

    v.items.forEach((item, idx) => {
        const q = item.q;
        let displayText = q.text;
        if (q.text_id) {
            const textEntry = TEXTS.find(t => t.id === q.text_id);
            if (textEntry) displayText = textEntry.text + '\n\n' + q.text;
        }
        const useMulti = q.type === 'multi' && q.options && v.fmt === 'multi';
        let answerHTML;
        if (useMulti) {
            answerHTML = `<div class="vq-options">` +
                q.options.map((o, i) => `<button class="opt-btn" data-opt-idx="${i}" data-item-idx="${idx}">${i + 1}) ${o}</button>`).join('') +
                `</div>`;
        } else {
            answerHTML = `<div class="vq-answer-area"><input class="vq-input" type="text" placeholder="Ответ..." data-idx="${idx}" autocomplete="off"></div>`;
        }
        const block = document.createElement('div');
        block.className = 'vq-block';
        block.dataset.idx = idx;
        block.innerHTML = `<div class="vq-header">
            <div class="vq-num">${idx + 1}</div>
            <div class="vq-task-label">Задание ${item.taskId}: ${item.taskTitle}</div>
        </div>
        <div class="vq-text">${displayText.replace(/\n/g, '<br>')}</div>
        ${q.hint ? `<div class="vq-hint">💡 ${q.hint}</div>` : ''}
        ${answerHTML}
        <div class="vq-feedback hidden"></div>`;
        container.appendChild(block);
    });

    container.querySelectorAll('.vq-input').forEach(input => {
        input.addEventListener('input', () => { v.answers[+input.dataset.idx] = input.value; });
    });

    container.querySelectorAll('.opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemIdx = +btn.dataset.itemIdx;
            btn.classList.toggle('selected');
            const blockOpts = container.querySelectorAll(`.opt-btn[data-item-idx="${itemIdx}"]`);
            const sel = [];
            blockOpts.forEach((b, i) => { if (b.classList.contains('selected')) sel.push(i); });
            v.answers[itemIdx] = sel.sort((a, b) => a - b).map(i => i + 1).join('');
        });
    });
}

function finishVariant() {
    const v = state.variant;
    if (!v) return;
    const container = $('variant-questions');
    container.querySelectorAll('.vq-input').forEach(inp => inp.disabled = true);
    container.querySelectorAll('.opt-btn').forEach(btn => btn.disabled = true);

    let correct = 0;
    const results = [];
    const total = v.items.length;

    v.items.forEach((item, idx) => {
        const q = item.q;
        const block = container.querySelector(`.vq-block[data-idx="${idx}"]`);
        const rawAns = v.answers[idx];
        const userAns = rawAns !== undefined ? String(rawAns).trim().toLowerCase() : '';
        const isCorrect = userAns !== '' && (Array.isArray(q.answer)
            ? q.answer.map(a => String(a).trim().toLowerCase()).includes(userAns)
            : userAns === String(q.answer).trim().toLowerCase());

        if (isCorrect) correct++;
        const correctDisplay = Array.isArray(q.answer) ? q.answer.join(' / ') : String(q.answer);
        const userDisplay = rawAns !== undefined && String(rawAns) ? String(rawAns) : '—';
        results.push(normalizeSessionItem({
            idx,
            taskId: item.taskId,
            taskTitle: item.taskTitle,
            q,
            userAnswer: userDisplay,
            correctAnswer: correctDisplay,
            correct: isCorrect,
        }));

        block.classList.add(isCorrect ? 'vq-correct' : 'vq-wrong');

        // Highlight multi-choice options
        if (q.type === 'multi' && q.options && v.fmt === 'multi') {
            const blockOpts = block.querySelectorAll('.opt-btn');
            if (q.correct) q.correct.forEach(ci => blockOpts[ci]?.classList.add('correct'));
            blockOpts.forEach((b, i) => {
                if (b.classList.contains('selected') && !(q.correct || []).includes(i)) b.classList.add('wrong');
            });
        }

        const fb = block.querySelector('.vq-feedback');
        fb.classList.remove('hidden');
        fb.classList.add(isCorrect ? 'vq-fb-correct' : 'vq-fb-wrong');
        let fbHtml = `<div class="vq-fb-row">${isCorrect ? '✅ Верно' : '❌ Неверно'}</div>`;
        if (!isCorrect) {
            fbHtml += `<div style="font-size:12px;margin-top:4px;color:var(--text-dim)">Ваш ответ: <strong>${userDisplay}</strong> · Верно: <span class="vq-right-ans">${correctDisplay}</span></div>`;
        }
        if (q.explanation) fbHtml += `<div class="vq-fb-explain">${q.explanation.replace(/\n/g, '<br>')}</div>`;
        fb.innerHTML = fbHtml;
    });

    const acc = total > 0 ? Math.round(correct / total * 100) : 0;

    // Останавливаем таймер и считаем время
    let timeSpent = 0;
    if (v.isFullVariant) {
        clearVariantTimer();
        if (state.variantStartTime) {
            timeSpent = Math.floor((Date.now() - state.variantStartTime) / 1000);
            state.variantStartTime = null;
        }
    }

    // Сохраняем сессию в Supabase (fire-and-forget)
    if (state.user) {
        const taskNumbers = [...new Set(v.items.map(item => item.taskId))].sort((a, b) => a - b);
        const variantStart = v.startedAt ? new Date(v.startedAt).toISOString() : new Date().toISOString();
        const variantDuration = v.startedAt ? Math.floor((Date.now() - v.startedAt) / 1000) : timeSpent;
        // points_earned: 0 — варианты не начисляют очков (TODO: добавить систему наград отдельным шагом)
        createPracticeSession({
            user_id: state.user.id,
            class_id: null,
            mode: v.sessionType || 'mixed',
            status: 'completed',
            started_at: variantStart,
            finished_at: new Date().toISOString(),
            duration_sec: variantDuration,
            total_questions: total,
            correct_answers_count: correct,
            accuracy: acc,
            points_earned: 0,
            xp_earned: 0,
            items: results,
            meta: {
                schema_version: 2,
                session_type: v.sessionType || 'mixed',
                source: v.sessionType === 'exam' ? 'full-variant' : 'test-builder',
                task_numbers: taskNumbers,
                label: v.sessionType === 'exam' ? 'Полный вариант' : 'Собранный вариант',
            },
        });
    }

    // Build side results panel
    const sideTable = $('variant-side-table');
    sideTable.innerHTML = `<div class="vside-col-hd">
        <span></span><span>Зад.</span><span>Ваш</span><span>Верно</span>
    </div>` + results.map(r => `<div class="vside-row ${r.correct ? 'vs-correct' : 'vs-wrong'}">
        <span>${r.correct ? '✅' : '❌'}</span>
        <span class="vside-task">${r.taskId}</span>
        <span class="vside-ans ${r.correct ? 'correct' : 'wrong'}">${r.userAnswer}</span>
        <span class="vside-ans correct">${r.correctAnswer}</span>
    </div>`).join('') + `<div class="vside-summary">
        <span></span>
        <span class="vside-summary-label">Итого</span>
        <span class="vside-summary-score">${correct} / ${total}</span>
        <span class="vside-summary-acc">${acc}%</span>
    </div>`;
    $('variant-side').classList.remove('hidden');
    $('variant-wrap').classList.add('checked');
    const s = $('variant-summary');
    const timeItem = (v.isFullVariant && timeSpent > 0)
        ? `<div class="vs-item"><div class="vs-val">${fmtVariantTime(timeSpent)}</div><div class="vs-lbl">Время</div></div>`
        : '';
    s.innerHTML = `<div class="vs-row">
        <div class="vs-item"><div class="vs-val">${correct}</div><div class="vs-lbl">Верно</div></div>
        <div class="vs-item"><div class="vs-val">${total}</div><div class="vs-lbl">Всего</div></div>
        <div class="vs-item"><div class="vs-val">${acc}%</div><div class="vs-lbl">Точность</div></div>
        ${timeItem}
    </div>`;
    s.classList.remove('hidden');
    $('btn-finish-variant').disabled = true;
    s.scrollIntoView({ behavior: 'smooth' });
}

/* ===== HELPERS ===== */
function $(id) { return document.getElementById(id); }
function show(id) { $(id)?.classList.add('active'); }
function hide(id) { $(id)?.classList.remove('active'); }
function toggle(id, show) { $(id)?.classList.toggle('hidden', !show); }
function showErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
const PROFILE_FIELDS = new Set(['id', 'name', 'role', 'class_code', 'classCode', 'sessions']);
let _saveTimer = null;
function save() {
    if (!state.user) return;
    updateTopbar();
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
        const gameState = Object.fromEntries(Object.entries(state.user).filter(([k]) => !PROFILE_FIELDS.has(k)));
        await saveUserState(state.user.id, gameState);
    }, 300);
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function weakest() {
    const u = state.user; if (!u?.taskStats) return null;
    let worst = null, worstAcc = 101;
    TASKS_META.forEach(t => { const s = u.taskStats[t.id]; if (s?.solved > 0) { const a = s.correct / s.solved * 100; if (a < worstAcc) { worstAcc = a; worst = t.id; } } });
    return worst;
}
function findItem(id) { for (const cat of Object.values(SHOP_DATA)) { const i = cat.find(x => x.id === id); if (i) return i; } return null; }

/* ===== SESSION HELPERS ===== */

/** Безопасный сниппет текста вопроса — только q.text, без полного passage */
function getQuestionTextSnippet(q) {
    return q.text || '';
}

/** Единый формат session item для всех режимов (task / mixed / exam) */
function normalizeSessionItem({ idx, taskId, taskTitle, q, userAnswer, correctAnswer, correct }) {
    return {
        idx,
        taskId: taskId ?? null,
        taskTitle: taskTitle ?? null,
        textId: q.text_id ?? null,
        questionId: q.id ?? null,
        qText: getQuestionTextSnippet(q),
        userAnswer: userAnswer ?? '—',
        correctAnswer: correctAnswer ?? '',
        correct: !!correct,
        explanation: q.explanation || '',
    };
}

/** Нормализует item любого legacy-формата для отображения */
function normalizeLegacyItem(a, i) {
    return {
        idx: a.idx ?? i,
        taskId: a.taskId ?? null,
        taskTitle: a.taskTitle ?? null,
        qText: a.qText || '',
        userAnswer: a.userAnswer ?? a.userDisplay ?? '—',
        correctAnswer: a.correctAnswer ?? a.correctDisplay ?? '—',
        correct: !!(a.correct ?? a.isCorrect),
        explanation: a.explanation || '',
        questionId: a.questionId ?? null,
    };
}

/** Человекочитаемая подпись сессии */
function buildSessionLabel(s) {
    const meta = s.meta || {};
    if (meta.label) return meta.label;
    if (s.mode === 'exam') return 'Полный вариант';
    if (s.mode === 'mixed') return 'Собранный вариант';
    if (s.taskId) {
        const t = (typeof TASKS_META !== 'undefined') ? TASKS_META.find(x => x.id === s.taskId) : null;
        return `Задание ${s.taskId}${t ? ' · ' + t.title : ''}`;
    }
    return 'Практика';
}

/** Агрегация "По заданиям" по item.taskId.
 *  Fallback: если items есть, но ни один item не содержит taskId
 *  (legacy practice-сессии), используем session-level taskId + total/correct.
 */
function aggregateStatsByTask(sessions) {
    const agg = {};
    sessions.forEach(s => {
        const items = s.items || [];
        let usableItemCount = 0;
        if (items.length > 0) {
            items.forEach(a => {
                const norm = normalizeLegacyItem(a, 0);
                const tid = norm.taskId;
                if (tid == null) return;
                usableItemCount++;
                if (!agg[tid]) agg[tid] = { solved: 0, correct: 0 };
                agg[tid].solved++;
                if (norm.correct) agg[tid].correct++;
            });
        }
        // Fallback: нет items или ни один item не дал taskId
        if (usableItemCount === 0 && s.taskId != null) {
            if (!agg[s.taskId]) agg[s.taskId] = { solved: 0, correct: 0 };
            agg[s.taskId].solved += s.total;
            agg[s.taskId].correct += s.correct;
        }
    });
    return agg;
}

/* ===== TASK STATS DATA LAYER (ШАГ 1) ===== */

function getStatsTaskGroups() {
    return [
        { key: 'text',        title: 'Работа с текстом', taskIds: [1, 2, 3, 22, 23, 24, 25, 26] },
        { key: 'norms',       title: 'Нормы',            taskIds: [4, 5, 6, 7, 8] },
        { key: 'spelling',    title: 'Орфография',       taskIds: [9, 10, 11, 12, 13, 14, 15] },
        { key: 'punctuation', title: 'Пунктуация',       taskIds: [16, 17, 18, 19, 20, 21] },
    ];
}

function getTaskGroupKey(taskId) {
    const g = getStatsTaskGroups().find(g => g.taskIds.includes(taskId));
    return g ? g.key : null;
}

function isTaskStatsSession(session) {
    if (session.mode !== 'task') return false;
    const meta = session.meta || {};
    if (meta.session_type && meta.session_type !== 'task') return false;
    if (meta.source && meta.source !== 'practice') return false;
    return true;
}

function normalizeTaskStatsSession(session) {
    const meta = session.meta || {};
    let taskId = meta.task_numbers?.[0] ?? session.taskId ?? null;
    if (taskId == null && session.items?.length > 0)
        taskId = normalizeLegacyItem(session.items[0], 0).taskId ?? null;
    if (taskId != null) taskId = Number(taskId);
    const taskMeta = (typeof TASKS_META !== 'undefined' && taskId != null)
        ? TASKS_META.find(x => x.id === taskId) : null;
    const items = session.items || [];
    const normItems = items.map((a, i) => normalizeLegacyItem(a, i));
    const total = (session.total > 0) ? session.total : normItems.length;
    const correct = (session.correct >= 0 && session.total > 0)
        ? session.correct
        : normItems.filter(a => a.correct).length;
    return {
        sessionId: session.id,
        taskId,
        taskTitle: taskMeta?.title ?? (taskId != null ? `Задание ${taskId}` : null),
        blockKey: taskId != null ? getTaskGroupKey(taskId) : null,
        startedAt: session.startedAt ?? null,
        finishedAt: session.finishedAt ?? null,
        createdAt: session.date,
        durationSec: session.duration ?? null,
        total,
        correct,
        accuracy: total > 0 ? Math.round(correct / total * 100) : 0,
        items: normItems,
    };
}

function buildTaskStatsModel(sessions) {
    const taskSessions = sessions
        .filter(isTaskStatsSession)
        .map(normalizeTaskStatsSession)
        .filter(s => s.taskId != null && s.blockKey != null);

    const tasksById = {};
    taskSessions.forEach(s => {
        if (!tasksById[s.taskId]) {
            tasksById[s.taskId] = {
                taskId: s.taskId,
                taskTitle: s.taskTitle,
                blockKey: s.blockKey,
                solved: 0, correct: 0, accuracy: 0,
                lastPlayedAt: null,
                sessions: [],
            };
        }
        const t = tasksById[s.taskId];
        t.solved += s.total;
        t.correct += s.correct;
        t.sessions.push(s);
        if (!t.lastPlayedAt || s.createdAt > t.lastPlayedAt) t.lastPlayedAt = s.createdAt;
    });
    Object.values(tasksById).forEach(t => {
        t.accuracy = t.solved > 0 ? Math.round(t.correct / t.solved * 100) : 0;
        t.sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });

    const groups = getStatsTaskGroups().map(g => {
        const tasks = g.taskIds.map(id => tasksById[id] ?? {
            taskId: id,
            taskTitle: (typeof TASKS_META !== 'undefined' ? TASKS_META.find(x => x.id === id)?.title : null) ?? `Задание ${id}`,
            blockKey: g.key,
            solved: 0, correct: 0, accuracy: 0,
            lastPlayedAt: null,
            sessions: [],
        });
        const solved = tasks.reduce((sum, t) => sum + t.solved, 0);
        const correct = tasks.reduce((sum, t) => sum + t.correct, 0);
        return { ...g, solved, correct,
            accuracy: solved > 0 ? Math.round(correct / solved * 100) : 0,
            tasks };
    });

    return { groups, tasksById, sessions: taskSessions };
}

/* ===== NEW STATS UI (ШАГ 3) ===== */

function accColor(pct) {
    return pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
}

function renderNewStats(model) {
    const c = $('stats-content');
    c.innerHTML = '';
    model.groups.forEach((g, i) => c.appendChild(renderStatsGroup(g, i === 0)));
}

function renderStatsGroup(group, isFirst = false) {
    const el = document.createElement('div');
    el.className = 'stats-group glass';
    el.id = 'stats-group-' + group.key;
    const accText = group.solved > 0 ? group.accuracy + '%' : '—';
    const pct = group.solved > 0 ? group.accuracy : 0;
    const clr = group.solved > 0 ? accColor(pct) : 'var(--text-muted)';
    const bodyClass = isFirst ? 'stats-group-body' : 'stats-group-body collapsed';
    const chevron = isFirst ? '⌄' : '›';
    el.innerHTML = `
        <div class="stats-group-header">
            <div class="stats-group-left">
                <div class="stats-group-title">${group.title}</div>
            </div>
            <div class="stats-group-right">
                <span class="stats-group-acc" style="color:${clr}">${accText}</span>
                <span class="stats-group-detail">${group.correct} / ${group.solved}</span>
                <span class="stats-group-chevron">${chevron}</span>
            </div>
        </div>
        <div class="${bodyClass}">
            <div class="stats-group-progress"><div class="stats-group-progress-bar" style="width:${pct}%"></div></div>
            <div class="stats-group-tasks"></div>
        </div>`;
    el.querySelector('.stats-group-header').addEventListener('click', () => toggleGroupCollapse(el));
    const tasksEl = el.querySelector('.stats-group-tasks');
    group.tasks.forEach(t => tasksEl.appendChild(renderStatsTaskRow(t)));
    return el;
}

function toggleGroupCollapse(el) {
    const body = el.querySelector('.stats-group-body');
    const chevron = el.querySelector('.stats-group-chevron');
    const collapsed = body.classList.toggle('collapsed');
    chevron.textContent = collapsed ? '›' : '⌄';
}

function renderStatsTaskRow(task) {
    const el = document.createElement('div');
    el.className = 'stats-task-row';
    const accText = task.solved > 0 ? task.accuracy + '%' : '—';
    const accClr = task.solved > 0 ? accColor(task.accuracy) : 'var(--text-muted)';
    const lastPlayed = task.lastPlayedAt
        ? new Date(task.lastPlayedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
        : 'ещё не решалось';
    el.innerHTML = `
        <div class="stats-task-main">
            <div class="stats-task-num">${task.taskId}</div>
            <div class="stats-task-info">
                <div class="stats-task-title">${task.taskTitle}</div>
                <div class="stats-task-meta">${task.correct} / ${task.solved} · ${lastPlayed}</div>
            </div>
            <div class="stats-task-acc" style="color:${accClr}">${accText}</div>
            <div class="stats-task-toggle">›</div>
        </div>
        <div class="stats-attempts hidden"></div>`;
    el.querySelector('.stats-task-main').addEventListener('click', () => toggleTaskAttempts(el, task));
    return el;
}

function toggleTaskAttempts(el, task) {
    const attemptsEl = el.querySelector('.stats-attempts');
    const toggle = el.querySelector('.stats-task-toggle');
    const expanded = el.classList.toggle('expanded');
    toggle.textContent = expanded ? '⌄' : '›';
    if (expanded && !attemptsEl.dataset.loaded) {
        attemptsEl.dataset.loaded = '1';
        renderTaskAttempts(task, attemptsEl);
    }
    attemptsEl.classList.toggle('hidden', !expanded);
}

function renderTaskAttempts(task, container) {
    if (!task.sessions.length) {
        container.innerHTML = '<div class="stats-empty">Попыток пока нет</div>';
        return;
    }
    task.sessions.forEach(s => container.appendChild(renderTaskAttemptCard(s)));
}

function renderTaskAttemptCard(s) {
    const el = document.createElement('div');
    el.className = 'stats-attempt-card' + (s.items.length ? ' clickable' : '');
    const d = new Date(s.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const dur = s.durationSec ? `${Math.floor(s.durationSec / 60)}:${String(s.durationSec % 60).padStart(2, '0')}` : null;
    const cls = s.accuracy >= 80 ? 'good' : s.accuracy >= 50 ? 'ok' : 'bad';
    el.innerHTML = `
        <div class="stats-attempt-date">${d}${dur ? ' · ⏱ ' + dur : ''}</div>
        <div class="sess-result ${cls}">${s.correct}/${s.total} (${s.accuracy}%)</div>`;
    if (s.items.length) el.addEventListener('click', () => showTaskAttemptDetail(s));
    return el;
}

function showTaskAttemptDetail(s) {
    const c = $('stats-content');
    const d = new Date(s.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const dur = s.durationSec ? `${Math.floor(s.durationSec / 60)}:${String(s.durationSec % 60).padStart(2, '0')}` : '—';
    const cls = s.accuracy >= 80 ? 'good' : s.accuracy >= 50 ? 'ok' : 'bad';
    let html = `
        <div class="sd-detail-bar">
            <button class="btn btn-sm btn-ghost" id="btn-sd-close">← Назад</button>
            <div class="sd-bar-info">
                <span class="sd-bar-title">${s.taskTitle ?? 'Задание ' + s.taskId}</span>
                <span class="sd-bar-meta">${d} · ⏱ ${dur}</span>
            </div>
            <div class="sess-result ${cls} sd-bar-result">${s.correct}/${s.total} (${s.accuracy}%)</div>
        </div>
        <div class="sd-answers">`;
    // Явно нормализуем items перед рендером — безопасно для legacy-сессий
    const items = (s.items || []).map((a, i) => normalizeLegacyItem(a, i));
    items.forEach((a, i) => {
        const qTextHtml = a.qText ? `<div class="sd-q-text">${a.qText.replace(/\n/g, '<br>')}</div>` : '';
        const userCls = a.correct ? 'sd-chip-correct' : 'sd-chip-wrong';
        html += `<div class="sd-answer ${a.correct ? 'sd-correct' : 'sd-wrong'}">
            <div class="sd-q-num">${i + 1}</div>
            <div class="sd-q-body">
                ${qTextHtml}
                <div class="sd-result-row">
                    <div class="sd-ans-chip ${userCls}">
                        ${a.correct ? '✅' : '❌'} <span class="sd-chip-label">Ваш ответ:</span> <strong>${a.userAnswer}</strong>
                    </div>
                    ${!a.correct ? `<div class="sd-ans-chip sd-chip-right">✓ <span class="sd-chip-label">Верно:</span> <strong>${a.correctAnswer}</strong></div>` : ''}
                </div>
                ${a.explanation && !a.correct ? `
                    <div class="sd-explain-block">
                        <div class="sd-explain-label">Пояснение</div>
                        <div class="sd-explain-text">${a.explanation.replace(/\n/g, '<br>')}</div>
                    </div>` : ''}
            </div>
        </div>`;
    });
    html += '</div>';
    c.innerHTML = html;
    $('btn-sd-close').addEventListener('click', () => renderStats());
}

/* ===== FLASHCARDS ===== */
let fcQty = 10;
let fcSetKey = 'orthoepy';

const FC_SET_META = {
    orthoepy:        { label: 'Ударения',               frontLabel: 'Слово',        backLabel: 'Правильное ударение',  totalId: 'fc-set-total' },
    abbreviations:   { label: 'Аббревиатуры',           frontLabel: 'Аббревиатура', backLabel: 'Расшифровка',          totalId: 'fc-set-abbr-total' },
    slitno_razdelno: { label: 'Правописание наречий',   frontLabel: 'Наречие',      backLabel: 'Правильное написание', totalId: 'fc-set-spraw-total' },
};

function initFlashcards() {
    $('fc-set-orth').addEventListener('click', () => { fcSetKey = 'orthoepy'; openFcQtyModal(); });
    $('fc-set-abbr').addEventListener('click', () => { fcSetKey = 'abbreviations'; openFcQtyModal(); });
    $('fc-set-spraw').addEventListener('click', () => { fcSetKey = 'slitno_razdelno'; openFcQtyModal(); });
    $('modal-fc-qty').querySelector('.modal-bg').addEventListener('click', closeFcQtyModal);
    $('btn-fc-cancel').addEventListener('click', closeFcQtyModal);
    $('btn-fc-start').addEventListener('click', () => { closeFcQtyModal(); startFlashcards(fcQty); });
    document.querySelectorAll('.fc-qty-pill').forEach(p => p.addEventListener('click', () => {
        document.querySelectorAll('.fc-qty-pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active'); fcQty = +p.dataset.q;
    }));
    $('btn-fc-back').addEventListener('click', showFcHub);
    $('btn-fc-flip').addEventListener('click', flipFlashcard);
    $('fc-scene').addEventListener('click', e => {
        if (e.target.classList.contains('fc-half')) return;
        flipFlashcard();
    });
    $('fc-half-no').addEventListener('click', () => { if (state.flashcard?.flipped) markFlashcard(false); });
    $('fc-half-yes').addEventListener('click', () => { if (state.flashcard?.flipped) markFlashcard(true); });
    $('btn-fc-restart').addEventListener('click', () => startFlashcards(fcQty));
    document.addEventListener('keydown', fcKeyHandler);
}

function fcKeyHandler(e) {
    const fc = state.flashcard;
    if (!fc) return;
    if ($('fc-training').classList.contains('hidden')) return;
    if (e.key === 'Enter') { e.preventDefault(); flipFlashcard(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (fc.flipped) markFlashcard(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (fc.flipped) markFlashcard(true); }
}

function openFcQtyModal() { $('modal-fc-qty').classList.remove('hidden'); }
function closeFcQtyModal() { $('modal-fc-qty').classList.add('hidden'); }

function showFcHub() {
    state.flashcard = null;
    if (typeof FLASHCARD_SETS !== 'undefined') {
        Object.entries(FC_SET_META).forEach(([key, meta]) => {
            const el = $(meta.totalId);
            if (el && FLASHCARD_SETS[key]?.items?.length) {
                el.textContent = FLASHCARD_SETS[key].items.length + ' карточек';
            }
        });
    }
    $('fc-hub').classList.remove('hidden');
    $('fc-training').classList.add('hidden');
}

function startFlashcards(qty) {
    const set = (typeof FLASHCARD_SETS !== 'undefined') ? FLASHCARD_SETS[fcSetKey] : null;
    if (!set || !set.items || !set.items.length) return;
    qty = qty || 10;
    const cards = [...set.items].sort(() => Math.random() - .5).slice(0, qty);
    state.flashcard = { cards, idx: 0, flipped: false, known: 0, unknown: 0 };
    const meta = FC_SET_META[fcSetKey];
    $('fc-set-label').textContent = meta.label;
    $('fc-front-label').textContent = meta.frontLabel;
    $('fc-back-label').textContent = meta.backLabel;
    $('fc-hub').classList.add('hidden');
    $('fc-training').classList.remove('hidden');
    $('fc-finish').classList.add('hidden');
    $('fc-scene').classList.remove('hidden');
    $('fc-controls').classList.remove('hidden');
    showFlashcard();
}


function showFlashcard() {
    const fc = state.flashcard; if (!fc) return;
    const card = fc.cards[fc.idx];
    fc.flipped = false;
    const fcCard = $('fc-card');
    fcCard.style.transition = 'none';           // отключить анимацию при сбросе
    fcCard.classList.remove('flipped');
    $('fc-scene').classList.remove('is-flipped');
    $('fc-front-text').textContent = card.front;
    $('fc-back-text').textContent = card.back;
    fcCard.offsetHeight;                        // принудительный reflow — применить состояние мгновенно
    fcCard.style.transition = '';               // вернуть анимацию для следующего переворота
    $('fc-counter').textContent = `${fc.idx + 1} / ${fc.cards.length}`;
    $('fc-bar-fill').style.width = (fc.idx / fc.cards.length * 100) + '%';
    $('fc-known').textContent = fc.known;
    $('fc-unknown').textContent = fc.unknown;
    $('fc-controls').classList.remove('hidden');
    $('fc-hint').innerHTML = 'Enter или клик — перевернуть';
}


function flipFlashcard() {
    const fc = state.flashcard; if (!fc) return;
    if (fc.flipped) return;
    fc.flipped = true;
    $('fc-card').classList.add('flipped');
    $('fc-scene').classList.add('is-flipped');
    $('fc-controls').classList.add('hidden');
    $('fc-hint').innerHTML = '← Не знаю &nbsp;·&nbsp; → Знаю<span class="fc-hint-secondary">Левая половина — не знаю, правая — знаю</span>';
}

function markFlashcard(known) {
    const fc = state.flashcard; if (!fc) return;
    if (known) fc.known++; else fc.unknown++;
    fc.idx++;
    if (fc.idx >= fc.cards.length) {
        $('fc-scene').classList.add('hidden');
        $('fc-controls').classList.add('hidden');
        $('fc-bar-fill').style.width = '100%';
        $('fc-counter').textContent = `${fc.cards.length} / ${fc.cards.length}`;
        $('fc-known').textContent = fc.known;
        $('fc-unknown').textContent = fc.unknown;
        $('fc-fin-known').textContent = fc.known;
        $('fc-fin-unknown').textContent = fc.unknown;
        $('fc-hint').innerHTML = '';
        $('fc-finish').classList.remove('hidden');
    } else {
        showFlashcard();
    }
}

})();
