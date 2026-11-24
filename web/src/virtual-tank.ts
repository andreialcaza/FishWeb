import type { FishKind, FishStage } from "./fish.js";
import { PET_TYPES, type PetType } from "./pets.js";

export const VIRTUAL_SAVE_KEY = "winfish:virtual-tank";
const DAY_MS = 86400000;
const MAX_SHELLS = 9999999;
const FISH_PRICES = {
  guppy: 25, oscar: 100, penta: 2500, grubber: 2500, gekko: 3500, breeder: 5000,
  ultra: 10000, bi: 10000, sylvester: 15000, ball: 20000,
} satisfies Record<FishKind, number>;

export const BACKDROP_NAMES = ["Tank 1", "Tank 2", "Bonus Tank", "Tank 3", "Tank 4", "Cyrax's Lair"];
const FISH_NAME_LENGTH = 12;
export const SPECIAL_FOOD = {
  0: "Baby guppy", 1: "Star", 2: "Beetle", 3: "Carnivore", 4: "Ultravore",
  5: "Chicken", 6: "Pizza", 7: "Ice cream",
} as const;
export type SpecialFood = keyof typeof SPECIAL_FOOD;
type Trait = "invisible" | "voracious" | "speedy" | "singing" | "backward";
type NamedFish = "Rocky" | "Ludwig" | "Cookie" | "Johnny V." | "Kilgore" | "Santa";
const TRAITS: readonly Trait[] = ["invisible", "voracious", "speedy", "singing", "backward"];
const NAMED_FISH: Record<NamedFish, FishSpec> = {
  Rocky: { kind: "guppy", name: "Rocky", hue: 175, traits: ["voracious"], diet: 1006 },
  Ludwig: { kind: "oscar", name: "Ludwig", hue: 85, traits: ["singing"] },
  Cookie: { kind: "gekko", name: "Cookie", diet: 6 },
  "Johnny V.": { kind: "oscar", name: "Johnny V.", hue: "rainbow", diet: 3 },
  Kilgore: { kind: "ultra", name: "Kilgore", traits: ["voracious", "singing"] },
  Santa: { kind: "guppy", name: "Santa", hue: 325, traits: ["singing"] },
};

export interface FishSpec {
  kind: FishKind;
  name?: NamedFish;
  hue?: number | "rainbow";
  traits?: readonly Trait[];
  diet?: number;
}

export interface VirtualFish {
  id: number;
  spec: FishSpec;
  name: string;
  price: number;
  acquired: number;
  shown: boolean;
  parent?: number;
  hasBred?: boolean;
  born?: boolean;
  stage: FishStage;
  meals: number;
  mealsToGrow: number;
  fedToday: number;
  day: number;
  lastHappyDay: number;
  mood: number;
  fullness?: number;
  personality: number;
}

export type StoreItem =
  | { type: "fish"; spec: FishSpec; price: number }
  | { type: "background"; background: number; price: number }
  | { type: "bubbulator" | "attractor" | "upgrade"; price: number };

export interface StoreSlot {
  id: number;
  day: number;
  item: StoreItem;
  sold: boolean;
}

interface StorePurchaseProblem {
  title: string;
  message: string;
}

type VirtualSettings = {
  showNames: boolean;
  showBubbulator: boolean;
  showAttractor: boolean;
  dropShells: boolean;
  showHungry: boolean;
  screensaverSound: boolean;
  screensaverRotate: boolean;
  screensaverDim: boolean;
  screensaverShells: boolean;
};

interface VirtualSave {
  version: 1;
  seed: number;
  shells: number;
  fish: VirtualFish[];
  nextFish: number;
  pets: PetType[];
  background: number;
  backgrounds: number[];
  bubbulator: boolean;
  attractor: boolean;
  upgrade: boolean;
  bonus: number;
  cyraxWins: number;
  storeDay: number;
  sold: number[];
  settings: VirtualSettings;
}

const SETTINGS: VirtualSettings = {
  showNames: true, showBubbulator: false, showAttractor: false, dropShells: true, showHungry: false,
  screensaverSound: true, screensaverRotate: true, screensaverDim: true, screensaverShells: false,
};

export function virtualDay(now: number): number {
  const date = new Date(now);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function dailyRandom(seed: number): (limit: number) => number {
  return (limit) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) % limit;
  };
}

function fishItem(spec: FishSpec): StoreItem {
  const traits = spec.traits ?? [];
  const attributes = traits.length + Number(Boolean(spec.diet));
  let price = FISH_PRICES[spec.kind];
  if (spec.name) price = 50000;
  else if (attributes > 1) price = 40000;
  else if (attributes) price = traits.includes("invisible") || traits.includes("singing") || (spec.diet ?? 0) >= 1000 ? 30000 : 25000;
  else if (spec.hue !== undefined) price = (spec.kind === "oscar" ? 1000 : 500) * (spec.hue === "rainbow" ? 5 : 1);
  return { type: "fish", spec, price };
}

function allowsTrait(kind: FishKind, trait: number): boolean {
  return !(kind === "penta" && [1, 4, 6].includes(trait))
    && !(kind === "grubber" && [4, 6].includes(trait))
    && !(kind === "ball" && [1, 4, 5].includes(trait));
}

function standardSpecial(roll: (limit: number) => number, excluded?: FishKind, trait = 9): FishSpec {
  const weights =  [
    ["penta", 26], ["grubber", 25], ["gekko", 25], ["breeder", 10],
    ["ultra", 5], ["bi", 3], ["ball", 3], ["sylvester", 3],
  ] as const;
  const stock = weights.filter(([kind]) => kind !== excluded && allowsTrait(kind, trait));
  let selected = roll(stock.reduce((total, [, weight]) => total + weight, 0));
  for (const [kind, weight] of stock) {
    selected -= weight;
    if (selected < 0) return { kind };
  }
  return { kind: "penta" };
}

function dailyTrait(day: number): number {
  if (day % 10 === 0) return day % 20 === 0 ? 7 : 8;
  if (day % 2 === 0) return 5;
  return [5, 3, 5, 1, 5, 3, 5, 2, 5, 0, 5, 3, 5, 1, 5, 3, 5, 6, 5, 4][day % 20] ?? 5;
}

function withTrait(spec: FishSpec, trait: number, roll: (limit: number) => number): FishSpec {
  if (trait < 5) return { ...spec, traits: [TRAITS[trait]] };
  if (trait === 5) return { ...spec, diet: 3 + roll(3) };
  if (trait === 6) {
    const diets = spec.kind === "ultra" ? [1000, 1006] : spec.kind === "sylvester" ? [1000]
      : ["oscar", "grubber", "bi"].includes(spec.kind) ? [1005, 1006] : [1000, 1005, 1006];
    return { ...spec, diet: diets[roll(diets.length)] };
  }
  const combinations: Trait[][] = [
    ["invisible", "voracious"], ["invisible", "singing"], ["voracious", "singing"],
    ["backward", "speedy"], ["voracious", "speedy"], ["invisible", "voracious", "singing"],
  ];
  const allowed = combinations.filter((traits) =>
    !(traits.includes("voracious") && ["ball", "penta"].includes(spec.kind))
    && !(traits.includes("backward") && ["ball", "penta", "grubber"].includes(spec.kind)));
  const combination = allowed[roll(allowed.length + 1)];
  if (combination) return { ...spec, traits: combination };
  const traits = TRAITS.filter((_, trait) => allowsTrait(spec.kind, trait));
  const diets = [5, 6].filter((diet) => allowsTrait(spec.kind, diet));
  return { ...withTrait(spec, diets[roll(diets.length)], roll), traits: [traits[roll(traits.length)]] };
}

function randomTrait(kind: FishKind, roll: (limit: number) => number): number {
  const weights = [[48, 5], [20, 1], [10, 3], [5, 2], [5, 0], [5, 6], [5, 4], [2, 7]]
    .filter(([, trait]) => allowsTrait(kind, trait));
  let selection = roll(weights.reduce((total, [weight]) => total + weight, 0));
  for (const [weight, trait] of weights) {
    selection -= weight;
    if (selection < 0) return trait;
  }
  return 3;
}

function storeStock(save: VirtualSave, day: number): StoreItem[] {
  const roll = dailyRandom(save.seed + day);
  const colorful = (kind: "guppy" | "oscar"): FishSpec => ({
    kind, hue: roll(30) === 0 ? "rainbow" : 30 + roll(300),
  });
  const colorfulGuppy = colorful("guppy");
  const colorfulOscar = colorful("oscar");
  const specialty = standardSpecial(roll);
  const trait = dailyTrait(day);
  const classic = (): FishSpec => {
    const kind = roll(2) === 0 ? "guppy" : "oscar";
    return roll(100) <= 75 ? colorful(kind) : { kind };
  };
  const named = (["Rocky", "Ludwig", "Johnny V.", "Kilgore"] as const).filter((name) =>
    !save.fish.some((fish) => fish.spec.name === name));
  const rare = trait === 8 && named.length
    ? NAMED_FISH[named[roll(named.length)]]
    : withTrait(roll(100) <= 75 ? classic() : standardSpecial(roll, specialty.kind, trait), trait, roll);
  const extraFish = (allowClassic: boolean) => {
    const spec = allowClassic && roll(100) <= 75 ? classic() : standardSpecial(roll);
    return fishItem(roll(2) ? spec : withTrait(spec, randomTrait(spec.kind, roll), roll));
  };
  const equipment: StoreItem = !save.bubbulator ? { type: "bubbulator", price: 20000 }
    : !save.attractor ? { type: "attractor", price: 50000 }
      : !save.upgrade ? { type: "upgrade", price: 20000 }
        : save.fish.some(({ spec }) => spec.name === "Cookie") ? extraFish(false) : fishItem(NAMED_FISH.Cookie);
  const candidates = [1, 2, 3, 4, 5, 6].filter((id) => !save.backgrounds.includes(id) && (id !== 6 || roll(5) === 0));
  const backdrop: StoreItem = candidates.length
    ? { type: "background", background: candidates[day % candidates.length], price: 15000 }
    : extraFish(true);
  return [fishItem({ kind: "guppy" }), fishItem({ kind: "oscar" }), equipment,
    fishItem(colorfulGuppy), fishItem(colorfulOscar), fishItem(specialty), fishItem(rare), backdrop];
}

export function requiredFood({ spec, stage }: VirtualFish): SpecialFood | undefined {
  if (spec.diet) {
    return ({ 3: 6, 4: 7, 5: 5, 1000: 0, 1005: 3, 1006: 4 } as Partial<Record<number, SpecialFood>>)[spec.diet];
  }
  if (spec.kind === "ball") return stage === 0 ? 7 : stage === 1 ? 5 : 6;
  if (spec.kind === "sylvester") return stage < 2 ? 3 : 4;
  return ({ oscar: 0, ultra: 3, penta: 1, grubber: 0, gekko: 2, bi: 0 } as Partial<Record<FishKind, SpecialFood>>)[spec.kind];
}

export function resaleValue(fish: VirtualFish, now: number): number {
  if (!fish.born && now >= fish.acquired && now - fish.acquired < DAY_MS) return fish.price;
  if (fish.spec.kind === "sylvester") return Math.floor(fish.price / 2) * (fish.stage === 2 ? 3 : 1);
  const multiplier = fish.spec.kind === "guppy" || fish.spec.kind === "breeder" || fish.spec.kind === "ball"
    ? [1, 2, 3, 3, 5][fish.stage] : 1;
  return Math.floor(fish.price / 2) * multiplier;
}

export function fishMood(fish: VirtualFish): string {
  return ["Horribly Depressed", "Feeling Neglected", "Quite Hungry", "Contented", "Happy", "Chipper",
    ["Super Pumped", "Lovin’ It!", "High on Life", "Totally Stoked", "Fish-tastic!"][fish.personality % 5]][fish.mood];
}

function readSave(raw: string): VirtualSave {
  const saved = JSON.parse(raw) as VirtualSave;
  if (saved?.version !== 1 || !Number.isInteger(saved.seed)
    || !Number.isInteger(saved.shells) || saved.shells < 0 || saved.shells > MAX_SHELLS
    || !Number.isInteger(saved.nextFish) || !Number.isInteger(saved.bonus) || saved.bonus < 0 || saved.bonus > 6
    || !Number.isInteger(saved.cyraxWins) || !Number.isInteger(saved.storeDay)
    || !Array.isArray(saved.sold) || !saved.sold.every((id) => Number.isInteger(id) && id >= 0 && id < 8)
    || !Array.isArray(saved.backgrounds) || !saved.backgrounds.includes(saved.background)
    || !saved.backgrounds.every((id) => Number.isInteger(id) && id >= 1 && id <= 6)
    || !Array.isArray(saved.pets) || !saved.pets.every((pet) => PET_TYPES.includes(pet))
    || !saved.settings || !Object.keys(SETTINGS).every((key) => typeof saved.settings[key as keyof VirtualSettings] === "boolean")
    || !Array.isArray(saved.fish) || saved.fish.length > 20 || !saved.fish.every((fish) => fish && fish.spec
      && Object.hasOwn(FISH_PRICES, fish.spec.kind) && typeof fish.name === "string" && typeof fish.shown === "boolean"
      && [fish.id, fish.price, fish.acquired, fish.stage, fish.meals, fish.mealsToGrow, fish.fedToday, fish.day,
        fish.lastHappyDay, fish.mood, fish.personality].every(Number.isInteger)
      && fish.stage >= 0 && fish.stage <= 4 && fish.mood >= 0 && fish.mood <= 6
      && (fish.spec.name === undefined || Object.hasOwn(NAMED_FISH, fish.spec.name))
      && (fish.spec.hue === undefined || fish.spec.hue === "rainbow" || Number.isFinite(fish.spec.hue))
      && (fish.spec.traits === undefined || (Array.isArray(fish.spec.traits) && fish.spec.traits.every((trait) => TRAITS.includes(trait))))))
    throw new Error("Invalid Virtual Tank save");
  return saved;
}

export class VirtualTankSave {
  message = "";
  private data: VirtualSave;
  private raw: string | null = null;
  private storeVisit?: { day: number; seed: number; items: StoreItem[] };

  constructor(readonly now = Date.now, private readonly storage = () => localStorage, private readonly random = Math.random) {
    this.data = {
      version: 1, seed: Math.floor(random() * 0x100000000), shells: 200, fish: [], nextFish: 1,
      pets: [], background: 1, backgrounds: [1], bubbulator: false, attractor: false, upgrade: false,
      bonus: 0, cyraxWins: 0, storeDay: virtualDay(now()), sold: [], settings: { ...SETTINGS },
    };
    this.refresh();
  }

  get shells(): number { return this.data.shells; }
  get fish(): readonly VirtualFish[] { return this.data.fish; }
  get pets(): readonly PetType[] { return this.data.pets; }
  get background(): number { return this.data.background; }
  get backgrounds(): readonly number[] { return this.data.backgrounds; }
  get settings(): Readonly<VirtualSettings> { return this.data.settings; }
  get capacity(): number { return this.data.bubbulator ? 20 : 10; }
  get adventurePetLimit(): number { return this.data.bonus >= 5 ? 4 : 3; }
  get petLimit(): number { return this.data.bonus === 6 ? 7 : this.data.bonus === 5 ? 4 : 3; }
  get bonusPets(): readonly PetType[] { return PET_TYPES.slice(20, 20 + Math.min(4, this.data.bonus)); }
  get bonusPrice(): number { return this.data.bonus < 6 ? (this.data.bonus + 4) * 5000 : 0; }
  get nextBonus(): string { return ["Brinkley", "Nostradamus", "Stanley", "Walter", "4 Pet Limit", "7 Pet Virtual Tank Limit"][this.data.bonus]; }
  get hasBubbulator(): boolean { return this.data.bubbulator; }
  get hasAttractor(): boolean { return this.data.attractor; }
  get foodLevel(): number { return this.data.upgrade ? 2 : 0; }

  refresh(): void {
    try {
      const raw = this.storage().getItem(VIRTUAL_SAVE_KEY);
      if (raw !== null && raw !== this.raw) {
        this.data = readSave(raw);
        this.raw = raw;
        this.message = "";
      }
    } catch {
      this.message = "The Virtual Tank save could not be loaded from browser storage.";
    }
  }

  private write(): void {
    try {
      const raw = JSON.stringify(this.data);
      this.storage().setItem(VIRTUAL_SAVE_KEY, raw);
      this.raw = raw;
      this.message = "";
    } catch {
      this.message = "Virtual Tank changes could not be saved in this browser.";
    }
  }

  catalog(newVisit = false): StoreSlot[] {
    this.refresh();
    const day = virtualDay(this.now());
    if (newVisit || this.storeVisit?.day !== day || this.storeVisit.seed !== this.data.seed) {
      this.storeVisit = { day, seed: this.data.seed, items: storeStock(this.data, day) };
    }
    return this.storeVisit.items.map((item, id) => ({
      id, day, item, sold: this.data.storeDay === day && this.data.sold.includes(id),
    }));
  }

  purchaseProblem(slot: StoreSlot): StorePurchaseProblem | undefined {
    if (slot.day !== virtualDay(this.now())) {
      return { title: "New Stock", message: "The store has new stock. Choose an item from today's selection." };
    }
    if (slot.day === this.data.storeDay && this.data.sold.includes(slot.id)) {
      return { title: "Sold Out", message: "Sorry, this is sold out. Check back tomorrow!" };
    }
    if (this.shells < slot.item.price) {
      const item = { fish: "this fish", background: "this backdrop", bubbulator: "the Bubbulator",
        attractor: "the Alien Attractor", upgrade: "this upgrade" }[slot.item.type];
      return { title: "Not Enough Shells", message: `Sorry, but you need more shells to purchase ${item}.\n\nKeep playing to earn more!` };
    }
    if (slot.item.type === "fish" && this.fish.length >= this.capacity) {
      const next = this.hasBubbulator ? "" : " You can either buy a Bubbulator or sell a fish back to us.";
      return { title: "Fishtank is Full", message: `You'll need to free up some room in your tank before you can buy another fish.${next}` };
    }
  }

  purchase(slot: StoreSlot, name = ""): string | undefined {
    this.refresh();
    const problem = this.purchaseProblem(slot);
    if (problem) return problem.message;
    const current = this.catalog()[slot.id];
    if (!current || JSON.stringify(current.item) !== JSON.stringify(slot.item)) return "The store stock changed. Choose an item again.";
    const { item } = slot;
    if (item.type === "fish" && !name.trim()) return "Please choose a name for your fish.";
    if (slot.day !== this.data.storeDay) {
      this.data.storeDay = slot.day;
      this.data.sold = [];
    }
    this.data.sold.push(slot.id);
    this.data.shells -= item.price;
    switch (item.type) {
      case "fish": {
        let spec = item.spec;
        const key = name.trim().toLowerCase();
        if (key === "1singingfish") spec = { ...spec, traits: [...new Set([...spec.traits ?? [], "singing" as const])] };
        if (key === "santa" && spec.kind === "guppy" && spec.hue === undefined && !spec.name
          && !this.fish.some((fish) => fish.spec.name === "Santa")) {
          spec = { ...spec, ...NAMED_FISH.Santa, traits: [...new Set([...spec.traits ?? [], "singing" as const])] };
        }
        this.addFish(spec, name, item.price);
        break;
      }
      case "background":
        this.data.backgrounds.push(item.background);
        this.data.background = item.background;
        break;
      case "bubbulator": this.data.bubbulator = this.data.settings.showBubbulator = true; break;
      case "attractor": this.data.attractor = this.data.settings.showAttractor = true; break;
      case "upgrade": this.data.upgrade = true; break;
    }
    this.write();
  }

  private addFish(spec: FishSpec, name: string, price: number, parent?: number): VirtualFish {
    const acquired = this.now();
    const day = virtualDay(acquired);
    const fish: VirtualFish = {
      id: this.data.nextFish++, spec, name: name.trim().slice(0, FISH_NAME_LENGTH + (parent === undefined ? 0 : 4)), price, acquired,
      shown: true, parent, born: parent !== undefined, stage: spec.kind === "sylvester" ? 1 : 0,
      meals: 0, mealsToGrow: spec.name === "Santa" ? 1 : 12 + Math.floor(this.random() * 9), fedToday: 0, day,
      lastHappyDay: day - 1, mood: 3, personality: Math.floor(this.random() * 1000),
    };
    this.data.fish.push(fish);
    return fish;
  }

  birth(parentId: number): VirtualFish | undefined {
    this.refresh();
    const parent = this.fish.find((fish) => fish.id === parentId);
    if (!parent || parent.spec.kind !== "breeder" || parent.stage !== 2 || parent.hasBred || this.fish.length >= this.capacity) return;
    const fish = this.addFish({ ...parent.spec, kind: "guppy" }, parent.name ? parent.name + " Jr." : "",
      parent.price, parentId);
    parent.hasBred = true;
    this.write();
    return fish;
  }

  updateDay(): void {
    const day = virtualDay(this.now());
    if (!this.fish.some((fish) => fish.day !== day)) return;
    this.refresh();
    for (const fish of this.data.fish) {
      if (fish.day === day) continue;
      fish.mood = Math.max(0, fish.mood - Math.max(0, day - fish.lastHappyDay - 1));
      if (day < fish.day) fish.lastHappyDay = day - 1;
      fish.day = day;
      fish.fedToday = 0;
    }
    this.write();
  }

  recordMeal(id: number, stage: FishStage, meals: number, fullness: number): void {
    this.refresh();
    this.updateDay();
    const fish = this.data.fish.find((fish) => fish.id === id);
    if (!fish || !fish.shown || fish.fedToday >= 3) return;
    if (++fish.fedToday === 3) {
      fish.mood = Math.min(6, fish.mood + 1);
      fish.lastHappyDay = fish.day;
    }
    fish.fullness = Math.round(fullness);
    fish.stage = stage;
    fish.meals = meals;
    this.write();
  }

  saveFullness(values: ReadonlyMap<number, { stage: FishStage; meals: number; fullness: number }>): void {
    const raw = this.raw;
    this.refresh();
    if (raw !== this.raw) return;
    let changed = false;
    for (const fish of this.data.fish) {
      const value = values.get(fish.id);
      if (!value || fish.stage !== value.stage || fish.meals !== value.meals) continue;
      const fullness = Math.round(value.fullness);
      if (fish.fullness === fullness) continue;
      fish.fullness = fullness;
      changed = true;
    }
    if (changed) this.write();
  }

  renameFish(id: number, name: string): void {
    this.refresh();
    const fish = this.data.fish.find((entry) => entry.id === id);
    if (!fish || !name.trim()) return;
    fish.name = name.trim().slice(0, FISH_NAME_LENGTH);
    this.write();
  }

  showFish(id: number | undefined, shown: boolean): void {
    this.refresh();
    for (const fish of this.data.fish) if (id === undefined || fish.id === id) fish.shown = shown;
    this.write();
  }

  sellFish(id: number): void {
    this.refresh();
    const fish = this.fish.find((entry) => entry.id === id);
    if (!fish) return;
    this.data.fish = this.data.fish.filter((entry) => entry !== fish);
    for (const baby of this.data.fish) if (baby.parent === id) delete baby.parent;
    this.changeShells(resaleValue(fish, this.now()));
  }

  choosePets(pets: readonly PetType[]): void {
    this.refresh();
    this.data.pets = [...new Set(pets)].slice(0, this.petLimit);
    this.write();
  }

  configure(settings: Partial<VirtualSettings>): void {
    this.refresh();
    Object.assign(this.data.settings, settings);
    this.data.settings.showBubbulator &&= this.hasBubbulator;
    this.data.settings.showAttractor &&= this.hasAttractor;
    this.write();
  }

  cycleBackground(direction: number): void {
    this.refresh();
    const backdrops = this.data.backgrounds.slice().sort((a, b) => a - b);
    this.data.background = backdrops[(backdrops.indexOf(this.background) + direction + backdrops.length) % backdrops.length];
    this.write();
  }

  sellBackground(background: number): void {
    this.refresh();
    if (this.background !== background || !this.backgrounds.includes(background) || this.backgrounds.length < 2) return;
    this.data.backgrounds = this.data.backgrounds.filter((id) => id !== background).sort((a, b) => a - b);
    this.data.background = this.backgrounds.find((id) => id > background) ?? this.backgrounds[0];
    this.changeShells(10000);
  }

  earn(shells: number): void {
    if (shells <= 0) return;
    this.refresh();
    this.changeShells(shells);
  }

  finishCyrax(): number {
    this.refresh();
    const shells = Math.min(25000, 5000 * Math.max(1, this.data.cyraxWins++));
    this.changeShells(shells);
    return shells;
  }

  buyBonus(expectedPrice = this.bonusPrice): boolean {
    this.refresh();
    if (!this.bonusPrice || this.bonusPrice !== expectedPrice || this.bonusPrice > this.shells) return false;
    const price = this.bonusPrice;
    this.data.bonus++;
    this.changeShells(-price);
    return true;
  }

  private changeShells(amount: number): void {
    this.data.shells = Math.max(0, Math.min(MAX_SHELLS, this.shells + amount));
    this.write();
  }
}
