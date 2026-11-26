import { AlienSystem, type AlienContext, type AlienKind } from "./aliens.js";
import type { PlaySound, Sound } from "./audio.js";
import { createFish, updateFish, type Fish, type FishCoinKind, type FishKind, type FishStage, type FishWorld } from "./fish.js";
import { createPet, updatePet, clickPet, findSingingPet, morphPet, nikoPosition, PET_TYPES, protectsFish, sneeze, type Pet, type PetDrop, type PetType } from "./pets.js";
import { adventureWave, BACKGROUNDS, FOOD_PRICE, MAX_WEAPON_POWER, SHOP_ITEMS, TankShop, TIME_TRIAL_SECONDS,
  type ScoreMode, type ShopId, type TankMode } from "./shop.js";
import { requiredFood, type SpecialFood, type VirtualFish, type VirtualTankSave } from "./virtual-tank.js";

export { FOOD_LIMIT, FOOD_PRICE, FISH_PRICE } from "./shop.js";
export const TANK_WIDTH = 640;
export const TANK_HEIGHT = 400;
export const TICK_MS = 28;

const CHOMP_TICKS = 11;
const COIN_FLOOR = 331;
const MAX_BALANCE = 9999999;
const CHALLENGE_WAVES_PER_INCREASE = [4, 5, 5, 6];
const TRIAL_PETS = PET_TYPES.filter((type) => type !== "presto");
const VIRTUAL_ALIENS: readonly AlienKind[] = ["strong-sylv", "balrog", "gus", "destructor", "ulysees", "psychosquid", "bilaterus"];
const SPECIAL_PREY = { 0: "guppy", 3: "oscar", 4: "ultra" } as const;
const SPECIAL_PELLETS = { 5: 5, 6: 3, 7: 4 } as const;
const SHELL_VALUES: Partial<Record<CoinKind, number>> = {
  silver: 1, gold: 2, star: 3, diamond: 5, "penta-diamond": 5, pearl: 10, treasure: 20, larva: 7,
  peanut: 1, "niko-pearl": 10, bomb: 5, "shell-star": 3, "shell-diamond": 5, "shell-pearl": 10, "shell-treasure": 20,
};
export const ATTRACTOR_POSITIONS = [[267, 320], [255, 310], [260, 310], [270, 345], [292, 320], [210, 352]];

export const SANDBOX_FISH = {
  guppy: "Guppy", breeder: "Breeder", oscar: "Carnivore", ultra: "Ultravore",
  penta: "Starcatcher", grubber: "Guppycruncher", gekko: "Beetlemuncher",
  sylvester: "Sylvester fish", ball: "Ball fish", bi: "Bi-fish",
} satisfies Record<FishKind, string>;

export const SANDBOX_ALIENS = {
  "weak-sylv": "Weak Sylvester", "strong-sylv": "Sylvester", balrog: "Balrog", gus: "Gus",
  destructor: "Destructor", ulysees: "Ulysses", psychosquid: "Psychosquid",
  bilaterus: "Bilaterus", "mini-sylv": "Mini Sylvester", cyrax: "Cyrax",
} satisfies Record<AlienKind, string>;

interface Position { x: number; y: number }

export interface FishChomp extends Position {
  readonly startTick: number;
  readonly opacity: number;
}

export interface Food extends Position {
  level: number;
  exotic: number;
  auto: boolean;
  bounced: boolean;
  eatDelay: number;
  vx: number;
  vy: number;
  age: number;
  fade: number;
}

export type CoinKind = FishCoinKind | PetDrop;
const coinValues = {
  silver: 15, gold: 35, star: 40, diamond: 200, "penta-diamond": 200, pearl: 500,
  treasure: 2000, larva: 150, peanut: 15, "niko-pearl": 250, note: 0, bomb: 150,
  "shell-star": 40, "shell-diamond": 200, "shell-pearl": 500, "shell-treasure": 2000,
} satisfies Record<CoinKind, number>;
const coinSounds: Partial<Record<CoinKind, Sound>> = {
  diamond: "diamond", "penta-diamond": "diamond", pearl: "pearl", "niko-pearl": "pearl", treasure: "treasure",
  "shell-star": "bonuscollect", "shell-diamond": "bonuscollect", "shell-pearl": "bonuscollect",
  "shell-treasure": "bonuscollect", bomb: "explode",
};
const deathPitch: Partial<Record<FishKind, number>> = {
  gekko: -3, sylvester: -3, ball: -3, bi: -3, breeder: 5, oscar: -6, grubber: -6, penta: 4, ultra: -12,
};

export interface Coin extends Position {
  kind: CoinKind;
  value: number;
  age: number;
  floorTicks: number;
  fade: number;
  bounced: boolean;
  vy: number;
  readonly rising: boolean;
  owner?: Pet;
  shell?: boolean;
  specialFood?: boolean;
  eatDelay?: number;
}

export interface DeadFish extends Position {
  fish: Fish;
  kind: FishKind;
  age: number;
  floorTicks: number;
  reviveTicks: number;
  revivable: boolean;
  vx: number;
  vy: number;
}

export interface TankOptions {
  tank?: number;
  level?: number;
  pets?: readonly PetType[];
  sandbox?: boolean;
  mode?: ScoreMode;
  playSound?: PlaySound;
  virtualTank?: VirtualTankSave;
  onFishSong?: (fish: VirtualFish) => void;
  seed?: number;
}

export type TankStatus = "playing" | "complete" | "failed" | "rescue" | "loan";
export type TankAction = "coin" | "food" | "food-limit" | "no-money" | "shot" | "pet" | null;
export type Purchase = "bought" | "locked" | "maxed" | "pending" | "no-money";

function remove<T>(items: T[], item: T): void {
  const index = items.indexOf(item);
  if (index !== -1) items.splice(index, 1);
}

export class Tank {
  readonly tank: number;
  readonly level: number;
  readonly mode: TankMode;
  readonly shop: TankShop;
  readonly alienSystem: AlienSystem;
  readonly virtualTank?: VirtualTankSave;
  readonly virtualFish = new Map<number, Fish>();
  private readonly fishIds = new WeakMap<Fish, number>();
  private readonly singingCooldown = new WeakMap<Fish, number>();
  private readonly onFishSong?: (fish: VirtualFish) => void;
  private lastVirtualDayCheck = -Infinity;
  private lastVirtualBackground?: number;
  private bonusEnd = 0;
  private lastShell?: CoinKind;
  private shellCombo = 0;
  shellBonus = false;
  virtualDisplayBackground?: number;
  shellsCollected = 0;
  sandboxFood = 0;
  readonly state = {
    tick: 0, money: 200, fish: [] as Fish[], food: [] as Food[], coins: [] as Coin[],
    pets: [] as Pet[], deadFish: [] as DeadFish[], fishChomps: [] as FishChomp[], status: "playing" as TankStatus,
  };

  private wave: readonly AlienKind[] = [];
  private foodCooldown = 0;
  private battleActiveLastStep = false;
  private readonly fishWorld: FishWorld;
  private readonly playSound?: PlaySound;

  constructor(private readonly random: () => number = Math.random, options: TankOptions = {}) {
    this.playSound = options.playSound;
    this.virtualTank = options.virtualTank;
    this.onFishSong = options.onFishSong;
    const tank = options.tank ?? 1;
    const scoreMode = options.sandbox ? undefined : options.mode;
    this.mode = this.virtualTank ? "virtual" : scoreMode ?? (options.sandbox ? "sandbox" : "adventure");
    const level = scoreMode ? 5 : options.level ?? (this.sandbox ? 5 : 1);
    const lastTank = scoreMode ? TIME_TRIAL_SECONDS.length : BACKGROUNDS.length;
    this.tank = Number.isInteger(tank) && tank >= 1 && tank <= lastTank ? tank : 1;
    this.level = this.tank === 5 ? 1 : Number.isInteger(level) && level >= 1 && level <= 5 ? level : 1;
    this.state.money = this.sandbox ? 999999 : 200;
    this.shop = new TankShop(this.tank, this.level, this.mode, () =>
      this.hatchablePets.some((type) => !this.hasPetInRoster(type)));
    this.alienSystem = new AlienSystem(random, this.playSound);
    const board = this;
    this.fishWorld = {
      random, width: TANK_WIDTH, height: TANK_HEIGHT, playSound: this.playSound,
      fish: this.state.fish, food: this.state.food, coins: this.state.coins,
      get attacking() { return board.alienSystem.battleActive; },
      get feedingBlocked() {
        const aliens = board.alienSystem.aliens;
        const first = aliens.find((alien) => alien.kind !== "bilaterus" && alien.kind !== "mini-sylv" && alien.kind !== "cyrax");
        return first?.kind === "gus" || (!first && aliens.some((alien) => alien.kind === "bilaterus"));
      },
      get merylActive() { return !!findSingingPet(board.state.pets); },
      get gumbo() { return board.state.pets.find((pet) => pet.type === "gumbo"); },
      get refuge() {
        const pet = board.state.pets.find((candidate) => candidate.type === "wadsworth" && candidate.protecting);
        if (!pet) return undefined;
        return { x: pet.x, y: pet.y, kind: "wadsworth" as const };
      },
      removeFood: (food) => remove(this.state.food, food as Food),
      removeCoin: (coin) => remove(this.state.coins, coin as Coin),
      dropCoin: (x, y, _value, kind, fish) => {
        const entry = fish && this.getVirtualFish(fish);
        const name = entry?.spec.name;
        this.addCoin(x, y, name === "Rocky" || (name === "Santa" && fish && fish.stage >= 2) ? "treasure" : kind);
      },
      spawnFish: (kind, x, y, direction, parent) => {
        if (!this.virtualTank) { this.addFish(kind, x, y, direction); return; }
        const entry = parent && this.getVirtualFish(parent);
        if (!entry) return false;
        const baby = this.virtualTank.birth(entry.id);
        if (!baby) {
          if (!this.specialFoodNeeded().includes(0) && this.specialFoodCount(0) > 0) return false;
          this.addFish("guppy", x, y, direction, { eatDelay: entry.spec.diet === 1000 ? 150 : 40 });
          return true;
        }
        this.addVirtualFish(baby, x, y, direction);
        return true;
      },
      killFish: (fish, reason) => {
        if (reason === "potion") this.playSound?.("explode");
        this.killFish(fish, reason === "transformation" ? "removed" : reason === "predation" ? "eaten" : "corpse");
      },
      onGrow: (fish) => {
        this.shop.onGrow(fish.kind, fish.stage);
        if (fish.stage !== 3) this.playSound?.(fish.stage === 4 ? "crowned1" : "grow");
      },
      spawnNostradamus: (x, y) => {
        const pet = this.addPet("nostradamus", x, y);
        pet.transformed = true;
        pet.morphAge = 0;
        this.playSound?.("grow");
        if (this.state.fish.length === 0) this.spawnBoughtFish("guppy");
      },
    };
    if (this.virtualTank) {
      this.fishWorld.growthForMeal = (fish, growth) => {
        const entry = this.getVirtualFish(fish);
        return !entry || entry.fedToday >= 3 || entry.spec.name === "Rocky" ? 0 : growth;
      };
      this.fishWorld.onMeal = (fish) => {
        const entry = this.getVirtualFish(fish);
        if (!entry) return;
        this.virtualTank!.recordMeal(entry.id, fish.stage, fish.meals, fish.fullness);
        if (entry.spec.traits?.includes("singing") && this.state.tick >= (this.singingCooldown.get(fish) ?? 0)) {
          this.singingCooldown.set(fish, this.state.tick + 540);
          this.onFishSong?.(entry);
        }
      };
      this.fishWorld.virtualCoinInterval = (fish, interval) => {
        const entry = this.getVirtualFish(fish);
        if (!entry) return Infinity;
        if (fish.kind === "breeder") return interval;
        if (!this.virtualTank!.settings.dropShells || entry.spec.name === "Cookie" || fish.fullness < 0) {
          if (fish.coinTicks > interval) fish.coinTicks = Math.max(0, interval - 90);
          return Infinity;
        }
        return interval > 360 ? Math.max(360, interval - entry.mood * 540) : interval;
      };
      this.fishWorld.virtualSpeed = (fish) => this.getVirtualFish(fish)?.spec.traits?.includes("speedy") ? 2 : 1;
      this.fishWorld.canCrown = (fish) => this.getVirtualFish(fish)?.spec.hue === undefined;
      this.syncVirtualTank();
      return;
    }

    const pets = this.tank === 5 && !this.sandbox ? PET_TYPES.slice(0, PET_TYPES.indexOf("gash") + 1)
      : options.pets ?? (scoreMode ? PET_TYPES.slice(0, 3) : []);
    for (const pet of new Set(pets)) this.addPet(pet);
    if (this.tank === 4) {
      this.addFish("breeder", this.randomX(), this.randomY(), 1, { meals: 2 });
    } else if (this.tank !== 5) {
      const beginner = this.isFirstLevel();
      this.addFish("guppy", this.randomX(), this.randomY(), 1, { meals: 2, beginner });
      this.addFish("guppy", this.randomX(), this.randomY(), -1, { meals: 2, beginner });
    }
    if (!this.sandbox) {
      const delay = this.tank === 5 ? 300 : this.tank === 1 && this.level === 2 ? 1750 : 3000;
      this.scheduleWave(delay);
    }
  }

  get sandbox(): boolean { return this.mode === "sandbox"; }
  get background(): number { return this.virtualDisplayBackground ?? this.virtualTank?.background ?? BACKGROUNDS[this.tank - 1]; }
  get foodLimit(): number {
    if (!this.virtualTank) return this.shop.foodLimit;
    const fish = this.state.fish.filter(({ kind }) => kind === "guppy" || kind === "breeder").length;
    return Math.max(5, Math.min(fish, 9));
  }
  get bonusSecondsLeft(): number { return Math.max(0, Math.ceil((this.bonusEnd - this.state.tick) * TICK_MS / 1000)); }
  get elapsedSeconds(): number { return Math.floor(this.state.tick * TICK_MS / 1000); }
  get trialSecondsLeft(): number {
    return this.mode === "time-trial" ? Math.max(0, TIME_TRIAL_SECONDS[this.tank - 1] - this.elapsedSeconds) : 0;
  }
  get isFishUnlocked(): boolean { return !!this.shop.getSlot("guppy")?.unlocked; }
  get canBuyFish(): boolean {
    const guppy = this.shop.getSlot("guppy");
    return !!guppy?.unlocked && this.state.money >= guppy.price;
  }
  get regularFoodCount(): number { return this.state.food.filter((food) => !food.auto && !food.exotic).length; }

  syncVirtualTank(): void {
    const save = this.virtualTank;
    if (!save) return;
    save.refresh();
    save.updateDay();
    this.state.money = save.shells;
    for (const [id, fish] of this.virtualFish) {
      const record = save.fish.find((entry) => entry.id === id && entry.shown);
      if (record && record.stage === fish.stage && record.meals === fish.meals) continue;
      this.virtualFish.delete(id);
      remove(this.state.fish, fish);
    }
    for (const entry of save.fish) if (entry.shown && !this.virtualFish.has(entry.id)) this.addVirtualFish(entry);
    for (const pet of [...this.state.pets]) {
      const type = pet.morph ? "presto" : pet.type;
      if (!save.pets.includes(type)) remove(this.state.pets, pet);
    }
    for (const type of save.pets) if (!this.hasPetInRoster(type)) this.addPet(type);
    if (this.background !== this.lastVirtualBackground) {
      this.lastVirtualBackground = this.background;
      const niko = this.state.pets.find((pet) => pet.type === "niko" && !pet.morph);
      if (niko) {
        const { x, y } = nikoPosition(this.background);
        for (const coin of this.state.coins) {
          if (coin.kind !== "niko-pearl" || coin.owner !== niko) continue;
          coin.x += x - niko.x;
          coin.y += y - niko.y;
        }
        niko.x = x;
        niko.y = y;
      }
    }
    if (!save.settings.showAttractor) this.alienSystem.schedule([], 0);
    else if (!this.alienSystem.hasScheduledWave && !this.alienSystem.battleActive) this.scheduleVirtualWave();
  }

  getVirtualFish(fish: Fish): VirtualFish | undefined {
    const id = this.fishIds.get(fish);
    return this.virtualTank?.fish.find((entry) => entry.id === id);
  }

  private addVirtualFish(entry: VirtualFish, x = this.randomX(), y = this.randomY(), direction: -1 | 1 = x < 320 ? 1 : -1): void {
    const fish = this.addFish(entry.spec.kind, x, y, direction, {
      stage: entry.stage, meals: entry.meals, virtual: true, exoticDiet: entry.spec.diet,
    });
    fish.mealsToGrow = entry.mealsToGrow;
    if (entry.fullness !== undefined) fish.fullness = entry.fullness;
    if (entry.spec.traits?.includes("voracious")) fish.fullness = Math.min(fish.fullness, 300);
    this.virtualFish.set(entry.id, fish);
    this.fishIds.set(fish, entry.id);
  }

  specialFoods(): SpecialFood[] {
    if (!this.virtualTank) return [];
    return ([0, 1, 2, 3, 4, 5, 6, 7] as const).filter((food) => this.specialFoodRequired(food) > 0);
  }

  specialFoodNeeded(): SpecialFood[] {
    return this.specialFoods().filter((food) => this.specialFoodCount(food) < this.specialFoodRequired(food));
  }

  private specialFoodRequired(food: SpecialFood): number {
    const fish = this.virtualTank?.fish.filter((fish) => fish.shown && requiredFood(fish) === food).length ?? 0;
    const pets = food === 0 ? this.state.pets.filter((pet) => pet.type === "gash" || pet.type === "amp").length : 0;
    const aliens = this.alienSystem.aliens.reduce((needed, alien) => needed + (alien.kind === "gus"
      ? (food >= 5 ? 3 : 0) : (food === 0 || food === 3 || food === 4 ? 1 : 0)), 0);
    return fish + pets + aliens;
  }

  private specialFoodCount(food: SpecialFood): number {
    if (food === 0 || food === 3 || food === 4) return this.state.fish.filter((fish) =>
      !fish.virtual && fish.kind === SPECIAL_PREY[food] && (food !== 0 || fish.stage === 0)).length;
    if (food === 1 || food === 2) return this.state.coins.filter((coin) =>
      coin.kind === (food === 1 ? "star" : "larva")).length;
    return this.state.food.filter((pellet) => pellet.exotic === SPECIAL_PELLETS[food]).length;
  }

  feedSpecial(food: SpecialFood): boolean {
    if (!this.virtualTank || this.specialFoodCount(food) >= this.specialFoodRequired(food)) return false;
    const x = this.randomX();
    if (food === 0 || food === 3 || food === 4) {
      this.addFish(SPECIAL_PREY[food], x, 5, x < 320 ? 1 : -1, { bought: true, eatDelay: 40 });
      this.playSound?.("splash");
    } else if (food === 1 || food === 2) {
      const coin = this.addCoin(x, food === 1 ? 60 + this.random() * 50 : 270 + this.random() * 50,
        food === 1 ? "star" : "larva");
      coin.specialFood = true;
      coin.eatDelay = 40;
    } else {
      this.addFood(x, 25, 0, true, 0, 40, SPECIAL_PELLETS[food]);
    }
    this.playSound?.("grow");
    return true;
  }

  startShellBonus(): void {
    this.shellBonus = true;
    this.state.status = "playing";
    this.state.money = 0;
    this.state.food.length = this.state.fish.length = this.state.coins.length = this.state.pets.length = 0;
    this.state.deadFish.length = this.state.fishChomps.length = 0;
    this.bonusEnd = this.state.tick + Math.round((5 + 5 * this.tank) * 1000 / TICK_MS);
    this.lastShell = undefined;
    this.shellCombo = 0;
  }

  buyFish(): boolean { return this.buy("guppy") === "bought"; }

  buy(id: ShopId): Purchase {
    const slot = this.shop.getSlot(id);
    if (!slot?.unlocked || this.state.status !== "playing") return "locked";
    if (slot.maxed) return "maxed";
    if (id === "potion" && this.shop.potionReady) return "pending";
    if (this.state.money < slot.price) {
      this.playSound?.("buzzer");
      if (this.state.money === 0 && this.isFirstLevel()) this.state.status = "loan";
      return "no-money";
    }
    this.state.money -= slot.price;
    if (id === "egg" && this.shop.hatchesPets) {
      const available = this.hatchablePets.filter((type) => !this.hasPetInRoster(type));
      this.addPet(available[Math.floor(this.random() * available.length)]);
      this.playSound?.("hatch");
    }
    this.shop.purchase(id, this.state.tick);
    if (id === "egg" && !this.shop.hatchesPets && this.shop.getSlot("egg")?.maxed) {
      this.state.status = "complete";
    }
    const item = SHOP_ITEMS[id];
    if ("fish" in item) this.spawnBoughtFish(item.fish);
    else this.playSound?.("buy");
    return "bought";
  }

  spawnSandboxFish(kind: FishKind, stage?: FishStage): void {
    if (this.sandbox) this.spawnBoughtFish(kind, true, stage);
  }

  spawnSandboxPet(type: PetType): void {
    if (this.sandbox && !this.hasPetInRoster(type)) {
      this.addPet(type);
      this.playSound?.("hatch");
    }
  }

  spawnSandboxAlien(kind: AlienKind): void {
    if (this.sandbox) this.alienSystem.spawn(kind, undefined, undefined, this.alienContext());
  }

  changePresto(type: PetType): void {
    const presto = this.state.pets.find((pet) => pet.type === "presto" || pet.morph);
    if (presto && morphPet(presto, type, this.random)) this.playSound?.("grow");
  }

  acknowledge(): void {
    if (this.state.status === "rescue") this.spawnBoughtFish("guppy");
    else if (this.state.status === "loan") this.state.money += 100;
    else return;
    this.state.status = "playing";
  }

  click(x: number, y: number, heldTicks = 0): TankAction {
    if (this.state.status !== "playing" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || x >= TANK_WIDTH || y < 0 || y >= TANK_HEIGHT) return null;

    if (heldTicks === 0) {
      const coin = this.state.coins.reduce<Coin | undefined>((closest, candidate) => {
        if (candidate.kind === "note" || candidate.specialFood || (candidate.kind === "peanut" && candidate.age < 12)) return closest;
        const distance = Math.hypot(candidate.x - x, candidate.y - y);
        if (distance > 26 || (closest && distance > Math.hypot(closest.x - x, closest.y - y))) return closest;
        return candidate;
      }, undefined);
      if (coin) {
        this.collectCoin(coin);
        return "coin";
      }
      if (this.shellBonus) return null;
      const snot = this.state.food.find((food) => food.exotic === 2 && Math.hypot(food.x - x, food.y - y) < 20);
      if (snot) {
        remove(this.state.food, snot);
        this.addMoney(1);
        this.playSound?.("points");
        return "coin";
      }
      for (const pet of this.state.pets) {
        const hitWidth = pet.type === "amp" ? 70 : 30;
        if (Math.abs(pet.x - x) <= hitWidth && Math.abs(pet.y - y) <= 30 && clickPet(pet, this.petContext())) return "pet";
      }
    } else if (this.alienSystem.battleActive && this.shop.weaponPower < MAX_WEAPON_POWER
      && !this.alienSystem.aliens.some((alien) => alien.kind === "gus")) return null;
    if (this.shellBonus) return null;

    const battle = this.alienSystem.click(x, y, this.alienContext());
    if (battle === "shot") return "shot";
    if (battle === "miss") return null;
    if (x < 31 || x > 586 || y > (battle === "feed" ? 304 : 324)) {
      if (!heldTicks) this.playSound?.("tapglass");
      return null;
    }
    if (this.tank === 5 || (this.foodCooldown > 0 && battle !== "feed")) return null;
    const exotic = this.sandbox && !this.shop.potionReady ? this.sandboxFood : 0;
    if (!exotic && this.regularFoodCount >= this.foodLimit) return "food-limit";
    const paid = !this.virtualTank && (battle !== "feed" || heldTicks > 0);
    if (paid && !this.shop.potionReady && this.state.money < FOOD_PRICE) {
      if (!heldTicks) this.playSound?.("buzzer");
      if (this.state.money === 0 && this.isFirstLevel()) this.state.status = "loan";
      return "no-money";
    }
    const level = this.virtualTank?.foodLevel ?? (this.shop.potionReady ? 3 : this.shop.foodLevel);
    if (this.shop.potionReady) this.shop.potionReady = false;
    else if (paid) this.state.money -= FOOD_PRICE;
    const eatDelay = heldTicks ? 20 : battle === "feed" ? this.alienSystem.gusFoodDelay(x, y) : 0;
    this.addFood(x, y, level, false, 0, eatDelay, exotic);
    this.playSound?.("dropfood");
    return "food";
  }

  step(): void {
    if (this.state.status !== "playing") return;
    this.state.tick++;
    if (this.shellBonus) {
      this.stepShellBonus();
      return;
    }
    if (this.virtualTank && this.state.tick - this.lastVirtualDayCheck >= 36) {
      this.lastVirtualDayCheck = this.state.tick;
      this.virtualTank.updateDay();
    }
    const { fishChomps, tick } = this.state;
    while (fishChomps.length && tick - fishChomps[0].startTick >= CHOMP_TICKS) fishChomps.shift();
    if (this.mode === "time-trial" && this.trialSecondsLeft === 0) {
      this.state.status = "complete";
      return;
    }
    this.shop.step(this.state.tick);
    if (this.foodCooldown > 0) this.foodCooldown--;
    const wasInBattle = this.battleActiveLastStep || this.alienSystem.battleActive;
    const warning = this.alienSystem.warning;
    if (this.tank !== 5 && warning?.ticks === 30 && this.hasPet("nostradamus") && this.random() < 0.5) {
      this.alienSystem.delayWave(605);
      sneeze(this.state.pets);
      this.playSound?.("bubbles");
      this.playSound?.("sneeze");
    }
    this.alienSystem.step(this.alienContext());
    const waveActive = this.alienSystem.battleActive;
    for (const food of [...this.state.food]) this.updateFood(food);
    for (const coin of [...this.state.coins]) this.updateCoin(coin);
    for (const fish of [...this.state.fish]) {
      if (this.state.fish.includes(fish)) updateFish(fish, this.fishWorld);
    }
    const pets = this.petContext();
    for (const pet of [...this.state.pets]) {
      if (this.state.pets.includes(pet)) updatePet(pet, pets);
    }
    this.battleActiveLastStep = this.alienSystem.battleActive;
    if ((wasInBattle || waveActive) && !this.battleActiveLastStep) {
      this.foodCooldown = 36;
      if (this.tank === 5 && !this.sandbox) this.shop.reveal("egg");
    }
    if (!this.sandbox && this.tank !== 5 && !this.battleActiveLastStep && !this.alienSystem.hasScheduledWave) {
      if (!this.virtualTank) this.scheduleWave(3000);
      else if (this.virtualTank.settings.showAttractor) this.scheduleVirtualWave();
    }
    for (const corpse of [...this.state.deadFish]) this.updateDeadFish(corpse);
    if (this.virtualTank) {
      if (this.state.tick % 540 === 0 && this.virtualTank.fish.some((fish) => fish.shown && fish.spec.name === "Cookie")) {
        const foods = this.specialFoodNeeded().filter((food) => food !== 0 || !this.hasPet("prego"));
        if (foods.length) this.feedSpecial(foods[Math.floor(this.random() * foods.length)]);
      }
      return;
    }
    if (this.sandbox) return;
    if (this.tank !== 5 && this.state.fish.length === 0 && fishChomps.length === 0
      && !this.state.deadFish.some((corpse) => corpse.reviveTicks > 0)) {
      this.state.status = this.isFirstLevel() ? "rescue" : "failed";
    }
    if (this.tank === 5 && this.state.pets.length === 0) this.state.status = "failed";
  }

  private scheduleVirtualWave(): void {
    this.alienSystem.schedule([VIRTUAL_ALIENS[Math.floor(this.random() * VIRTUAL_ALIENS.length)]], 3000);
  }

  private stepShellBonus(): void {
    for (const coin of [...this.state.coins]) this.updateCoin(coin);
    if (this.state.tick >= this.bonusEnd) {
      if (this.state.coins.length === 0) this.state.status = "complete";
      return;
    }
    if (this.state.tick % 10 !== 0) return;
    const count = 1 + Math.floor(this.random() * 2);
    for (let i = 0; i < count; i++) {
      const roll = this.random();
      const kind = roll < 0.2 ? "silver" : roll < 0.3 ? "treasure" : roll < 0.5 ? "pearl" : roll < 0.8 ? "diamond" : "gold";
      this.addCoin(45 + this.random() * 550, 12 + this.random() * 10, kind);
    }
  }

  private isFirstLevel(): boolean { return this.tank === 1 && this.level === 1 && this.mode === "adventure"; }
  private hasPet(type: PetType): boolean { return this.state.pets.some((pet) => pet.type === type); }
  private get hatchablePets(): readonly PetType[] { return this.mode === "time-trial" ? TRIAL_PETS : PET_TYPES; }
  private hasPetInRoster(type: PetType): boolean {
    return this.state.pets.some((pet) => (pet.morph ? "presto" : pet.type) === type);
  }
  private randomX(): number { return 60 + this.random() * 520; }
  private randomY(): number { return 70 + this.random() * 265; }

  private scheduleWave(ticks: number): void {
    this.wave = adventureWave(this.tank, this.level, this.random, this.wave.length ? this.wave : undefined);
    if (!this.wave.length) return;
    const kinds = [...this.wave];
    if (this.mode === "challenge") {
      const extraGroups = Math.floor(this.alienSystem.wavesStarted / CHALLENGE_WAVES_PER_INCREASE[this.tank - 1]);
      for (let i = 0; i < extraGroups; i++) kinds.push(...this.wave);
    }
    this.alienSystem.schedule(kinds, ticks);
  }

  private addFish(kind: FishKind, x: number, y: number, direction: -1 | 1, options?: Parameters<typeof createFish>[5]): Fish {
    const beginner = kind === "guppy" && this.isFirstLevel();
    const fish = createFish(kind, x, y, direction, this.random, { beginner, ...options });
    this.state.fish.push(fish);
    return fish;
  }

  private spawnBoughtFish(kind: FishKind, sandboxCreature = false, stage?: FishStage): void {
    const virtual = sandboxCreature && (kind === "sylvester" || kind === "ball" || kind === "bi");
    const x = this.randomX();
    this.addFish(kind, x, 5, x < TANK_WIDTH / 2 ? 1 : -1, { bought: true, virtual, stage });
    this.playSound?.("grow");
    this.playSound?.(kind === "ultra" ? "splashbig" : "splash");
  }

  private killFish(fish: Fish, result: "corpse" | "eaten" | "removed"): void {
    if (!this.state.fish.includes(fish) || (this.virtualTank && fish.virtual)) return;
    remove(this.state.fish, fish);
    if (result === "eaten") {
      const count = 2 + Math.floor(this.random() * 3);
      for (let i = 0; i < count; i++) {
        this.state.fishChomps.push({
          x: Math.trunc(fish.x) + Math.floor(this.random() * 20) - 10,
          y: Math.trunc(fish.y) + Math.floor(this.random() * 20) - 10,
          startTick: this.state.tick,
          opacity: (50 + Math.floor(this.random() * 200)) / 255,
        });
      }
    } else if (result === "corpse") {
      this.playSound?.("die", deathPitch[fish.kind]);
      this.state.deadFish.push({
        fish, kind: fish.kind, x: fish.x, y: fish.y, age: 0, floorTicks: 0, reviveTicks: 0, revivable: true,
        vx: fish.vx, vy: fish.vy - (fish.y < 80 || fish.vy < -3 ? 1 : 2),
      });
    }
  }

  private addPet(type: PetType, x = this.randomX(), y = this.randomY()): Pet {
    const pet = createPet(type, x, y, this.random, this.background, Boolean(this.virtualTank));
    this.state.pets.push(pet);
    return pet;
  }

  private addFood(x: number, y: number, level: number, auto: boolean, vx = 0, eatDelay = 20, exotic = 0): void {
    this.state.food.push({ x, y, level, auto, vx, exotic, eatDelay, vy: vx ? -2 : 0, age: 0, fade: 0, bounced: false });
  }

  private updateFood(food: Food): void {
    food.age++;
    if (food.eatDelay > 0) food.eatDelay--;
    if (food.fade > 0) {
      if (++food.fade === 16) remove(this.state.food, food);
      return;
    }
    food.x = Math.min(570, Math.max(40, food.x + food.vx));
    food.vx -= Math.sign(food.vx) * Math.min(Math.abs(food.vx), 0.05);
    food.y += food.vy + (food.bounced && food.vy < 0 ? 0 : 1.5);
    food.vy = Math.min(0, food.vy + (food.bounced ? 0.15 : 0.05));
    if (food.y > (food.level === 3 ? 345 : 355)) {
      if (food.level === 3 || food.exotic === 2) remove(this.state.food, food);
      else food.fade = 1;
    }
  }

  private addCoin(x: number, y: number, kind: CoinKind, owner?: Pet): Coin {
    const rises = kind === "penta-diamond" || kind === "peanut" || kind.startsWith("shell-");
    const shell = Boolean(this.virtualTank || this.shellBonus);
    const coin: Coin = {
      x, y, kind, value: shell ? SHELL_VALUES[kind] ?? 0 : coinValues[kind], age: 0, floorTicks: 0, fade: 0,
      vy: rises ? -7 : 0, bounced: false, owner, shell,
      get rising() { return this.vy < 0; },
    };
    this.state.coins.push(coin);
    return coin;
  }

  private collectCoin(coin: Coin): void {
    if (!this.state.coins.includes(coin) || coin.kind === "note" || coin.specialFood) return;
    let amount = coin.value;
    if (this.shellBonus) {
      this.shellCombo = this.lastShell === coin.kind ? this.shellCombo + 1 : 1;
      this.lastShell = coin.kind;
      amount *= this.shellCombo === 10 ? 25 : this.shellCombo;
      this.playSound?.("bonuscollect", this.shellCombo - 1);
      if (this.shellCombo === 10) this.lastShell = undefined;
    } else this.playSound?.(coin.shell && coin.kind === "treasure" ? "bonuscollect" : coinSounds[coin.kind] ?? "points");
    if (coin.kind === "niko-pearl" && coin.owner?.type === "niko") coin.owner.pearlTaken = true;
    remove(this.state.coins, coin);
    this.addMoney(amount);
  }

  private addMoney(amount: number): void {
    if (this.virtualTank) {
      this.virtualTank.earn(amount);
      this.shellsCollected += amount;
      this.state.money = this.virtualTank.shells;
    } else this.state.money = Math.min(MAX_BALANCE, this.state.money + amount);
  }

  private updateCoin(coin: Coin): void {
    coin.age++;
    if (coin.eatDelay && coin.eatDelay > 0) coin.eatDelay--;
    if (coin.fade > 0) {
      if (++coin.fade === 16) remove(this.state.coins, coin);
      return;
    }
    if (coin.kind === "note" || coin.kind === "larva") {
      coin.y -= 1;
      if (coin.y < 0 || (coin.kind === "note" && coin.age > 100)) remove(this.state.coins, coin);
      return;
    }
    if (coin.kind === "niko-pearl") {
      if (coin.age > 216) remove(this.state.coins, coin);
      return;
    }
    if (coin.vy < 0) {
      coin.y = Math.max(45, coin.y + coin.vy);
      coin.vy = coin.y === 45 ? 0 : Math.min(0, coin.vy + 0.13);
      return;
    }
    const seymour = this.hasPet("seymour");
    coin.y = Math.min(COIN_FLOOR, coin.y + (seymour ? 0.8 : 1.5));
    if (coin.kind === "bomb" && coin.age > 30) {
      const fish = this.state.fish.find((target) => {
        const radius = target.kind === "ultra" ? 70 : 30;
        return !target.virtual && Math.abs(target.x - coin.x) < radius && Math.abs(target.y - coin.y) < radius;
      });
      if (fish) {
        this.playSound?.("explode");
        this.killFish(fish, "corpse");
        remove(this.state.coins, coin);
        return;
      }
    }
    if (coin.y === COIN_FLOOR && ++coin.floorTicks >= (seymour ? 200 : this.isFirstLevel() && !this.shellBonus ? 150 : 20)) {
      if (coin.kind === "bomb") remove(this.state.coins, coin);
      else coin.fade = 1;
    }
  }

  private updateDeadFish(corpse: DeadFish): void {
    corpse.age++;
    if (corpse.reviveTicks > 0) {
      corpse.y = Math.max(20, corpse.y - 1.5);
      if (--corpse.reviveTicks === 0) {
        this.addFish(corpse.kind, corpse.x, corpse.y, corpse.fish.direction, { stage: corpse.fish.stage });
        remove(this.state.deadFish, corpse);
      }
      return;
    }
    const floor = corpse.kind === "ultra" ? 310 : 345;
    corpse.vy = Math.min(2, corpse.vy + 0.05);
    corpse.vx -= Math.sign(corpse.vx) * Math.min(Math.abs(corpse.vx), 0.03);
    corpse.x = Math.max(50, Math.min(590, corpse.x + corpse.vx / corpse.fish.speedDivisor));
    corpse.y = Math.max(50, Math.min(floor, corpse.y + corpse.vy / corpse.fish.speedDivisor));
    if (corpse.y >= floor && corpse.age >= 20) {
      corpse.floorTicks++;
      corpse.revivable = corpse.floorTicks < 10;
      if (corpse.floorTicks >= 50) remove(this.state.deadFish, corpse);
    }
  }

  private alienContext(): AlienContext<Fish, Food, Pet> {
    const virtual = this.virtualTank;
    const [x, y] = ATTRACTOR_POSITIONS[this.background - 1];
    return {
      fish: this.state.fish, food: this.state.food, pets: this.state.pets, weaponPower: virtual ? 8 : this.shop.weaponPower,
      protectFish: (fish) => protectsFish(this.state.pets, fish),
      attractor: virtual ? virtual.settings.showAttractor && { x: x + 40, y: y - 15 } : this.tank !== 5 && this.hasPet("blip"),
      virtual: Boolean(virtual),
      virtualCoinDrops: virtual?.settings.dropShells,
      removeFish: (fish, corpse) => this.killFish(fish, corpse ? "corpse" : "eaten"),
      removeFood: (food) => remove(this.state.food, food),
      removePet: (pet) => remove(this.state.pets, pet),
      dropCoin: (x, y) => this.addCoin(x, y, "diamond"),
    };
  }

  private petContext(): Parameters<typeof updatePet<Fish, Coin, Food, AlienSystem["aliens"][number], DeadFish, AlienSystem["projectiles"][number]>>[1] {
    return {
      fish: this.state.fish, coins: this.state.coins, food: this.state.food, aliens: this.alienSystem.aliens,
      playSound: this.playSound,
      deadFish: this.state.deadFish, projectiles: this.alienSystem.projectiles, pets: this.state.pets,
      random: this.random, tick: this.state.tick, tank: this.tank, background: this.background,
      addFish: (x, y) => {
        if (this.virtualTank && this.specialFoodCount(0) > this.specialFoodRequired(0)) return false;
        this.addFish("guppy", x, y, 1, this.virtualTank ? { eatDelay: 40 } : undefined);
        return true;
      },
      addFood: (x, y, tier, kind, vx) => this.addFood(x, y, tier, true, vx, 20, kind === "snot" ? 2 : 0),
      addCoin: (x, y, kind, owner) => {
        if (!this.virtualTank || this.virtualTank.settings.dropShells || kind === "note" || kind === "bomb") this.addCoin(x, y, kind, owner);
      },
      collectCoin: (coin) => this.collectCoin(coin),
      bounceCoin: (coin, pet) => {
        coin.bounced = true;
        coin.y = pet.y - 29;
        coin.vy = -7;
        coin.floorTicks = coin.fade = 0;
      },
      bounceFood: (food, pet) => {
        food.bounced = true;
        food.y = pet.y - 29;
        food.eatDelay = 20;
        food.vy = -7;
      },
      removeFood: (food) => remove(this.state.food, food),
      removePet: (pet) => { if (!pet.virtual) remove(this.state.pets, pet); },
      killFish: (fish, corpse) => this.killFish(fish, corpse ? "corpse" : "removed"),
      reviveFish: (corpse) => {
        if (!corpse.revivable) return;
        corpse.revivable = false;
        corpse.reviveTicks = 10;
        this.playSound?.("heal");
      },
      damageAlien: (alien, amount) => this.alienSystem.damage(alien, amount),
      revealShop: () => this.shop.revealAll(),
      interceptProjectile: (projectile, pet) => this.alienSystem.interceptProjectile(projectile, pet),
      fireAtAlien: (alien, pet) => this.alienSystem.fireAtAlien(alien, pet),
      punchFish: (fish, direction) => {
        if (fish.coinInterval > 5) fish.coinTicks = fish.coinInterval - 5;
        fish.knockVx = 18 * direction;
        fish.knockTicks = 50;
      },
      liftFish: (fish, velocity) => {
        if (fish.boughtTicks > 0) return;
        fish.boughtTicks = 50;
        fish.vy = velocity;
      },
    };
  }
}
