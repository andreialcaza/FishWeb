import type { PlaySound } from "./audio.js";

export type FishKind = "guppy" | "breeder" | "oscar" | "ultra" | "gekko" | "penta" | "grubber" | "sylvester" | "ball" | "bi";
export type FishStage = 0 | 1 | 2 | 3 | 4;
export type FishDeath = "starvation" | "predation" | "potion" | "transformation";
export type FishCoinKind = "silver" | "gold" | "star" | "diamond" | "penta-diamond" | "pearl" | "treasure" | "larva" | "peanut";

interface Point {
  x: number;
  y: number;
}

export interface FishView extends Readonly<Point> {
  readonly kind: FishKind;
  readonly direction: 1 | -1;
  readonly size: number;
  readonly stage: FishStage;
  readonly hunger: number;
  readonly fullness: number;
  readonly hungry: boolean;
  readonly hidden: boolean;
  readonly animation: "swim" | "turn" | "eat";
  readonly frame: number;
  readonly variant: number;
  readonly alternateTurn: boolean;
  readonly growthTicks: number;
}

export interface Fish extends FishView, Point {
  x: number;
  y: number;
  direction: 1 | -1;
  size: number;
  stage: FishStage;
  hunger: number;
  fullness: number;
  hungry: boolean;
  hidden: boolean;
  animation: FishView["animation"];
  frame: number;
  alternateTurn: boolean;
  growthTicks: number;
  meals: number;
  mealsToGrow: number;
  coinTicks: number;
  coinInterval: number;
  vx: number;
  vy: number;
  speedDivisor: number;
  boughtTicks: number;
  movement: number;
  movementTicks: number;
  accelerationTicks: number;
  swimDirection: 1 | -1;
  turnTicks: number;
  eatTicks: number;
  swimTicks: number;
  eatDelay: number;
  knockTicks: number;
  knockVx: number;
  readonly beginner: boolean;
  readonly virtual: boolean;
  readonly exoticDiet: number;
}

export interface FishFood extends Readonly<Point> {
  readonly level?: number;
  readonly exotic?: number;
  readonly pickedUp?: boolean;
  readonly eatDelay?: number;
}

export interface FishCoin extends Readonly<Point> {
  readonly kind?: string;
  readonly value: number;
  readonly eatDelay?: number;
}

export interface FishWorld {
  playSound?: PlaySound;
  readonly random: () => number;
  readonly width: number;
  readonly height: number;
  readonly fish: readonly Fish[];
  readonly food: readonly FishFood[];
  readonly coins: readonly FishCoin[];
  readonly attacking?: boolean;
  readonly feedingBlocked?: boolean;
  readonly merylActive?: boolean;
  readonly relaxed?: boolean;
  readonly refuge?: Readonly<Point> & { readonly kind: "wadsworth" | "gumbo" };
  readonly gumbo?: Readonly<Point>;
  removeFood(food: FishFood): void;
  removeCoin(coin: FishCoin): void;
  dropCoin(x: number, y: number, value: number, kind: FishCoinKind, fish?: Fish): void;
  spawnFish(kind: FishKind, x: number, y: number, direction: 1 | -1, parent?: Fish): boolean | void;
  killFish(fish: Fish, reason: FishDeath): void;
  onGrow(fish: Fish): void;
  spawnNostradamus?(x: number, y: number): void;
  growthForMeal?(fish: Fish, growth: number): number;
  onMeal?(fish: Fish): void;
  virtualCoinInterval?(fish: Fish, interval: number): number;
  virtualSpeed?(fish: Fish): number;
  canCrown?(fish: Fish): boolean;
}

interface FishOptions {
  stage?: FishStage;
  meals?: number;
  bought?: boolean;
  beginner?: boolean;
  virtual?: boolean;
  exoticDiet?: number;
  eatDelay?: number;
}

interface FishProfile {
  initialFullness: number;
  chaseThreshold: number;
  coinDelay: number;
  coinRandom: number;
  mealFullness: number;
  maxFullness: number;
  bottom?: boolean;
}

const PROFILES: Record<FishKind, FishProfile> = {
  guppy:     { initialFullness: 400, chaseThreshold: 500, coinDelay: 150, coinRandom: 200, mealFullness: 500, maxFullness: 800 },
  breeder:   { initialFullness: 400, chaseThreshold: 500, coinDelay: 1000, coinRandom: 400, mealFullness: 500, maxFullness: 800 },
  oscar:     { initialFullness: 600, chaseThreshold: 500, coinDelay: 150, coinRandom: 200, mealFullness: 900, maxFullness: 1300 },
  ultra:     { initialFullness: 600, chaseThreshold: 500, coinDelay: 200, coinRandom: 250, mealFullness: 900, maxFullness: 1300 },
  gekko:     { initialFullness: 400, chaseThreshold: 500, coinDelay: 200, coinRandom: 250, mealFullness: 700, maxFullness: 1000 },
  penta:     { initialFullness: 900, chaseThreshold: 900, coinDelay: 0, coinRandom: 0, mealFullness: 900, maxFullness: 1300, bottom: true },
  grubber:   { initialFullness: 900, chaseThreshold: 900, coinDelay: 300, coinRandom: 200, mealFullness: 1000, maxFullness: 1400, bottom: true },
  sylvester: { initialFullness: 400, chaseThreshold: 500, coinDelay: 200, coinRandom: 250, mealFullness: 700, maxFullness: 1000 },
  ball:      { initialFullness: 400, chaseThreshold: 500, coinDelay: 200, coinRandom: 250, mealFullness: 700, maxFullness: 1000 },
  bi:        { initialFullness: 400, chaseThreshold: 500, coinDelay: 200, coinRandom: 250, mealFullness: 700, maxFullness: 1000 },
};

const FISH_SIZES = [34, 50, 68, 68, 68] as const;
const GUPPY_COINS = ["silver", "gold", "star", "diamond"] as const;
const COIN_VALUES: Record<FishCoinKind, number> = {
  silver: 15, gold: 35, star: 40, diamond: 200, "penta-diamond": 200, pearl: 500, treasure: 2000, larva: 150, peanut: 15,
};
const GRUBBER_SPEEDS = [-0.5, 0.5, -1, 1, 0, 0, -2.5, 2.5] as const;
const PENTA_SPEEDS = [0, -0.5, 0.5, -1, 1, 0, 0, -2.5, 2.5] as const;
const EXOTIC_PREY: Partial<Record<number, FishKind>> = { 1000: "guppy", 1005: "oscar", 1006: "ultra" };

function roll(random: () => number, limit: number): number {
  return Math.floor(random() * limit);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moveToward(value: number, target: number, step: number): number {
  return value + clamp(target - value, -step, step);
}

function fishSize(kind: FishKind, stage: FishStage): number {
  if (kind === "ultra" || (kind === "sylvester" && stage >= 2)) return 160;
  if (kind === "ball") return 50;
  if (kind === "guppy" || kind === "breeder") return FISH_SIZES[stage];
  return 80;
}

export function createFish(kind: FishKind, x: number, y: number, direction: 1 | -1, random: () => number, options: FishOptions = {}): Fish {
  const profile = PROFILES[kind];
  const stage = options.stage ?? (kind === "sylvester" ? 1 : 0);
  const fullness = profile.initialFullness + roll(random, 200);
  const speedDivisor = (profile.bottom ? 2.5 : 1.6) + roll(random, 3) * (profile.bottom ? 0.1 : 0.2);
  const coinInterval = kind === "breeder" && stage === 2 ? 800 + roll(random, 200) : options.virtual
    ? 4320 + roll(random, 200) : profile.coinDelay + roll(random, profile.coinRandom);
  const boughtTicks = options.bought ? (profile.bottom ? 45 : 45 + roll(random, 10)) : 0;
  const dropSpeed = kind === "ultra" ? 25 : kind === "oscar" || kind === "gekko" ? 23 : 18;
  return {
    kind, x, y, direction, stage, size: fishSize(kind, stage), fullness,
    hunger: clamp(1 - fullness / profile.maxFullness, 0, 1),
    hungry: false, hidden: false, animation: "swim", frame: 0, variant: kind === "bi" ? roll(random, 2) : 0,
    alternateTurn: false,
    meals: options.meals ?? 0,
    mealsToGrow: options.virtual || kind === "ball" || kind === "sylvester"
      ? 12 + roll(random, 9)
      : 4 + roll(random, kind === "breeder" ? 2 : 3),
    coinTicks: 0,
    coinInterval, speedDivisor, boughtTicks, vx: profile.bottom ? 0 : direction,
    vy: profile.bottom ? 0 : options.bought ? dropSpeed + roll(random, 5) : -0.5,
    movement: roll(random, 10), movementTicks: 0, accelerationTicks: 40, swimDirection: 1,
    turnTicks: 0, eatTicks: 0, swimTicks: 0, growthTicks: 0, eatDelay: options.eatDelay ?? 0,
    knockTicks: 0, knockVx: 0,
    beginner: options.beginner ?? false, virtual: options.virtual ?? false, exoticDiet: options.exoticDiet ?? 0,
  };
}

type Meal = { kind: "food"; item: FishFood } | { kind: "fish"; item: Fish } | { kind: "coin"; item: FishCoin };

function nearest<T extends Readonly<Point>>(items: readonly T[], origin: Readonly<Point>, matches: (item: T) => boolean): T | undefined {
  let closest: T | undefined;
  let minDistance = Infinity;
  for (const item of items) {
    if (!matches(item)) continue;
    const distance = (item.x - origin.x) ** 2 + (item.y - origin.y) ** 2;
    if (distance < minDistance) {
      closest = item;
      minDistance = distance;
    }
  }
  return closest;
}

function canEatPrey(predator: Fish, prey: Fish): boolean {
  return predator !== prey && !prey.virtual && !prey.hidden && prey.eatDelay <= 0;
}

function findMeal(fish: Fish, world: FishWorld, reachOnly = false): Meal | undefined {
  const { kind, exoticDiet, stage } = fish;
  const reachable = (kind: Meal["kind"], item: Readonly<Point>) => !reachOnly || mealInReach(fish, kind, item);
  if (exoticDiet >= 1000) {
    const preyKind = EXOTIC_PREY[exoticDiet];
    const item = nearest(world.fish, fish, (prey) => prey.kind === preyKind && canEatPrey(fish, prey) && reachable("fish", prey));
    return item && { kind: "fish", item };
  }
  if (kind === "guppy" || kind === "breeder" || kind === "ball" || exoticDiet > 0) {
    const item = nearest(world.food, fish, (food) => {
      if (food.pickedUp || (food.eatDelay ?? 0) > 0 || !reachable("food", food)) return false;
      const exotic = food.exotic ?? 0;
      if (exoticDiet > 0) return exotic === (exoticDiet === 6 ? 0 : exoticDiet);
      if (kind === "ball") return exotic === (stage === 0 ? 4 : stage === 1 ? 5 : 3);
      if (exotic === 2) return kind === "guppy" && (fish.virtual || (stage <= 2 && fish.fullness < 108));
      return exotic === 0 || kind === "breeder";
    });
    return item && { kind: "food", item };
  }
  if (kind === "penta" || kind === "gekko") {
    const item = nearest(world.coins, fish, (coin) => {
      if ((coin.eatDelay ?? 0) > 0 || !reachable("coin", coin)) return false;
      if (kind === "gekko") return coin.kind === "larva" || coin.kind === "peanut";
      if (world.relaxed) return coin.kind === "silver" || coin.kind === "gold";
      return coin.kind === "star" || coin.kind === "shell-star" || coin.kind === "peanut"
        || (coin.kind === undefined && coin.value === COIN_VALUES.star);
    });
    return item && { kind: "coin", item };
  }
  const preyKind = kind === "ultra" || (kind === "sylvester" && stage === 1) ? "oscar" : kind === "sylvester" ? "ultra" : "guppy";
  const item = nearest(world.fish, fish, (prey) => canEatPrey(fish, prey) && prey.kind === preyKind
    && (preyKind !== "guppy" || kind === "bi" || prey.stage === 0) && reachable("fish", prey));
  return item && { kind: "fish", item };
}

function emitCoin(fish: Fish, world: FishWorld, kind: FishCoinKind): void {
  const offsetX = fish.kind === "ultra" ? -4 : 1;
  const offsetY = fish.kind === "penta" ? -16 : fish.kind === "grubber" ? -14 : fish.kind === "ultra" ? 46 : 6;
  world.dropCoin(clamp(fish.x + offsetX, 12, world.width - 12), clamp(fish.y + offsetY, 0, world.height - 20), COIN_VALUES[kind], kind, fish);
}

function setStage(fish: Fish, world: FishWorld, stage: FishStage): void {
  fish.stage = stage;
  fish.size = fishSize(fish.kind, stage);
  fish.growthTicks = 10;
  world.onGrow(fish);
}

function eatMeal(fish: Fish, meal: Meal, world: FishWorld): boolean {
  const { kind } = fish;
  const profile = PROFILES[kind];
  let fullness = profile.mealFullness;
  let maximum = profile.maxFullness;
  let growth = 1;

  if (meal.kind === "food") {
    world.removeFood(meal.item);
    world.playSound?.("slurp");
    if (kind === "guppy" && meal.item.exotic === 2) {
      if (fish.virtual) {
        fish.fullness = Math.min(fish.fullness, 30);
        return true;
      }
      if (fish.stage > 2) return true;
      world.killFish(fish, "transformation");
      world.spawnNostradamus?.(fish.x, fish.y);
      return false;
    }
    if (kind === "guppy" || kind === "breeder") {
      switch (meal.item.level ?? 0) {
        case 0:
          if (fish.beginner && kind === "guppy") fullness += 200;
          break;
        case 1:
          fullness = 700;
          maximum = 1000;
          growth = fish.virtual ? 1 : 2;
          break;
        case 3:
          if (kind === "guppy") {
            if (fish.stage < 2) {
              world.killFish(fish, "potion");
              return false;
            }
            fullness = 1100;
            maximum = 1400;
            growth = 0;
            if (fish.stage === 2) setStage(fish, world, 3);
            break;
          }
          // Breeders digest potions like quality pellets.
        default:
          fullness = fish.virtual ? 500 : 1100;
          maximum = fish.virtual ? 800 : 1400;
          growth = fish.virtual ? 2 : 3;
      }
    }
  } else if (meal.kind === "fish") {
    world.playSound?.("chomp");
    world.killFish(meal.item, "predation");
  } else {
    world.playSound?.("slurp");
    world.removeCoin(meal.item);
  }

  if (fish.virtual && world.onMeal) fish.fullness = Math.max(fish.fullness, 300);
  fish.fullness = Math.min(maximum, fish.fullness + fullness);
  growth = world.growthForMeal?.(fish, growth) ?? growth;
  if (fish.eatTicks === 0) {
    fish.eatTicks = kind === "grubber" ? 12 : kind === "penta" || kind === "ball" || kind === "bi" || kind === "sylvester" ? 0 : 8;
  }

  if (kind === "penta") {
    if ((!world.virtualCoinInterval || Number.isFinite(world.virtualCoinInterval(fish, 1))) && (!fish.virtual || ++fish.coinTicks >= 3)) {
      fish.coinTicks = 0;
      emitCoin(fish, world, "penta-diamond");
    }
  } else if (kind === "guppy" || kind === "breeder" || kind === "ball" || kind === "sylvester") {
    fish.meals += growth;
    if (fish.stage < 2 && fish.meals >= fish.mealsToGrow) {
      setStage(fish, world, fish.stage === 0 ? 1 : 2);
      fish.meals = 0;
      if (kind === "breeder") {
        if (fish.stage === 1) {
          fish.coinTicks = 900;
          if (!fish.virtual) fish.mealsToGrow = 5 + roll(world.random, 5);
        } else {
          fish.coinInterval = 500 + roll(world.random, 200);
          if (fish.virtual) fish.coinTicks = 0;
        }
      }
    } else if (kind === "guppy" && fish.stage < 4 && fish.meals >= fish.mealsToGrow * (fish.virtual ? 8 : 15)
      && (world.canCrown?.(fish) ?? true)) {
      setStage(fish, world, 4);
    }
  }
  world.onMeal?.(fish);
  return true;
}

function dropReward(fish: Fish, world: FishWorld): void {
  const { kind, stage } = fish;
  if (world.attacking || kind === "penta" || ((kind === "guppy" || kind === "breeder") && stage === 0 && !fish.virtual)) return;
  const baseInterval = world.merylActive && kind === "guppy" ? 35 : fish.coinInterval;
  const interval = world.virtualCoinInterval?.(fish, baseInterval) ?? baseInterval;
  if (++fish.coinTicks < interval) return;
  fish.coinTicks = 0;
  if (world.relaxed && fish.fullness <= 0) return;

  switch (kind) {
    case "breeder":
      if (stage > 0 && (!fish.virtual || stage === 2)) {
        const spawned = world.spawnFish("guppy", fish.x + 5, fish.y + 10, fish.direction, fish);
        if (spawned !== false) {
          world.playSound?.("baby");
          if (fish.virtual) fish.coinInterval = 2160;
        }
      }
      return;
    case "guppy":
      if (fish.virtual) {
        const rewards = ["gold", "diamond", "pearl", "gold", "treasure"] as const;
        emitCoin(fish, world, rewards[stage]);
      } else if (stage > 0) {
        emitCoin(fish, world, GUPPY_COINS[stage - 1]);
      }
      return;
    case "oscar":
      emitCoin(fish, world, "diamond");
      return;
    case "ultra":
      emitCoin(fish, world, "treasure");
      return;
    case "gekko":
      emitCoin(fish, world, "pearl");
      return;
    case "grubber":
      emitCoin(fish, world, "larva");
      return;
    case "sylvester":
      emitCoin(fish, world, stage === 1 ? "pearl" : "treasure");
      return;
    case "ball":
      emitCoin(fish, world, stage === 0 ? "silver" : stage === 1 ? "gold" : "diamond");
      return;
    case "bi":
      emitCoin(fish, world, "gold");
  }
}

function steer(velocity: number, offset: number, limit: number, step: number): number {
  if (offset === 0) return velocity;
  const sign = Math.sign(offset);
  return sign * velocity < limit ? velocity + sign * step : velocity;
}

function chaseMeal(fish: Fish, meal: Meal, floor: number): void {
  const { item } = meal;
  const desperate = fish.fullness <= 300;
  const targetOffset = fish.kind === "sylvester" && meal.kind === "fish" && !fish.exoticDiet
    ? fish.stage === 1 ? -4 : -44 : 0;
  const dx = item.x + targetOffset - fish.x;
  const bottom = PROFILES[fish.kind].bottom;
  if (fish.accelerationTicks >= (bottom ? 5 : 3)) {
    fish.accelerationTicks = 0;
    if (bottom) {
      const penta = fish.kind === "penta";
      const far = Math.abs(dx) > (penta ? 10 : 12);
      const fast = penta ? (desperate ? 6 : 4.5) : (desperate ? 4 : 2.5);
      const accelerate = penta ? (desperate ? 2.5 : 1.8) : (desperate ? 1.5 : 0.8);
      const slowAcceleration = penta ? desperate ? 1.2 : 1 : desperate ? 0.8 : 0.6;
      fish.vx = steer(fish.vx, dx, far ? fast : desperate ? 2.5 : 1.5, far ? accelerate : slowAcceleration);
    } else {
      steerSwimmer(fish, item, dx, targetOffset, desperate);
    }
  }
  if (fish.kind === "grubber" && fish.y >= floor - 0.5 && Math.abs(dx) < 40 && item.y > fish.y - 120 && item.y < fish.y + 60) {
    fish.vy = -14;
  }
}

function steerSwimmer(fish: Fish, meal: Readonly<Point>, dx: number, targetOffset: number, desperate: boolean): void {
  const { kind } = fish;
  const predator = kind === "oscar" || kind === "ultra";
  const symmetric = kind === "ball" || kind === "bi" || kind === "sylvester" || kind === "gekko";
  const close = symmetric || kind === "ultra";
  const distanceX = Math.abs(dx);
  const stepX = distanceX > (close ? 4 : 8) ? predator ? 1.5 : desperate ? 1.3 : 1
    : distanceX > (close ? 2 : 4) ? desperate || predator ? 0.2 : 0.1
      : predator && !desperate ? 0.1 : 0.05;
  fish.vx = steer(fish.vx, dx, (predator ? 4 : 3) + Number(desperate), stepX);

  const offsetY = feedingOffset(fish) + (kind === "breeder" ? 5 : 0);
  const dy = meal.y + targetOffset - fish.y - offsetY;
  if (symmetric) {
    const stepY = desperate ? 1.3 : Math.abs(dy) > 3 ? 1 : 0.5;
    fish.vy = steer(fish.vy, dy, desperate ? 4 : 3, stepY);
    return;
  }

  const downward = dy > 0;
  const limitY = (desperate || predator ? 3 : 2) + Number(downward);
  if (kind === "ultra" && desperate) {
    fish.vy = steer(fish.vy, dy, limitY, 1.3);
    return;
  }
  const far = Math.abs(dy) > (kind === "ultra" ? 3 : 6);
  const farUp = desperate ? predator ? 1.3 : 1 : predator ? 0.8 : 0.6;
  const farDown = desperate ? predator ? 1.5 : 1.3 : predator ? 1.3 : 1;
  const stepY = downward ? (far ? farDown : desperate ? 0.7 : 0.5) : (far ? farUp : desperate ? 0.5 : 0.3);
  fish.vy = steer(fish.vy, dy, limitY, stepY);
}

function feedingOffset(fish: Fish): number {
  if (fish.kind === "sylvester" && fish.stage !== 1) return -30;
  if (fish.exoticDiet && (fish.kind === "guppy" || fish.kind === "oscar" || fish.kind === "ultra")) return 20;
  if (fish.kind === "ultra") return 20;
  if (fish.kind === "oscar") return 10;
  if (fish.kind === "gekko") return 5;
  return 0;
}

function mealInReach(fish: Fish, mealKind: Meal["kind"], item: Readonly<Point>, anticipating = false): boolean {
  const dx = Math.abs(item.x - fish.x);
  const dy = item.y - fish.y;
  if (fish.exoticDiet) {
    const offset = feedingOffset(fish);
    if (mealKind === "food") return dx < (anticipating ? 30 : 15) && Math.abs(dy - offset) < (anticipating ? 25 : 20);
    const radius = (fish.exoticDiet === 1006 ? 80 : 40) + (anticipating ? 20 : 0);
    return dx < radius && Math.abs(dy - offset) < radius;
  }
  if (mealKind === "food") {
    if (fish.kind === "ball") return !anticipating && dx < 30 && Math.abs(dy) < 30;
    if (fish.kind === "breeder") return dx < (anticipating ? 35 : 20) && dy > (anticipating ? -25 : -20) && dy < (anticipating ? 20 : 15);
    return dx < (anticipating ? 30 : 15) && dy > (anticipating ? -20 : -15) && dy < (anticipating ? 25 : 20);
  }
  if (mealKind === "coin") {
    if (fish.kind === "gekko") return dx < (anticipating ? 40 : 18) && Math.abs(dy) < (anticipating ? 30 : 18);
    return !anticipating && dx < 20 && dy > -30 && dy < 20;
  }
  switch (fish.kind) {
    case "oscar": return dx < (anticipating ? 47 : 30) && dy > (anticipating ? -25 : -13) && dy < (anticipating ? 35 : 23);
    case "ultra": return dx < (anticipating ? 110 : 80) && dy > (anticipating ? -50 : -30) && dy < (anticipating ? 70 : 50);
    case "grubber": return dx < 40 && dy > (anticipating ? -120 : -30) && dy < (anticipating ? 60 : 30);
    case "sylvester": return !anticipating && (fish.stage === 1 ? dx < 30 && Math.abs(dy) < 30 : dx < 70 && Math.abs(dy + 30) < 70);
    default: return !anticipating && dx < 30 && Math.abs(dy) < 30;
  }
}

function swim(fish: Fish, world: FishWorld): void {
  if (fish.movement === 0) {
    if (fish.boughtTicks === 0) fish.vy = 0.5;
    fish.y -= 0.25 / fish.speedDivisor;
  } else if (fish.movement < 3) {
    if (fish.boughtTicks === 0) fish.vy = -0.5;
    fish.y -= 0.5 / fish.speedDivisor;
  } else if (fish.movement > 4 && fish.boughtTicks === 0) {
    fish.vy = fish.y < 70 ? -0.1 : -0.5;
  }

  if (fish.accelerationTicks >= 40) {
    fish.accelerationTicks = 0;
    switch (fish.movement) {
      case 0:
        if (Math.abs(fish.vx) > 0.5) fish.vx -= Math.sign(fish.vx) * 0.5;
        break;
      case 1:
      case 2:
        fish.vx = moveToward(fish.vx, fish.movement === 1 ? 1 : -1, 1);
        break;
      case 3:
      case 4:
        fish.vx = moveToward(fish.vx, fish.movement === 3 ? -1 : 1, 1);
        if (fish.boughtTicks === 0) fish.vy = moveToward(fish.vy, 3, 1);
        break;
      default:
        fish.vx += fish.swimDirection * (fish.vx * fish.swimDirection >= 0 ? 1 : 2);
        if ((fish.swimDirection > 0 && fish.x > 290) || (fish.swimDirection < 0 && fish.x < 215)) {
          fish.swimDirection = fish.swimDirection > 0 ? -1 : 1;
          fish.vx += fish.swimDirection * 2;
        }
    }
  }
  if ((fish.movement === 3 || fish.movement === 4) && fish.y > world.height * 0.56) fish.movement = 0;
}

function updateMovement(fish: Fish, world: FishWorld, bottom: boolean): void {
  fish.accelerationTicks++;
  const onEdge = bottom && (fish.x <= 50 || fish.x >= world.width - 60);
  fish.movementTicks++;
  if ((fish.movementTicks <= 20 && !onEdge) || (fish.kind === "grubber" && fish.eatTicks > 0)) return;
  fish.movementTicks = 0;
  if (roll(world.random, 10) !== 0) return;
  fish.movement = bottom ? roll(world.random, fish.kind === "penta" ? PENTA_SPEEDS.length : GRUBBER_SPEEDS.length) : 1 + roll(world.random, 9);
}

function walk(fish: Fish): void {
  const speeds = fish.kind === "penta" ? PENTA_SPEEDS : GRUBBER_SPEEDS;
  fish.vx = moveToward(fish.vx, speeds[fish.movement] ?? 0, 0.1);
}

function takeShelter(fish: Fish, refuge: Readonly<Point>, turtle: boolean): void {
  const dx = refuge.x - fish.x;
  const dy = refuge.y - fish.y;
  if (turtle) {
    if (fish.knockTicks === 0) fish.vx = 0.5 * fish.direction;
    if (fish.boughtTicks === 0) fish.vy = 0;
    if (Math.abs(dx) > 5) fish.x += Math.sign(dx) * (Math.abs(dx) > 50 ? 5 : 3);
    if (Math.abs(dy) > 5) fish.y += Math.sign(dy) * (Math.abs(dy) > 50 ? 4 : 3);
  } else {
    fish.vx = steer(fish.vx, dx, 4, Math.abs(dx) > 10 ? 1.3 : Math.abs(dx) > 5 ? 0.2 : 0.05);
    const offsetY = dy - 20;
    const raising = offsetY < 0;
    const step = Math.abs(offsetY) > 5 ? raising ? 1 : 1.3 : raising ? 0.5 : 0.7;
    fish.vy = steer(fish.vy, offsetY, raising ? 3 : 4, step);
  }
}

function animate(fish: Fish, bottom: boolean): number {
  if (fish.growthTicks > 0) fish.growthTicks--;
  const direction = fish.vx < 0 ? -1 : fish.vx > 0 ? 1 : fish.direction;
  if (bottom) {
    fish.direction = direction;
    if (fish.kind === "grubber" && fish.eatTicks > 0) {
      fish.eatTicks--;
      if (fish.eatTicks > 0) {
        fish.animation = "eat";
        fish.frame = 9 - Math.floor(fish.eatTicks / 2);
        return 1;
      }
    }
    const length = Math.abs(fish.vx) >= 1 ? 20 : 40;
    fish.swimTicks = (fish.swimTicks + (fish.vx > 0 ? 1 : -1) + length) % length;
    fish.animation = "swim";
    fish.frame = Math.floor(fish.swimTicks / (length / 10));
    return 1;
  }

  if (fish.kind === "ball") {
    const step = Math.abs(fish.vx) > 1 ? 3 : Math.abs(fish.vx) > 0.5 ? 2 : 1;
    const frameDelay = fish.stage === 1 ? 12 : 6;
    const length = frameDelay * 10;
    fish.swimTicks = (fish.swimTicks + direction * step + length) % length;
    fish.direction = direction;
    fish.animation = "swim";
    fish.frame = Math.floor(fish.swimTicks / frameDelay);
    return 1;
  }

  if (direction !== fish.direction && (fish.kind !== "bi" || fish.turnTicks === 0)) {
    fish.turnTicks = fish.kind === "sylvester" ? 10 : 20;
    if (fish.kind === "bi") fish.alternateTurn = !fish.alternateTurn;
  }
  fish.direction = direction;
  if (fish.turnTicks > 0) {
    fish.turnTicks--;
    if (fish.kind === "ultra") fish.eatTicks = 0;
    else if (fish.eatTicks > 0) fish.eatTicks--;
    fish.animation = "turn";
  }
  if (fish.turnTicks > 0) {
    fish.frame = fish.kind === "sylvester"
      ? (direction < 0 ? 9 : 10) - fish.turnTicks : 9 - Math.floor(fish.turnTicks / 2);
    return 1;
  }

  if (fish.eatTicks > 0 && --fish.eatTicks > 0) {
    fish.animation = "eat";
    fish.frame = 9 - Math.floor(fish.eatTicks / 2);
    return 1;
  }

  fish.animation = "swim";
  if (fish.kind === "sylvester" && Math.abs(fish.vx) > 1.6) {
    fish.swimTicks = (fish.swimTicks + 1) % 51;
    const tick = fish.swimTicks;
    fish.frame = tick <= 10 ? Math.floor(tick / 2) : tick <= 39 ? 6 : Math.floor((50 - tick) / 2);
    return tick <= 6 ? 0.75 : tick <= 10 ? 1.75 : 1.5;
  }
  const fast = fish.kind !== "sylvester" && fish.kind !== "bi" && Math.abs(fish.vx) > 1;
  fish.swimTicks = (fish.swimTicks + (fast ? 2 : 1)) % 20;
  fish.frame = fish.kind === "bi" && fish.variant === 1
    ? Math.abs(fish.swimTicks - (fish.swimTicks < 10 ? 9 : 10)) : Math.floor(fish.swimTicks / 2);
  return 1;
}

export function updateFish(fish: Fish, world: FishWorld): void {
  const profile = PROFILES[fish.kind];
  const bottom = profile.bottom ?? false;
  const floor = world.height - (fish.kind === "penta" ? 76 : 80);
  if (fish.eatDelay > 0) fish.eatDelay--;
  const nurseryFish = fish.kind === "guppy" || fish.kind === "breeder";
  const refuge = world.refuge?.kind === "wadsworth" && fish.stage < 2 && nurseryFish ? world.refuge : undefined;
  const gumbo = world.gumbo ?? (world.refuge?.kind === "gumbo" ? world.refuge : undefined);
  const sheltering = refuge !== undefined;
  if (!world.attacking && !sheltering) fish.fullness = Math.max(-5000, fish.fullness - 1);

  const starvationLimit = world.relaxed ? (bottom || fish.kind === "gekko" ? -4320 : -2160) : fish.beginner ? -500 : 0;
  const exempt = fish.virtual || fish.kind === "sylvester" || fish.kind === "ball" || fish.kind === "bi";
  if (!exempt && fish.fullness <= starvationLimit) {
    world.killFish(fish, "starvation");
    return;
  }

  const feedingBlocked = world.feedingBlocked && nurseryFish;
  const meal = fish.fullness < profile.chaseThreshold && !sheltering && !feedingBlocked ? findMeal(fish, world) : undefined;
  if (meal) {
    chaseMeal(fish, meal, floor);
    const reached = mealInReach(fish, meal.kind, meal.item) ? meal : findMeal(fish, world, true);
    if (reached) {
      if (!eatMeal(fish, reached, world)) return;
    } else if (fish.eatTicks === 0 && mealInReach(fish, meal.kind, meal.item, true)) {
      fish.eatTicks = 20;
    }
  } else if (refuge) {
    takeShelter(fish, refuge, true);
  } else if (gumbo && world.attacking && nurseryFish) {
    takeShelter(fish, gumbo, false);
  } else if (bottom) {
    walk(fish);
  } else {
    swim(fish, world);
  }

  updateMovement(fish, world, bottom);
  dropReward(fish, world);
  fish.hungry = fish.fullness <= 300;
  const maxFullness = Math.max(profile.maxFullness, fish.fullness);
  fish.hunger = clamp((maxFullness - fish.fullness) / (maxFullness - starvationLimit), 0, 1);

  const large = fish.size >= 160;
  const xMin = large ? 80 : fish.kind === "ball" ? 35 : 50;
  const xMax = world.width - (fish.kind === "grubber" ? 40 : fish.kind === "penta" ? 50 : large ? 80 : 60);
  const canSwimLow = fish.kind === "guppy" || fish.kind === "breeder";
  const yMin = large ? 80 : fish.kind === "ball" ? 55 : canSwimLow || bottom ? 60 : 70;
  const yMax = bottom ? floor : world.height - (large ? 85 : fish.kind === "ball" ? 90 : canSwimLow ? 65 : 75);
  if (fish.boughtTicks > 0) {
    fish.boughtTicks--;
    if (!bottom) fish.vy *= 0.9;
  }

  if (bottom) {
    if (fish.y >= floor && fish.vy > 0) fish.vy = 0;
    if (fish.y < floor) fish.vy += 0.4;
  } else {
    if (Number.isInteger(fish.vx) && fish.vx >= 0 && fish.vx <= 3) fish.y += (1 - fish.vx * 0.25) / fish.speedDivisor;
    if (large) fish.y -= 0.25;
  }

  if (fish.x > xMax - 5 && fish.vx > 0.1) fish.vx -= 0.1;
  if (fish.x < xMin + 5 && fish.vx < -0.1) fish.vx += 0.1;
  if (fish.knockTicks > 0) {
    fish.knockTicks--;
    fish.knockVx *= 0.9;
    fish.x += fish.knockVx;
  }
  const minY = fish.boughtTicks > 0 && (bottom || fish.vy > 0) ? -fish.size / 2 : yMin;
  const swimSpeed = animate(fish, bottom) / fish.speedDivisor * (world.virtualSpeed?.(fish) ?? 1);
  fish.x = clamp(fish.x + fish.vx * swimSpeed, xMin, xMax);
  fish.y = clamp(fish.y + fish.vy * swimSpeed, minY, yMax);
  fish.hidden = refuge !== undefined && Math.abs(refuge.x - fish.x) < 8 && Math.abs(refuge.y - fish.y) < 8;
}
