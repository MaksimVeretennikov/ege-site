/* ===== SOUNDS — only correct/wrong/levelup/combo (no click sounds) ===== */
const SoundEngine = (() => {
    let ctx = null;
    function getCtx() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
    function resume() { const c = getCtx(); if (c.state === 'suspended') c.resume(); }

    function correct() {
        resume(); const c = getCtx(); const now = c.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(f, now + i * .07);
            g.gain.setValueAtTime(.2, now + i * .07);
            g.gain.exponentialRampToValueAtTime(.001, now + i * .07 + .25);
            o.connect(g); g.connect(c.destination); o.start(now + i * .07); o.stop(now + i * .07 + .25);
        });
    }

    function wrong() {
        resume(); const c = getCtx(); const now = c.currentTime;
        const o1 = c.createOscillator(), g1 = c.createGain();
        o1.type = 'sawtooth'; o1.frequency.setValueAtTime(300, now);
        o1.frequency.linearRampToValueAtTime(180, now + .25);
        g1.gain.setValueAtTime(.1, now); g1.gain.exponentialRampToValueAtTime(.001, now + .3);
        o1.connect(g1); g1.connect(c.destination); o1.start(now); o1.stop(now + .3);
        const o2 = c.createOscillator(), g2 = c.createGain();
        o2.type = 'sawtooth'; o2.frequency.setValueAtTime(250, now + .18);
        o2.frequency.linearRampToValueAtTime(130, now + .45);
        g2.gain.setValueAtTime(.08, now + .18); g2.gain.exponentialRampToValueAtTime(.001, now + .5);
        o2.connect(g2); g2.connect(c.destination); o2.start(now + .18); o2.stop(now + .5);
    }

    function levelUp() {
        resume(); const c = getCtx(); const now = c.currentTime;
        [{f:523,t:0,d:.12},{f:587,t:.1,d:.12},{f:659,t:.2,d:.12},{f:784,t:.3,d:.18},{f:1047,t:.42,d:.35}].forEach(({f,t,d}) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(f, now + t);
            g.gain.setValueAtTime(.18, now + t); g.gain.exponentialRampToValueAtTime(.001, now + t + d);
            o.connect(g); g.connect(c.destination); o.start(now + t); o.stop(now + t + d);
        });
    }

    function combo() {
        resume(); const c = getCtx(); const now = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(600, now);
        o.frequency.exponentialRampToValueAtTime(1200, now + .08);
        g.gain.setValueAtTime(.1, now); g.gain.exponentialRampToValueAtTime(.001, now + .12);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + .12);
    }

    function purchase() {
        resume(); const c = getCtx(); const now = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(1500, now);
        o.frequency.exponentialRampToValueAtTime(2500, now + .04);
        o.frequency.exponentialRampToValueAtTime(1800, now + .08);
        g.gain.setValueAtTime(.15, now); g.gain.exponentialRampToValueAtTime(.001, now + .15);
        o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + .15);
    }

    function achievement() {
        resume(); const c = getCtx(); const now = c.currentTime;
        [784,988,1175,1568].forEach((f, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(f, now + i * .04);
            g.gain.setValueAtTime(.12, now + i * .04); g.gain.exponentialRampToValueAtTime(.001, now + .7);
            o.connect(g); g.connect(c.destination); o.start(now + i * .04); o.stop(now + .7);
        });
    }

    return { correct, wrong, levelUp, combo, purchase, achievement };
})();
