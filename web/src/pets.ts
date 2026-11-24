import type { PlaySound } from "./audio.js";

export const PET_TYPES = [
  "stinky", "niko", "itchy", "prego", "zorf", "clyde", "vert", "rufus",
  "meryl", "wadsworth", "seymour", "shrapnel", "gumbo", "blip", "rhubarb",
  "nimbus", "amp", "gash", "angie", "presto", "brinkley", "nostradamus",
  "stanley", "walter",
] as const;

export type PetType = typeof PET_TYPES[number];
export type PetDrop = "gold" | "penta-diamond" | "niko-pearl" | "note" | "bomb"
  | "shell-star" | "shell-diamond" | "shell-pearl" | "shell-treasure";

function petInfo(name: string, stem: string, rows: number, description: string, width = 80, height = 80) {
  return { name, stem, rows, columns: 10, width, height, description };
}

export const PET_INFO = {
  stinky: petInfo("Stinky", "stinky", 3, "Collects coins near the bottom and hides during attacks."),
  niko: petInfo("Niko", "niko", 3, "Opens periodically to offer a pearl worth $250."),
  itchy: petInfo("Itchy", "itchy", 4, "Chases and attacks aliens."),
  prego: petInfo("Prego", "prego", 4, "Gives birth to baby guppies."),
  zorf: petInfo("Zorf", "zorf", 3, "Drops food for hungry guppies and breeders."),
  clyde: petInfo("Clyde", "clyde", 1, "Collects coins as they fall through the tank."),
  vert: petInfo("Vert", "vert", 2, "Drops gold coins."),
  rufus: petInfo("Rufus", "rufus", 2, "Attacks aliens that come near the bottom."),
  meryl: petInfo("Meryl", "meryl", 4, "Sings to make guppies drop coins faster."),
  wadsworth: petInfo("Wadsworth", "wadsworth", 3, "Shelters small and medium guppies during attacks."),
  seymour: petInfo("Seymour", "seymour", 2, "Slows falling coins and keeps them on the bottom longer."),
  shrapnel: petInfo("Shrapnel", "shrapnel", 2, "Drops bombs worth $150 when collected. Uncollected bombs can kill fish."),
  gumbo: petInfo("Gumbo", "gumbo", 2, "Lures guppies away from aliens."),
  blip: petInfo("Blip", "blip", 2, "Reveals shop items, alien entry points, and alien health."),
  rhubarb: petInfo("Rhubarb", "rhubarb", 2, "Shoos fish away from the bottom."),
  nimbus: petInfo("Nimbus", "nimbus", 2, "Bounces coins and food upward so there is more time to reach them."),
  amp: petInfo("Amp", "amp", 2, "Click three times when charged to turn guppies into diamonds.", 160, 60),
  gash: petInfo("Gash", "gash", 3, "Attacks aliens and occasionally eats a guppy between attacks."),
  angie: petInfo("Angie", "angie", 2, "Revives fish before they sink away."),
  presto: petInfo("Presto", "presto", 3, "Right-click Presto to transform into another pet."),
  brinkley: petInfo("Brinkley", "brink", 2, "Eats fish food and drops rewards every third pellet."),
  nostradamus: petInfo("Nostradamus", "nostradamus", 2, "Drops snot pellets and may delay an incoming attack by sneezing."),
  stanley: petInfo("Stanley", "stanley", 6, "Intercepts enemy projectiles and shoots balls at aliens."),
  walter: petInfo("Walter", "walter", 3, "Click to punch nearby fish and speed up their next drop."),
} satisfies Record<PetType, ReturnType<typeof petInfo>>;

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetFish extends PetPosition {
  kind: string;
  stage: number;
  fullness: number;
  vx: number;
  vy: number;
  readonly virtual?: boolean;
  readonly exoticDiet?: number;
  readonly knockTicks?: number;
}

export interface PetCoin extends PetPosition {
  kind: string;
  fade?: number;
  rising?: boolean;
}

export interface PetFood extends PetPosition {
  bounced?: boolean;
  vx?: number;
  vy?: number;
  fade?: number;
  exotic?: number;
  auto?: boolean;
}

export interface PetAlien extends PetPosition {
  kind: string;
  healing?: boolean;
  spawnTicks?: number;
}

export interface PetProjectile extends PetPosition {
  kind: string;
  target?: PetPosition | null;
  intercepted?: boolean;
  urgent?: boolean;
  reflected?: boolean;
  spawnTicks?: number;
  interception?: unknown;
}

export interface PetCorpse extends PetPosition {
  revivable?: boolean;
  kind?: string;
}

type PetAnimation = "idle" | "turn" | "attack" | "hide" | "open" | "sing" | "ready"
  | "sleep" | "punch" | "feed" | "glow" | "birth" | "sneeze";

export interface Pet extends PetPosition {
  virtual?: boolean;
  type: PetType;
  morph: boolean;
  transformed: boolean;
  morphCooldown: number;
  morphAge: number;
  age: number;
  size: number;
  vx: number;
  vy: number;
  direction: 1 | -1;
  animation: PetAnimation;
  frame: number;
  row: number;
  timer: number;
  interval: number;
  cooldown: number;
  action: number;
  count: number;
  protecting: boolean;
  pearlTaken: boolean;
  swim: number;
  turn: number;
  targetVx: number;
  targetVy: number;
  knockback: number;
  knockbackTicks: number;
}

export interface PetContext<
  Fish extends PetFish = PetFish,
  Coin extends PetCoin = PetCoin,
  Food extends PetFood = PetFood,
  Alien extends PetAlien = PetAlien,
  DeadFish extends PetCorpse = PetCorpse,
  Projectile extends PetProjectile = PetProjectile,
> {
  playSound?: PlaySound;
  readonly fish: readonly Fish[];
  readonly coins: readonly Coin[];
  readonly food: readonly Food[];
  readonly aliens: readonly Alien[];
  readonly deadFish: readonly DeadFish[];
  readonly projectiles: readonly Projectile[];
  readonly pets: readonly Pet[];
  readonly random: () => number;
  readonly tick: number;
  readonly tank: number;
  readonly background: number;
  addFish(x: number, y: number): boolean | void;
  addFood(x: number, y: number, tier: number, kind?: "snot", vx?: number): void;
  addCoin(x: number, y: number, kind: PetDrop, owner?: Pet): void;
  collectCoin(coin: Coin): void;
  bounceCoin(coin: Coin, pet: Pet): void;
  bounceFood(food: Food, pet: Pet): void;
  removeFood(food: Food): void;
  killFish(fish: Fish, leaveCorpse: boolean): void;
  reviveFish(deadFish: DeadFish): void;
  damageAlien(alien: Alien, amount: number): void;
  removePet(pet: Pet): void;
  revealShop(): void;
  interceptProjectile(projectile: Projectile, pet: Pet): boolean | void;
  fireAtAlien(alien: Alien, pet: Pet): boolean | void;
  punchFish(fish: Fish, direction: 1 | -1): void;
  liftFish?(fish: Fish, velocity: number): void;
}

const ground = { stinky: 335, rufus: 330, rhubarb: 320 } as const;
const desktopNikoPositions = [[95, 253], [175, 163], [65, 156], [145, 260], [67, 185], [160, 176]] as const;
const rightLimit: Partial<Record<PetType, number>> = { amp: 540, rufus: 600, stinky: 590, clyde: 590 };
const swimFloor: Partial<Record<PetType, number>> = { prego: 325, zorf: 235 };
const rhubarbFish = new Set(["guppy", "oscar", "ultra", "gekko", "breeder"]);
const walterFish = new Set(["guppy", "oscar", "ultra", "gekko", "sylvester", "ball", "bi"]);
const walterDropPets = new Set<PetType>(["vert", "shrapnel", "amp", "nostradamus"]);
const groundSpeeds = [0, -0.5, 0.5, -1, 1, 1.5, -1.5, -2.5, 2.5] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function approach(value: number, target: number, increment: number): number {
  return value < target ? Math.min(value + increment, target) : Math.max(value - increment, target);
}

function within(first: PetPosition, second: PetPosition, x: number, y = x): boolean {
  return Math.abs(first.x - second.x) < x && Math.abs(first.y - second.y) < y;
}

function nearest<T extends PetPosition>(origin: PetPosition, items: readonly T[], eligible: (item: T) => boolean): T | undefined {
  let closest: T | undefined;
  let distance = Infinity;
  for (const item of items) {
    if (!eligible(item)) continue;
    const nextDistance = (origin.x - item.x) ** 2 + (origin.y - item.y) ** 2;
    if (nextDistance < distance) {
      distance = nextDistance;
      closest = item;
    }
  }
  return closest;
}

function petInterval(type: PetType, random: () => number, virtual: boolean): number {
  if (virtual && (type === "vert" || type === "shrapnel" || type === "nostradamus")) {
    return 1080 + Math.floor(random() * 200);
  }
  switch (type) {
    case "niko": return 1450;
    case "prego": return 930;
    case "zorf": return 65;
    case "vert": return 216;
    case "meryl": return virtual ? 4320 : 1400;
    case "wadsworth": return 120;
    case "shrapnel": return 633 + Math.floor(random() * 20);
    case "amp": return 3000;
    case "gash": return 1570;
    case "nostradamus": return 300 + Math.floor(random() * 300);
    case "stanley": return 101;
    default: return 0;
  }
}

export function nikoPosition(backdrop: number): PetPosition {
  const [left, top] = desktopNikoPositions[backdrop - 1] ?? desktopNikoPositions[5];
  // Center the 80px sprite and account for the 80px cropped from the top of the desktop backdrop.
  return { x: left + 40, y: top + 40 - 80 };
}

export function createPet(type: PetType, x: number, y: number, random = Math.random, backdrop = 1, virtual = false): Pet {
  const direction = random() < 0.5 ? -1 : 1;
  const position = type === "niko" ? nikoPosition(backdrop) : { x, y };
  return {
    type, virtual,
    morph: type === "presto",
    transformed: false,
    morphCooldown: 0,
    morphAge: type === "presto" ? 0 : 20,
    age: 0,
    x: position.x,
    y: type in ground ? ground[type as keyof typeof ground] : position.y,
    size: PET_INFO[type].width,
    vx: direction * 0.5,
    vy: 0,
    direction,
    animation: "idle",
    frame: 0,
    row: 0,
    timer: type === "amp" ? 300 : type === "gash" && !virtual ? -1550 : 0,
    interval: petInterval(type, random, virtual),
    cooldown: 0,
    action: 0,
    count: 0,
    protecting: false,
    pearlTaken: false,
    swim: 0,
    turn: 0,
    targetVx: direction * 0.5,
    targetVy: 0,
    knockback: 0,
    knockbackTicks: 0,
  };
}

export function morphPet(pet: Pet, type: PetType, random = Math.random): boolean {
  if (!pet.morph || pet.morphCooldown > 0 || type === pet.type) return false;
  const { x, y, direction } = pet;
  const walterPair = (pet.type === "walter" && type === "presto") || (pet.type === "presto" && type === "walter");
  const cooldown = walterPair ? pet.cooldown : 0;
  const count = walterPair ? pet.count : 0;
  Object.assign(pet, createPet(type, x, y, random, undefined, pet.virtual), { x, y, direction, morph: true, morphAge: 0 });
  pet.cooldown = cooldown;
  pet.count = count;
  pet.morphCooldown = pet.virtual || type === "presto" ? 0 : 360;
  if (type === "gash") pet.timer = 1520;
  return true;
}

export function findSingingPet(pets: readonly Pet[]): Pet | undefined {
  return pets.find((pet) => pet.type === "meryl" && pet.timer >= pet.interval - 100);
}

export function protectsFish(pets: readonly Pet[], fish: PetFish): boolean {
  return fish.kind === "guppy" && fish.stage < 2
    && pets.some((pet) => pet.type === "wadsworth" && pet.protecting && within(pet, fish, 8));
}

function chase(pet: Pet, target: PetPosition, speed: number, horizontal = false): void {
  const dx = target.x - pet.x;
  const dy = horizontal ? 0 : target.y - pet.y;
  const scale = speed / Math.max(8, Math.hypot(dx, dy));
  pet.vx = approach(pet.vx, dx * scale, 0.32);
  pet.vy = approach(pet.vy, dy * scale, 0.23);
}

function wander(pet: Pet, random: () => number, horizontal: boolean): void {
  if (pet.age % 21 === 0 && random() < 0.1) {
    const motions = pet.type === "stinky" || pet.type === "clyde" ? 3 : groundSpeeds.length;
    const move = groundSpeeds[Math.floor(random() * motions)];
    pet.targetVx = horizontal || pet.type === "clyde" ? move : clamp(move, -1, 1);
    pet.targetVy = horizontal ? 0 : pet.targetVx === 0 ? 0.5 : 0.35 - random() * 1.2;
  }
  if (pet.x < (pet.type === "amp" ? 96 : 56) && pet.targetVx <= 0) pet.targetVx = 1;
  if (pet.x > (rightLimit[pet.type] ?? 580) - 10 && pet.targetVx >= 0) pet.targetVx = -1;
  if (!horizontal && pet.y < 95 && pet.targetVy <= 0) pet.targetVy = 0.5;
  if (!horizontal && pet.y > (swimFloor[pet.type] ?? 335) - 20 && pet.targetVy >= 0) pet.targetVy = -0.5;
  pet.vx = approach(pet.vx, pet.targetVx, 0.1);
  if (pet.type === "clyde") {
    const phase = pet.age % 40;
    pet.vy += phase === 2 || phase === 3 ? pet.y < 205 ? -0.2 : -0.5 : 0.02;
    pet.vy = clamp(pet.vy, -2, pet.y > 315 ? 0.2 : 2);
  } else {
    pet.vy = approach(pet.vy, pet.targetVy, 0.06);
  }
}

function validCoin(coin: PetCoin, hasPenta: boolean): boolean {
  return !["bomb", "peanut", "larva", "note", "niko-pearl"].includes(coin.kind)
    && (!hasPenta || (coin.kind !== "star" && coin.kind !== "shell-star"));
}

function alienDamage(type: PetType, alien: PetAlien): number {
  const resistant = alien.kind === "destructor" || alien.kind === "gus";
  if (type === "gash") return resistant ? 0.5 : 3;
  if (type === "rufus") {
    if (alien.kind === "destructor") return 0.25;
    if (alien.kind === "ulysses" || alien.kind === "ulysees" || alien.kind === "gus") return 0.5;
    return 2;
  }
  return resistant ? 0.25 : 1;
}

function projectilePriority(projectile: PetProjectile): number {
  if (!projectile.target || projectile.intercepted || projectile.interception
    || (projectile.spawnTicks ?? 0) > 10) return -1;
  if (projectile.kind === "energy-ball" || projectile.kind === "energyball") return projectile.urgent || projectile.reflected ? 2 : 1;
  return ["classic", "missile", "rocket"].includes(projectile.kind) ? 0 : -1;
}

function stanleyProjectile<Projectile extends PetProjectile>(projectiles: readonly Projectile[]): Projectile | undefined {
  let closest: Projectile | undefined;
  let priority = -1;
  let distance = Infinity;
  for (const projectile of projectiles) {
    const nextPriority = projectilePriority(projectile);
    if (nextPriority < 0 || nextPriority < priority || !projectile.target) continue;
    const nextDistance = Math.hypot(projectile.x - projectile.target.x, projectile.y - projectile.target.y);
    if (nextPriority > priority || nextDistance < distance) {
      closest = projectile;
      priority = nextPriority;
      distance = nextDistance;
    }
  }
  return closest;
}

export function updatePet<
  Fish extends PetFish, Coin extends PetCoin, Food extends PetFood,
  Alien extends PetAlien, DeadFish extends PetCorpse, Projectile extends PetProjectile,
>(pet: Pet, context: PetContext<Fish, Coin, Food, Alien, DeadFish, Projectile>): void {
  const { fish, food, coins, aliens, deadFish, pets, projectiles, random } = context;
  const invaded = aliens.length > 0;
  const finalTank = context.tank === 5;
  const underground = pet.type in ground;
  const hasPenta = fish.some((animal) => animal.kind === "penta" || animal.kind === "starcatcher");
  const isCollectorCoin = (coin: Coin) => validCoin(coin, hasPenta);
  const isTargetAlien = (alien: Alien) => !alien.healing && !alien.spawnTicks;
  pet.age++;
  if (pet.morphAge < 20) pet.morphAge++;
  if (pet.morphCooldown > 0) pet.morphCooldown--;
  if (pet.cooldown > 0) pet.cooldown--;
  if (pet.type === "stinky") pet.action = clamp(pet.action + (invaded ? 1 : -1), 0, 9);
  else if (pet.action > 0) pet.action--;
  if (pet.turn > 0) pet.turn--;

  let following = false;
  if (!finalTank) {
    switch (pet.type) {
      case "stinky":
      case "clyde": {
        if (pet.type === "stinky" && pet.action > 0) {
          pet.vx = 0;
          pet.count = 0;
          following = true;
          break;
        }
        const coin = nearest(pet, coins, isCollectorCoin);
        if (coin) {
          chase(pet, coin, pet.type === "stinky" ? 2 : 1.65, pet.type === "stinky");
          if (pet.type === "stinky" && pet.age % 5 === 0 && pets.some((other) => other.type === "nimbus")) pet.count++;
          const touching = coins.find((candidate) => isCollectorCoin(candidate) && within(pet, candidate, 20));
          if (touching) {
            context.collectCoin(touching);
            pet.count = 0;
          }
          following = true;
        }
        break;
      }
      case "niko":
        pet.timer++;
        if (pet.timer === 1224) context.playSound?.("nikoopen");
        if (pet.timer === 1440) context.playSound?.("nikoclose");
        if (pet.timer === 1233) {
          pet.pearlTaken = false;
          context.addCoin(pet.x - 3, pet.y - 6, "niko-pearl", pet);
        }
        if (pet.timer >= pet.interval) pet.timer = Math.floor(random() * 50);
        break;
      case "itchy":
      case "rufus":
      case "gash": {
        const alien = nearest(pet, aliens, isTargetAlien);
        if (alien) {
          const rufus = pet.type === "rufus";
          chase(pet, alien, rufus ? 2.5 : 6, rufus);
          const reach = rufus ? alien.kind === "bilaterus" ? 10 : 55 : 20;
          if (within(pet, alien, reach, rufus && alien.kind !== "bilaterus" ? 70 : reach)) {
            context.damageAlien(alien, alienDamage(pet.type, alien));
            if (rufus) {
              if (pet.action === 0) context.playSound?.("punch");
              pet.vx = 0;
              pet.action = 2;
            }
          }
          if (pet.type === "gash" && pet.action === 0 && within(pet, alien, 30)) pet.action = 10;
          following = true;
        } else if (pet.type === "gash" && !invaded && ++pet.timer > pet.interval) {
          const prey = nearest(pet, fish, (animal) => animal.kind === "guppy" && !animal.virtual);
          if (prey) {
            chase(pet, prey, 5);
            if (within(pet, prey, 20)) {
              context.playSound?.("chomp");
              context.killFish(prey, false);
              pet.timer = 0;
            }
            if (pet.action === 0 && within(pet, prey, 30)) pet.action = 10;
            following = true;
          }
        }
        break;
      }
      case "prego":
        if (!invaded && ++pet.timer >= pet.interval) {
          if (context.addFish(pet.x + 7, pet.y + 25) === false) {
            pet.timer -= 300;
            break;
          }
          context.playSound?.("baby");
          const guppyCount = fish.filter((animal) => animal.kind === "guppy").length;
          pet.interval = guppyCount > 10 ? 2000 : guppyCount > 5 ? 1230 : 930;
          pet.timer = 0;
        }
        break;
      case "zorf":
        if (!invaded && ++pet.timer >= pet.interval) {
          const hungry = fish.some((animal) => (animal.kind === "guppy" || animal.kind === "breeder")
            && !animal.exoticDiet && animal.fullness < 300);
          const brinkleyPresent = pets.some((other) => other.type === "brinkley");
          if (brinkleyPresent) pet.count++;
          if (hungry || (brinkleyPresent && pet.count % 2 === 0)) {
            context.addFood(pet.x - 5, pet.y - 10, 0, undefined, pet.direction * 3);
            context.playSound?.("dropfood");
            pet.timer = -10;
          } else if (brinkleyPresent) {
            pet.timer = 0;
          }
        }
        break;
      case "vert":
      case "shrapnel":
      case "nostradamus":
        if (!invaded && ++pet.timer >= pet.interval) {
          if (pet.type === "nostradamus") context.addFood(pet.x - 5, pet.y - 10, 0, "snot");
          else context.addCoin(pet.x + 11, pet.y + 6, pet.type === "vert" ? "gold" : "bomb");
          pet.timer = 0;
        }
        break;
      case "meryl":
        if (!invaded) {
          pet.timer++;
          if (pet.timer === pet.interval - 100) {
            context.addCoin(pet.x + 11, pet.y - 9, "note");
            context.playSound?.("sing");
          }
          if (pet.timer >= pet.interval) pet.timer = 0;
        }
        break;
      case "wadsworth": {
        const danger = invaded || projectiles.some((projectile) =>
          !projectile.reflected && (projectile.kind === "missile" || projectile.kind === "energy-ball"));
        if (danger !== pet.protecting) {
          pet.protecting = danger;
          pet.timer = danger ? pet.interval : 30;
        } else if (pet.timer > 0) {
          pet.timer--;
        }
        if (pet.protecting && pet.timer === 0 && fish.some((animal) =>
          animal.kind === "guppy" && animal.stage < 2
            && Math.abs(pet.x - animal.x) > 10 && Math.abs(pet.y - animal.y) > 10)) pet.timer = 100;
        break;
      }
      case "gumbo": {
        const alien = nearest(pet, aliens, () => true);
        if (alien) {
          const away = { x: alien.x > 290 ? 50 : 580, y: alien.y > 185 ? 60 : 335 };
          chase(pet, away, 4);
          following = true;
        }
        break;
      }
      case "blip":
        if (context.tick > 200 && (!pet.morph || pet.age > 720)) context.revealShop();
        break;
      case "rhubarb": {
        const bottom = invaded ? 225 : 235;
        const canLift = (animal: Fish) => rhubarbFish.has(animal.kind) && animal.y > bottom;
        const nextFish = nearest(pet, fish, (animal) => rhubarbFish.has(animal.kind) && animal.y > bottom - 10);
        if (nextFish) {
          chase(pet, nextFish, 2.5, true);
          if (pet.action === 0 && fish.some((animal) => canLift(animal)
            && Math.abs(animal.x - pet.x) < (animal.kind === "ultra" ? 90 : 50))) pet.action = 20;
          following = true;
        }
        if (pet.action === 5) {
          for (const animal of fish) {
            if (!canLift(animal) || Math.abs(animal.x - pet.x) >= (animal.kind === "ultra" ? 80 : 40)) continue;
            const velocity = random() < 0.5 ? -20 : -30;
            context.playSound?.("punch");
            if (context.liftFish) context.liftFish(animal, velocity);
            else animal.vy = velocity;
          }
        }
        break;
      }
      case "nimbus": {
        const coin = nearest(pet, coins, (item) => isCollectorCoin(item) && !item.rising);
        const pellet = invaded || pet.virtual ? undefined : nearest(pet, food, (item) =>
          !item.fade && !item.exotic && !(item.bounced && (item.vy ?? -1) < 0) && !(item.auto && !item.bounced && item.vx));
        const target = coin && pellet
          ? nearest(pet, [coin, pellet], () => true)
          : coin ?? pellet;
        if (target) {
          chase(pet, target, 4.3);
          if (coin && within(pet, coin, 30)) context.bounceCoin(coin, pet);
          if (pellet && within(pet, pellet, 30)) context.bounceFood(pellet, pet);
          following = true;
        }
        break;
      }
      case "amp":
        if (!invaded && pet.timer < pet.interval && ++pet.timer === pet.interval) context.playSound?.("eel2");
        break;
      case "angie": {
        const corpse = nearest(pet, deadFish, (animal) => animal.revivable !== false);
        if (corpse) {
          chase(pet, corpse, 2.7);
          if (within(pet, corpse, corpse.kind === "ultra" ? 60 : 30)) context.reviveFish(corpse);
          following = true;
        }
        break;
      }
      case "brinkley": {
        const pellet = invaded || pet.cooldown > 0 ? undefined : nearest(pet, food, (item) => !item.fade);
        if (pellet) {
          chase(pet, pellet, 2.8);
          if (within(pet, pellet, 15, 18)) {
            context.removeFood(pellet);
            context.playSound?.("slurp");
            pet.cooldown = 45;
            pet.count++;
            if (pet.count % 3 === 0) {
              const reward = pet.count % 135 === 0 ? "shell-treasure" : pet.count % 45 === 0 ? "shell-pearl"
                : pet.count % 15 === 0 ? "shell-diamond" : "shell-star";
              context.addCoin(pet.x + 1, pet.y - 14, reward);
            }
          }
          following = true;
        }
        break;
      }
      case "stanley": {
        if (invaded && pet.cooldown === 0) {
          const projectile = stanleyProjectile(projectiles);
          if (projectile && context.interceptProjectile(projectile, pet) !== false) {
            context.playSound?.("sfx");
            const roll = random();
            pet.cooldown = roll < 0.1 ? 30 : roll < 0.6 ? 60 : 90;
            pet.timer = 0;
            pet.action = 10;
          }
        }
        if (invaded) {
          pet.count = Math.min(10, pet.count + 1);
          if (++pet.timer >= pet.interval) {
            pet.timer = 0;
            if (pet.cooldown === 0) pet.cooldown = 50;
            const alien = nearest(pet, aliens, (candidate) => isTargetAlien(candidate)
              && !projectiles.some((shot) => shot.kind === "pet-ball" && shot.target === candidate));
            if (alien && context.fireAtAlien(alien, pet) !== false) {
              pet.action = 10;
              context.playSound?.("unleash");
            }
          }
        } else {
          pet.count = Math.max(0, pet.count - 1);
        }
        break;
      }
    }
  }

  if (pet.type === "walter" && pet.action <= 35 && pet.action > 18) {
    const distance = pet.action > 31 ? 20 : pet.action > 26 ? 50 : 80;
    const glove = { x: pet.x + pet.direction * distance, y: pet.y };
    for (const animal of fish) {
      if (walterFish.has(animal.kind) && !animal.knockTicks && within(glove, animal, 40)) {
        context.punchFish(animal, pet.direction);
      }
    }
    for (const other of pets) {
      if (other === pet || other.type in ground || other.type === "niko" || other.type === "clyde"
        || other.type === "prego" || other.knockbackTicks > 0 || (other.morph && other.age < 30)
        || !within(glove, other, 40)) continue;
      if (walterDropPets.has(other.type)) other.timer = other.interval - (other.type === "nostradamus" ? 10 : 5);
      other.knockback = pet.direction * (random() < 0.5 ? 15 : 10);
      other.knockbackTicks = 50;
    }
  }

  if (!following && pet.type !== "niko") wander(pet, random, underground);
  if (pet.type === "stinky" && pet.action > 0) pet.vx = 0;
  if (pet.type === "walter" && pet.cooldown > 0 && pet.action === 0) pet.vx = approach(pet.vx, 0, 0.1);
  if (pet.type === "amp") pet.vy = clamp(pet.vy, -0.5, 0.5);

  if (pet.knockbackTicks > 0) {
    pet.knockbackTicks--;
    pet.knockback *= 0.9;
    pet.x += pet.knockback;
    if (pet.morph && pet.type !== "presto" && pet.knockbackTicks <= 40) {
      pet.morphCooldown = 0;
      morphPet(pet, "presto", random);
    }
  }
  if (pet.type !== "niko") {
    const floor = underground ? ground[pet.type as keyof typeof ground] : swimFloor[pet.type] ?? 335;
    const ceiling = pet.type === "nimbus" && !pet.morph ? 285 : 60;
    const nextDirection = pet.vx < -0.08 ? -1 : pet.vx > 0.08 ? 1 : pet.direction;
    if (nextDirection !== pet.direction) {
      if ((pet.type === "walter" && pet.action > 0) || (pet.type === "prego" && pet.timer > pet.interval - 220)) {
        pet.vx = 0;
      } else {
        pet.direction = nextDirection;
        pet.turn = 19;
      }
    }
    pet.x = clamp(pet.x + pet.vx, pet.type === "amp" ? 90 : 50, rightLimit[pet.type] ?? 580);
    if (underground) pet.y = approach(pet.y, floor, 2);
    else pet.y = clamp(pet.y + pet.vy, ceiling, floor);
  } else if (pet.morph) {
    pet.y = approach(pet.y, 315, 2);
  }
  animatePet(pet, invaded);
}

function animatePet(pet: Pet, invaded: boolean): void {
  pet.animation = "idle";
  pet.row = 0;
  pet.swim += Math.abs(pet.vx) > 1 ? 2 : 1;
  const speed = pet.type === "seymour" ? 8 : pet.type === "shrapnel" ? 6
    : ["nimbus", "brinkley", "stanley", "clyde"].includes(pet.type) ? 4 : 2;
  pet.frame = Math.floor(pet.swim / speed) % 10;
  if (pet.turn > 0 && !["niko", "clyde", "rufus", "rhubarb"].includes(pet.type)) {
    pet.animation = "turn";
    pet.row = ["prego", "meryl"].includes(pet.type) ? 2 : 1;
    pet.frame = 9 - Math.floor(pet.turn / 2);
  }
  switch (pet.type) {
    case "stinky":
      if (pet.action > 0) {
        pet.animation = "hide";
        pet.row = 2;
        pet.frame = pet.action;
      } else if (!pet.turn && Math.abs(pet.vx) < 0.3) {
        pet.frame = Math.floor(pet.swim / 4) % 10;
      }
      break;
    case "clyde": {
      const phase = pet.age % 40;
      pet.frame = phase <= 6 ? Math.floor(phase / 2) : phase <= 15 ? 4 : Math.floor(phase / 4);
      break;
    }
    case "niko":
      if (pet.timer < 1224) {
        pet.frame = Math.abs(pet.age % 19 - 9);
      } else {
        pet.animation = "open";
        pet.row = pet.pearlTaken ? 2 : 1;
        pet.frame = pet.timer >= 1440 ? 1449 - pet.timer : Math.min(9, pet.timer - 1224);
      }
      break;
    case "itchy":
      if (invaded) {
        pet.animation = "attack";
        pet.row = pet.turn > 0 ? 3 : 2;
      }
      break;
    case "prego":
      if (!pet.turn && pet.timer > pet.interval - 200) {
        pet.animation = "birth";
        const remaining = pet.interval - pet.timer;
        if (remaining > 190 || remaining < 5) {
          pet.row = 3;
          pet.frame = remaining > 190 ? Math.floor((200 - remaining) / 2) : 10 - remaining;
        } else {
          pet.row = 1;
        }
      }
      break;
    case "zorf":
      if (!pet.turn && pet.timer < 0) {
        pet.animation = "feed";
        pet.row = 2;
        pet.frame = pet.timer + 10;
      }
      break;
    case "rufus":
      if (pet.action > 0) pet.animation = "attack";
      if (!invaded && Math.abs(pet.vx) < 0.1) {
        pet.row = 1;
        const phase = pet.age % 60;
        pet.frame = phase <= 2 ? Math.floor(phase / 2) : phase <= 23 ? 2
          : phase <= 32 ? Math.floor(phase / 2) - 10 : phase <= 53 ? 7 : Math.floor(phase / 2) - 20;
      } else {
        pet.frame = Math.floor(pet.swim / (pet.action ? 1 : 4)) % 10;
        if (pet.direction < 0) pet.frame = 9 - pet.frame;
      }
      break;
    case "vert":
      if (!pet.turn) pet.frame = Math.min(pet.swim % 20, 19 - pet.swim % 20);
      break;
    case "meryl":
      if (pet.timer >= pet.interval - 100) {
        pet.animation = "sing";
        if (!pet.turn) pet.row = 1;
      }
      break;
    case "wadsworth":
      if (pet.timer > 0) {
        pet.animation = "open";
        pet.row = 2;
        const initial = pet.protecting ? pet.interval : 30;
        if (pet.timer > initial - 10) pet.frame = 9 - Math.floor(Math.max(0, initial - pet.timer - 1) / 2);
        else pet.frame = pet.timer <= 10 ? Math.floor((pet.timer - 1) / 2) : 5;
      }
      break;
    case "shrapnel":
      if (pet.timer > pet.interval - 50) pet.animation = "glow";
      break;
    case "gumbo":
      if (invaded) pet.animation = "glow";
      break;
    case "rhubarb":
      if (pet.action > 0) {
        pet.animation = "attack";
        pet.row = 1;
        pet.frame = Math.min(9, Math.floor(pet.action / 2));
      } else if (pet.vx > 0) pet.frame = 9 - pet.frame;
      break;
    case "amp":
      if (pet.timer >= pet.interval) pet.animation = "ready";
      else if (pet.timer < 0) pet.animation = "glow";
      break;
    case "gash":
      if (pet.action > 0 && !pet.turn) {
        pet.animation = "attack";
        pet.row = 2;
        pet.frame = Math.min(9, pet.action);
      }
      break;
    case "nostradamus":
      if (pet.action > 0 && pet.action < 25) pet.animation = "sneeze";
      break;
    case "stanley":
      if (pet.count > 0 && pet.count < 10) {
        pet.row = 5;
        pet.frame = pet.count;
      } else if (invaded) {
        pet.animation = "attack";
        pet.row = pet.action > 0 ? 4 : pet.turn > 0 ? 3 : 2;
        if (pet.action > 0) pet.frame = Math.min(9, pet.action);
      }
      break;
    case "walter":
      if (pet.action > 0) {
        pet.animation = "punch";
        pet.row = 2;
        pet.frame = pet.action >= 30 ? 9 - Math.floor((pet.action - 20) / 2)
          : pet.action >= 10 ? 4 : Math.floor(pet.action / 2);
      } else {
        if (!pet.turn) {
          const frame = Math.floor(pet.swim / 2) % 20;
          pet.frame = Math.min(frame, 19 - frame);
        }
        if (pet.cooldown > 0 && pet.cooldown < 335) pet.animation = "sleep";
      }
      break;
  }
}

export function sneeze(pets: readonly Pet[]): void {
  for (const pet of pets) {
    if (pet.type === "nostradamus") pet.action = 30;
  }
}

export function clickPet<
  Fish extends PetFish, Coin extends PetCoin, Food extends PetFood,
  Alien extends PetAlien, DeadFish extends PetCorpse, Projectile extends PetProjectile,
>(pet: Pet, context: PetContext<Fish, Coin, Food, Alien, DeadFish, Projectile>): boolean {
  if (pet.type === "amp" && pet.timer >= pet.interval) {
    if (++pet.count < 3) {
      context.playSound?.("eel3");
      return true;
    }
    context.playSound?.("eel1");

    const guppies = context.fish.filter((animal) => animal.kind === "guppy" && !animal.virtual);
    const limit = Math.max(20, Math.floor((guppies.length - 20) / 2) + 20);
    for (const [index, guppy] of guppies.entries()) {
      context.killFish(guppy, true);
      if (index < limit) context.addCoin(guppy.x + 11, guppy.y + 6, "penta-diamond");
    }
    for (const other of [...context.pets]) {
      if (other.type !== "nostradamus" || other.morph || !other.transformed) continue;
      context.removePet(other);
      context.addCoin(other.x + 11, other.y + 6, "penta-diamond");
    }
    if (context.fish.length === 0) context.addFish(320, 55);
    pet.interval += 200;
    pet.timer = -20;
    pet.count = 0;
    return true;
  }
  if (pet.type === "walter" && pet.cooldown === 0 && pet.action === 0 && pet.turn === 0) {
    context.playSound?.("punch");
    pet.action = 40;
    if (++pet.count >= 5) {
      pet.cooldown = 360;
      pet.count = 0;
    }
    return true;
  }
  return false;
}
