import { drawTankSprite } from "./art.js";
const guppySheets = {
    swim: ["smallswim.gif", "smallswim_.gif", 5],
    turn: ["smallturn.gif", "smallturn_.gif", 5],
    eat: ["smalleat.gif", "smalleat_.gif", 5],
};
const hungryGuppySheets = {
    swim: ["hungryswim.gif", "_hungryswim.gif", 5],
    turn: ["hungryturn.gif", "_hungryturn.gif", 5],
    eat: ["hungryeat.gif", "hungryeat_.gif", 5],
};
const sheets = {
    guppyDeath: ["smalldie.gif", "_smalldie.gif", 5],
    breeder: ["breeder.gif", "_breeder.gif", 9],
    hungryBreeder: ["hungrybreeder.gif", "_hungrybreeder.gif", 12],
    ultra: ["ultravore.gif", "_ultravore.gif", 4],
    gekko: ["gekko.gif", "_gekko.gif", 7],
    penta: ["starcatcher.gif", "_starcatcher.gif", 3],
    grubber: ["grubgrubber.gif", "_grubgrubber.gif", 5],
    smallSylvester: ["smallsylv.gif", "_smallsylv.gif", 2],
    largeSylvester: ["sylv.gif", "_sylv.gif", 2],
    ball: ["balls.gif", "_balls.gif", 4],
    bi: ["bilaterus.gif", "_bilaterus.gif", 8],
};
function drawSheet(ctx, [src, alpha, rows], frame, row, x, y, width, direction) {
    return drawTankSprite(ctx, src, alpha, 10, rows, frame, row, x, y, width, direction);
}
function guppyRow(stage) {
    return stage < 3 ? stage : stage - 1;
}
function growthScale(fish) {
    if (fish.growthTicks === 0 || fish.stage >= 3)
        return 1;
    if (fish.growthTicks <= 3)
        return 1 + fish.growthTicks * 0.07;
    const start = fish.kind === "breeder" ? 0.7 : fish.kind === "sylvester" ? 0.6 : 0.5;
    return start + (10 - fish.growthTicks) * (1.2 - start) / 7;
}
export function drawFishLayer(ctx, art, fish, timeSeconds) {
    if (fish.hidden)
        return;
    if (fish.kind === "guppy" && art.customFish) {
        art.drawFish(ctx, fish.x, fish.y, fish.size, fish.direction, timeSeconds, fish.stage);
        return;
    }
    const turning = fish.animation === "turn";
    const eating = fish.animation === "eat";
    const { x, y, frame, stage, hungry } = fish;
    let direction = turning ? -fish.direction : fish.direction;
    let sheet;
    let row;
    let width = 80;
    switch (fish.kind) {
        case "guppy":
        case "oscar":
            sheet = (hungry ? hungryGuppySheets : guppySheets)[fish.animation];
            row = fish.kind === "oscar" ? 4 : guppyRow(stage);
            break;
        case "breeder":
            sheet = hungry ? sheets.hungryBreeder : sheets.breeder;
            row = eating && hungry ? stage + 9 : stage * 3 + (turning ? 1 : eating ? 2 : 0);
            break;
        case "ultra":
            sheet = sheets.ultra;
            row = turning ? 2 : eating ? 1 : 0;
            width = 160;
            break;
        case "gekko":
            sheet = sheets.gekko;
            row = eating && hungry ? 6 : (hungry ? 3 : 0) + (turning ? 1 : eating ? 2 : 0);
            break;
        case "penta":
            sheet = sheets.penta;
            row = hungry ? 1 : 0;
            direction = -1;
            break;
        case "grubber":
            sheet = sheets.grubber;
            row = eating ? (hungry ? 4 : 1) : (hungry ? 2 : 0);
            direction = -1;
            break;
        case "sylvester":
            sheet = stage === 1 ? sheets.smallSylvester : sheets.largeSylvester;
            row = Number(turning);
            width = stage === 1 ? 80 : 160;
            break;
        case "ball":
            sheet = sheets.ball;
            row = stage === 0 ? 0 : stage === 1 ? 2 : 1;
            width = 50;
            break;
        case "bi": {
            sheet = sheets.bi;
            const swimRow = fish.variant ? 2 : 5;
            row = turning ? swimRow - (fish.alternateTurn ? 2 : 1) : swimRow;
            if (turning && fish.alternateTurn)
                direction *= -1;
            break;
        }
    }
    width *= growthScale(fish);
    const glowing = fish.kind === "guppy" && stage === 3;
    const tinted = fish.kind === "ultra" && hungry;
    if (glowing || tinted)
        ctx.save();
    const alpha = ctx.globalAlpha;
    if (glowing)
        ctx.globalAlpha *= 0.61;
    if (tinted)
        ctx.filter = "sepia(0.7) saturate(1.4)";
    const drawn = drawSheet(ctx, sheet, frame, row, x, y, width, direction);
    if (drawn && glowing && !hungry) {
        ctx.globalAlpha = alpha * 0.78;
        ctx.globalCompositeOperation = "lighter";
        drawSheet(ctx, sheet, frame, row, x, y, width, direction);
    }
    if (glowing || tinted)
        ctx.restore();
    if (!drawn)
        art.drawFish(ctx, x, y, fish.size, fish.direction, timeSeconds, stage);
}
export function drawDeadFish(ctx, art, corpse, timeSeconds) {
    const { fish, x, y, age, floorTicks, reviveTicks } = corpse;
    const { kind, stage, direction } = fish;
    const bottom = kind === "penta" || kind === "grubber";
    let frame = 9;
    if (reviveTicks > 0)
        frame = Math.min(9, reviveTicks);
    else if (age < 20)
        frame = Math.floor(age / 2);
    else if (!bottom)
        frame = Math.max(6, 9 - Math.floor(floorTicks / 2));
    const sheet = kind === "breeder" ? sheets.hungryBreeder : kind === "ultra" || kind === "gekko" || bottom ? sheets[kind] : sheets.guppyDeath;
    let row = guppyRow(stage);
    if (kind === "oscar")
        row = 4;
    else if (kind === "breeder")
        row = stage * 3 + 2;
    else if (kind === "ultra" || kind === "grubber")
        row = 3;
    else if (kind === "gekko")
        row = 5;
    else if (kind === "penta")
        row = 2;
    ctx.save();
    ctx.globalAlpha *= Math.max(0, 1 - floorTicks / 50);
    if (kind === "bi" || kind === "ball" || kind === "sylvester") {
        drawFishLayer(ctx, art, { ...fish, x, y, hidden: false }, timeSeconds);
    }
    else if ((kind === "guppy" && art.customFish) || !drawSheet(ctx, sheet, frame, row, x, y, undefined, bottom ? -1 : direction)) {
        art.drawFish(ctx, x, y, fish.size, direction, timeSeconds, stage);
    }
    ctx.restore();
}
