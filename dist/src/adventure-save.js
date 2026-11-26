import { PET_TYPES } from "./pets.js";
import { BACKGROUNDS } from "./shop.js";
const SAVE_KEY = "winfish:adventure:checkpoint";
const SAVE_VERSION = 2;
const LEVELS_PER_TANK = 5;
const PRESTO_INDEX = PET_TYPES.indexOf("presto");
export const FINAL_ADVENTURE_TANK = BACKGROUNDS.length;
function levelCount(tank) {
    return tank === FINAL_ADVENTURE_TANK ? 1 : LEVELS_PER_TANK;
}
function finalUnlocked(tanks) {
    return tanks.slice(0, -1).every(({ cleared }) => cleared === LEVELS_PER_TANK);
}
function unlockedPets(tanks) {
    return PET_TYPES.slice(0, PRESTO_INDEX + 1).filter((_, index) => index === PRESTO_INDEX
        ? tanks[FINAL_ADVENTURE_TANK - 1].cleared > 0
        : tanks[Math.floor(index / LEVELS_PER_TANK)].cleared > index % LEVELS_PER_TANK);
}
function validPets(pets, unlocked) {
    return Array.isArray(pets) && pets.length <= 4 && new Set(pets).size === pets.length
        && pets.every((pet) => unlocked.includes(pet));
}
function validProgress(tanks) {
    if (!Array.isArray(tanks) || tanks.length !== FINAL_ADVENTURE_TANK
        || !tanks.every((tank, index) => tank && Number.isInteger(tank.cleared)
            && tank.cleared >= 0 && tank.cleared <= levelCount(index + 1)))
        return false;
    if (tanks[FINAL_ADVENTURE_TANK - 1].cleared && !finalUnlocked(tanks))
        return false;
    const unlocked = [...unlockedPets(tanks), ...PET_TYPES.slice(PRESTO_INDEX + 1)];
    return tanks.every(({ pets }, index) => pets === undefined
        || validPets(pets, index + 1 === FINAL_ADVENTURE_TANK ? [] : unlocked));
}
function migrate(checkpoint) {
    if (checkpoint?.stage === "complete") {
        return BACKGROUNDS.map((_, index) => ({ cleared: levelCount(index + 1) }));
    }
    if (checkpoint?.stage !== "level" && checkpoint?.stage !== "next")
        return undefined;
    const { tank, level, pets } = checkpoint;
    if (!Number.isInteger(tank) || tank < 1 || tank > FINAL_ADVENTURE_TANK
        || !Number.isInteger(level) || level < 1 || level > levelCount(tank))
        return undefined;
    const tanks = BACKGROUNDS.map((_, index) => {
        const number = index + 1;
        return { cleared: number < tank ? levelCount(number) : number === tank ? level - 1 : 0 };
    });
    if (!validPets(pets, unlockedPets(tanks)))
        return undefined;
    tanks[tank - 1].pets = tank === FINAL_ADVENTURE_TANK ? [] : pets;
    return tanks;
}
export class AdventureSave {
    storage;
    message = "";
    tanks = BACKGROUNDS.map(() => ({ cleared: 0 }));
    saved;
    constructor(storage = () => localStorage) {
        this.storage = storage;
        try {
            this.saved = this.storage().getItem(SAVE_KEY);
        }
        catch {
            this.message = "Browser storage is unavailable for Adventure saves.";
            return;
        }
        if (this.saved === null)
            return;
        try {
            const save = JSON.parse(this.saved);
            const tanks = save?.version === 1 ? migrate(save.checkpoint) : save?.version === SAVE_VERSION ? save.tanks : undefined;
            if (validProgress(tanks)) {
                this.tanks = tanks;
                return;
            }
        }
        catch {
            // Malformed saves can be replaced by starting Adventure again.
        }
        this.message = "This browser’s Adventure save could not be loaded.";
    }
    get started() {
        return this.tanks.some(({ cleared, pets }) => cleared > 0 || pets !== undefined);
    }
    get finalUnlocked() { return finalUnlocked(this.tanks); }
    get unlockedPets() { return unlockedPets(this.tanks); }
    level(tank) { return Math.min(this.tanks[tank - 1].cleared + 1, levelCount(tank)); }
    isComplete(tank) { return this.tanks[tank - 1].cleared === levelCount(tank); }
    pets(tank) { return this.tanks[tank - 1].pets; }
    savePets(tank, pets) {
        this.tanks[tank - 1].pets = pets.slice();
        this.write();
    }
    completeLevel(tank, level) {
        const progress = this.tanks[tank - 1];
        if (level !== progress.cleared + 1 || level > levelCount(tank)
            || (tank === FINAL_ADVENTURE_TANK && !this.finalUnlocked))
            return [];
        progress.cleared = level;
        this.write();
        if (tank === FINAL_ADVENTURE_TANK)
            return ["presto"];
        const petIndex = (tank - 1) * LEVELS_PER_TANK + level - 1;
        const rewards = petIndex < PRESTO_INDEX ? [PET_TYPES[petIndex]] : [];
        if (this.finalUnlocked)
            rewards.push("cyrax");
        return rewards;
    }
    write() {
        try {
            const storage = this.storage();
            const current = storage.getItem(SAVE_KEY);
            const updated = JSON.stringify({ version: SAVE_VERSION, tanks: this.tanks });
            if (current !== updated && current !== (this.saved ?? null)) {
                this.message = "The Adventure save changed in another tab. Reload to use that save.";
                return;
            }
            if (current !== updated)
                storage.setItem(SAVE_KEY, updated);
            this.saved = updated;
            this.message = "";
        }
        catch {
            this.message = "Adventure progress could not be saved in this browser.";
        }
    }
}
