import { formatTime, type GameRecords } from "./records.js";

const TANKS = [1, 2, 3, 4];
const LEVELS = [1, 2, 3, 4, 5];
const TITLES = { adventure: "Adventure", "time-trial": "Time Trial", challenge: "Challenge", personal: "Personal Records" };
type Page = keyof typeof TITLES;
type RecordRow = { label: string; score: string };

function formatScore(score: number | undefined, format: (value: number) => string): string {
  return score === undefined ? "-----" : format(score);
}

function scoreGroup(title: string, rows: RecordRow[]): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement("dl");
  for (const row of rows) {
    const pair = document.createElement("div");
    const name = document.createElement("dt");
    name.textContent = row.label;
    const value = document.createElement("dd");
    value.textContent = row.score;
    pair.append(name, value);
    list.append(pair);
  }
  section.append(heading, list);
  return section;
}

export function setupHallOfFame(records: GameRecords, finishedAdventure: () => boolean): void {
  const selector = document.getElementById("start-screen")!;
  const open = document.querySelector<HTMLButtonElement>("#start-scores")!;
  const screen = document.getElementById("hall-of-fame")!;
  const menu = document.querySelector<HTMLButtonElement>("#scores-menu")!;
  const heading = document.getElementById("scores-page-title")!;
  const content = document.getElementById("scores-page")!;
  const buttons = Array.from(screen.querySelectorAll<HTMLButtonElement>("[data-score-page]"));
  const coins = new Intl.NumberFormat("en-US");
  let page: Page = "time-trial";

  function adventureRows(tank: number): RecordRow[] {
    return LEVELS.map((level) => ({
      label: `${tank}-${level}`,
      score: formatScore(records.best("adventure", tank, level), formatTime),
    }));
  }

  function render(): void {
    heading.textContent = TITLES[page];
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.scorePage === page));
    content.dataset.page = page;
    const finalBoss = records.best("adventure", 5);
    const showFinal = finishedAdventure() || finalBoss !== undefined;
    content.classList.toggle("scores-with-final", showFinal && page === "adventure");
    if (page === "adventure") {
      const groups = TANKS.map((tank) => scoreGroup(`Tank ${tank}`, adventureRows(tank)));
      if (showFinal) {
        const scores = records.scores("adventure", 5);
        groups.push(scoreGroup("Tank 5 (Surviving Pets)", [1, 2, 3].map((rank) => ({
          label: String(rank),
          score: formatScore(scores[rank - 1], (value) => `${value} / 18`),
        }))));
      }
      content.replaceChildren(...groups);
    } else if (page === "personal") {
      const adventure = scoreGroup("Adventure", TANKS.flatMap(adventureRows));
      const modes = (["time-trial", "challenge"] as const).map((mode) => scoreGroup(TITLES[mode], TANKS.map((tank) => ({
        label: `Tank ${tank}`,
        score: formatScore(records.best(mode, tank), mode === "time-trial" ? coins.format : formatTime),
      }))));
      content.replaceChildren(adventure, ...modes);
      if (finalBoss !== undefined) {
        const final = document.createElement("p");
        final.className = "scores-final-personal";
        final.textContent = `Final Boss · ${finalBoss}/18 Pets Saved`;
        adventure.append(final);
      }
    } else {
      const mode = page;
      content.replaceChildren(...TANKS.map((tank) => {
        const scores = records.scores(mode, tank);
        return scoreGroup(`Tank ${tank}`, LEVELS.map((rank) => ({
          label: String(rank),
          score: formatScore(scores[rank - 1], mode === "time-trial" ? String : formatTime),
        })));
      }));
    }
  }

  function close(): void {
    screen.hidden = true;
    selector.hidden = false;
    open.focus();
  }

  open.addEventListener("click", () => {
    render();
    selector.hidden = true;
    screen.hidden = false;
    menu.focus();
  });
  menu.addEventListener("click", close);
  screen.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  for (const button of buttons) {
    button.addEventListener("click", () => {
      page = button.dataset.scorePage as Page;
      render();
    });
  }
  open.disabled = false;
}
