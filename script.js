const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startDate = new Date(2023, 0, 15, 12, 0, 0);

/* =========================
   VARIABLES RESPONSIVAS
========================= */
let isMobile = false;
let centerX = 0;
let groundY = 0;
let targetOffset = 0; // Cuánto se moverá el árbol

/* =========================
   CONFIGURACIÓN DE PANTALLA (RESPONSIVE + HD)
========================= */
function setupCanvas() {
    // Detectar pixel ratio para que se vea nítido en celulares
    const dpr = window.devicePixelRatio || 1;

    // Tamaño lógico
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // Escalar contexto para que las medidas sigan siendo lógicas
    ctx.scale(dpr, dpr);

    // Ajustar estilo CSS para que ocupe la pantalla
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    // Detectar si es móvil (ancho menor a 768px)
    isMobile = window.innerWidth < 768;

    // Configuración de posiciones
    groundY = window.innerHeight * 0.88; // Suelo al 88% de la altura lógica
    centerX = window.innerWidth / 2;     // Centro lógico

    // LÓGICA DE MOVIMIENTO:
    // PC: Se mueve a la derecha (25% del ancho)
    // MÓVIL: No se mueve (0), se queda centrado
    targetOffset = isMobile ? 0 : window.innerWidth * 0.25;
}

window.addEventListener("resize", () => {
    setupCanvas();
    // Reiniciar posiciones si se redimensiona drásticamente
    heart.x = centerX;
    heart.y = window.innerHeight / 2 - 100;
});
setupCanvas(); // Iniciar

/* =========================
   CONFIGURACIÓN JUEGO
========================= */
const treeColor = "#5d4037";
const leafColors = ["#ff5d8f", "#ff87ab", "#ffacc5", "#ffb3c1", "#c62828"];

let state = "idle";
let globalProgress = 0;
let moveProgress = 0;
let bloomDurationCounter = 0;
const TIME_TO_WIND = 600;

let heart = {
    x: centerX,
    y: window.innerHeight / 2 - 100, // Posición inicial
    size: 20,
    vy: 0
};

let backLeaves = [], frontLeaves = [], flyingLeaves = [], branchTips = [];

/* =========================
   FUNCIONES DE DIBUJO
========================= */
function drawHeart(x, y, size) {
    ctx.fillStyle = "#c62828";
    ctx.beginPath();
    let topY = y - size / 2;
    ctx.moveTo(x, topY);
    ctx.bezierCurveTo(x - size, topY - size, x - size * 2, topY + size / 2, x, topY + size * 2);
    ctx.bezierCurveTo(x + size * 2, topY + size / 2, x + size, topY - size, x, topY);
    ctx.fill();
}

class Leaf {
    constructor(sx, sy, tx, ty) {
        this.sx = sx; this.sy = sy;
        this.x = sx; this.y = sy;
        this.tx = tx; this.ty = ty;
        // Hojas un poco más grandes en móvil para que se vean bien
        this.size = (Math.random() * 2 + 2.5) * (isMobile ? 1.5 : 1);
        this.color = leafColors[Math.floor(Math.random() * leafColors.length)];
        this.alpha = 0;
        this.t = 0;
        this.delay = Math.random() * 50;

        // Vuelo
        this.isFlying = false;
        this.vx = -2 - Math.random() * 3;
        this.vy = (Math.random() - 0.5) * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.spinSpeed = (Math.random() - 0.5) * 0.1;
    }

    update() {
        if (this.isFlying) {
            this.x += this.vx;
            this.y += this.vy + Math.sin(this.x * 0.05) * 0.5;
            this.angle += this.spinSpeed;
            this.alpha -= 0.005;
            return;
        }
        if (this.delay > 0) { this.delay--; return; }
        this.t += 0.012;
        if (this.t > 1) this.t = 1;
        const ease = 1 - Math.pow(1 - this.t, 3);
        this.x = this.sx + (this.tx - this.sx) * ease;
        this.y = this.sy + (this.ty - this.sy) * ease;
        this.alpha = Math.min(1, this.alpha + 0.02);
    }

    draw() {
        this.update();
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        if (this.isFlying) ctx.rotate(this.angle);
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(0, -s / 2);
        ctx.bezierCurveTo(-s, -s * 1.5, -s * 2, 0, 0, s * 1.5);
        ctx.bezierCurveTo(s * 2, 0, s, -s * 1.5, 0, -s / 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnLeaves() {
    if (branchTips.length === 0) return;
    const cx = centerX;
    const cy = groundY - window.innerHeight * (isMobile ? 0.45 : 0.58); // Altura copa ajustada
    const baseScale = window.innerHeight * 0.025;

    for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(a), 3);
        let y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        const f = Math.sqrt(Math.random());
        x *= baseScale * f;
        y *= baseScale * f;
        const tip = branchTips[Math.floor(Math.random() * branchTips.length)];
        const leaf = new Leaf(
            tip.x, tip.y,
            cx + x + (Math.random() - 0.5) * baseScale,
            cy + y + (Math.random() - 0.5) * baseScale
        );
        Math.random() < 0.45 ?
            (leaf.color = "#ffd1dc", leaf.size *= 0.7, backLeaves.push(leaf)) :
            frontLeaves.push(leaf);
    }
}

function spawnFlyingLeaf() {
    const cx = centerX;
    const cy = groundY - window.innerHeight * (isMobile ? 0.45 : 0.58);
    const baseScale = window.innerHeight * 0.025;
    const a = Math.random() * Math.PI * 2;
    let x = 16 * Math.pow(Math.sin(a), 3);
    let y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    x *= baseScale * Math.sqrt(Math.random());
    y *= baseScale * Math.sqrt(Math.random());
    const leaf = new Leaf(cx + x, cy + y, cx + x, cy + y);
    leaf.isFlying = true; leaf.alpha = 1; leaf.delay = 0;
    flyingLeaves.push(leaf);
}

function drawTreeStep(x, y, len, ang, w, gen, p) {
    if (p <= 0 || gen > 4) return;
    const curr = len * p;
    const ex = x + Math.cos(ang) * curr;
    const ey = y + Math.sin(ang) * curr;
    ctx.strokeStyle = treeColor;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
        (x + ex) / 2 + Math.cos(ang + Math.PI / 2) * len * 0.15,
        (y + ey) / 2 + Math.sin(ang + Math.PI / 2) * len * 0.15,
        ex, ey
    );
    ctx.stroke();

    if (gen === 4 && p >= 0.95 && !branchTips.some(t => Math.hypot(t.x - ex, t.y - ey) < 6)) {
        branchTips.push({ x: ex, y: ey });
    }
    if (p > 0.7 && gen < 5) {
        const np = (p - 0.7) / 0.3;
        drawTreeStep(ex, ey, len * 0.74, ang - 0.35, w * 0.7, gen + 1, np);
        drawTreeStep(ex, ey, len * 0.74, ang + 0.35, w * 0.7, gen + 1, np);
    }
}

function updateTimer() {
    const diff = new Date() - startDate;
    document.getElementById("days").innerText = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById("hours").innerText = Math.floor((diff / (1000 * 60 * 60)) % 24);
    document.getElementById("minutes").innerText = Math.floor((diff / (1000 * 60)) % 60);
    document.getElementById("seconds").innerText = Math.floor((diff / 1000) % 60);
}

/* =========================
   ANIMACIÓN PRINCIPAL
========================= */
function animate() {
    // Usamos window.innerWidth/Height para limpiar porque el canvas tiene escalado
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // SUELO
    if (state !== "idle" && state !== "falling") {
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(window.innerWidth, groundY); // Ancho completo lógico
        ctx.strokeStyle = "#8d6e63";
        ctx.stroke();
    }

    // MOVIMIENTO LATERAL (Solo afecta si targetOffset > 0, es decir, en PC)
    let currentShift = 0;
    if (state === "blooming" || state === "windy") {
        if (moveProgress < 1) moveProgress += 0.005;
        const ease = moveProgress < 0.5 ? 4 * Math.pow(moveProgress, 3) : 1 - Math.pow(-2 * moveProgress + 2, 3) / 2;
        currentShift = targetOffset * ease;
        document.getElementById("message-container").style.opacity = ease;
    }

    ctx.save();
    ctx.translate(currentShift, 0);

    if (state === "idle") {
        drawHeart(heart.x, heart.y, heart.size);
        ctx.fillStyle = "#8b3a3a";
        ctx.font = "italic 18px Georgia";
        ctx.fillText("Click aquí", heart.x + 30, heart.y);
    }
    else if (state === "falling") {
        heart.vy += 0.5;
        heart.y += heart.vy;
        drawHeart(heart.x, heart.y, heart.size);
        if (heart.y >= groundY) {
            heart.y = groundY;
            state = "growing";
            globalProgress = 0;
        }
    }
    else {
        // Altura y grosor del árbol relativos a la pantalla
        const treeHeight = window.innerHeight * 0.25;
        const trunkWidth = window.innerHeight * 0.055;

        drawTreeStep(centerX, groundY, treeHeight, -Math.PI / 2, trunkWidth, 0, globalProgress / 100);

        if (state === "growing") {
            globalProgress += 0.6;
            if (globalProgress >= 100) state = "blooming";
        }

        if (state === "blooming" || state === "windy") {
            if (backLeaves.length + frontLeaves.length < 18000) spawnLeaves();
            if (state === "blooming" && ++bloomDurationCounter > TIME_TO_WIND) state = "windy";
        }

        if (state === "windy") {
            spawnFlyingLeaf(); spawnFlyingLeaf();
            flyingLeaves.forEach(l => l.draw());
            flyingLeaves = flyingLeaves.filter(l => l.alpha > 0);
        }

        backLeaves.forEach(l => l.draw());
        frontLeaves.forEach(l => l.draw());
    }

    ctx.restore();
    updateTimer();
    requestAnimationFrame(animate);
}

// EVENTOS: Soportar Click y Touch (Toque en pantalla)
function startGame() { if (state === "idle") state = "falling"; }
canvas.addEventListener("click", startGame);
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); // Evitar zoom o scroll
    startGame();
}, { passive: false });

animate();