const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('game-container');

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const startScreen = document.getElementById('start-screen');
const infoScreen = document.getElementById('info-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const levelUpScreen = document.getElementById('level-up-screen');
const perksContainer = document.getElementById('perks-container');
const scoreBoard = document.getElementById('score-board');
const healthBoard = document.getElementById('health-board');
const scoreValue = document.getElementById('score-value');
const comboValue = document.getElementById('combo-value');
const comboContainer = document.getElementById('combo-container');
const hiScoreInGame = document.getElementById('hi-score-in-game');
const hiScoreStart = document.getElementById('hi-score-start');
const finalScoreValue = document.getElementById('final-score-value');
const newRecordMsg = document.getElementById('new-record-msg');
const healthBar = document.getElementById('health-bar');
const energyBar = document.getElementById('energy-bar');
const xpBar = document.getElementById('xp-bar');
const levelValue = document.getElementById('level-value');
const empReadyText = document.getElementById('emp-ready-text');

const startBtn = document.getElementById('start-btn');
const infoBtn = document.getElementById('info-btn');
const closeInfoBtn = document.getElementById('close-info-btn');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const muteBtn = document.getElementById('mute-btn');

// --- SOUND ENGINE ---
class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.muted = false;
    }

    playTone(freq, type, duration, vol = 0.1, sweep = 0) {
        if (this.muted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (sweep !== 0) {
            osc.frequency.exponentialRampToValueAtTime(freq + sweep, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playHit() { this.playTone(200, 'sawtooth', 0.1, 0.1, -100); }
    playCoreDamage() { this.playTone(100, 'square', 0.4, 0.2, -50); }
    playPowerUp() { this.playTone(400, 'sine', 0.3, 0.1, 400); }
    playGameOver() { this.playTone(150, 'sawtooth', 1.0, 0.2, -100); }
    playEMP() { this.playTone(50, 'sawtooth', 1.0, 0.3, 500); }
    playBossSpawn() { this.playTone(80, 'square', 1.5, 0.2, -40); }
    playLaser() { this.playTone(600, 'sine', 0.1, 0.1, -200); }
    playDash() { this.playTone(300, 'triangle', 0.2, 0.1, 300); }
    playReflect() { this.playTone(800, 'sine', 0.1, 0.2, 200); }
    playMissile() { this.playTone(300, 'sawtooth', 0.2, 0.1, -150); }
    playXP() { this.playTone(1200, 'sine', 0.05, 0.05, 0); }
    playLevelUp() { 
        this.playTone(400, 'sine', 0.1, 0.1); 
        setTimeout(()=>this.playTone(600, 'sine', 0.1, 0.1), 100);
        setTimeout(()=>this.playTone(800, 'sine', 0.4, 0.1), 200);
    }
}

const sfx = new SoundEngine();

muteBtn.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    muteBtn.classList.toggle('muted', sfx.muted);
});

// --- GAME STATE ---
let gameState = 'START'; 
let score = 0;
let highScore = localStorage.getItem('neonOrbitHighScore') || 0;
let health = 100;
let maxHealth = 100;
let animationId;
let frames = 0;
let difficultyMultiplier = 1;

let comboMultiplier = 1;
let comboTimer = 0;

let energy = 0;
const maxEnergy = 100;
let empReady = false;

// XP System
let xp = 0;
let xpTarget = 100;
let level = 1;
let energyGainMultiplier = 1;

// Perks logic
let hasChainLightning = false;
let hasDrones = false;

let shakeTime = 0;
let shakeIntensity = 0;

let bossSpawnTarget = 3000;

// Mouse tracking
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

// Entities
let player;
let core;
let turret;
let enemies = [];
let projectiles = [];
let friendlyProjectiles = [];
let particles = [];
let powerUps = [];
let xpGems = [];
let floatingTexts = [];
let shockwaves = [];
let empShockwaves = [];
let lightningArcs = [];
let drones = [];
let stars = [];

// Power-up States
let slowTimeRemaining = 0;
let overchargeRemaining = 0;

// Input
const keys = { 
    w: false, a: false, s: false, d: false, 
    W: false, A: false, S: false, D: false, 
    Escape: false, ' ': false, Shift: false 
};

// Perks
const PERK_POOL = [
    { id: 'speed', title: 'THRUSTERS', icon: '🚀', desc: '+1 Core Movement Speed' },
    { id: 'health', title: 'REINFORCED HULL', icon: '🛡️', desc: '+20 Max HP & Heal 20' }, // NERF: Only heal 20
    { id: 'shield_thick', title: 'HEAVY SHIELD', icon: '🔰', desc: 'Thicker Shield Defenses' },
    { id: 'shield_wide', title: 'WIDE SHIELD', icon: '弧', desc: 'Wider Shield Coverage Arc' },
    { id: 'turret_fast', title: 'RAPID TURRET', icon: '🔫', desc: '-15% Turret Cooldown' },
    { id: 'energy_siphon', title: 'ENERGY SIPHON', icon: '⚡', desc: '+20% EMP Charge Rate' },
    { id: 'chain_lightning', title: 'CHAIN LIGHTNING', icon: '🌩️', desc: 'Reflects shoot Lightning!' },
    { id: 'drones', title: 'ORBITING DRONES', icon: '🛸', desc: 'Spawns 2 protective drones' }
];

// Initialization
hiScoreStart.innerText = highScore;

// Resize Canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (core && gameState === 'START') {
        core.x = canvas.width / 2;
        core.y = canvas.height / 2;
    }
    initStars();
}
window.addEventListener('resize', resize);
resize();

function initStars() {
    stars = [];
    for(let i=0; i<150; i++) {
        // V9 Visuals: Colored stars
        let colors = ['#ffffff', '#aaddff', '#ffaadd'];
        stars.push({
            x: Math.random() * canvas.width * 3 - canvas.width,
            y: Math.random() * canvas.height * 3 - canvas.height,
            size: Math.random() * 2,
            z: Math.random() * 0.5 + 0.1, 
            brightness: Math.random(),
            color: colors[Math.floor(Math.random()*colors.length)]
        });
    }
}

// UI Navigation
infoBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    infoScreen.classList.remove('hidden');
});
closeInfoBtn.addEventListener('click', () => {
    infoScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// Input Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === ' ') keys[' '] = true;
    
    if (e.key === 'Escape' && gameState === 'PLAYING') togglePause();
    else if (e.key === 'Escape' && gameState === 'PAUSED') togglePause();
    
    if (e.key === ' ' && empReady && gameState === 'PLAYING') {
        triggerEMP();
    }
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    if (e.key === ' ') keys[' '] = false;
});
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseScreen.classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseScreen.classList.add('hidden');
        gameLoop();
    }
}

function triggerEMP() {
    energy = 0; 
    updateUI();
    sfx.playEMP();
    applyScreenShake(20, 30);
    empShockwaves.push(new EmpShockwave());
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        addScore(e.pts, e.x, e.y, e.color);
        createExplosion(e.x, e.y, e.color, 15);
        xpGems.push(new XpGem(e.x, e.y, e.pts));
    }
    enemies = [];
    projectiles = [];
    powerUps = []; 
}

// --- CLASSES ---
class Core {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 30;
        this.color = '#00ffff';
        this.pulse = 0;
        this.ringRotation = 0;
        this.speed = 3.5;
        this.vx = 0;
        this.vy = 0;
        this.trail = [];
    }
    update() {
        this.vx = 0;
        this.vy = 0;
        if (keys.w || keys.W) this.vy -= this.speed;
        if (keys.s || keys.S) this.vy += this.speed;
        if (keys.a || keys.A) this.vx -= this.speed;
        if (keys.d || keys.D) this.vx += this.speed;
        
        if (this.vx !== 0 && this.vy !== 0) {
            this.vx *= 0.707;
            this.vy *= 0.707;
        }

        this.x += this.vx;
        this.y += this.vy;
        
        // Thruster trail
        if (this.vx !== 0 || this.vy !== 0) {
            this.trail.push({x: this.x, y: this.y});
            if (this.trail.length > 10) this.trail.shift();
        } else if (this.trail.length > 0) {
            this.trail.shift();
        }

        this.x = Math.max(this.radius + 10, Math.min(canvas.width - this.radius - 10, this.x));
        this.y = Math.max(this.radius + 10, Math.min(canvas.height - this.radius - 10, this.y));
    }
    draw() {
        this.pulse += 0.05;
        this.ringRotation += 0.02;
        const currentRadius = this.radius + Math.sin(this.pulse) * 3;
        
        ctx.save();
        
        // Draw Trail
        if (this.trail.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for(let i=1; i<this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.lineWidth = this.radius * 0.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffff';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.translate(this.x, this.y);
        
        // V9 Visuals: High-tech Reactor Core
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius + 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
        ctx.fill();

        // Rotating Ring 1
        ctx.rotate(this.ringRotation);
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius + 10, 0, Math.PI * 1.5);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Rotating Ring 2 (Opposite)
        ctx.rotate(-this.ringRotation * 2.5);
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius + 5, 0, Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Inner Core
        ctx.rotate(this.ringRotation * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius - 5, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Bright center
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius - 15, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
    }
}

class AutoTurret {
    constructor() {
        this.angle = 0;
        this.dist = 45;
        this.fireTimer = 0;
        this.fireRate = 180;
        this.laserLife = 0;
        this.target = null;
    }
    update() {
        this.angle += 0.05;
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            let closest = null;
            let minDist = Infinity;
            for(let e of enemies) {
                let d = Math.hypot(e.x - core.x, e.y - core.y);
                if (d < minDist && d < Math.max(canvas.width, canvas.height)) {
                    minDist = d;
                    closest = e;
                }
            }
            if (closest) {
                this.target = closest;
                this.fireTimer = 0;
                this.laserLife = 10;
                sfx.playLaser();
                
                if (closest instanceof DreadnoughtBoss) {
                    closest.bounce();
                    if (closest.hp <= 0) {
                        closest.die();
                        enemies.splice(enemies.indexOf(closest), 1);
                    }
                } else {
                    addScore(closest.pts, closest.x, closest.y, closest.color);
                    createExplosion(closest.x, closest.y, closest.color, 15);
                    xpGems.push(new XpGem(closest.x, closest.y, closest.pts));
                    if (closest instanceof SplitterEnemy) closest.split();
                    enemies.splice(enemies.indexOf(closest), 1);
                }
            }
        }
    }
    draw() {
        let tx = core.x + Math.cos(this.angle) * this.dist;
        let ty = core.y + Math.sin(this.angle) * this.dist;
        
        ctx.beginPath();
        ctx.arc(tx, ty, 5, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        
        if (this.laserLife > 0 && this.target) {
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.strokeStyle = `rgba(0, 255, 255, ${this.laserLife/10})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            this.laserLife--;
        }
    }
}

class PlayerShield {
    constructor() {
        this.angle = 0;
        this.radius = 80;
        this.baseArcLength = Math.PI * 2 / 3;
        this.arcLength = this.baseArcLength;
        this.thickness = 10;
        this.color = '#ff00ff';
        this.dashCooldown = 0;
        this.dashing = 0;
    }
    update() {
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.dashing > 0) this.dashing--;
        
        let targetAngle = Math.atan2(mouseY - core.y, mouseX - core.x);
        if (targetAngle < 0) targetAngle += Math.PI * 2;
        
        // BALANCE: Dash costs 20 Energy
        if (keys.Shift && this.dashCooldown === 0 && energy >= 20) {
            energy -= 20;
            updateUI();
            this.dashing = 15; 
            this.dashCooldown = 180; 
            sfx.playDash();
        }
        
        if (this.dashing > 0) {
            this.angle += 0.5;
            createExplosion(
                core.x + Math.cos(this.angle)*this.radius, 
                core.y + Math.sin(this.angle)*this.radius, 
                '#ffffff', 1
            );
        } else {
            this.angle = targetAngle;
        }

        this.angle = (this.angle + Math.PI * 2) % (Math.PI * 2);

        if (overchargeRemaining > 0) {
            this.arcLength = Math.PI;
            this.color = '#ffff00';
            overchargeRemaining--;
        } else {
            this.arcLength = this.baseArcLength;
            this.color = (this.dashCooldown === 0 && energy >= 20) ? '#ffffff' : '#ff00ff'; 
            if (this.dashing > 0) this.color = '#ffffff';
        }
    }
    draw() {
        // V9 Visuals: Energy barrier look
        ctx.beginPath();
        ctx.arc(core.x, core.y, this.radius, this.angle - this.arcLength/2, this.angle + this.arcLength/2);
        ctx.lineWidth = this.thickness;
        ctx.strokeStyle = this.color;
        ctx.lineCap = 'round';
        ctx.shadowBlur = this.dashing > 0 ? 25 : 15;
        ctx.shadowColor = this.color;
        ctx.stroke();
        
        // Inner bright line
        ctx.beginPath();
        ctx.arc(core.x, core.y, this.radius, this.angle - this.arcLength/2, this.angle + this.arcLength/2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Inner faint fill for the energy arc
        ctx.beginPath();
        ctx.moveTo(core.x, core.y);
        ctx.arc(core.x, core.y, this.radius, this.angle - this.arcLength/2, this.angle + this.arcLength/2);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class XpGem {
    constructor(x, y, value) {
        this.x = x; this.y = y;
        this.value = value;
        this.radius = 4 + (value/10);
        this.color = '#ffaa00';
        this.pulse = 0;
        let a = Math.random() * Math.PI*2;
        this.vx = Math.cos(a) * 0.5;
        this.vy = Math.sin(a) * 0.5;
    }
    update() {
        this.pulse += 0.1;
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + Math.sin(this.pulse), 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Drone {
    constructor(angleOffset) {
        this.angle = angleOffset;
        this.radius = 8;
        this.distance = 120;
        this.color = '#ffaa00';
        this.x = core.x;
        this.y = core.y;
        this.trail = [];
    }
    update() {
        this.angle += 0.03;
        this.x = core.x + Math.cos(this.angle) * this.distance;
        this.y = core.y + Math.sin(this.angle) * this.distance;
        
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 8) this.trail.shift();
        
        // Drones damage enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            if (Math.hypot(e.x - this.x, e.y - this.y) < e.radius + this.radius) {
                if (e instanceof DreadnoughtBoss) {
                    e.bounce();
                    if (e.hp <= 0) { e.die(); enemies.splice(i, 1); }
                } else {
                    addScore(e.pts, e.x, e.y, e.color);
                    createExplosion(e.x, e.y, e.color, 15);
                    xpGems.push(new XpGem(e.x, e.y, e.pts));
                    if (e instanceof SplitterEnemy) e.split();
                    enemies.splice(i, 1);
                }
                sfx.playHit();
            }
        }
    }
    draw() {
        if (this.trail.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for(let i=1; i<this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = this.radius;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(x, y) {
        if (x !== undefined && y !== undefined) {
            this.x = x; this.y = y;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const spawnDist = Math.max(canvas.width, canvas.height) / 2 + 100;
            this.x = core.x + Math.cos(angle) * spawnDist;
            this.y = core.y + Math.sin(angle) * spawnDist;
        }
        this.radius = 10;
        this.color = '#ff3300';
        this.speed = (1.8 + Math.random() * 1.0) * difficultyMultiplier; 
        this.pts = 10;
        this.damage = 5;
        this.trail = [];
        this.setupVelocity();
    }
    setupVelocity() {
        const dx = core.x - this.x;
        const dy = core.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
    }
    update() {
        const dx = core.x - this.x;
        const dy = core.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        this.vx = this.vx * 0.95 + (dx/dist)*this.speed * 0.05;
        this.vy = this.vy * 0.95 + (dy/dist)*this.speed * 0.05;

        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift();
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        if (this.trail.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for(let i=1; i<this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = this.radius;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class FastEnemy extends Enemy {
    constructor() {
        super();
        this.speed *= 1.6;
        this.color = '#ffaa00';
        this.radius = 6;
        this.pts = 20;
        this.damage = 10;
        this.setupVelocity();
    }
}

class WeaverEnemy extends Enemy {
    constructor() {
        super();
        this.color = '#ff00aa';
        this.pts = 30;
        this.wobbleAngle = 0;
        this.baseVx = this.vx;
        this.baseVy = this.vy;
    }
    update() {
        this.wobbleAngle += 0.1;
        
        const dx = core.x - this.x;
        const dy = core.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        this.baseVx = this.baseVx * 0.95 + (dx/dist)*this.speed * 0.05;
        this.baseVy = this.baseVy * 0.95 + (dy/dist)*this.speed * 0.05;

        const perpX = -this.baseVy;
        const perpY = this.baseVx;
        const wobbleFactor = Math.sin(this.wobbleAngle) * 2;
        this.x += this.baseVx + perpX * wobbleFactor;
        this.y += this.baseVy + perpY * wobbleFactor;
        
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift();
    }
}

class SplitterEnemy extends Enemy {
    constructor() {
        super();
        this.radius = 16;
        this.color = '#aa00ff';
        this.speed *= 0.7;
        this.pts = 15;
        this.damage = 15;
        this.setupVelocity();
    }
    split() {
        for(let i=0; i<2; i++) {
            let mini = new FastEnemy();
            mini.x = this.x + (Math.random()*20-10);
            mini.y = this.y + (Math.random()*20-10);
            mini.setupVelocity();
            enemies.push(mini);
        }
    }
}

class SniperEnemy extends Enemy {
    constructor() {
        super();
        this.radius = 12;
        this.color = '#00ffaa';
        this.pts = 40;
        this.stopDist = 250 + Math.random() * 100;
        this.fireTimer = 0;
        this.shotsFired = 0;
        this.retreating = false;
    }
    update() {
        if (this.retreating) {
            this.x -= this.vx * 2;
            this.y -= this.vy * 2;
            if (this.x < -100 || this.x > canvas.width+100 || this.y < -100 || this.y > canvas.height+100) {
                this.life = 0; 
            }
        } else {
            let d = Math.hypot(core.x - this.x, core.y - this.y);
            let onScreen = (this.x > 0 && this.x < canvas.width && this.y > 0 && this.y < canvas.height);
            
            if (d > this.stopDist || !onScreen) {
                this.x += this.vx;
                this.y += this.vy;
            } else {
                this.fireTimer++;
                if (this.fireTimer > 100) {
                    this.fire();
                    this.fireTimer = 0;
                    this.shotsFired++;
                    if (this.shotsFired >= 2) {
                        this.retreating = true;
                    }
                }
            }
        }
        
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift();
    }
    fire() {
        projectiles.push(new Projectile(this.x, this.y));
        sfx.playLaser();
    }
}

class GravityEnemy extends Enemy {
    constructor() {
        super();
        this.radius = 18;
        this.color = '#111111';
        this.pts = 50;
        this.damage = 10;
        this.speed *= 0.5;
        this.pulse = 0;
        this.setupVelocity();
    }
    update() {
        super.update();
        this.pulse += 0.1;
        let dx = this.x - core.x;
        let dy = this.y - core.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 350 && dist > this.radius) {
            core.x += (dx/dist) * 0.5; 
            core.y += (dy/dist) * 0.5;
        }
        for(let p of powerUps) {
            let pdx = this.x - p.x;
            let pdy = this.y - p.y;
            let pdist = Math.hypot(pdx, pdy);
            if (pdist < 350) {
                p.x += (pdx/pdist) * 1.5;
                p.y += (pdy/pdist) * 1.5;
            }
        }
        for(let x of xpGems) {
            let xdx = this.x - x.x;
            let xdy = this.y - x.y;
            let xdist = Math.hypot(xdx, xdy);
            if (xdist < 350) {
                x.x += (xdx/xdist) * 2;
                x.y += (xdy/xdist) * 2;
            }
        }
    }
    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + Math.sin(this.pulse)*5, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,0,255,0.3)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff00ff';
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

// V9: New Phantom Enemy
class PhantomEnemy extends Enemy {
    constructor() {
        super();
        this.radius = 14;
        this.color = 'rgba(255, 255, 255, 0.4)';
        this.pts = 60;
        this.damage = 15;
        this.pulse = 0;
        this.speed *= 0.8;
        this.setupVelocity();
    }
    draw() {
        this.pulse += 0.1;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + Math.sin(this.pulse)*2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffff';
        ctx.fill();
        
        // Face
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - 2, 2, 0, Math.PI*2);
        ctx.arc(this.x + 4, this.y - 2, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

class DreadnoughtBoss extends Enemy {
    constructor() {
        super();
        this.radius = 35;
        this.color = '#ff0000';
        this.speed = 1.0;
        this.pts = 500;
        this.damage = 40;
        this.hp = 5; 
        this.pulse = 0;
        this.spawnTimer = 0;
        this.setupVelocity();
        sfx.playBossSpawn();
        floatingTexts.push(new FloatingText(canvas.width/2, canvas.height/4, 'DREADNOUGHT INCOMING', '#ff0000'));
    }
    update() {
        const dx = core.x - this.x;
        const dy = core.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        this.vx = this.vx * 0.95 + (dx/dist)*this.speed * 0.05;
        this.vy = this.vy * 0.95 + (dy/dist)*this.speed * 0.05;

        this.x += this.vx;
        this.y += this.vy;

        this.pulse += 0.05;
        this.spawnTimer++;
        if (this.spawnTimer > 150) { 
            this.spawnTimer = 0;
            let mini = new FastEnemy();
            mini.x = this.x;
            mini.y = this.y;
            mini.setupVelocity();
            enemies.push(mini);
        }
    }
    draw() {
        ctx.save();
        ctx.beginPath();
        const currentRadius = this.radius + Math.sin(this.pulse) * 5;
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        
        if (this.flash > 0) {
            ctx.fillStyle = '#ffffff';
            this.flash--;
        } else {
            ctx.fillStyle = this.color;
        }
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '20px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.hp, this.x, this.y);
        ctx.restore();
    }
    bounce() {
        this.hp--;
        this.flash = 5; // Flash effect instead of velocity knockback
        applyScreenShake(10, 10);
        createExplosion(this.x, this.y, this.color, 20);
        sfx.playCoreDamage(); 
    }
    die() {
        addScore(this.pts, this.x, this.y, this.color);
        createExplosion(this.x, this.y, this.color, 100);
        applyScreenShake(20, 20);
        for(let i=0; i<3; i++) {
            let p = new PowerUp();
            p.x = this.x + (Math.random()*40-20);
            p.y = this.y + (Math.random()*40-20);
            powerUps.push(p);
        }
        for(let i=0; i<20; i++) {
            xpGems.push(new XpGem(this.x, this.y, 15));
        }
    }
}

class Projectile {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 4;
        this.color = '#ffffff';
        this.damage = 15;
        let dx = core.x - x;
        let dy = core.y - y;
        let dist = Math.hypot(dx, dy);
        this.vx = (dx/dist) * 6 * difficultyMultiplier;
        this.vy = (dy/dist) * 6 * difficultyMultiplier;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class FriendlyProjectile {
    constructor(x, y, vx, vy) {
        this.x = x; this.y = y;
        this.radius = 4;
        this.color = '#00ffaa';
        this.vx = vx;
        this.vy = vy;
        this.history = [];
    }
    update() {
        this.history.push({x: this.x, y: this.y});
        if (this.history.length > 6) this.history.shift();
        this.x += this.vx;
        this.y += this.vy;
    }
    draw() {
        ctx.save();
        if (this.history.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for(let i=1; i<this.history.length; i++) ctx.lineTo(this.history[i].x, this.history[i].y);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.radius * 2;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
    }
}

class HomingMissile {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 3;
        this.color = '#ff00ff';
        this.speed = 10; 
        this.target = null;
        this.life = 150; 
        this.trail = [];
        
        let angle = Math.random() * Math.PI*2;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
    }
    update() {
        this.life--;
        if (!this.target || enemies.indexOf(this.target) === -1) {
            let minDist = Infinity;
            for(let e of enemies) {
                let d = Math.hypot(e.x - this.x, e.y - this.y);
                if (d < minDist) { minDist = d; this.target = e; }
            }
        }
        
        if (this.target) {
            let dx = this.target.x - this.x;
            let dy = this.target.y - this.y;
            let dist = Math.hypot(dx, dy);
            this.vx = this.vx * 0.9 + (dx/dist)*this.speed * 0.1;
            this.vy = this.vy * 0.9 + (dy/dist)*this.speed * 0.1;
        }

        this.x += this.vx;
        this.y += this.vy;
        
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 8) this.trail.shift();
    }
    draw() {
        if (this.trail.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for(let i=1; i<this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = this.radius*2;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }
}

class PowerUp {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = Math.max(canvas.width, canvas.height) / 2 + 50;
        this.x = core.x + Math.cos(angle) * spawnDist;
        this.y = core.y + Math.sin(angle) * spawnDist;
        this.radius = 12;
        
        const types = [
            { type: 'health', color: 'var(--powerup-green, #00ff00)', label: 'REPAIR', icon: '+' },
            { type: 'overcharge', color: 'var(--powerup-yellow, #ffff00)', label: 'OVERCHARGE', icon: 'O' },
            { type: 'slow', color: 'var(--powerup-blue, #0088ff)', label: 'CHRONO-SLOW', icon: 'S' },
            { type: 'missile', color: '#ff00ff', label: 'MISSILE SWARM', icon: 'M' }
        ];
        const selected = types[Math.floor(Math.random() * types.length)];
        this.type = selected.type;
        this.color = selected.color;
        this.label = selected.label;
        this.icon = selected.icon;
        
        const speed = 1.0;
        const dx = core.x - this.x;
        const dy = core.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this.pulse = 0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulse += 0.1;
    }
    draw() {
        ctx.save();
        ctx.beginPath();
        const currentRadius = this.radius + Math.sin(this.pulse) * 2;
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, this.x, this.y);
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = Math.random() * 3 + 1;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.02;
        this.history = [];
    }
    update() {
        this.history.push({x: this.x, y: this.y});
        if (this.history.length > 5) this.history.shift();
        this.x += this.vx; this.y += this.vy;
        this.life -= this.decay;
        this.vx *= 0.95; this.vy *= 0.95;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        
        if (this.history.length > 0) {
            ctx.beginPath();
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for(let i=1; i<this.history.length; i++) ctx.lineTo(this.history[i].x, this.history[i].y);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.radius;
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Shockwave {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.radius = 10;
        this.life = 1;
    }
    update() {
        this.radius += 3;
        this.life -= 0.05;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class EmpShockwave {
    constructor() {
        this.x = core.x;
        this.y = core.y;
        this.radius = 10;
        this.maxRadius = Math.max(canvas.width, canvas.height)*1.5;
        this.color = '#ffffff';
        this.life = 1;
        this.active = true;
    }
    update() {
        this.radius += 30;
        this.life -= 0.02;
        if (this.radius > this.maxRadius) this.active = false;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = this.color;
        ctx.stroke();
        ctx.restore();
    }
}

class LightningArc {
    constructor(startX, startY, target) {
        this.startX = startX; this.startY = startY;
        this.target = target;
        this.life = 10;
    }
    update() {
        this.life--;
        if (this.life === 0 && enemies.indexOf(this.target) !== -1) {
            addScore(this.target.pts, this.target.x, this.target.y, this.target.color);
            createExplosion(this.target.x, this.target.y, this.target.color, 15);
            xpGems.push(new XpGem(this.target.x, this.target.y, this.target.pts));
            if (this.target instanceof SplitterEnemy) this.target.split();
            enemies.splice(enemies.indexOf(this.target), 1);
            sfx.playHit();
        }
    }
    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        
        // Simple jagged line
        let segments = 5;
        let dx = this.target.x - this.startX;
        let dy = this.target.y - this.startY;
        for(let i=1; i<=segments; i++) {
            let px = this.startX + (dx * (i/segments)) + (Math.random()*20-10);
            let py = this.startY + (dy * (i/segments)) + (Math.random()*20-10);
            if (i===segments) { px = this.target.x; py = this.target.y; }
            ctx.lineTo(px, py);
        }
        
        ctx.strokeStyle = `rgba(0, 255, 255, ${this.life/10})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.stroke();
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.life = 1; this.vy = -2;
        this.scale = 1.5; // Starts big
    }
    update() {
        this.y += this.vy;
        this.vy *= 0.95; // Friction
        this.life -= 0.02;
        if (this.scale > 1.0) this.scale -= 0.05;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Outfit, Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5; ctx.shadowColor = this.color;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

// --- FUNCTIONS ---
function initGame() {
    if (sfx.ctx.state === 'suspended') sfx.ctx.resume();
    core = new Core(canvas.width / 2, canvas.height / 2);
    player = new PlayerShield();
    turret = new AutoTurret();
    enemies = []; projectiles = []; friendlyProjectiles = []; particles = []; powerUps = []; xpGems = []; floatingTexts = []; shockwaves = []; empShockwaves = []; lightningArcs = [];
    score = 0; health = 100; maxHealth = 100; frames = 0; difficultyMultiplier = 1; bossSpawnTarget = 3000;
    shakeTime = 0; slowTimeRemaining = 0; overchargeRemaining = 0;
    comboMultiplier = 1; comboTimer = 0;
    energy = 0; empReady = false; empReadyText.classList.add('hidden');
    
    xp = 0; xpTarget = 100; level = 1; energyGainMultiplier = 1; hasChainLightning = false; hasDrones = false; drones = [];
    
    initStars();

    hiScoreInGame.innerText = highScore;
    newRecordMsg.classList.add('hidden');
    updateUI();
    
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    infoScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    levelUpScreen.classList.add('hidden');
    scoreBoard.classList.remove('hidden');
    healthBoard.classList.remove('hidden');
    
    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

function updateUI() {
    scoreValue.innerText = score;
    comboValue.innerText = `x${comboMultiplier}`;
    levelValue.innerText = level;
    
    if (comboMultiplier > 1) {
        comboContainer.style.color = `hsl(${Math.min(120, comboMultiplier*10)}, 100%, 50%)`;
    } else {
        comboContainer.style.color = 'var(--powerup-yellow)';
    }

    healthBar.style.width = Math.min(100, Math.max(0, (health / maxHealth) * 100)) + '%';
    if (health < maxHealth * 0.3) {
        healthBar.style.background = '#ff0000';
        healthBar.style.boxShadow = '0 0 10px #ff0000';
    } else {
        healthBar.style.background = 'var(--enemy-color)';
        healthBar.style.boxShadow = '0 0 10px var(--enemy-color)';
    }
    
    energyBar.style.width = Math.min(100, (energy / maxEnergy) * 100) + '%';
    if (energy >= maxEnergy && !empReady) {
        empReady = true;
        energyBar.classList.add('full');
        empReadyText.classList.remove('hidden');
    } else if (energy < maxEnergy && empReady) {
        empReady = false;
        energyBar.classList.remove('full');
        empReadyText.classList.add('hidden');
    }
    
    xpBar.style.width = Math.min(100, (xp / xpTarget) * 100) + '%';
}

function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

function applyScreenShake(intensity, duration) {
    shakeIntensity = intensity; shakeTime = duration;
}

function castChainLightning(x, y) {
    if (!hasChainLightning || enemies.length === 0) return;
    let closest = null;
    let minDist = Infinity;
    for(let e of enemies) {
        let d = Math.hypot(e.x - x, e.y - y);
        if (d < minDist && d < 400) {
            minDist = d;
            closest = e;
        }
    }
    if (closest) {
        lightningArcs.push(new LightningArc(x, y, closest));
    }
}

function addScore(basePts, x, y, color) {
        const totalPts = basePts * comboMultiplier;
        score += totalPts;
        floatingTexts.push(new FloatingText(x, y, `+${totalPts}`, color));
        
        if (!empReady) {
            energy += 5 * energyGainMultiplier; 
            updateUI();
        }
        
        comboMultiplier = Math.min(50, comboMultiplier + 1); // V10: Cap combo at 50
        
        if (comboMultiplier > 1 && comboMultiplier % 10 === 0) {
            health = Math.min(maxHealth, health + 10);
            floatingTexts.push(new FloatingText(core.x, core.y - 60, 'COMBO HEAL +10', 'var(--powerup-green)'));
            sfx.playPowerUp();
        }
        
        comboTimer = 180; 
        comboContainer.classList.remove('active');
        void comboContainer.offsetWidth; 
        comboContainer.classList.add('active');
        
        if (score >= bossSpawnTarget) {
            enemies.push(new DreadnoughtBoss());
            bossSpawnTarget += 5000 + Math.floor(bossSpawnTarget * 0.5); // V10: Exponential scaling
        }

        if (score > highScore) {
            highScore = score;
            hiScoreInGame.innerText = highScore;
        }
        if (score % 200 === 0) difficultyMultiplier += 0.1;
        updateUI();
    }

function addXp(amt) {
    xp += amt;
    sfx.playXP();
    if (xp >= xpTarget) {
        xp -= xpTarget;
        xpTarget = Math.floor(xpTarget * 1.5);
        level++;
        triggerLevelUp();
    }
    updateUI();
}

function triggerLevelUp() {
    gameState = 'LEVELUP';
    sfx.playLevelUp();
    levelUpScreen.classList.remove('hidden');
    
    let shuffled = [...PERK_POOL];
    if (hasChainLightning) shuffled = shuffled.filter(p => p.id !== 'chain_lightning');
    if (hasDrones) shuffled = shuffled.filter(p => p.id !== 'drones');
    shuffled = shuffled.sort(() => 0.5 - Math.random());
    let choices = shuffled.slice(0, 3);
    
    perksContainer.innerHTML = '';
    choices.forEach(perk => {
        let card = document.createElement('div');
        card.className = 'perk-card';
        card.innerHTML = `
            <div class="perk-icon">${perk.icon}</div>
            <div class="perk-title">${perk.title}</div>
            <div class="perk-desc">${perk.desc}</div>
        `;
        card.onclick = () => selectPerk(perk.id);
        perksContainer.appendChild(card);
    });
}

function selectPerk(id) {
    sfx.playPowerUp();
    switch(id) {
        case 'speed': core.speed += 1; break;
        case 'health': maxHealth += 20; health = Math.min(maxHealth, health + 20); break; // NERF
        case 'shield_thick': player.thickness += 5; break;
        case 'shield_wide': player.baseArcLength += 0.2; break;
        case 'turret_fast': turret.fireRate = Math.max(30, turret.fireRate * 0.85); break;
        case 'energy_siphon': energyGainMultiplier += 0.2; break;
        case 'chain_lightning': hasChainLightning = true; break;
        case 'drones': hasDrones = true; drones = [new Drone(0), new Drone(Math.PI)]; break;
    }
    updateUI();
    levelUpScreen.classList.add('hidden');
    gameState = 'PLAYING';
    gameLoop();
}

function checkCollisions() {
    // Projectiles vs Shield/Core
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const dx = p.x - core.x; const dy = p.y - core.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= player.radius + p.radius + player.thickness/2 && dist >= player.radius - p.radius - player.thickness/2) {
            let pAngle = Math.atan2(dy, dx);
            if (pAngle < 0) pAngle += Math.PI * 2;
            let angleDiff = pAngle - player.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (Math.abs(angleDiff) <= player.arcLength / 2 + 0.1) {
                // Deflect!
                sfx.playReflect();
                shockwaves.push(new Shockwave(p.x, p.y, player.color));
                createExplosion(p.x, p.y, p.color, 5);
                friendlyProjectiles.push(new FriendlyProjectile(p.x, p.y, -p.vx * 2, -p.vy * 2));
                castChainLightning(p.x, p.y);
                projectiles.splice(i, 1);
                continue;
            }
        }
        
        if (dist < core.radius + p.radius) {
            sfx.playCoreDamage();
            health -= p.damage;
            comboMultiplier = 1;
            createExplosion(p.x, p.y, core.color, 10);
            applyScreenShake(5, 10);
            gameContainer.classList.remove('flash-red');
            void gameContainer.offsetWidth;
            gameContainer.classList.add('flash-red');
            projectiles.splice(i, 1);
            updateUI();
            if (health <= 0) gameOver();
        }
    }
    
    // Friendly Projectiles vs Enemies
    for (let j = friendlyProjectiles.length - 1; j >= 0; j--) {
        const fp = friendlyProjectiles[j];
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const dist = Math.hypot(e.x - fp.x, e.y - fp.y);
            if (dist < e.radius + fp.radius) {
                if (e instanceof DreadnoughtBoss) {
                    e.bounce();
                    if (e.hp <= 0) {
                        e.die();
                        enemies.splice(i, 1);
                    }
                } else {
                    addScore(e.pts, e.x, e.y, e.color);
                    createExplosion(e.x, e.y, e.color, 15);
                    xpGems.push(new XpGem(e.x, e.y, e.pts));
                    if (e instanceof SplitterEnemy) e.split();
                    enemies.splice(i, 1);
                }
                friendlyProjectiles.splice(j, 1);
                break;
            }
        }
    }

    // Enemies vs Shield/Core
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.life !== undefined && e.life <= 0) {
            enemies.splice(i, 1);
            continue;
        }

        const dx = e.x - core.x; const dy = e.y - core.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Shield Collision (Phantom ignores shield)
        if (!(e instanceof PhantomEnemy) && dist <= player.radius + e.radius + player.thickness/2 && dist >= player.radius - e.radius - player.thickness/2) {
            let enemyAngle = Math.atan2(dy, dx);
            if (enemyAngle < 0) enemyAngle += Math.PI * 2;
            
            let angleDiff = enemyAngle - player.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (Math.abs(angleDiff) <= player.arcLength / 2 + 0.1) {
                sfx.playHit();
                shockwaves.push(new Shockwave(e.x, e.y, player.color));
                
                if (e instanceof DreadnoughtBoss || e instanceof GravityEnemy) {
                    if (e instanceof DreadnoughtBoss) e.bounce();
                    else { e.x -= e.vx*5; e.y -= e.vy*5; } 
                    
                    if (e.hp !== undefined && e.hp <= 0) {
                        e.die();
                        enemies.splice(i, 1);
                    }
                    continue; 
                }
                
                addScore(e.pts, e.x, e.y, e.color);
                createExplosion(e.x, e.y, e.color, 15);
                xpGems.push(new XpGem(e.x, e.y, e.pts));
                applyScreenShake(2, 5);
                
                if (e instanceof SplitterEnemy) e.split();
                
                enemies.splice(i, 1);
                continue;
            }
        }
        
        // Core Collision
        if (dist < core.radius + e.radius) {
            sfx.playCoreDamage();
            health -= e.damage;
            comboMultiplier = 1; 
            createExplosion(e.x, e.y, core.color, 20);
            applyScreenShake(10, 20);
            
            gameContainer.classList.remove('flash-red');
            void gameContainer.offsetWidth;
            gameContainer.classList.add('flash-red');
            
            if (e instanceof DreadnoughtBoss || e instanceof GravityEnemy) {
                if(e.hp !== undefined) e.hp--;
                e.x -= e.vx * 20;
                e.y -= e.vy * 20;
                if (e.hp !== undefined && e.hp <= 0) enemies.splice(i, 1);
            } else {
                enemies.splice(i, 1);
            }
            
            updateUI();
            if (health <= 0) gameOver();
        }
    }

    // Powerups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        const dx = p.x - core.x; const dy = p.y - core.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= player.radius + p.radius + player.thickness/2 && dist >= player.radius - p.radius - player.thickness/2) {
            let pAngle = Math.atan2(dy, dx);
            if (pAngle < 0) pAngle += Math.PI * 2;
            let angleDiff = pAngle - player.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (Math.abs(angleDiff) <= player.arcLength / 2 + 0.1) {
                sfx.playPowerUp();
                if (p.type === 'health') { health = Math.min(maxHealth, health + 20); }
                else if (p.type === 'overcharge') { overchargeRemaining = 300; }
                else if (p.type === 'slow') { slowTimeRemaining = 300; }
                else if (p.type === 'missile') {
                    sfx.playMissile();
                    for(let m=0; m<6; m++) friendlyProjectiles.push(new HomingMissile(core.x, core.y)); 
                }
                
                floatingTexts.push(new FloatingText(p.x, p.y, p.label, p.color));
                createExplosion(p.x, p.y, p.color, 20);
                powerUps.splice(i, 1);
                updateUI();
                continue;
            }
        }
        if (dist < core.radius + p.radius) powerUps.splice(i, 1);
    }
    
    // XP Gems vs Core
    for (let i = xpGems.length - 1; i >= 0; i--) {
        const g = xpGems[i];
        const dist = Math.hypot(g.x - core.x, g.y - core.y);
        if (dist < 150) {
            g.x += (core.x - g.x) / dist * 5;
            g.y += (core.y - g.y) / dist * 5;
        }
        if (dist < core.radius + g.radius) {
            addXp(g.value);
            xpGems.splice(i, 1);
        }
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    sfx.playGameOver();
    
    if (score >= highScore && score > 0) {
        localStorage.setItem('neonOrbitHighScore', score);
        newRecordMsg.classList.remove('hidden');
    }
    
    finalScoreValue.innerText = score;
    gameOverScreen.classList.remove('hidden');
    scoreBoard.classList.add('hidden');
    healthBoard.classList.add('hidden');
}

function spawnEnemy() {
    const rand = Math.random();
    let hasGravity = enemies.some(e => e instanceof GravityEnemy);
    let hasSniper = enemies.some(e => e instanceof SniperEnemy);
    
    if (rand > 0.95 && !hasGravity) enemies.push(new GravityEnemy());
    else if (rand > 0.85) enemies.push(new PhantomEnemy()); // V9: Phantom spawns
    else if (rand > 0.70) enemies.push(new SplitterEnemy());
    else if (rand > 0.55 && !hasSniper) enemies.push(new SniperEnemy()); 
    else if (rand > 0.35) enemies.push(new WeaverEnemy());
    else if (rand > 0.15) enemies.push(new FastEnemy());
    else enemies.push(new Enemy());
}

function drawNebulaBackground() {
    let cx = canvas.width/2;
    let cy = canvas.height/2;
    
    // Gradient Background
    let grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#0a0515');
    grd.addColorStop(0.5, '#150a25'); // Horizon
    grd.addColorStop(1, '#050210');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Synthwave Neon Sun - Enhanced
    let sunR = Math.min(canvas.width, canvas.height) * 0.25;
    ctx.save();
    ctx.translate(cx, cy - 20); // Hover slightly above horizon
    
    // Massive Soft Sun Glow
    let glowGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, sunR * 2.5);
    glowGrd.addColorStop(0, 'rgba(255, 100, 0, 0.4)');
    glowGrd.addColorStop(0.5, 'rgba(255, 0, 100, 0.1)');
    glowGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrd;
    ctx.beginPath();
    ctx.arc(0, 0, sunR * 2.5, 0, Math.PI*2);
    ctx.fill();
    
    // Sun Gradient
    let sunGrd = ctx.createLinearGradient(0, -sunR, 0, sunR);
    sunGrd.addColorStop(0, '#fff5cc'); // Super bright top
    sunGrd.addColorStop(0.2, '#ffcc00'); // Yellow
    sunGrd.addColorStop(0.6, '#ff3366'); // Pink/Orange
    sunGrd.addColorStop(1, '#6600ff'); // Deep purple bottom
    
    // Draw the sun with retro cuts
    // Instead of drawing the top half solid and clipping the bottom,
    // let's clip the entire sun shape with calculated bars
    ctx.beginPath();
    ctx.arc(0, 0, sunR, 0, Math.PI*2);
    ctx.fillStyle = sunGrd;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#ff00aa';
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Blackout the retro cuts (to reveal background behind the sun)
    ctx.globalCompositeOperation = 'destination-out';
    for(let i = 0; i < 9; i++) {
        // Cut width increases as it goes down
        let yTop = (sunR * 0.1) + i * (sunR/8);
        let cutHeight = 2 + (i * 2.5); 
        
        ctx.beginPath();
        ctx.rect(-sunR, yTop, sunR*2, cutHeight);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    // V10.5: Animated 3D Perspective Grid
    ctx.save();
    ctx.translate(cx, cy); // Horizon line
    let speed = frames * 0.05;
    let gridSpacing = 80;
    let maxZ = 30;
    
    // Vertical Lines (fanning out)
    ctx.lineWidth = 2;
    for (let x = -25; x <= 25; x++) {
        ctx.beginPath();
        let startX = (x * gridSpacing * maxZ) / maxZ; 
        let endX = (x * gridSpacing * maxZ) / 0.1;
        ctx.moveTo(startX, 0); // Horizon
        ctx.lineTo(endX, canvas.height); // Bottom
        
        let lineGrd = ctx.createLinearGradient(0, 0, 0, canvas.height/2);
        lineGrd.addColorStop(0, 'rgba(0, 255, 255, 0)');
        lineGrd.addColorStop(0.3, 'rgba(0, 255, 255, 0.4)');
        lineGrd.addColorStop(1, 'rgba(255, 0, 255, 0.8)');
        ctx.strokeStyle = lineGrd;
        ctx.stroke();
    }

    // Horizontal Lines (moving towards camera)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    for (let z = 1; z < maxZ; z++) {
        let actualZ = z - (speed % 1); // Moves from maxZ down to 0
        if (actualZ <= 0.1) continue;
        
        let y = 800 / actualZ; 
        if (y > canvas.height/2) continue; // Don't draw past bottom
        
        ctx.beginPath();
        ctx.moveTo(-canvas.width, y);
        ctx.lineTo(canvas.width, y);
        
        // Fade in at horizon, bright near camera
        ctx.globalAlpha = Math.max(0, 1 - (actualZ / maxZ));
        
        // Pinkish near camera, cyan near horizon
        if (actualZ < 5) ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
        else ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.stroke();
    }
    
    ctx.restore();
    
    // Floating ambient dust
    ctx.fillStyle = '#ffffff';
    for(let i=0; i<30; i++) {
        let dx = (Math.sin(frames*0.01 + i) * 100 + i*100) % canvas.width;
        let dy = (Math.cos(frames*0.01 + i) * 100 + i*100) % canvas.height;
        if (dx < 0) dx += canvas.width;
        if (dy < 0) dy += canvas.height;
        
        ctx.globalAlpha = 0.2 + Math.sin(frames*0.05 + i)*0.2;
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + i%2, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    drawNebulaBackground();

    ctx.save();
    
    // Parallax
    let offsetX = (canvas.width/2 - core.x) * 0.1;
    let offsetY = (canvas.height/2 - core.y) * 0.1;
    
    // Draw Stars
    stars.forEach(s => {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.brightness * (0.5 + Math.sin(frames*0.05 + s.z)*0.5);
        ctx.beginPath();
        ctx.arc(s.x + offsetX * s.z * 5, s.y + offsetY * s.z * 5, s.size, 0, Math.PI*2);
        ctx.fill();
        s.y += s.speed || 0.1;
        if(s.y > canvas.height * 2) { s.y = -canvas.height; s.x = Math.random() * canvas.width * 3 - canvas.width; }
    });
    ctx.globalAlpha = 1.0;

    // V10: Glitch Effect on damage
    if (shakeTime > 0) {
        const sx = (Math.random() - 0.5) * shakeIntensity;
        const sy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(sx, sy);
        
        // Chromatic aberration glitch
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(-10, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        ctx.fillRect(10, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        
        shakeTime--;
    }

    if (slowTimeRemaining > 0) slowTimeRemaining--;
    
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            comboMultiplier = 1;
            updateUI();
        }
    }

    frames++;
    // V9: Harsher difficulty scaling
    let currentSpawnRate = Math.max(15, 60 - difficultyMultiplier * 8);
    if (slowTimeRemaining > 0) currentSpawnRate *= 2;

    if (frames % Math.floor(currentSpawnRate) === 0) spawnEnemy();
    if (frames % 500 === 0) powerUps.push(new PowerUp()); 

    core.update();

    turret.update();
    turret.draw();

    core.draw();
    player.update();
    player.draw();

    [particles, powerUps, shockwaves, empShockwaves, lightningArcs, floatingTexts, projectiles, friendlyProjectiles, xpGems, drones].forEach(arr => {
        for (let i = arr.length - 1; i >= 0; i--) {
            arr[i].update();
            arr[i].draw();
            if (arr[i].life !== undefined && arr[i].life <= 0) arr.splice(i, 1);
            else if (arr[i].active !== undefined && !arr[i].active) arr.splice(i, 1);
            else if (arr[i] instanceof Projectile || arr[i] instanceof FriendlyProjectile || arr[i] instanceof HomingMissile) {
                if (arr[i].x < -500 || arr[i].x > canvas.width+500 || arr[i].y < -500 || arr[i].y > canvas.height+500) arr.splice(i, 1);
            }
        }
    });

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const {vx, vy, speed} = e;
        if (slowTimeRemaining > 0) { e.vx *= 0.5; e.vy *= 0.5; }
        
        e.update();
        e.draw();
        
        if (slowTimeRemaining > 0) { e.vx = vx; e.vy = vy; }
        
        const dx = e.x - core.x; const dy = e.y - core.y;
        if (Math.sqrt(dx*dx + dy*dy) > Math.max(canvas.width, canvas.height) + 500) enemies.splice(i, 1);
    }

    checkCollisions();
    ctx.restore();
    animationId = requestAnimationFrame(gameLoop);
}

// Listeners
startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', initGame);
resumeBtn.addEventListener('click', togglePause);

// Initial clear
ctx.fillStyle = '#050510';
ctx.fillRect(0, 0, canvas.width, canvas.height);
