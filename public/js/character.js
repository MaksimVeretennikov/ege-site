/* ===== FULL-BODY CHARACTER RENDERER ===== */
const CharRenderer = (() => {
    let canvas, ctx;
    let equipped = { top: '#6366f1', bottom: '#3b82f6', hair: '#44403c', accessory: '', bg: 'default' };
    let breathe = 0;
    let rainDrops = [];

    function init(el) {
        canvas = el; ctx = canvas.getContext('2d');
        canvas.width = 300; canvas.height = 480;
        // Init rain drops
        rainDrops = [];
        for (let i = 0; i < 60; i++) {
            rainDrops.push({ x: Math.random() * 300, y: Math.random() * 480, speed: 3 + Math.random() * 4, len: 8 + Math.random() * 12 });
        }
    }

    function setEquipped(e) { equipped = { ...equipped, ...e }; }

    function render() {
        if (!ctx) return;
        const W = 300, H = 480;
        ctx.clearRect(0, 0, W, H);
        breathe = Math.sin(Date.now() / 900) * 2;
        drawBg(W, H);
        drawBody(W, H);
    }

    function drawBg(W, H) {
        const bg = equipped.bg || 'default';

        if (bg === 'bg_lofi') { drawLofi(W, H); return; }
        if (bg === 'bg_space') { drawSpace(W, H); return; }
        if (bg === 'bg_rooftop') { drawRooftop(W, H); return; }

        // Base gradient
        const g = ctx.createLinearGradient(0, 0, 0, H);
        if (bg === 'default' || bg === 'bg_default') {
            g.addColorStop(0, '#05051a'); g.addColorStop(0.4, '#0a0a2e'); g.addColorStop(1, '#0f0f2a');
        } else if (bg === 'bg_neon') {
            g.addColorStop(0, '#0a0520'); g.addColorStop(0.4, '#1a0a3e'); g.addColorStop(1, '#0f0a1a');
        } else if (bg === 'bg_rain') {
            g.addColorStop(0, '#060a14'); g.addColorStop(0.5, '#0e1822'); g.addColorStop(1, '#080c12');
        } else {
            g.addColorStop(0, '#0a0a1a'); g.addColorStop(1, '#1a1a2e');
        }
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // City silhouette buildings
        drawCityscape(W, H, bg);

        // Stars
        if (bg !== 'bg_rain') drawStars(W, H);

        // Neon signs for neon bg
        if (bg === 'bg_neon') drawNeonSigns(W, H);

        // Rain
        if (bg === 'bg_rain') drawRain(W, H);

        // Floor glow
        const floorGlow = ctx.createRadialGradient(W / 2, H - 30, 10, W / 2, H - 30, 120);
        const glowColor = bg === 'bg_neon' ? 'rgba(236,72,153,0.15)' : bg === 'bg_rain' ? 'rgba(56,189,248,0.08)' : 'rgba(139,92,246,0.12)';
        floorGlow.addColorStop(0, glowColor); floorGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = floorGlow; ctx.fillRect(0, H - 100, W, 100);

        // Ground line
        ctx.strokeStyle = 'rgba(139,92,246,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, H - 38); ctx.lineTo(W, H - 38); ctx.stroke();
    }

    function drawCityscape(W, H, bg) {
        const buildings = [
            { x: 0, w: 35, h: 180 }, { x: 30, w: 25, h: 220 },
            { x: 55, w: 30, h: 160 }, { x: 80, w: 20, h: 240 },
            { x: 220, w: 25, h: 200 }, { x: 240, w: 35, h: 260 },
            { x: 270, w: 30, h: 190 },
        ];
        buildings.forEach(b => {
            const by = H - 38 - b.h;
            // Building body
            ctx.fillStyle = bg === 'bg_neon' ? 'rgba(20,10,35,0.9)' : bg === 'bg_rain' ? 'rgba(10,15,25,0.9)' : 'rgba(8,8,20,0.9)';
            ctx.fillRect(b.x, by, b.w, b.h);
            // Windows
            const winColor = bg === 'bg_neon' ? ['rgba(236,72,153,0.4)','rgba(139,92,246,0.4)','rgba(6,182,212,0.3)'] :
                             bg === 'bg_rain' ? ['rgba(200,200,255,0.15)','rgba(180,200,255,0.1)'] :
                             ['rgba(255,220,100,0.25)','rgba(139,92,246,0.2)','rgba(100,200,255,0.15)'];
            for (let wy = by + 8; wy < H - 55; wy += 14) {
                for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 10) {
                    const on = Math.sin(wx * 7 + wy * 3) > -0.3;
                    if (on) {
                        ctx.fillStyle = winColor[Math.floor((wx + wy) / 13) % winColor.length];
                        ctx.fillRect(wx, wy, 5, 7);
                    }
                }
            }
        });
    }

    function drawStars(W, H) {
        for (let i = 0; i < 35; i++) {
            const sx = (i * 97 + 13) % W;
            const sy = (i * 53 + 7) % (H * 0.4);
            const sr = 0.4 + (i % 3) * 0.4;
            const twinkle = Math.sin(Date.now() / 600 + i * 1.7) * 0.3 + 0.7;
            ctx.globalAlpha = twinkle * 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawNeonSigns(W, H) {
        const t = Date.now() / 1000;
        // Neon sign on building
        ctx.shadowBlur = 15;
        // Pink sign
        ctx.shadowColor = '#ec4899'; ctx.strokeStyle = `rgba(236,72,153,${0.5 + Math.sin(t * 2) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(32, 160); ctx.lineTo(50, 160); ctx.lineTo(50, 175); ctx.stroke();
        // Cyan sign
        ctx.shadowColor = '#06b6d4'; ctx.strokeStyle = `rgba(6,182,212,${0.5 + Math.sin(t * 3 + 1) * 0.3})`;
        ctx.beginPath(); ctx.arc(253, 130, 8, 0, Math.PI * 2); ctx.stroke();
        // Purple sign
        ctx.shadowColor = '#8b5cf6'; ctx.strokeStyle = `rgba(139,92,246,${0.5 + Math.sin(t * 1.5 + 2) * 0.3})`;
        ctx.beginPath(); ctx.moveTo(244, 155); ctx.lineTo(270, 155); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(248, 162); ctx.lineTo(266, 162); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawRain(W, H) {
        ctx.strokeStyle = 'rgba(130,180,220,0.2)'; ctx.lineWidth = 1;
        rainDrops.forEach(d => {
            d.y += d.speed;
            if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; }
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1, d.y + d.len); ctx.stroke();
        });
        // Puddle reflections on ground
        ctx.fillStyle = 'rgba(100,150,200,0.04)';
        ctx.beginPath(); ctx.ellipse(80, H - 35, 30, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(200, H - 33, 25, 3, 0, 0, Math.PI * 2); ctx.fill();
    }

    function drawLofi(W, H) {
        // Warm room background
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1a1520'); g.addColorStop(0.5, '#221a28'); g.addColorStop(1, '#18131e');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // Window with night sky
        ctx.fillStyle = '#0a0a20';
        roundRect(15, 40, 80, 100, 4);
        ctx.fillStyle = '#0f0f2e';
        roundRect(18, 43, 74, 94, 3);
        // Window cross
        ctx.strokeStyle = '#3a3050'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(55, 43); ctx.lineTo(55, 137); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(18, 90); ctx.lineTo(92, 90); ctx.stroke();
        // Moon in window
        ctx.fillStyle = 'rgba(255,240,200,0.8)';
        ctx.beginPath(); ctx.arc(42, 65, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = 'rgba(255,240,200,0.3)'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(42, 65, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Stars in window
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        [[72,55],[30,80],[80,72],[50,55],[68,85]].forEach(([x,y]) => {
            ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
        });

        // Shelf
        ctx.fillStyle = '#2a2035'; ctx.fillRect(0, 155, 100, 5);
        // Plant on shelf
        ctx.fillStyle = '#5b3a1a'; ctx.fillRect(10, 135, 14, 20);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(17, 128, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.arc(12, 125, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(22, 122, 7, 0, Math.PI * 2); ctx.fill();
        // Books on shelf
        ctx.fillStyle = '#8b5cf6'; ctx.fillRect(40, 140, 6, 15);
        ctx.fillStyle = '#ec4899'; ctx.fillRect(48, 138, 5, 17);
        ctx.fillStyle = '#06b6d4'; ctx.fillRect(55, 141, 7, 14);
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(64, 139, 5, 16);

        // Desk lamp (right side)
        ctx.strokeStyle = '#4a3860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(250, H - 50); ctx.lineTo(250, 200); ctx.lineTo(270, 180); ctx.stroke();
        // Lamp shade
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.moveTo(260, 175); ctx.lineTo(280, 185); ctx.lineTo(265, 185); ctx.closePath(); ctx.fill();
        // Lamp glow
        ctx.fillStyle = 'rgba(245,158,11,0.06)';
        ctx.beginPath(); ctx.arc(270, 200, 60, 0, Math.PI * 2); ctx.fill();

        // Vinyl record player
        ctx.fillStyle = '#2a2035'; roundRect(210, 250, 55, 35, 4);
        ctx.fillStyle = '#1a1525'; ctx.beginPath(); ctx.arc(237, 267, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath(); ctx.arc(237, 267, 4, 0, Math.PI * 2); ctx.fill();
        // Spinning grooves
        const t = Date.now() / 800;
        ctx.strokeStyle = 'rgba(139,92,246,0.2)'; ctx.lineWidth = 0.5;
        for (let r = 7; r <= 13; r += 3) {
            ctx.beginPath(); ctx.arc(237, 267, r, t % (Math.PI*2), t % (Math.PI*2) + 4); ctx.stroke();
        }
        // Tone arm
        ctx.strokeStyle = '#4a3860'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(258, 255); ctx.lineTo(248, 270); ctx.stroke();

        // Music notes floating
        ctx.fillStyle = 'rgba(139,92,246,0.3)';
        const nt = Date.now() / 1500;
        ctx.font = '12px serif';
        ctx.fillText('♪', 225 + Math.sin(nt) * 8, 240 + Math.cos(nt) * 5);
        ctx.fillText('♫', 260 + Math.sin(nt + 2) * 6, 235 + Math.cos(nt + 1) * 4);

        // Floor
        ctx.fillStyle = '#1a1322'; ctx.fillRect(0, H - 40, W, 40);
        ctx.strokeStyle = 'rgba(139,92,246,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, H - 40); ctx.lineTo(W, H - 40); ctx.stroke();

        // Warm ambient glow
        const warm = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 200);
        warm.addColorStop(0, 'rgba(245,158,11,0.03)'); warm.addColorStop(1, 'transparent');
        ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    }

    function drawSpace(W, H) {
        // Deep space
        const g = ctx.createRadialGradient(W/2, H/2, 20, W/2, H/2, 300);
        g.addColorStop(0, '#0a0a2a'); g.addColorStop(0.5, '#050518'); g.addColorStop(1, '#000008');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // Nebula
        const neb = ctx.createRadialGradient(80, 120, 10, 80, 120, 100);
        neb.addColorStop(0, 'rgba(139,92,246,0.12)'); neb.addColorStop(0.5, 'rgba(236,72,153,0.05)'); neb.addColorStop(1, 'transparent');
        ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);

        const neb2 = ctx.createRadialGradient(230, 80, 10, 230, 80, 80);
        neb2.addColorStop(0, 'rgba(6,182,212,0.08)'); neb2.addColorStop(1, 'transparent');
        ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);

        // Many stars
        for (let i = 0; i < 80; i++) {
            const sx = (i * 97 + 13) % W;
            const sy = (i * 41 + 7) % H;
            const sr = 0.3 + (i % 4) * 0.3;
            const twinkle = Math.sin(Date.now() / 500 + i * 1.3) * 0.3 + 0.7;
            ctx.globalAlpha = twinkle * 0.6;
            ctx.fillStyle = i % 7 === 0 ? '#a78bfa' : i % 5 === 0 ? '#22d3ee' : '#fff';
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Planet
        const pt = Date.now() / 4000;
        const px = 60, py = 320;
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath(); ctx.arc(px, py, 25, 0, Math.PI * 2); ctx.fill();
        // Planet ring
        ctx.strokeStyle = 'rgba(139,92,246,0.4)'; ctx.lineWidth = 2;
        ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.3); ctx.rotate(0.3);
        ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // Planet glow
        ctx.shadowColor = '#8b5cf6'; ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(139,92,246,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 27, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Distant planet
        ctx.fillStyle = '#164e63';
        ctx.beginPath(); ctx.arc(260, 100, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(6,182,212,0.3)';
        ctx.beginPath(); ctx.arc(260, 100, 14, 0, Math.PI * 2); ctx.fill();

        // Floating platform
        ctx.fillStyle = 'rgba(30,27,75,0.8)';
        ctx.beginPath(); ctx.ellipse(W/2, H - 35, 60, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(139,92,246,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(W/2, H - 35, 60, 10, 0, 0, Math.PI * 2); ctx.stroke();
    }

    function drawRooftop(W, H) {
        // Evening sky gradient
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0c1445'); g.addColorStop(0.3, '#1a1055'); g.addColorStop(0.6, '#2d1b4e'); g.addColorStop(1, '#15102a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        drawStars(W, H);

        // Far buildings
        ctx.fillStyle = 'rgba(15,10,30,0.9)';
        [[0,180,40],[35,200,30],[60,160,25],[80,220,35],[200,190,30],[225,210,25],[245,170,35],[275,195,25]].forEach(([x,h,w]) => {
            ctx.fillRect(x, H - 38 - h, w, h);
        });
        // Windows on far buildings
        ctx.fillStyle = 'rgba(255,220,100,0.2)';
        for (let i = 0; i < 30; i++) {
            const wx = (i * 31 + 5) % 100;
            const wy = H - 38 - (i * 17 + 20) % 180;
            if (wy > H * 0.3) ctx.fillRect(wx, wy, 3, 5);
            ctx.fillRect(wx + 200, wy - 10, 3, 5);
        }

        // Rooftop floor
        ctx.fillStyle = '#1a1428';
        ctx.fillRect(100, H - 50, 100, 15);
        ctx.fillStyle = '#15101f'; ctx.fillRect(0, H - 38, W, 38);

        // Railing
        ctx.strokeStyle = 'rgba(139,92,246,0.2)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, H - 80); ctx.lineTo(100, H - 80); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(200, H - 80); ctx.lineTo(300, H - 80); ctx.stroke();
        // Railing posts
        for (let x = 0; x <= 100; x += 20) {
            ctx.beginPath(); ctx.moveTo(x, H - 80); ctx.lineTo(x, H - 50); ctx.stroke();
        }
        for (let x = 200; x <= 300; x += 20) {
            ctx.beginPath(); ctx.moveTo(x, H - 80); ctx.lineTo(x, H - 50); ctx.stroke();
        }

        // Antenna
        ctx.strokeStyle = '#3a2a50'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(260, H - 50); ctx.lineTo(260, H - 120); ctx.stroke();
        ctx.strokeStyle = 'rgba(239,68,68,0.6)'; ctx.lineWidth = 1;
        const blink = Math.sin(Date.now() / 500) > 0 ? 0.8 : 0.2;
        ctx.globalAlpha = blink;
        ctx.beginPath(); ctx.arc(260, H - 122, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(239,68,68,0.6)';
        ctx.beginPath(); ctx.arc(260, H - 122, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        // Ground glow
        const flg = ctx.createRadialGradient(W/2, H - 30, 10, W/2, H - 30, 100);
        flg.addColorStop(0, 'rgba(139,92,246,0.1)'); flg.addColorStop(1, 'transparent');
        ctx.fillStyle = flg; ctx.fillRect(0, H - 80, W, 80);
    }

    function drawBody(W, H) {
        const cx = W / 2;
        const by = breathe;
        const topColor = equipped.top || '#6366f1';
        const bottomColor = equipped.bottom || '#3b82f6';
        const hairColor = equipped.hair || '#44403c';

        // === SHADOW ===
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(cx, H - 35, 38, 8, 0, 0, Math.PI * 2); ctx.fill();

        // === LEGS (connected to torso via hips) ===
        // Hips connecting torso to legs
        ctx.fillStyle = bottomColor;
        roundRect(cx - 28, 270 + by, 56, 30, 6);
        // Left leg
        roundRect(cx - 22, 295 + by, 18, 110, 6);
        // Right leg
        roundRect(cx + 4, 295 + by, 18, 110, 6);
        // Shoes
        ctx.fillStyle = '#1e1e2e';
        roundRect(cx - 25, 398 + by, 22, 14, 5);
        roundRect(cx + 3, 398 + by, 22, 14, 5);
        // Shoe accents
        ctx.fillStyle = 'rgba(139,92,246,0.5)';
        ctx.fillRect(cx - 24, 405 + by, 20, 2);
        ctx.fillRect(cx + 4, 405 + by, 20, 2);

        // === TORSO ===
        ctx.fillStyle = topColor;
        roundRect(cx - 30, 190 + by, 60, 85, 10);
        // Collar
        ctx.fillStyle = darken(topColor, 20);
        ctx.beginPath();
        ctx.moveTo(cx - 8, 190 + by); ctx.lineTo(cx, 205 + by); ctx.lineTo(cx + 8, 190 + by);
        ctx.closePath(); ctx.fill();

        // === ARMS ===
        ctx.fillStyle = topColor;
        ctx.save();
        ctx.translate(cx - 30, 200 + by);
        ctx.rotate(-0.08 + Math.sin(Date.now() / 1200) * 0.03);
        roundRectLocal(-14, 0, 14, 70, 6);
        ctx.restore();
        ctx.save();
        ctx.translate(cx + 30, 200 + by);
        ctx.rotate(0.08 - Math.sin(Date.now() / 1200) * 0.03);
        roundRectLocal(0, 0, 14, 70, 6);
        ctx.restore();
        // Hands
        ctx.fillStyle = '#e8c4a0';
        ctx.beginPath(); ctx.arc(cx - 37, 270 + by, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 37, 270 + by, 7, 0, Math.PI * 2); ctx.fill();

        // === NECK ===
        ctx.fillStyle = '#e8c4a0';
        roundRect(cx - 8, 175 + by, 16, 20, 4);

        // === HEAD ===
        ctx.fillStyle = '#e8c4a0';
        roundRect(cx - 24, 120 + by, 48, 58, 18);

        // === HAIR ===
        ctx.fillStyle = hairColor;
        ctx.beginPath(); ctx.ellipse(cx, 128 + by, 28, 18, 0, Math.PI, 0); ctx.fill();
        roundRect(cx - 26, 125 + by, 8, 30, 4);
        roundRect(cx + 18, 125 + by, 8, 30, 4);
        ctx.beginPath(); ctx.ellipse(cx, 118 + by, 24, 12, 0, 0, Math.PI * 2); ctx.fill();

        // === FACE ===
        ctx.fillStyle = '#1e1e2e';
        const blink = Math.sin(Date.now() / 3000) > 0.97 ? 1 : 4;
        ctx.beginPath(); ctx.ellipse(cx - 9, 145 + by, 4, blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 9, 145 + by, 4, blink, 0, 0, Math.PI * 2); ctx.fill();
        if (blink > 1) {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(cx - 7, 143 + by, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 11, 143 + by, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        // Eyebrows
        ctx.strokeStyle = darken(hairColor, 20); ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 14, 138 + by); ctx.lineTo(cx - 5, 137 + by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 5, 137 + by); ctx.lineTo(cx + 14, 138 + by); ctx.stroke();
        // Mouth
        ctx.strokeStyle = '#c4956e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, 156 + by, 5, 0.1, Math.PI - 0.1); ctx.stroke();

        // === ACCESSORIES ===
        const acc = equipped.accessory || '';
        if (acc === 'acc_glasses' || acc === 'glasses') {
            ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx - 9, 145 + by, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx + 9, 145 + by, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx - 2, 145 + by); ctx.lineTo(cx + 2, 145 + by); ctx.stroke();
        }
        if (acc === 'acc_headphones' || acc === 'headphones') {
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(cx, 125 + by, 30, Math.PI + 0.3, -0.3); ctx.stroke();
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.arc(cx - 27, 140 + by, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 27, 140 + by, 8, 0, Math.PI * 2); ctx.fill();
        }
        if (acc === 'acc_cap' || acc === 'cap') {
            ctx.fillStyle = '#334155';
            roundRect(cx - 28, 112 + by, 56, 14, 6);
            roundRect(cx - 24, 105 + by, 48, 14, 8);
            ctx.fillRect(cx - 32, 124 + by, 40, 4);
        }
        if (acc === 'acc_neon_mask' || acc === 'neon_mask') {
            ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2;
            ctx.shadowColor = '#8b5cf6'; ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(cx - 20, 148 + by); ctx.quadraticCurveTo(cx, 160 + by, cx + 20, 148 + by);
            ctx.stroke(); ctx.shadowBlur = 0;
        }

        // Neon accent lines on torso
        ctx.strokeStyle = 'rgba(139,92,246,0.4)'; ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(139,92,246,0.3)'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(cx - 28, 220 + by); ctx.lineTo(cx - 28, 270 + by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 28, 220 + by); ctx.lineTo(cx + 28, 270 + by); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath(); ctx.fill();
    }

    function roundRectLocal(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath(); ctx.fill();
    }

    function darken(hex, amount) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
        const num = parseInt(c, 16);
        let r = Math.max(0, (num >> 16) - amount);
        let g = Math.max(0, ((num >> 8) & 0xff) - amount);
        let b = Math.max(0, (num & 0xff) - amount);
        return `rgb(${r},${g},${b})`;
    }

    function startLoop() {
        (function loop() { render(); requestAnimationFrame(loop); })();
    }

    return { init, setEquipped, render, startLoop };
})();
