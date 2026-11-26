import { drawTankSprite } from "./art.js";
import { PET_INFO } from "./pets.js";
const petSpecies = {
    stinky: "Snail", niko: "Oyster", itchy: "Swordfish", prego: "Momma Fish", zorf: "Sea Horse",
    clyde: "Jellyfish", vert: "Skeleton", rufus: "Fiddler Crab", meryl: "Mermaid", wadsworth: "Whale",
    seymour: "Turtle", shrapnel: "Robot Fish", gumbo: "Angler", blip: "Porpoise", rhubarb: "Hermit Crab",
    nimbus: "Manta Ray", amp: "Electric Eel", gash: "Shark", angie: "Angelfish", presto: "Tadpole",
};
const ANIMATION_TICK_MS = 10;
const HATCH_TICK = 140;
const DETAILS_TICK = 170;
const ANIMATION_END = 220;
const shardVelocities = [[1, -10], [-11, -15], [-14, 3], [12, -13], [-15, 10], [11, 5], [13, 14], [-1, 12]];
const slowPortraits = new Set(["seymour", "shrapnel", "clyde", "rhubarb", "brinkley"]);
export function setupHatchScreen(playSound, onContinue, onMenu) {
    const screen = document.getElementById("hatch-screen");
    const title = document.getElementById("hatch-title");
    const details = document.getElementById("hatch-reward");
    const name = document.getElementById("hatch-name");
    const description = document.getElementById("hatch-description");
    const saveStatus = document.getElementById("hatch-save-status");
    const menu = document.getElementById("hatch-menu");
    const skip = document.getElementById("hatch-skip");
    const next = document.getElementById("hatch-continue");
    const canvas = document.getElementById("hatch-art");
    const ctx = canvas.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reward;
    let tick = 0;
    let startedAt = 0;
    let frameId;
    function draw() {
        if (!ctx || screen.hidden)
            return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (tick <= HATCH_TICK || reward === "cyrax") {
            const firstStrip = tick <= 80;
            const strip = firstStrip ? "EggCrack1.gif" : "EggCrack2.gif";
            const column = Math.max(0, Math.floor((tick - (firstStrip ? 56 : 120)) / 2));
            const shake = tick <= HATCH_TICK ? Math.round(2 * Math.sin(tick * Math.PI / 16)) : 0;
            const drawn = drawTankSprite(ctx, strip, `_${strip}`, firstStrip ? 13 : 10, 1, column, 0, 317, 132.5 + shake);
            if (!drawn && tick <= HATCH_TICK) {
                ctx.fillStyle = "#fff0c8";
                ctx.beginPath();
                ctx.ellipse(317, 132.5 + shake, 31, 42, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            if (reward === "cyrax" && tick > HATCH_TICK) {
                const rise = Math.min(1, (tick - HATCH_TICK) / (ANIMATION_END - HATCH_TICK));
                drawTankSprite(ctx, "boss.gif", "_boss.gif", 10, 2, tick / 2 % 10, 0, 318, 130 + 430 * (1 - rise) ** 3);
            }
            return;
        }
        const { stem, columns, rows, width, height } = PET_INFO[reward];
        const swing = tick % 20;
        const frame = reward === "vert" || reward === "niko" ? Math.min(swing, 19 - swing)
            : tick / (slowPortraits.has(reward) ? 4 : 2) % columns;
        const top = reward === "niko" ? 70 : reward === "stinky" || reward === "clyde" || reward === "amp" ? 100 : 90;
        drawTankSprite(ctx, `${stem}.gif`, `_${stem}.gif`, columns, rows, frame, 0, 318, top + height / 2, width);
        if (tick < 200) {
            const age = tick - HATCH_TICK;
            for (const [index, [vx, vy]] of shardVelocities.entries()) {
                drawTankSprite(ctx, "eggshards.gif", "_eggshards.gif", 8, 1, index, 0, 318 + vx * age, 132.5 + vy * age);
            }
        }
    }
    function advance(nextTick) {
        if (tick <= HATCH_TICK && nextTick > HATCH_TICK)
            playSound(reward === "cyrax" ? "evillaff" : "hatch");
        tick = nextTick;
        if (tick >= DETAILS_TICK && details.hidden) {
            const moveFocus = document.activeElement === title || document.activeElement === skip;
            details.hidden = false;
            skip.hidden = true;
            next.hidden = false;
            if (moveFocus)
                next.focus();
        }
        draw();
    }
    function frame(now) {
        advance(Math.max(tick, Math.floor((now - startedAt) / ANIMATION_TICK_MS)));
        frameId = requestAnimationFrame(frame);
    }
    function skipAnimation() {
        if (frameId !== undefined)
            cancelAnimationFrame(frameId);
        frameId = undefined;
        advance(ANIMATION_END);
        if (!reducedMotion.matches) {
            startedAt = performance.now() - ANIMATION_END * ANIMATION_TICK_MS;
            frameId = requestAnimationFrame(frame);
        }
    }
    function hide() {
        screen.hidden = true;
        if (frameId !== undefined)
            cancelAnimationFrame(frameId);
        frameId = undefined;
    }
    skip.addEventListener("click", skipAnimation);
    next.addEventListener("click", () => { hide(); onContinue(); });
    menu.addEventListener("click", () => { hide(); onMenu(); });
    reducedMotion.addEventListener("change", () => {
        if (!screen.hidden)
            skipAnimation();
    });
    return {
        get visible() { return !screen.hidden; },
        draw,
        show(nextReward, saveMessage) {
            reward = nextReward;
            tick = 0;
            if (reward === "cyrax") {
                name.textContent = "Evil Alien Mastermind";
                description.textContent = "The alien mastermind is waiting in the final tank.";
            }
            else {
                const pet = PET_INFO[reward];
                const species = petSpecies[reward];
                name.textContent = species ? `${pet.name} the ${species}` : pet.name;
                description.textContent = reward === "presto" ? `You defeated Cyrax! ${pet.description}` : pet.description;
            }
            saveStatus.textContent = saveMessage || "Your game has been saved.";
            menu.hidden = reward === "presto";
            details.hidden = true;
            next.hidden = true;
            skip.hidden = false;
            screen.hidden = false;
            title.focus();
            if (reducedMotion.matches)
                skipAnimation();
            else {
                startedAt = performance.now();
                draw();
                frameId = requestAnimationFrame(frame);
            }
        },
    };
}
