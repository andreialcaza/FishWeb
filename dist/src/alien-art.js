import { drawTankSprite } from "./art.js";
import { TANK_WIDTH } from "./tank-geometry.js";
const alienSheets = {
    "weak-sylv": ["sylv", 2, "#80bf58"],
    "strong-sylv": ["sylv", 2, "#8ab843"],
    balrog: ["balrog", 2, "#b7393b"],
    gus: ["gus", 3, "#805ea9"],
    destructor: ["destructor", 2, "#a9a199"],
    ulysees: ["ulysses", 3, "#3e91be"],
    psychosquid: ["psychosquid", 5, "#cf6c37"],
    bilaterus: ["bilaterus", 8, "#dadbc5"],
    "mini-sylv": ["smallsylv", 2, "#87ba4c"],
    cyrax: ["boss", 2, "#8454b5"],
};
function drawPart(ctx, kind, part, size, flash = true) {
    const [stem, rows, color] = alienSheets[kind];
    const turning = kind === "bilaterus" ? part.row === 1 || part.row === 4 : part.row === 1 || part.row === 3;
    const direction = turning && part.turnTicks ? Math.sign(part.turnTicks) : part.direction;
    const { x, y, row, frame } = part;
    if (drawTankSprite(ctx, `${stem}.gif`, `_${stem}.gif`, 10, rows, frame, row, x, y, size, direction)) {
        if (flash && part.hitFlash > 0) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha *= Math.min(1, part.hitFlash / 12);
            drawTankSprite(ctx, `${stem}.gif`, `_${stem}.gif`, 10, rows, frame, row, x, y, size, direction);
            ctx.restore();
        }
        return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.fillStyle = flash && part.hitFlash > 0 ? "#d3f7ec" : color;
    ctx.strokeStyle = "#1d303d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.3, size * 0.23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#172738";
    ctx.beginPath();
    ctx.arc(size * 0.18, size * -0.05, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
function drawHealth(ctx, alien) {
    const width = 127;
    const x = alien.x + (alien.kind === "bilaterus" ? 3.5 : 10 + width / 2 - alien.size / 2);
    const y = alien.y + alien.size / 2 - 3;
    const ratio = Math.min(1, Math.max(0, alien.health / alien.maxHealth));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - width / 2, y, width * ratio, 15);
    ctx.clip();
    if (!drawTankSprite(ctx, "healthbar.gif", "healthbar_.gif", 1, 1, 0, 0, x, y + 7.5, width)) {
        ctx.fillStyle = "#67d849";
        ctx.fillRect(x - width / 2, y + 3, width, 6);
    }
    ctx.restore();
    if (!drawTankSprite(ctx, "healthbartube.gif", "healthbartube_.gif", 1, 1, 0, 0, x, y + 7.5, width)) {
        ctx.strokeStyle = "#143a43";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - width / 2, y + 3, width, 6);
    }
}
function drawProjectile(ctx, projectile) {
    const { x, y, frame, row, kind, interception } = projectile;
    let drawn = false;
    if (kind === "missile")
        drawn = drawTankSprite(ctx, "missile.gif", "_missile.gif", 16, 1, frame, 0, x, y);
    else if (kind === "pet-ball")
        drawn = drawTankSprite(ctx, "balls.gif", "_balls.gif", 10, 4, frame, row, x, y);
    else if (kind === "head" || kind === "bone") {
        drawPart(ctx, "bilaterus", projectile, 80, false);
        drawn = true;
    }
    else {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (projectile.reflected)
            ctx.filter = "sepia(1) saturate(2)";
        drawn = drawTankSprite(ctx, "energyball.gif", undefined, 6, 1, frame, 0, x, y);
        ctx.filter = "none";
        if (drawn)
            drawTankSprite(ctx, "energyball.gif", undefined, 6, 1, 5, 0, x, y);
        ctx.restore();
    }
    if (!drawn) {
        ctx.fillStyle = kind === "missile" ? "#ffd38a" : projectile.reflected ? "#e3ef7a" : "#8fd8ff";
        ctx.beginPath();
        ctx.arc(x, y, kind === "energy-ball" ? 10 : 6, 0, Math.PI * 2);
        ctx.fill();
    }
    if (!interception)
        return;
    const { from, ticks, duration } = interception;
    const progress = Math.min(1, ticks / duration);
    const ballX = from.x + (x - from.x) * progress;
    const ballY = from.y + (y - from.y) * progress;
    if (!drawTankSprite(ctx, "balls.gif", "_balls.gif", 10, 4, ticks % 10, 1, ballX, ballY, 38)) {
        ctx.fillStyle = "#d1fd8c";
        ctx.beginPath();
        ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawEffect(ctx, effect) {
    const { x, y, kind, ticks, duration } = effect;
    const progress = 1 - ticks / duration;
    if (kind === "warp") {
        const frame = Math.min(16, Math.floor(progress * 17));
        const drawn = drawTankSprite(ctx, "warphole.gif", "_warphole.gif", 17, 1, frame, 0, x, y - 10);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const glow = drawTankSprite(ctx, "warpglow.gif", "_warpglow.gif", 17, 1, frame, 0, x, y - 10);
        ctx.restore();
        if (drawn || glow)
            return;
    }
    else if (kind === "laser" || kind === "explosion") {
        const laser = kind === "laser";
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const frame = Math.min(9, Math.floor(progress * 10));
        const drawn = drawTankSprite(ctx, laser ? "lasers.gif" : "explosion.gif", laser ? "_lasers.gif" : "_explosion.gif", 10, laser ? 6 : 1, frame, 0, x, y);
        ctx.restore();
        if (drawn)
            return;
    }
    ctx.save();
    ctx.globalAlpha *= 1 - progress;
    ctx.strokeStyle = kind === "explosion" ? "#ffcb74" : kind === "hit" ? "#fff3d6" : "#a3f4ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const radius = 5 + progress * (kind === "warp" ? 55 : kind === "explosion" ? 28 : 15);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
const warnings = {
    gus: "Alien signature type G detected",
    destructor: "Alien signature type D detected",
    ulysees: "Alien signature type U detected",
    psychosquid: "Alien signature type P detected",
    bilaterus: "Alien signature type II detected",
    cyrax: "Cyrax approaching",
};
export function drawAlienLayer(ctx, system, showHealth, showCrosshairs) {
    ctx.save();
    for (const corpse of system.deadAliens) {
        if (corpse.opacity === 0)
            continue;
        ctx.save();
        ctx.globalAlpha *= corpse.opacity;
        drawPart(ctx, corpse.kind, corpse, 160);
        ctx.restore();
    }
    for (const alien of system.aliens) {
        if (alien.heads) {
            if (alien.spawnTicks >= 7)
                continue;
            for (const bone of [...(alien.bones ?? [])].reverse()) {
                if (!alien.spawnTicks)
                    drawPart(ctx, alien.kind, bone, 80);
            }
            for (const head of [...alien.heads].reverse()) {
                const scale = head.active ? 0.64 : 1;
                drawPart(ctx, alien.kind, head, 80 * (1 - alien.spawnTicks / 7 * scale));
            }
        }
        else {
            if (alien.spawnTicks >= 10)
                continue;
            const flash = !alien.healing && alien.kind !== "mini-sylv" && (alien.kind !== "gus" || alien.row !== 2);
            drawPart(ctx, alien.kind, alien, alien.size * (1 - alien.spawnTicks / 10), flash);
        }
        if (!alien.spawnTicks && (showHealth || alien.kind === "cyrax"))
            drawHealth(ctx, alien);
    }
    for (const projectile of system.projectiles)
        drawProjectile(ctx, projectile);
    for (const effect of system.effects)
        drawEffect(ctx, effect);
    const warning = system.warning;
    if (warning) {
        const message = warning.kinds.length > 1 ? "Multiple alien signatures detected"
            : warnings[warning.kinds[0]] ?? "Enemy approaching";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#391e29";
        ctx.fillStyle = "#ff8982";
        ctx.strokeText(message, TANK_WIDTH / 2, 29);
        ctx.fillText(message, TANK_WIDTH / 2, 29);
        if ((showCrosshairs || warning.crosshairs) && warning.ticks <= 225) {
            ctx.globalCompositeOperation = "lighter";
            warning.points.forEach(({ x, y }, index) => {
                const frame = (Math.floor((225 - warning.ticks) / 4) + index * 2) % 5;
                if (drawTankSprite(ctx, "crosshair.gif", undefined, 5, 1, frame, 0, x, y))
                    return;
                ctx.beginPath();
                ctx.arc(x, y, 26, 0, Math.PI * 2);
                ctx.moveTo(x - 33, y);
                ctx.lineTo(x + 33, y);
                ctx.moveTo(x, y - 33);
                ctx.lineTo(x, y + 33);
                ctx.strokeStyle = "#ff8982";
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    }
    ctx.restore();
}
