import { FOOD_LEFT_EDGE, FOOD_RIGHT_EDGE, TANK_HEIGHT, TANK_WIDTH } from "./tank-geometry.js";
const ALIEN_DATA = {
    "weak-sylv": [2, 50],
    "strong-sylv": [1.6, 60],
    balrog: [1.2, 130],
    gus: [1.6, 100],
    destructor: [1.2, 150],
    ulysees: [3.5, 220],
    psychosquid: [0.5, 260],
    bilaterus: [0.8, 100],
    "mini-sylv": [1, 1],
    cyrax: [2, 5000],
};
const spawnSounds = {
    "weak-sylv": "roar", "strong-sylv": "roar", balrog: "roar", gus: "guffaw",
    destructor: "interfer", ulysees: "roar2", psychosquid: "roar3", bilaterus: "rattle", cyrax: "evillaff",
};
const CYRAX_REINFORCEMENTS = [
    ["gus"], ["destructor"], ["ulysees"], ["psychosquid"], ["bilaterus"], ["weak-sylv", "balrog"],
];
const FISH_TARGETS = new Set(["guppy", "oscar", "ultra", "gekko", "penta", "grubber", "breeder"]);
const EXOTIC_DAMAGE = { 3: 30, 4: 20, 5: 25 };
const TANK_Y_OFFSET = 75;
const DIAMOND_VALUE = 200;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function approach(value, target, step) {
    return value + clamp(target - value, -step, step);
}
function inside(origin, x, y, halfWidth, halfHeight = halfWidth) {
    return Math.abs(origin.x - x) < halfWidth && Math.abs(origin.y - y) < halfHeight;
}
function squareDistance(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
function isGroundAlien(kind) {
    return kind === "destructor" || kind === "ulysees";
}
function chaseAxis(position, target, speed, limit, step) {
    if (position > target && speed > -limit)
        return speed - step;
    if (position < target && speed < limit)
        return speed + step;
    return speed;
}
export class AlienSystem {
    random;
    playSound;
    enemies = [];
    shots = [];
    defeated = [];
    animations = [];
    removedTargets = new Set();
    pendingWave = null;
    currentContext;
    waveCount = 0;
    ticksSinceChomp = 216;
    constructor(random = Math.random, playSound) {
        this.random = random;
        this.playSound = playSound;
    }
    get aliens() { return this.enemies; }
    get projectiles() { return this.shots; }
    get effects() { return this.animations; }
    get deadAliens() { return this.defeated; }
    get wavesStarted() { return this.waveCount; }
    get hasScheduledWave() { return this.pendingWave !== null; }
    get battleActive() {
        return this.enemies.length > 0 || this.shots.some((shot) => this.isEnemyShot(shot));
    }
    get warning() {
        const wave = this.pendingWave;
        return wave && wave.ticks <= 275 && !this.battleActive ? wave : null;
    }
    schedule(kinds, ticks) {
        this.pendingWave = kinds.length ? {
            kinds: [...kinds],
            points: [],
            ticks: Math.max(1, Math.floor(ticks)),
            crosshairs: false,
        } : null;
    }
    delayWave(ticks) {
        if (this.pendingWave && ticks > 0) {
            this.pendingWave.ticks += Math.floor(ticks);
            if (this.pendingWave.ticks > 275)
                this.pendingWave.points = [];
        }
    }
    spawn(kind, x, y, context = this.currentContext) {
        const [speedMod, baseHealth] = ALIEN_DATA[kind];
        const size = kind === "mini-sylv" || kind === "bilaterus" ? 80 : 160;
        const half = size / 2;
        const relax = context?.relax;
        const finishedGames = context?.finishedGames ?? 1;
        let health = baseHealth;
        if (kind === "cyrax")
            health -= Math.trunc(clamp(finishedGames - 1, 0, 20) * 2500 / 20);
        if (relax && kind !== "bilaterus")
            health = kind === "gus" ? 70 + this.int(50) : 150 + this.int(100);
        const position = x === undefined || y === undefined ? this.spawnPoint(kind) : { x, y };
        const alien = {
            ...this.swimmer(x ?? position.x, y ?? position.y, speedMod),
            kind,
            size,
            health,
            maxHealth: health,
            spawnTicks: 15,
            healing: false,
            hasHealed: false,
            specialTicks: 0,
            chaseDelay: kind === "mini-sylv" ? 40 : 100,
            switchTicks: 200,
            launchTicks: 0,
            reloadTicks: relax ? 144 : 75,
            summonTicks: 0,
            miniTicks: 0,
            age: 0,
        };
        alien.vx = alien.direction * 3;
        alien.swimTicks = 0;
        alien.frame = 1;
        alien.movementTicks = 20;
        if (isGroundAlien(kind) && !context?.virtual)
            alien.y = 280 + half - TANK_Y_OFFSET;
        if (kind === "mini-sylv") {
            alien.speedMod = 0.8 + this.int(5) / 10;
            alien.hitFlash = 30;
        }
        else {
            this.effect("warp", alien, 36);
        }
        if (kind === "bilaterus")
            this.createBilaterus(alien);
        this.enemies.push(alien);
        const sound = spawnSounds[kind];
        if (sound)
            this.playSound?.(sound);
        if (kind !== "mini-sylv")
            this.ticksSinceChomp = 216;
        return alien;
    }
    step(context) {
        this.currentContext = context;
        this.removedTargets.clear();
        this.ticksSinceChomp++;
        for (let i = this.animations.length - 1; i >= 0; i--) {
            if (--this.animations[i].ticks === 0)
                this.animations.splice(i, 1);
        }
        this.updateDefeated();
        for (const alien of [...this.enemies]) {
            if (!this.enemies.includes(alien))
                continue;
            if (++alien.age > 4320 && context.virtual) {
                this.effect("laser", alien, 10);
                this.removeAlien(alien, false);
            }
            else if (alien.bilaterus) {
                this.updateBilaterus(alien, alien.bilaterus);
            }
            else {
                this.updateAlien(alien);
            }
        }
        for (const shot of [...this.shots]) {
            if (this.shots.includes(shot))
                this.updateProjectile(shot);
        }
        this.updateWave();
    }
    click(x, y, context) {
        if (!this.battleActive)
            return null;
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= TANK_WIDTH || y < 0 || y >= TANK_HEIGHT)
            return "miss";
        this.currentContext = context;
        const cyrax = this.enemies.find((alien) => alien.kind === "cyrax");
        const regular = this.enemies.filter((alien) => (alien.kind !== "bilaterus" && alien.kind !== "mini-sylv" && alien.kind !== "cyrax"));
        if (!cyrax && regular[0]?.kind === "gus") {
            return x >= FOOD_LEFT_EDGE && x <= FOOD_RIGHT_EDGE && y <= 379 - TANK_Y_OFFSET ? "feed" : "miss";
        }
        this.effect("laser", { x, y }, 15);
        if (this.playSound) {
            this.playSound("zap");
            if (Math.random() < 0.5)
                this.playSound("zzam");
            if (Math.random() < 0.1)
                this.playSound("ricochet");
        }
        const power = cyrax ? 10 : context.weaponPower;
        let hit = false;
        const struck = new Set();
        for (const alien of [...this.enemies]) {
            if (!this.enemies.includes(alien))
                continue;
            const group = alien.kind === "bilaterus" || alien.kind === "mini-sylv" || alien.kind === "cyrax" ? alien.kind : "body";
            if (struck.has(group))
                continue;
            const target = alien.heads?.[0] ?? alien;
            if (!inside(target, x, y, alien.size / 2) || target.hitFlash > 0)
                continue;
            hit = true;
            const ground = isGroundAlien(alien.kind);
            const damage = ground || alien.bilaterus ? power * 2 + 2 : power * 3;
            if (alien.healing) {
                if (!cyrax)
                    alien.health += damage;
                alien.hitFlash = 10;
            }
            else {
                this.effect("hit", { x, y }, 30);
                this.hitAlien(alien, damage, true, true);
            }
            this.playSound?.("hit");
            this.knockBack(alien, target, x, y);
            if (group === "bilaterus" || !this.enemies.includes(alien))
                struck.add(group);
        }
        for (const shot of this.shots) {
            if (!this.isEnemyShot(shot) || !inside(shot, x, y, 30))
                continue;
            if (shot.kind === "missile" && shot.spawnTicks > 0)
                continue;
            hit = true;
            this.effect("hit", { x, y }, 30);
            if (shot.kind === "missile") {
                this.removeProjectile(shot);
            }
            else if (shot.spawnTicks === 0) {
                shot.vx = this.deflectVelocity(shot.x - x);
                shot.vy = this.deflectVelocity(shot.y - y);
                shot.reflected = true;
            }
            break;
        }
        return hit ? "shot" : "miss";
    }
    gusFoodDelay(x, y) {
        const gus = this.enemies.find((alien) => alien.kind === "gus");
        if (!gus)
            return 0;
        return inside(gus, x + 20, y + 20, 55) ? 20 : 0;
    }
    damage(view, amount) {
        const alien = this.enemies.find((enemy) => enemy === view);
        if (!alien || alien.healing || amount <= 0)
            return false;
        this.hitAlien(alien, amount);
        return true;
    }
    fireAtAlien(view, from, damage = 15) {
        const enemy = this.enemies.find((alien) => alien === view);
        if (!enemy || this.shots.some((shot) => shot.enemy === enemy))
            return false;
        const shot = this.newProjectile("pet-ball", from, 0.4);
        shot.enemy = enemy;
        shot.damage = damage;
        shot.row = this.int(4);
        return true;
    }
    interceptProjectile(view, from) {
        const shot = this.shots.find((candidate) => candidate === view);
        if (!shot || !this.isEnemyShot(shot) || !shot.target || shot.interception || shot.spawnTicks > 10)
            return false;
        if (!from) {
            this.removeProjectile(shot);
            return true;
        }
        shot.interception = {
            from: { x: from.x, y: from.y - 30 },
            ticks: 1,
            duration: Math.max(2, Math.floor(Math.hypot(from.x - shot.x, from.y - 30 - shot.y) / 16)),
        };
        return true;
    }
    int(limit) {
        return Math.floor(this.random() * limit);
    }
    swimmer(x, y, speedMod) {
        return {
            x, y, vx: 0, vy: 0, speedMod, targetVx: 0, targetVy: 0, movement: this.int(10),
            movementTicks: 0, turnTicks: 0, swimTicks: 0, direction: this.int(2) ? 1 : -1, row: 0, frame: 0, hitFlash: 0,
        };
    }
    spawnPoint(kind) {
        const half = kind === "bilaterus" || kind === "mini-sylv" ? 40 : 80;
        const attractor = this.currentContext?.attractor;
        if (this.currentContext?.virtual && attractor && typeof attractor === "object") {
            return { x: attractor.x, y: attractor.y - 89 };
        }
        return { x: 20 + this.int(TANK_WIDTH - 190) + half, y: 105 + this.int(195) + half - TANK_Y_OFFSET };
    }
    effect(kind, at, ticks) {
        this.animations.push({ kind, x: at.x, y: at.y, ticks, duration: ticks });
    }
    updateWave() {
        const wave = this.pendingWave;
        if (!wave || this.battleActive)
            return;
        wave.ticks--;
        if (wave.ticks <= 275 && !wave.points.length) {
            this.playSound?.("awooga");
            if (this.currentContext?.attractor)
                this.playSound?.("sonar");
            wave.points = wave.kinds.map((kind) => {
                const point = this.spawnPoint(kind);
                return isGroundAlien(kind) && !this.currentContext?.virtual
                    ? { x: point.x, y: 280 + 80 - TANK_Y_OFFSET }
                    : point;
            });
        }
        wave.crosshairs = Boolean(this.currentContext?.attractor) && wave.ticks <= 225;
        if (wave.ticks > 0)
            return;
        this.pendingWave = null;
        this.waveCount++;
        wave.kinds.forEach((kind, index) => this.spawn(kind, wave.points[index].x, wave.points[index].y));
    }
    candidates(allowPets) {
        const context = this.currentContext;
        if (!context)
            return [];
        const fish = context.fish.filter((target) => ((target.kind === undefined || FISH_TARGETS.has(target.kind)) && !target.virtual && (target.eatDelay ?? 0) <= 0
            && !this.removedTargets.has(target) && !context.protectFish?.(target)));
        const pets = allowPets ? (context.pets ?? []).filter((pet) => (!pet.virtual && (pet.eatDelay ?? 0) <= 0 && !this.removedTargets.has(pet))) : [];
        return [
            ...fish.map((target) => ({ target, pet: false })),
            ...pets.map((target) => ({ target, pet: true })),
        ];
    }
    fishCanBeChased() {
        const context = this.currentContext;
        if (!context?.relax)
            return true;
        if (this.ticksSinceChomp < 360)
            return false;
        if (context.fish.filter((fish) => fish.kind === undefined || FISH_TARGETS.has(fish.kind)).length > 1)
            return true;
        this.ticksSinceChomp = 500;
        return false;
    }
    removeVictim(victim, corpse) {
        if (this.removedTargets.has(victim.target))
            return;
        this.removedTargets.add(victim.target);
        if (victim.pet)
            this.currentContext?.removePet?.(victim.target);
        else
            this.currentContext?.removeFish(victim.target, corpse);
        if (!corpse) {
            this.playSound?.("chomp");
            this.ticksSinceChomp = 0;
        }
    }
    nearestVictim(at, victims) {
        let result;
        let bestDistance = Infinity;
        for (const victim of victims) {
            const distance = squareDistance(at, victim.target);
            if (distance < bestDistance) {
                result = victim;
                bestDistance = distance;
            }
        }
        return result;
    }
    wander(body, ground, odds, paused = false) {
        if (body.movement === 0 || (ground && body.movement === 2))
            body.targetVx = ground ? -1 : -1.5;
        if (body.movement === 1 || (ground && body.movement === 3))
            body.targetVx = ground ? 1 : 1.5;
        if (!ground) {
            if (body.movement === 2)
                body.targetVy = -1.5;
            if (body.movement === 3)
                body.targetVy = 1.5;
            body.vy = approach(body.vy, body.targetVy, 0.1);
        }
        body.vx = approach(body.vx, body.targetVx, 0.1);
        if (!paused && ++body.movementTicks > 20) {
            body.movementTicks = 0;
            if (this.int(odds) === 0)
                body.movement = this.int(4);
        }
    }
    chase(body, at, food = false) {
        body.vx = chaseAxis(body.x, at.x, body.vx, 1.8, 0.1);
        body.vy = body.y < at.y && food
            ? chaseAxis(body.y, at.y, body.vy, 3, 0.3)
            : chaseAxis(body.y, at.y, body.vy, 1.8, 0.1);
    }
    move(body, size, spawnKick = 0) {
        const mini = size === 80;
        const left = mini ? 50 : 70;
        const right = TANK_WIDTH - (mini ? 60 : 70);
        const top = (mini ? 135 : 165) - TANK_Y_OFFSET;
        const bottom = (mini ? 410 : 370) - TANK_Y_OFFSET;
        body.x = clamp(body.x + body.vx / body.speedMod + spawnKick, left, right);
        body.y = clamp(body.y + body.vy / body.speedMod, top, bottom);
    }
    updateAlien(alien) {
        const { kind } = alien;
        const ground = isGroundAlien(kind);
        const virtual = this.currentContext?.virtual;
        const cyrax = this.enemies.some((enemy) => enemy.kind === "cyrax");
        const victims = this.candidates(cyrax);
        if (ground && virtual) {
            if (alien.y >= 280 + 80 - TANK_Y_OFFSET) {
                alien.y = 280 + 80 - TANK_Y_OFFSET;
                alien.vy = 0;
            }
            else {
                alien.vy += alien.speedMod * 0.4;
            }
        }
        const spawnKick = alien.spawnTicks > 0 && alien.spawnTicks <= 10 ? Math.sign(alien.vx) * 3 : 0;
        if (alien.spawnTicks > 0 && --alien.spawnTicks > 8)
            return;
        if (kind === "cyrax")
            this.summonReinforcements(alien);
        const chaseable = this.fishCanBeChased() && (kind !== "gus" || alien.chaseDelay <= 0);
        const chaseVictims = chaseable && !ground && !alien.healing && kind !== "cyrax" ? victims : [];
        const victim = this.nearestVictim(alien, chaseVictims);
        const food = kind === "gus" ? this.gusFood(alien) : undefined;
        const chaseFood = food && (!victim || squareDistance(alien, food) - 2500 < squareDistance(alien, victim.target));
        if (chaseFood)
            this.chase(alien, food, true);
        else if (victim)
            this.chase(alien, victim.target);
        else
            this.wander(alien, ground, 10, alien.specialTicks > 0);
        if (kind === "gus" && (food || victim))
            this.eatGusFood(alien);
        if (!this.enemies.includes(alien))
            return;
        if (victim && alien.chaseDelay <= 0) {
            const eaten = this.touchingVictim(alien, chaseVictims, alien.size === 80 ? 30 : 45, alien.size === 80 ? 30 : 65);
            if (eaten) {
                this.removeVictim(eaten, false);
                if (kind === "gus")
                    this.hitAlien(alien, 15, true);
            }
        }
        if (!this.enemies.includes(alien))
            return;
        if (kind === "psychosquid" && ++alien.switchTicks >= 400 && !this.currentContext?.relax) {
            this.switchPsychosquid(alien, !alien.healing);
        }
        if (kind === "ulysees") {
            const phase = alien.frame % 5;
            if (alien.specialTicks > 0)
                alien.vx = clamp(alien.vx, -0.1, 0.1);
            else if (phase === 1 || phase === 2)
                alien.vx += Math.sign(alien.vx) * 0.55;
            else if (phase !== 3 && Math.abs(alien.vx) > 0.9)
                alien.vx -= Math.sign(alien.vx) * 0.8;
        }
        this.move(alien, alien.size, spawnKick);
        if (alien.hitFlash > 0)
            alien.hitFlash--;
        if (alien.chaseDelay > 0)
            alien.chaseDelay--;
        if (ground && (cyrax || this.currentContext?.fish.some((fish) => fish.kind === undefined || FISH_TARGETS.has(fish.kind)))) {
            this.updateLauncher(alien, victims);
        }
        this.animateAlien(alien);
    }
    touchingVictim(at, victims, width, height) {
        return victims.find(({ target }) => {
            const ultra = "kind" in target && target.kind === "ultra";
            return !this.removedTargets.has(target) && inside(at, target.x, target.y, ultra ? 70 : width, ultra ? (height === 65 ? 85 : 70) : height);
        });
    }
    gusFood(alien) {
        let nearest;
        let best = Infinity;
        for (const food of this.currentContext?.food ?? []) {
            if ((food.eatDelay ?? 0) > 0 || food.exotic === 2 || food.fade || this.removedTargets.has(food))
                continue;
            const distance = squareDistance(alien, food);
            if (distance < best) {
                nearest = food;
                best = distance;
            }
        }
        return nearest;
    }
    eatGusFood(alien) {
        if (alien.hitFlash > 5)
            return;
        const food = this.currentContext?.food.find((pellet) => (!this.removedTargets.has(pellet) && !pellet.fade && (pellet.eatDelay ?? 0) <= 0 && inside(alien, pellet.x, pellet.y, 45)));
        if (!food)
            return;
        this.playSound?.("slurp");
        const tier = food.tier ?? food.level ?? 0;
        let damage = EXOTIC_DAMAGE[food.exotic ?? 0] ?? tier * 2 + 4;
        if (this.currentContext?.relax)
            damage = 8;
        else if (tier === 3) {
            damage = 20;
            this.effect("explosion", alien, 18);
            this.playSound?.("explode");
        }
        this.removedTargets.add(food);
        this.currentContext?.removeFood(food);
        this.hitAlien(alien, damage, true);
    }
    summonReinforcements(alien) {
        const hasReinforcements = this.enemies.some((enemy) => enemy !== alien && enemy.kind !== "mini-sylv");
        if (!hasReinforcements && ++alien.summonTicks >= 300) {
            alien.summonTicks = 0;
            for (const kind of CYRAX_REINFORCEMENTS[this.int(CYRAX_REINFORCEMENTS.length)])
                this.spawn(kind);
        }
        if (++alien.miniTicks >= 75) {
            alien.miniTicks = 0;
            this.spawn("mini-sylv", alien.x, alien.y);
        }
    }
    switchPsychosquid(alien, healing) {
        if (healing)
            this.playSound?.("roar3");
        alien.healing = healing;
        alien.hasHealed ||= healing;
        alien.speedMod = healing ? 2 : 0.5;
        alien.specialTicks = 10;
        alien.switchTicks = this.int(100);
    }
    animateAlien(alien) {
        const kind = alien.kind;
        const facing = alien.vx < 0 ? -1 : 1;
        if (facing !== alien.direction && alien.vx !== 0) {
            alien.turnTicks = alien.direction * (kind === "ulysees" ? 20 : 10);
        }
        if (alien.vx !== 0)
            alien.direction = facing;
        if (alien.turnTicks !== 0)
            alien.turnTicks -= Math.sign(alien.turnTicks);
        if (alien.specialTicks > 0 && --alien.specialTicks === 0)
            alien.swimTicks = 0;
        const special = alien.specialTicks;
        const turn = alien.turnTicks;
        alien.row = turn !== 0 ? 1 : 0;
        if (special > 0 && kind === "ulysees") {
            alien.row = 2;
            alien.frame = special > 20 ? 9 - Math.trunc((special - 20) / 2) : Math.trunc((special - 1) / 2);
        }
        else if (special > 0 && kind === "psychosquid") {
            alien.row = 4;
            alien.frame = alien.healing ? 10 - special : special;
        }
        else if (special > 0 && kind === "destructor") {
            alien.frame = special;
        }
        else if (turn !== 0) {
            alien.frame = kind === "ulysees"
                ? 9 - Math.trunc(Math.abs(turn) / 2)
                : turn > 0 ? 9 - turn : 10 + turn;
        }
        else if (kind === "ulysees") {
            alien.swimTicks = (alien.swimTicks + (Math.abs(alien.vx) > 8 ? 2 : 1)) % 80;
            alien.frame = Math.trunc(alien.swimTicks / 8);
        }
        else if (kind === "cyrax" || kind === "destructor" || kind === "psychosquid" || Math.abs(alien.vx) <= 1.6) {
            alien.swimTicks = (alien.swimTicks + 1) % 20;
            alien.frame = Math.trunc(alien.swimTicks / 2);
        }
        else {
            this.animateFastSwim(alien);
        }
        if (special === 0 && alien.healing)
            alien.row = turn ? 3 : 2;
        if (kind === "gus" && alien.hitFlash > 0 && !this.enemies.some((enemy) => enemy.kind === "cyrax")) {
            alien.row = 2;
            alien.frame = Math.min(9, alien.hitFlash);
        }
        alien.frame = clamp(alien.frame, 0, 9);
    }
    animateFastSwim(alien) {
        const ticks = ++alien.swimTicks;
        if (ticks > 50) {
            alien.swimTicks = 0;
            alien.frame = 0;
            return;
        }
        const speed = ticks <= 6 ? -0.25 : ticks <= 10 ? 0.75 : 0.5;
        alien.x += speed * alien.vx / alien.speedMod;
        alien.y += speed * alien.vy / alien.speedMod;
        alien.frame = ticks <= 10 ? Math.trunc(ticks / 2) : ticks <= 39 ? 6 : Math.trunc((50 - ticks) / 2);
    }
    knockBack(alien, target, x, y) {
        const edge = alien.size / 8;
        const dx = Math.abs(x - target.x) > edge ? Math.sign(target.x - x) : 0;
        const dy = Math.abs(y - target.y) > edge ? Math.sign(target.y - y) : 0;
        if (isGroundAlien(alien.kind)) {
            if (dx && alien.specialTicks === 0)
                alien.vx = dx * alien.speedMod * 3;
            return;
        }
        const strong = alien.kind === "psychosquid" || alien.bilaterus;
        const force = ((dx && dy) ? (strong ? 3.5 : 2.5) : (strong ? 4 : 3)) * target.speedMod;
        if (dx)
            target.vx = dx * force;
        if (dy)
            target.vy = dy * force;
    }
    hitAlien(alien, damage, flash = false, fromLaser = false) {
        const active = alien.heads?.[0];
        if (active) {
            active.health -= damage;
            if (flash)
                active.hitFlash = 10;
            alien.health = active.health;
            if (active.health <= 0)
                this.breakHead(alien);
            return;
        }
        alien.health -= damage;
        if (flash)
            alien.hitFlash = 10;
        if (alien.health <= 0)
            this.removeAlien(alien, true);
        else if (fromLaser && alien.kind === "psychosquid" && alien.health < 100 && !alien.hasHealed && !this.currentContext?.relax) {
            this.switchPsychosquid(alien, true);
        }
    }
    removeAlien(alien, defeated) {
        const index = this.enemies.indexOf(alien);
        if (index < 0)
            return;
        const cyrax = this.enemies.some((enemy) => enemy.kind === "cyrax");
        if (defeated) {
            this.effect("explosion", alien, 20);
            this.playSound?.("explode");
            this.playSound?.(alien.kind === "cyrax" ? "explosion4" : "explosion1");
            if (!cyrax && (!this.currentContext?.virtual || this.currentContext.virtualCoinDrops)) {
                const offset = 25 + 36 - alien.size / 2;
                this.currentContext?.dropCoin(alien.x + offset, alien.y + offset, DIAMOND_VALUE);
            }
            if (alien.kind !== "gus" && alien.kind !== "mini-sylv" && alien.kind !== "bilaterus") {
                this.defeated.push({
                    kind: alien.kind, x: alien.x, y: alien.y, row: 0, frame: alien.frame, direction: alien.direction,
                    hitFlash: 10, vx: 0, vy: 0, ticks: 125, opacity: 1,
                });
            }
        }
        this.enemies.splice(index, 1);
        for (const shot of [...this.shots]) {
            if (shot.enemy === alien)
                this.removeProjectile(shot, false);
        }
        if (alien.kind === "cyrax") {
            for (const enemy of [...this.enemies])
                this.removeAlien(enemy, false);
            for (const shot of [...this.shots]) {
                if (this.isEnemyShot(shot))
                    this.removeProjectile(shot, false);
            }
            this.pendingWave = null;
        }
    }
    updateDefeated() {
        for (let index = this.defeated.length - 1; index >= 0; index--) {
            const alien = this.defeated[index];
            if (--alien.ticks === 0) {
                this.defeated.splice(index, 1);
                continue;
            }
            alien.opacity = clamp(1 - (105 - alien.ticks) * 0.02, 0, 1);
            alien.vx += alien.vx > 0 ? -0.03 : 0.03;
            alien.vy = Math.min(2, alien.vy + 0.05);
            alien.x = clamp(alien.x, 70, TANK_WIDTH - 70) + alien.vx;
            if (isGroundAlien(alien.kind))
                alien.y = Math.min(285, alien.y);
            alien.y += alien.vy;
            if (alien.ticks > 50 && alien.ticks % 7 === 0)
                this.effect("explosion", alien, 12);
        }
    }
    createBilaterus(alien) {
        const heads = [0, 1].map((variant) => ({
            ...this.swimmer(alien.x, alien.y, 0.8),
            active: variant === 0,
            health: 100,
            variant,
            chaseDelay: 100,
            followTicks: 12,
            vy: -0.5,
            row: variant === 0 ? 5 : 0,
        }));
        const bones = Array.from({ length: 6 }, (_, index) => ({
            ...this.swimmer(alien.x, alien.y, 0.8),
            row: 6 + index % 2,
            frame: 5,
            followTicks: 12,
            chaseDelay: 100,
            vy: -0.5,
        }));
        alien.bilaterus = { heads, bones, switchTicks: 0 };
        alien.heads = heads;
        alien.bones = bones;
        if (this.int(2) === 0)
            this.switchHeads(alien.bilaterus);
    }
    switchHeads(bilaterus) {
        bilaterus.heads.reverse();
        bilaterus.bones.reverse();
        bilaterus.heads.forEach((head, index) => {
            head.active = index === 0;
            head.turnTicks = -head.turnTicks;
            head.vx = head.direction * 1.5;
            head.row = head.variant ? (head.active ? 2 : 0) : (head.active ? 5 : 3);
        });
        bilaterus.bones.forEach((bone, index) => {
            const lead = index === 0 ? bilaterus.heads[0] : bilaterus.bones[index - 1];
            bone.targetVx = lead.vx;
            bone.targetVy = lead.vy;
            bone.vx = 0;
        });
        bilaterus.switchTicks = 0;
    }
    updateBilaterus(alien, bilaterus) {
        if (alien.spawnTicks > 0) {
            alien.spawnTicks--;
            return;
        }
        const { heads, bones } = bilaterus;
        if (heads.length === 2 && ++bilaterus.switchTicks >= 1000)
            this.switchHeads(bilaterus);
        const [active, passive] = heads;
        const victims = this.fishCanBeChased() ? this.candidates(this.enemies.some((enemy) => enemy.kind === "cyrax")) : [];
        const victim = this.nearestVictim(active, victims);
        if (victim)
            this.chase(active, victim.target);
        else
            this.wander(active, false, 5);
        if (victim && active.chaseDelay === 0) {
            const eaten = this.touchingVictim(active, victims, 30, 30);
            if (eaten)
                this.removeVictim(eaten, false);
        }
        if (active.x <= 50 || active.x >= TANK_WIDTH - 60) {
            active.targetVx = active.x <= 50 ? 1.5 : -1.5;
            active.vx = active.targetVx * 0.1;
        }
        this.move(active, 80);
        active.hitFlash = Math.max(0, active.hitFlash - 1);
        active.chaseDelay = Math.max(0, active.chaseDelay - 1);
        const facing = active.vx < 0 ? -1 : 1;
        if (active.vx !== 0 && facing !== active.direction && active.turnTicks === 0)
            active.turnTicks = active.direction * 20;
        if (active.vx !== 0)
            active.direction = facing;
        active.turnTicks -= Math.sign(active.turnTicks);
        active.swimTicks = (active.swimTicks + 1) % 20;
        active.row = (active.variant ? 2 : 5) - (active.turnTicks ? 1 : 0);
        active.frame = active.turnTicks
            ? 9 - Math.trunc(Math.abs(active.turnTicks) / 2)
            : active.variant ? Math.abs(active.swimTicks < 10 ? active.swimTicks - 9 : active.swimTicks - 10) : Math.trunc(active.swimTicks / 2);
        let lead = active;
        bones.forEach((bone, index) => {
            if (++bone.followTicks >= 12) {
                bone.followTicks = 0;
                bone.targetVx = lead.vx;
                bone.targetVy = lead.vy;
            }
            this.followPart(bone, lead, index === 0 ? 40 : 30);
            bone.row = 6 + index % 2;
            bone.frame = this.boneFrame(bone.x - lead.x);
            lead = bone;
            if (bone.hitFlash > 0)
                bone.hitFlash--;
            if (bone.chaseDelay > 0)
                bone.chaseDelay--;
            if (bone.chaseDelay === 0 && this.fishCanBeChased()) {
                const eaten = this.touchingVictim(bone, victims, 30, 30);
                if (eaten) {
                    this.removeVictim(eaten, false);
                    bone.hitFlash = 10;
                }
            }
        });
        if (passive) {
            if (++passive.followTicks >= 12) {
                passive.followTicks = 0;
                passive.targetVx = lead.vx;
                passive.targetVy = lead.vy;
            }
            this.followPart(passive, lead, 40);
            const deltaX = passive.x - lead.x;
            const behind = deltaX < 36 && deltaX > -30;
            passive.row = passive.variant ? (behind ? 0 : 2) : (behind ? 3 : 5);
            passive.frame = behind ? this.boneFrame(deltaX) : 4;
            passive.direction = behind || deltaX < 0 ? -1 : 1;
            passive.hitFlash = Math.max(0, passive.hitFlash - 1);
            passive.chaseDelay = Math.max(0, passive.chaseDelay - 1);
        }
        alien.x = active.x;
        alien.y = active.y;
        alien.direction = active.direction;
        alien.health = active.health;
        alien.hitFlash = active.hitFlash;
    }
    followPart(part, lead, distance) {
        part.vx = approach(part.vx, part.targetVx, 0.02);
        part.vy = approach(part.vy, part.targetVy, 0.02);
        part.x = clamp(part.x, lead.x - distance, lead.x + distance);
        part.y = clamp(part.y, lead.y - 20, lead.y + 20);
        this.move(part, 80);
    }
    boneFrame(deltaX) {
        return deltaX >= 36 || deltaX <= -30 ? 0 : clamp(5 - Math.trunc(deltaX / 6), 0, 9);
    }
    breakHead(alien) {
        const bilaterus = alien.bilaterus;
        if (!bilaterus)
            return;
        const head = bilaterus.heads[0];
        this.scatterPart("head", head, head.variant ? 1 : 4);
        if (bilaterus.heads.length > 1) {
            this.playSound?.("explode");
            this.playSound?.("explosion1");
            this.switchHeads(bilaterus);
            bilaterus.heads.pop();
            alien.health = bilaterus.heads[0].health;
            return;
        }
        for (const bone of bilaterus.bones)
            this.scatterPart("bone", bone, 6);
        this.removeAlien(alien, true);
    }
    scatterPart(kind, part, row) {
        const shot = this.newProjectile(kind, part, 0.8);
        shot.row = row;
        const velocities = [-6, -5, -4, 4, 5, 6];
        shot.vx = velocities[this.int(velocities.length)];
        shot.vy = velocities[this.int(velocities.length)];
        shot.vy = 2 + this.int(5);
    }
    updateLauncher(alien, victims) {
        const ulysees = alien.kind === "ulysees";
        if (ulysees && ++alien.launchTicks === alien.reloadTicks - 15) {
            if (alien.turnTicks !== 0)
                alien.launchTicks -= 2;
            else if (this.launchTarget(alien, victims))
                alien.specialTicks = 40;
            else
                alien.launchTicks = 0;
        }
        if (!ulysees)
            alien.launchTicks++;
        if (alien.launchTicks <= alien.reloadTicks)
            return;
        const relax = this.currentContext?.relax;
        let count = relax ? 1 : ulysees ? 2 : 3;
        let launched = false;
        let index = 0;
        while (count-- > 0) {
            const victim = this.launchTarget(alien, victims);
            if (!victim)
                break;
            const at = {
                x: alien.x + (alien.vx < 0 ? -1 : 1) * (ulysees ? 30 + index * 8 : 50 + index * 15),
                y: alien.y - (ulysees ? 64 - index * 8 : 75 - index * 5),
            };
            const shot = this.newProjectile(ulysees ? "energy-ball" : "missile", at, 0.8);
            shot.victim = victim;
            launched = true;
            index++;
        }
        if (launched && !ulysees)
            alien.specialTicks = 10;
        if (launched)
            this.playSound?.(ulysees ? "unleash" : "missle");
        alien.launchTicks = 0;
        alien.reloadTicks = (relax ? 360 : 150) + this.int(50);
    }
    launchTarget(alien, victims) {
        let farthest;
        let best = 0;
        for (const victim of victims) {
            if (this.shots.some((shot) => shot.victim?.target === victim.target))
                continue;
            const distance = squareDistance(alien, victim.target);
            if (distance > best) {
                best = distance;
                farthest = victim;
            }
        }
        return farthest;
    }
    newProjectile(kind, at, speedMod) {
        const shot = {
            ...this.swimmer(at.x, at.y, speedMod),
            kind,
            spawnTicks: 15,
            reflected: false,
            frame: 1,
            damage: 0,
            get target() { return this.victim?.target; },
            get intercepted() { return this.interception !== undefined; },
            get urgent() { return this.kind === "energy-ball" && this.reflected; },
        };
        this.shots.push(shot);
        return shot;
    }
    isEnemyShot(shot) {
        return shot.kind === "missile" || shot.kind === "energy-ball";
    }
    updateProjectile(shot) {
        if (shot.interception && ++shot.interception.ticks >= shot.interception.duration) {
            this.removeProjectile(shot);
            return;
        }
        if (shot.spawnTicks > 0)
            shot.spawnTicks--;
        if (shot.kind === "pet-ball") {
            if (!this.updatePetBall(shot))
                return;
        }
        else if (this.isEnemyShot(shot)) {
            if (!this.updateEnemyShot(shot))
                return;
        }
        shot.x += shot.vx / shot.speedMod;
        shot.y += shot.vy / shot.speedMod;
        if (shot.kind === "energy-ball")
            shot.frame = (shot.frame + 1) % 5;
        else if (shot.kind === "missile")
            shot.frame = this.missileFrame(shot);
        else if (shot.kind === "pet-ball") {
            const spin = shot.reflected ? 1 : 2;
            shot.swimTicks = (shot.swimTicks + (shot.vx < 0 ? spin : -spin) + 20) % 20;
            shot.frame = Math.floor(shot.swimTicks / 2);
        }
        else {
            shot.frame = (shot.frame + 1) % 10;
            if (shot.kind === "head" && shot.frame === 0)
                shot.direction = shot.direction === 1 ? -1 : 1;
        }
        if (shot.x < 20 || shot.x > TANK_WIDTH - 20 || shot.y < 10 || shot.y > 345) {
            if (!this.isEnemyShot(shot) || shot.reflected)
                this.removeProjectile(shot, shot.kind !== "pet-ball");
        }
    }
    updatePetBall(shot) {
        const enemy = shot.enemy;
        if (enemy) {
            const target = enemy.heads?.[0] ?? enemy;
            this.homeProjectile(shot, target, enemy.size !== 80);
            if (inside(target, shot.x, shot.y, enemy.size === 80 ? 30 : 60)) {
                shot.enemy = undefined;
                shot.reflected = true;
                shot.speedMod = shot.damage >= 55 ? 0.6 : 1.5;
                shot.vx = -shot.vx;
                shot.vy = -shot.vy;
                this.damage(enemy, shot.damage);
            }
            return true;
        }
        shot.vy += 0.2;
        return true;
    }
    updateEnemyShot(shot) {
        const victim = shot.victim;
        if (!victim || !this.targetInTank(victim)) {
            this.removeProjectile(shot);
            return false;
        }
        if (shot.reflected) {
            if (this.currentContext?.relax)
                return true;
            for (const alien of this.enemies) {
                if (alien.kind === "mini-sylv" || alien.healing)
                    continue;
                const target = alien.heads?.[0] ?? alien;
                const hit = alien.size === 80
                    ? inside(target, shot.x - 15, shot.y - 15, 30)
                    : shot.x > target.x - 50 && shot.x < target.x + 60 && Math.abs(shot.y - target.y) < 70;
                if (hit) {
                    this.hitAlien(alien, 30, true);
                    this.removeProjectile(shot);
                    return false;
                }
            }
            const cyrax = this.enemies.some((enemy) => enemy.kind === "cyrax");
            for (const other of this.candidates(cyrax)) {
                if (other.pet !== cyrax)
                    continue;
                const reach = "kind" in other.target && other.target.kind === "ultra" ? 70 : 30;
                if (inside(other.target, shot.x, shot.y, reach))
                    this.removeVictim(other, true);
            }
            return true;
        }
        const ultra = "kind" in victim.target && victim.target.kind === "ultra";
        this.homeProjectile(shot, victim.target, ultra);
        const target = victim.target;
        const hit = ultra ? shot.x > target.x - 72 && shot.x < target.x + 60
            && shot.y > target.y - 76 && shot.y < target.y + 60 : inside(target, shot.x, shot.y, 30);
        if (hit) {
            this.removeVictim(victim, true);
            this.removeProjectile(shot);
            return false;
        }
        shot.x = clamp(shot.x, 50, TANK_WIDTH - 50);
        shot.y = clamp(shot.y, 135 - TANK_Y_OFFSET, 410 - TANK_Y_OFFSET);
        return true;
    }
    targetInTank(victim) {
        const context = this.currentContext;
        if (!context || this.removedTargets.has(victim.target))
            return false;
        return victim.pet
            ? Boolean(context.pets?.includes(victim.target))
            : context.fish.includes(victim.target);
    }
    homeProjectile(shot, at, ultra = false) {
        const dx = Math.abs(shot.x - at.x);
        const dy = Math.abs(shot.y - at.y);
        const far = ultra ? 120 : 40;
        const near = ultra ? 30 : 20;
        shot.vx = chaseAxis(shot.x, at.x, shot.vx, dx > far ? 1.8 : dx > near ? 1.4 : 0.6, 0.2);
        shot.vy = chaseAxis(shot.y, at.y, shot.vy, dy > far ? 1.8 : dy > near ? 1.4 : 0.2, dy > near ? 0.2 : 0.1);
    }
    deflectVelocity(delta) {
        const velocity = delta / 5;
        return Math.abs(velocity) >= 1 ? velocity : velocity < 0 ? -1 : 1;
    }
    missileFrame(shot) {
        if (Math.abs(shot.vx) < 0.8 || Math.abs(shot.vy) > 2.5)
            return shot.vy > 0 ? 12 : 4;
        const pitch = Math.abs(shot.vy) > 2 ? 3 : Math.abs(shot.vy) > 1.5 ? 2 : Math.abs(shot.vy) > 1 ? 1 : 0;
        return (16 + (shot.vx > 0 ? -Math.sign(shot.vy) * pitch : 8 + Math.sign(shot.vy) * pitch)) % 16;
    }
    removeProjectile(shot, explode = true) {
        const index = this.shots.indexOf(shot);
        if (index < 0)
            return;
        this.shots.splice(index, 1);
        if (explode && shot.kind !== "pet-ball") {
            this.effect("explosion", shot, 12);
            this.playSound?.("explode");
        }
    }
}
