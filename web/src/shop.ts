import type { AlienKind } from "./aliens.js";
import type { FishKind } from "./fish.js";

export const FOOD_PRICE = 5;
export const FISH_PRICE = 100;
export const FOOD_LIMIT = 1;
export const MAX_FOOD_LEVEL = 2;
export const MAX_FOOD_LIMIT = 9;
export const MAX_WEAPON_POWER = 12;

export type ScoreMode = "time-trial" | "challenge";
export type TankMode = "adventure" | "sandbox" | "virtual" | ScoreMode;

export const SHOP_ITEMS = {
  guppy: { label: "Guppy", price: FISH_PRICE, fish: "guppy" },
  breeder: { label: "Breeder", price: 200, fish: "breeder" },
  quality: { label: "Food quality", price: 200 },
  quantity: { label: "Food quantity", price: 300 },
  oscar: { label: "Carnivore", price: 1000, fish: "oscar" },
  potion: { label: "Star potion", price: 250 },
  penta: { label: "Starcatcher", price: 750, fish: "penta" },
  grubber: { label: "Guppycruncher", price: 750, fish: "grubber" },
  gekko: { label: "Beetlemuncher", price: 2000, fish: "gekko" },
  ultra: { label: "Ultravore", price: 10000, fish: "ultra" },
  weapon: { label: "Laser upgrade", price: 1000 },
  egg: { label: "Egg piece", price: 0 },
} satisfies Record<string, {label: string; price: number; fish?: FishKind}>;

export type ShopId = keyof typeof SHOP_ITEMS;

export interface ShopSlot {
  readonly id: ShopId;
  readonly position: number;
  readonly price: number;
  readonly unlocked: boolean;
  readonly maxed: boolean;
}

const eggPrices = [
  [150, 500, 2000, 3000, 5000],
  [750, 3000, 5000, 7500, 10000],
  [1000, 5000, 7500, 10000, 15000],
  [3000, 25000, 50000, 75000, 99999],
  [0],
];

export const BACKGROUNDS = [1, 2, 4, 5, 6] as const;
export const TIME_TRIAL_SECONDS = [300, 600, 600, 600] as const;
const CHALLENGE_EGG_PRICES = [5000, 5000, 15000, 25000];
const CHALLENGE_PRICE_INTERVALS = [150, 150, 175, 200];
const CHALLENGE_SHOP_UNLOCK_TICK = 10800;
const CHALLENGE_PRICE_RESET_TICKS = 500;

interface SlotConfig {
  id: ShopId;
  position: number;
  basePrice: number;
  price: number;
}

function getSlots(tank: number, level: number, mode: TankMode): SlotConfig[] {
  if (mode === "virtual") return [];
  const layouts: (ShopId | null)[][] = [
    ["guppy", "quality", "quantity", "oscar", null, "weapon", "egg"],
    ["guppy", "quality", "quantity", "potion", "penta", "weapon", "egg"],
    ["guppy", "quality", "quantity", "grubber", "gekko", "weapon", "egg"],
    ["breeder", "quality", "quantity", "oscar", "ultra", "weapon", "egg"],
    [null, null, null, null, null, null, "egg"],
  ];
  const omitted: ShopId[] = [];
  if (tank === 1 && level === 1) omitted.push("quality", "quantity", "oscar", "weapon");
  if (tank === 1 && level === 2) omitted.push("oscar", "weapon");
  if (tank === 2 && level === 1) omitted.push("penta", "weapon");
  if (tank === 3 && level === 1) omitted.push("gekko", "weapon");
  if (tank === 4 && level === 1) omitted.push("ultra", "weapon");

  return layouts[tank - 1].flatMap((id, position) => {
    if (!id || omitted.includes(id)) return [];
    let price = SHOP_ITEMS[id].price;
    if (id === "egg") {
      switch (mode) {
        case "sandbox": price = 0; break;
        case "time-trial": price = 100; break;
        case "challenge": price = CHALLENGE_EGG_PRICES[tank - 1]; break;
        case "adventure": price = eggPrices[tank - 1][level - 1]; break;
      }
    }
    if (id === "weapon" && tank >= 3) price = tank === 3 ? 2000 : 5000;
    return [{ id, position, basePrice: price, price }];
  });
}

export class TankShop {
  private readonly config: SlotConfig[];
  private readonly unlocked = new Set<ShopId>();
  private inflationResumesAt = 0;
  foodLevel = 0;
  foodLimit = FOOD_LIMIT;
  weaponPower = 2;
  potionReady = false;
  eggPieces = 0;

  constructor(
    readonly tank: number,
    readonly level: number,
    readonly mode: TankMode,
    private readonly canHatchPet: () => boolean = () => true,
  ) {
    this.config = getSlots(tank, level, mode);
    if (mode === "sandbox") this.revealAll();
  }

  get sandbox(): boolean { return this.mode === "sandbox"; }
  get hatchesPets(): boolean { return this.sandbox || this.mode === "time-trial"; }

  get slots(): ShopSlot[] {
    return this.config.map(({ id, position, price }) => ({
      id, position, price, unlocked: this.unlocked.has(id), maxed: this.isMaxed(id),
    }));
  }

  getSlot(id: ShopId): ShopSlot | undefined {
    return this.slots.find((slot) => slot.id === id);
  }

  revealAll(): void {
    this.reveal(...this.config.map((slot) => slot.id).filter((id) => this.sandbox || this.tank !== 5 || id !== "egg"));
  }

  reveal(...ids: ShopId[]): void {
    for (const id of ids) {
      if (this.config.some((slot) => slot.id === id)) this.unlocked.add(id);
    }
  }

  onGrow(kind: FishKind, stage: number): void {
    if (stage === 1) {
      if (kind === "guppy") this.reveal("guppy");
      if (kind === "breeder") this.reveal("breeder");
    }
    if (this.mode === "time-trial" && stage === 2 && (kind === "guppy" || kind === "breeder")) this.reveal("egg");
    if (stage !== 2 || kind !== "guppy") return;
    if (this.tank === 1 && this.level === 1) this.reveal("egg");
    else if (this.tank === 1 && this.level === 2) this.reveal("quality");
    else if (this.tank === 2) {
      this.reveal("quality", "quantity", "potion", this.level === 1 ? "egg" : "penta");
    } else if (this.tank === 3) this.reveal("quality", "quantity", "grubber");
    else this.reveal("quality", "quantity", "oscar");
  }

  step(tick: number): void {
    if (this.mode !== "challenge") return;
    if (tick === CHALLENGE_SHOP_UNLOCK_TICK) this.revealAll();
    if (tick < this.inflationResumesAt || tick % CHALLENGE_PRICE_INTERVALS[this.tank - 1] !== 0
      || (!this.unlocked.has("guppy") && !this.unlocked.has("breeder"))) return;
    for (const slot of this.config) {
      if (this.unlocked.has(slot.id)) slot.price = Math.min(99999, slot.price + Math.floor(slot.basePrice / 100));
    }
  }

  purchase(id: ShopId, tick = 0): void {
    switch (id) {
      case "quality":
        this.foodLevel++;
        if (this.tank === 1 && this.level === 2) this.reveal("quantity", "egg");
        break;
      case "quantity": this.foodLimit++; break;
      case "potion": this.potionReady = true; break;
      case "weapon": this.weaponPower++; break;
      case "egg":
        if (this.sandbox) break;
        if (this.mode === "time-trial") {
          const egg = this.config.find((slot) => slot.id === "egg")!;
          egg.price *= 2;
        } else {
          this.eggPieces++;
          if (this.mode === "challenge") {
            this.inflationResumesAt = tick + CHALLENGE_PRICE_RESET_TICKS;
            for (const slot of this.config) if (slot.id !== "egg") slot.price = slot.basePrice;
          }
        }
        break;
      case "oscar":
        this.reveal("egg");
        if (this.tank !== 4 || this.level > 1) this.reveal("ultra", "weapon");
        break;
      case "penta":
      case "gekko":
      case "ultra": this.reveal("weapon", "egg"); break;
      case "grubber": this.reveal(this.level === 1 ? "egg" : "gekko"); break;
    }
  }

  private isMaxed(id: ShopId): boolean {
    switch (id) {
      case "quality": return this.foodLevel >= MAX_FOOD_LEVEL;
      case "quantity": return this.foodLimit >= MAX_FOOD_LIMIT;
      case "weapon": return this.weaponPower >= MAX_WEAPON_POWER;
      case "egg": return this.hatchesPets ? !this.canHatchPet() : this.eggPieces >= (this.tank === 5 ? 1 : 3);
      default: return false;
    }
  }
}

type Wave = readonly AlienKind[];
const gus = ["gus"] as const;
const destructor = ["destructor"] as const;
const balrog = ["balrog"] as const;
const bilaterus = ["bilaterus"] as const;
const ulysees = ["ulysees"] as const;
const squid = ["psychosquid"] as const;
const sylvAndBalrog = ["weak-sylv", "balrog"] as const;
const destructorAndUlysees = ["destructor", "ulysees"] as const;
const balrogAndBilaterus = ["balrog", "bilaterus"] as const;

export function adventureWave(tank: number, level: number, random: () => number, previous?: Wave): Wave {
  switch (tank) {
    case 1:
      if (level === 1) return [];
      if (level === 2) return ["weak-sylv"];
      if (level === 3) return ["strong-sylv"];
      return level === 5 && previous && random() < 0.5 ? sylvAndBalrog : balrog;
    case 2:
      if (level === 1) return ["strong-sylv"];
      if (level === 2) return balrog;
      if (level === 3) return gus;
      if (level === 4) return destructor;
      if (!previous) return random() < 0.5 ? gus : destructor;
      {
        const current = previous === sylvAndBalrog ? (random() < 0.5 ? gus : destructor) : previous;
        if (random() < 0.1) return current === gus ? destructor : gus;
        return random() < 0.05 ? sylvAndBalrog : current;
      }
    case 3:
      if (level === 1) return balrog;
      if (level === 2) {
        if (!previous) return random() < 0.5 ? gus : destructor;
        return random() < 0.1 ? (previous === gus ? destructor : gus) : previous;
      }
      if (level === 3) return squid;
      if (level === 4) return ulysees;
      return random() < 0.5 ? ulysees : squid;
    case 4:
      if (level === 1) return balrog;
      if (level === 3) return previous && random() < 0.5 ? ["psychosquid", "balrog"] : gus;
      if (level === 4) return previous && random() < 0.5 ? destructorAndUlysees : bilaterus;
      if (level === 5 && previous) {
        const chance = random();
        if (chance < 0.4) return ["psychosquid", "balrog"];
        if (chance < 0.8) return destructorAndUlysees;
      }
      return bilaterus;
    case 5: return ["cyrax"];
    default: return balrogAndBilaterus;
  }
}
