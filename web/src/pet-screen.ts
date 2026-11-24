import { drawTankSprite } from "./art.js";
import { PET_INFO, PET_TYPES, type PetType } from "./pets.js";
import { createPorthole, sidePortholePositions } from "./porthole.js";

interface BonusOffer {
  label: string;
  description: string;
  buy(): void;
}

interface PetAvailability {
  unlocked: readonly PetType[];
  limit: number;
  bonus?: BonusOffer;
}

interface PetScreenOptions extends PetAvailability {
  mode: "adventure" | "virtual";
  note?: string;
  lineup: readonly PetType[];
  resume?: { lineup: readonly PetType[]; run(): void };
  confirm(pets: readonly PetType[]): void;
  back?(): void;
  menu?(): void;
}

const petPositions = [...sidePortholePositions, ...[226, 323].flatMap((x) => [290, 373].map((y) => ({ x, y })))];
const slowPortraits = new Set<PetType>(["clyde", "seymour", "shrapnel", "rhubarb"]);

export function setupPetScreen() {
  const screen = document.getElementById("pets-screen")!;
  const title = document.getElementById("pets-title")!;
  const roster = document.getElementById("pet-choices")!;
  const summary = document.getElementById("pets-summary")!;
  const details = document.getElementById("pets-details")!;
  const name = document.getElementById("pets-name")!;
  const description = document.getElementById("pets-description")!;
  const portrait = (document.getElementById("pets-portrait") as HTMLCanvasElement).getContext("2d");
  const back = document.getElementById("pets-back")!;
  const menu = document.getElementById("pets-menu")!;
  const bonus = document.getElementById("pets-bonus")!;
  const start = document.getElementById("pets-start")!;
  const resume = document.getElementById("pets-continue") as HTMLButtonElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const selected = new Set<PetType>();
  let options: PetScreenOptions | undefined;
  let hovered: PetType | undefined;
  let focused: PetType | undefined;
  let preview: PetType | undefined;
  let frame: number | undefined;
  let lastTick = -1;

  const slots = PET_TYPES.map((type, index) => {
    const { button, canvas } = createPorthole(petPositions[index]);
    roster.append(button);
    button.addEventListener("pointerenter", (event) => {
      if (button.disabled || event.pointerType === "touch") return;
      hovered = type;
      updatePreview();
    });
    button.addEventListener("pointerleave", () => {
      if (hovered === type) hovered = undefined;
      updatePreview();
    });
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) {
        focused = type;
        updatePreview();
      }
    });
    button.addEventListener("blur", () => {
      if (focused === type) focused = undefined;
      updatePreview();
    });
    button.addEventListener("click", () => {
      if (!options || button.disabled) return;
      if (selected.has(type)) selected.delete(type);
      else if (selected.size < options.limit) selected.add(type);
      else {
        updatePreview(type);
        return;
      }
      updateSelection();
    });
    return { type, button, icon: canvas.getContext("2d") };
  });

  function draw(tick = reducedMotion.matches ? 0 : Math.floor(performance.now() / 10)): void {
    if (!options) return;
    for (const { type, button, icon } of slots) {
      if (button.disabled || !icon) continue;
      const { stem } = PET_INFO[type];
      const x = type === "amp" ? 47 : 44;
      icon.clearRect(0, 0, 90, 83);
      drawTankSprite(icon, `scl_${stem}.gif`, `_scl_${stem}.gif`, 10, 1, tick / 4 % 10, 0, x, 40);
    }
    portrait?.clearRect(0, 0, 160, 80);
    if (!portrait || !preview) return;
    const { stem, columns, rows } = PET_INFO[preview];
    const portraitTick = Math.floor(tick / 2);
    const swing = portraitTick % 18;
    const column = preview === "niko" || preview === "vert" ? Math.min(swing, 18 - swing)
      : portraitTick / (slowPortraits.has(preview) ? 4 : 2) % columns;
    const y = preview === "amp" ? 30 : preview === "niko" ? 35 : 40;
    drawTankSprite(portrait, `${stem}.gif`, `_${stem}.gif`, columns, rows, column, 0, 80, y);
  }

  function animate(now: number): void {
    const tick = Math.floor(now / 10);
    if (tick !== lastTick) {
      lastTick = tick;
      draw(tick);
    }
    frame = requestAnimationFrame(animate);
  }

  function syncAnimation(): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = options && !reducedMotion.matches ? requestAnimationFrame(animate) : undefined;
    draw();
  }

  function updatePreview(pet?: PetType): void {
    preview = pet ?? hovered ?? focused ?? Array.from(selected).at(-1);
    details.hidden = preview === undefined;
    if (preview) {
      name.textContent = PET_INFO[preview].name;
      description.textContent = PET_INFO[preview].description;
    }
    draw();
  }

  function updateSelection(): void {
    if (!options) return;
    const { unlocked, limit, note } = options;
    const capacity = Math.min(limit, unlocked.length);
    for (const { type, button } of slots) {
      if (button.disabled) continue;
      const pressed = selected.has(type);
      button.setAttribute("aria-pressed", String(pressed));
      button.setAttribute("aria-disabled", String(!pressed && selected.size >= capacity));
    }
    const sameLineup = options.resume?.lineup;
    resume.disabled = !sameLineup || sameLineup.length !== selected.size || !sameLineup.every((pet) => selected.has(pet));
    start.title = options.resume && resume.disabled ? "Restart to use this lineup" : "";
    const slotsLeft = capacity - selected.size;
    const prompt = options.mode === "virtual" ? "to display in your tank" : "to take to the next level";
    summary.textContent = note ?? (capacity === 0 ? "No pets unlocked yet."
      : slotsLeft > 0 ? `Choose ${slotsLeft} more ${slotsLeft === 1 ? "pet" : "pets"}\n${prompt}`
      : `${selected.size} of ${capacity} pets selected`);
    summary.classList.toggle("pets-summary-empty", capacity === 0);
    updatePreview();
  }

  function setAvailability(availability: PetAvailability): void {
    if (!options) return;
    Object.assign(options, availability, { bonus: availability.bonus });
    const { unlocked, limit, bonus: offer } = availability;
    for (const pet of selected) if (!unlocked.includes(pet)) selected.delete(pet);
    for (const pet of Array.from(selected).slice(limit)) selected.delete(pet);
    if (hovered && !unlocked.includes(hovered)) hovered = undefined;
    if (focused && !unlocked.includes(focused)) focused = undefined;
    for (const { type, button } of slots) {
      const pet = PET_INFO[type];
      button.disabled = !unlocked.includes(type);
      button.setAttribute("aria-label", button.disabled ? `${pet.name} (locked)` : pet.name);
      if (button.disabled) {
        button.removeAttribute("aria-pressed");
        button.removeAttribute("aria-disabled");
        button.removeAttribute("aria-description");
      } else button.setAttribute("aria-description", pet.description);
    }
    const moveFocus = document.activeElement === bonus && !offer;
    bonus.hidden = !offer;
    bonus.firstElementChild!.textContent = offer?.label ?? "";
    bonus.title = offer?.description ?? "";
    if (moveFocus) start.focus();
    updateSelection();
  }

  function hide(): void {
    options = undefined;
    screen.hidden = true;
    syncAnimation();
  }

  function confirm(): void {
    if (!options) return;
    const { unlocked, confirm } = options;
    const lineup = unlocked.filter((pet) => selected.has(pet));
    hide();
    confirm(lineup);
  }

  function leave(action?: () => void): void {
    if (!action) return;
    hide();
    action();
  }

  start.addEventListener("click", confirm);
  resume.addEventListener("click", () => { if (!resume.disabled) leave(options?.resume?.run); });
  back.addEventListener("click", () => leave(options?.back));
  menu.addEventListener("click", () => leave(options?.menu));
  bonus.addEventListener("click", () => options?.bonus?.buy());
  document.addEventListener("keydown", (event) => {
    if (!options || event.key !== "Escape" || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    if (options.mode === "virtual") confirm();
    else leave(options.back);
  });
  reducedMotion.addEventListener("change", syncAnimation);

  return {
    draw,
    setAvailability,
    show(next: PetScreenOptions): void {
      options = { ...next };
      selected.clear();
      next.lineup.forEach((pet) => selected.add(pet));
      hovered = focused = undefined;
      const virtual = next.mode === "virtual";
      screen.dataset.mode = next.mode;
      title.textContent = virtual ? "Add/Remove Pets" : "Choose Your Pets";
      back.hidden = !next.back;
      menu.hidden = !next.menu;
      resume.hidden = !next.resume;
      start.firstElementChild!.textContent = virtual ? "Return to Tank" : next.resume ? "Restart Level" : "Start Level";
      setAvailability(next);
      screen.hidden = false;
      title.focus();
      syncAnimation();
    },
  };
}
