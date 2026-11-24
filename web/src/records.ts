import type { ScoreMode } from "./shop.js";

type RecordMode = ScoreMode | "adventure";
const RECORD_KEY = "winfish:records";

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const minuteText = hours ? `${hours}:${String(minutes % 60).padStart(2, "0")}` : String(minutes);
  return `${minuteText}:${String(seconds % 60).padStart(2, "0")}`;
}

export class GameRecords {
  private readonly unsaved = new Map<string, readonly number[]>();

  constructor(private readonly storage: () => Pick<Storage, "getItem" | "setItem"> = () => localStorage) {}

  scores(mode: RecordMode, tank: number, level = 1): number[] {
    const scores = this.read(this.key(mode, tank, level));
    if (mode !== "adventure") {
      // Earlier versions stored only the best run for each tank.
      const legacy = this.getItem(`winfish:${mode}:best:${tank}`);
      if (legacy !== null && /^\d+$/.test(legacy) && validScore(Number(legacy))) scores.push(Number(legacy));
    }
    return this.rank(scores, mode, tank);
  }

  best(mode: RecordMode, tank: number, level = 1): number | undefined {
    return this.scores(mode, tank, level)[0];
  }

  record(mode: RecordMode, tank: number, score: number, level = 1): number {
    const key = this.key(mode, tank, level);
    const unsaved = this.unsaved.get(key) ?? [];
    const scores = this.rank([...this.read(key), score], mode, tank);
    try {
      this.storage().setItem(key, JSON.stringify(scores));
      this.unsaved.delete(key);
    } catch {
      this.unsaved.set(key, this.rank([...unsaved, score], mode, tank));
    }
    return this.best(mode, tank, level) ?? score;
  }

  private key(mode: RecordMode, tank: number, level: number): string {
    return `${RECORD_KEY}:${mode}:${tank}:${level}`;
  }

  private getItem(key: string): string | null {
    try {
      return this.storage().getItem(key);
    } catch {
      return null;
    }
  }

  private read(key: string): number[] {
    const unsaved = this.unsaved.get(key) ?? [];
    try {
      const saved: unknown = JSON.parse(this.getItem(key) ?? "null");
      return Array.isArray(saved) ? [...saved.filter(validScore), ...unsaved] : [...unsaved];
    } catch {
      return [...unsaved];
    }
  }

  private rank(scores: number[], mode: RecordMode, tank: number): number[] {
    const descending = mode === "time-trial" || (mode === "adventure" && tank === 5);
    const limit = mode !== "adventure" ? 5 : tank === 5 ? 3 : 1;
    return scores.sort(descending ? (a, b) => b - a : (a, b) => a - b).slice(0, limit);
  }
}
