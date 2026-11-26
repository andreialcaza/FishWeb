import { AdventureSave, FINAL_ADVENTURE_TANK, type AdventureHatchReward } from "./adventure-save.js";
import { drawAlienLayer } from "./alien-art.js";
import { drawFishChomps, drawShopIcon, drawTankDrops, loadTankArt } from "./art.js";
import { loadFishSongCatalog, type FishSongEntry, type GameAudio, type MusicTrack } from "./audio.js";
import { drawDeadFish, drawFishLayer } from "./fish-art.js";
import { setupHallOfFame } from "./hall-of-fame.js";
import { setupHatchScreen } from "./hatch-screen.js";
import { drawPet } from "./pet-art.js";
import { setupPetScreen } from "./pet-screen.js";
import { PET_INFO, PET_TYPES, type PetType } from "./pets.js";
import { GameRecords, formatTime } from "./records.js";
import { SANDBOX_ALIENS, SANDBOX_FISH, Tank, TANK_HEIGHT, TANK_WIDTH, TICK_MS, type TankAction, type TankOptions } from "./simulation.js";
import { BACKGROUNDS, MAX_WEAPON_POWER, SHOP_ITEMS, TIME_TRIAL_SECONDS, type ScoreMode, type ShopId } from "./shop.js";
import { drawVirtualDecorations, drawVirtualFish, setupVirtualControls } from "./virtual-tank-ui.js";
import { VIRTUAL_SAVE_KEY, VirtualTankSave, type VirtualFish } from "./virtual-tank.js";

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

interface ShopButton {
  button: HTMLButtonElement;
  icon: CanvasRenderingContext2D;
  price: HTMLElement;
  hatchTick?: number;
}

interface TankHint {
  message: string;
  expiresAt: number;
}

const MODE_NAMES = { adventure: "Adventure", "time-trial": "Time Trial", challenge: "Challenge" };
type ChooserMode = keyof typeof MODE_NAMES;
const TANK_MUSIC: readonly MusicTrack[] = ["tank-1", "tank-2", "tank-3", "tank-4"];

export function startTank(ctx: CanvasRenderingContext2D, audio: GameAudio): void {
  const { canvas } = ctx;
  const start = element<HTMLButtonElement>("start-adventure");
  const modeButtons = {
    "time-trial": element<HTMLButtonElement>("start-time-trial"),
    challenge: element<HTMLButtonElement>("start-challenge"),
  };
  const sandbox = element<HTMLButtonElement>("start-sandbox");
  const startVirtual = element<HTMLButtonElement>("start-virtual");
  const selector = element("start-screen");
  const selectorSpeech = element("selector-speech");
  const saveStatus = element("adventure-save-status");
  const moreModes = element("selector-more-modes");
  const screen = element("tank-screen");
  const balance = element("balance");
  const balanceKind = element("balance-kind");
  const modeStatus = element("mode-status");
  const feedback = element("feedback");
  const shop = element("shop");
  const menu = element("tank-menu");
  const menuToggle = element<HTMLButtonElement>("menu-toggle");
  const menuOk = element<HTMLButtonElement>("options-ok");
  const modeScreen = element("mode-screen");
  const modeTanks = element("mode-tanks");
  const modeTankTemplate = element<HTMLTemplateElement>("mode-tank-template");
  const finalTankButton = element<HTMLButtonElement>("mode-final-tank");
  const levelDialog = element<HTMLDialogElement>("level-dialog");
  const levelContinue = element<HTMLButtonElement>("level-continue");
  const levelTanks = element<HTMLButtonElement>("level-tanks");
  const levelSaveStatus = element("level-save-status");
  const levelBonus = element<HTMLButtonElement>("level-bonus");
  const sandboxDialog = element<HTMLDialogElement>("sandbox-dialog");
  const runDialog = element<HTMLDialogElement>("run-dialog");
  const helpDialog = element<HTMLDialogElement>("help-dialog");
  const instructionsDialog = element<HTMLDialogElement>("instructions-dialog");
  const prestoControl = element("presto-control");
  const prestoForm = element<HTMLSelectElement>("presto-form");
  const sandboxTools = element<HTMLButtonElement>("sandbox-tools");
  const sandboxTank = element<HTMLSelectElement>("sandbox-tank");
  const sandboxFish = element<HTMLSelectElement>("sandbox-fish");
  const sandboxPet = element<HTMLSelectElement>("sandbox-pet");
  const sandboxAlien = element<HTMLSelectElement>("sandbox-alien");
  const sandboxFood = element<HTMLSelectElement>("sandbox-food");
  const sandboxSong = element<HTMLSelectElement>("sandbox-song");
  const sandboxSongButton = element<HTMLButtonElement>("sandbox-play-song");
  const portrait = window.matchMedia("(orientation: portrait)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const formatCoins = new Intl.NumberFormat();
  const buttons = new Map<ShopId, ShopButton>();
  const hints = new WeakMap<Tank, { current?: TankHint; shown: Set<string> }>();
  const aim = { x: TANK_WIDTH / 2, y: TANK_HEIGHT / 2 };
  const hatch = setupHatchScreen(audio.play, continueAdventure, leaveHatchScreen);
  const petScreen = setupPetScreen();
  const art = loadTankArt(() => {
    draw();
    hatch.draw();
    petScreen.draw();
  });
  const runs = { adventure: new Map<number, Tank>(), "time-trial": new Map<number, Tank>(), challenge: new Map<number, Tank>() };
  const records = new GameRecords();
  const adventureSave = new AdventureSave();
  const modeHints = new Map<HTMLButtonElement, string>([
    [modeButtons["time-trial"], "How much money can you earn before time runs out?"],
    [modeButtons.challenge, "Can you fend off the increasingly difficult aliens?"],
    [startVirtual, "Buy and raise your own\ncustom fish, then use them\nas a screensaver!"],
  ]);
  let hoveredMode: HTMLButtonElement | undefined;
  let focusedMode: HTMLButtonElement | undefined;
  const virtualSave = new VirtualTankSave();
  const virtualHud = element("virtual-controls");
  const endScreensaver = element<HTMLButtonElement>("virtual-stop-screensaver");
  setupHallOfFame(records, () => adventureSave.isComplete(FINAL_ADVENTURE_TANK));

  let tank: Tank | undefined;
  let coopActive = false;
  let coopHost = false;
  let chooserMode: ChooserMode | undefined;
  let sandboxSession: Tank | undefined;
  let virtualSession: Tank | undefined;
  let screensaver = false;
  let screensaverStart = 0;
  let screensaverShells = 0;
  let requestedFullscreen = false;
  let virtualSong = 0;
  let pendingRun: { session: Tank; options: TankOptions } | undefined;
  let pendingHatch: AdventureHatchReward | undefined;
  let instructedLevel: { level: number; pets: readonly PetType[] } | undefined;
  let frameId: number | undefined;
  let lastFrame: number | undefined;
  let pendingTime = 0;
  let keyboardAim = false;
  let pointer: { id: number; firstTick: number; nextTick: number } | undefined;
  let settledStatus: Tank["state"]["status"] = "playing";
  let songs: FishSongEntry[] = [];
  let loadingSongs = false;
  let songPlaying = false;

  const unlockedPets = () => [...adventureSave.unlockedPets, ...virtualSave.bonusPets];
  const virtualControls = setupVirtualControls(virtualSave, art, () => tank, unlockedPets,
    syncVirtualView, startScreensaver, () => audio.play("buy"));
  const virtualPets = virtualHud.querySelector<HTMLButtonElement>('[data-virtual-view="pets"]')!;

  function createTank(options: TankOptions): Tank {
    return new Tank(options.seed === undefined ? Math.random : createSeededRandom(options.seed), { ...options, playSound: (sound, pitch) => {
      if (!options.virtualTank || !screensaver || virtualSave.settings.screensaverSound) audio.play(sound, pitch);
    } });
  }

  function syncMusic(): void {
    if (hatch.visible) audio.setMusic("complete");
    else if (!tank || screen.hidden) audio.setMusic("menu");
    else if (screensaver && !virtualSave.settings.screensaverSound) audio.setMusic(null);
    else if (tank.virtualTank && virtualControls.open) audio.setMusic("menu");
    else if (tank.shellBonus) audio.setMusic("complete");
    else if (tank.state.status === "complete") audio.setMusic("complete");
    else if (tank.state.status === "failed") audio.setMusic("menu");
    else if (tank.alienSystem.battleActive) audio.setMusic(tank.tank === 5 ? "cyrax" : "battle");
    else if (tank.alienSystem.warning) audio.setMusic("warning");
    else if (tank.virtualTank) audio.setMusic(null);
    else audio.setMusic(TANK_MUSIC[tank.tank - 1] ?? null);
  }

  function setSongPlaying(playing: boolean): void {
    songPlaying = playing;
    sandboxSongButton.textContent = playing ? "Stop Song" : "Play Song";
  }

  function stopSong(): void {
    virtualSong = 0;
    audio.stopFishSong();
    setSongPlaying(false);
  }

  function showHint(session: Tank, message: string, duration: number): void {
    const history = hints.get(session)!;
    if (history.shown.has(message)) return;
    history.shown.add(message);
    history.current = { message, expiresAt: session.state.tick + duration };
  }

  function activeHint(session: Tank): TankHint | undefined {
    const hint = hints.get(session)?.current;
    if (hint && hint.expiresAt > session.state.tick) return hint;
  }

  function active(): boolean {
    return !screen.hidden && menu.hidden && !document.hidden
      && !helpDialog.open && !sandboxDialog.open && !virtualControls.open && tank?.state.status === "playing";
  }

  function draw(): void {
    if (!tank || screen.hidden) return;
    const { tick, food, fish, pets, coins, deadFish, fishChomps } = tank.state;
    const seconds = tick * TICK_MS / 1000;
    art.drawBackground(ctx, TANK_WIDTH, TANK_HEIGHT, seconds, tank.background);
    drawVirtualDecorations(ctx, tank, seconds);
    drawTankDrops(ctx, art, food, [], seconds);
    for (const corpse of deadFish) drawDeadFish(ctx, art, corpse, seconds);
    for (const swimmer of fish) {
      if (swimmer.hidden) continue;
      const record = tank.getVirtualFish(swimmer);
      if (record) {
        const settings = tank.virtualTank!.settings;
        const hungry = !screensaver && swimmer.hungry && (settings.showHungry || record.fedToday < 3);
        drawVirtualFish(ctx, art, { ...swimmer, hungry }, record, seconds, settings.showNames);
      }
      else drawFishLayer(ctx, art, swimmer, seconds);
    }
    for (const pet of pets) drawPet(ctx, pet, seconds, tank.background);
    drawTankDrops(ctx, art, [], coins, seconds);
    const blip = tank.tank !== 5 && pets.some((pet) => pet.type === "blip");
    drawAlienLayer(ctx, tank.alienSystem, blip, blip);
    drawFishChomps(ctx, fishChomps, tick);
    for (const slot of tank.shop.slots) {
      if (!slot.unlocked) continue;
      const entry = buttons.get(slot.id);
      if (!entry) continue;
      const hatchAge = entry.hatchTick === undefined ? Infinity : tick - entry.hatchTick;
      const hatchFrame = hatchAge >= 2 && hatchAge < 8 ? Math.floor((hatchAge - 2) / 2) : undefined;
      drawShopIcon(entry.icon, slot.id, tank.shop, seconds, entry.button.dataset.faceHidden !== "true", hatchFrame);
    }
    if (active() && document.activeElement === canvas && (keyboardAim || canvas.matches(":focus-visible"))) {
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 8, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#0a2631";
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff3bd";
      ctx.stroke();
    }
    if (screensaver && virtualSave.settings.screensaverDim) {
      const phase = (tick - screensaverStart) % 3000;
      const dim = 200 / 255 * Math.max(0, Math.min(1, (phase - 1320) / 30, (1680 - phase) / 30));
      if (dim > 0) {
        ctx.fillStyle = `rgb(0 0 0 / ${dim})`;
        ctx.fillRect(0, 0, TANK_WIDTH, TANK_HEIGHT);
      }
    }
  }

  function updateHud(): void {
    if (!tank) return;
    const money = formatCoins.format(tank.state.money);
    if (balance.textContent !== money) balance.textContent = money;
    const { mode } = tank;
    let modeMessage = "";
    if (mode === "time-trial") modeMessage = `Time Trial · Tank ${tank.tank} · ${formatTime(tank.trialSecondsLeft)} left`;
    if (mode === "challenge") {
      modeMessage = `Challenge · Tank ${tank.tank} · ${tank.shop.eggPieces}/3 egg pieces · ${formatTime(tank.elapsedSeconds)}`;
    }
    if (tank.shellBonus) modeMessage = tank.bonusSecondsLeft > 0
      ? `Collect as many shells as you can! • ${tank.bonusSecondsLeft}s` : "Collect the remaining shells!";
    if (screensaver && virtualSave.settings.screensaverShells) {
      modeMessage = `${formatCoins.format(tank.shellsCollected - screensaverShells)} shells collected`;
    }
    modeStatus.hidden = !modeMessage;
    if (modeStatus.textContent !== modeMessage) modeStatus.textContent = modeMessage;
    const virtualMessage = tank.virtualTank?.message || (tank.virtualTank && !tank.virtualTank.fish.length ? "Visit the Store to buy fish." : "");
    const message = screensaver ? "" : activeHint(tank)?.message ?? (mode === "adventure" ? adventureSave.message : virtualMessage);
    if (feedback.textContent !== message) feedback.textContent = message;
    if (tank.virtualTank) virtualControls.updateButtons(tank);
    for (const slot of tank.shellBonus ? [] : tank.shop.slots) {
      const entry = buttons.get(slot.id)!;
      const hatchesPet = slot.id === "egg" && tank.shop.hatchesPets;
      const freeEgg = hatchesPet && tank.sandbox;
      const label = hatchesPet ? "Hatch a random pet" : SHOP_ITEMS[slot.id].label;
      const soldOut = slot.maxed && (slot.id !== "egg" || hatchesPet);
      const price = soldOut ? (hatchesPet ? "Full" : "MAX") : freeEgg ? "Free" : "$" + formatCoins.format(slot.price);
      const hatchStarting = entry.hatchTick !== undefined && tank.state.tick - entry.hatchTick < 2;
      entry.button.hidden = !slot.unlocked;
      entry.button.disabled = !menu.hidden || slot.maxed || tank.state.status !== "playing";
      entry.button.dataset.soldOut = String(soldOut);
      entry.button.dataset.faceHidden = String(soldOut || hatchStarting);
      entry.button.dataset.affordable = String(soldOut || tank.state.money >= slot.price);
      if (entry.price.textContent !== price) {
        entry.price.textContent = price;
        entry.button.title = soldOut ? "" : label;
        entry.button.setAttribute("aria-label", soldOut ? (hatchesPet ? "All available pets are in the tank" : label + " at maximum")
          : label + (freeEgg ? " for free" : " for " + formatCoins.format(slot.price) + " coins"));
      }
    }
    const presto = tank.state.pets.find((pet) => pet.type === "presto" || pet.morph);
    prestoControl.hidden = !presto;
    if (presto) {
      prestoForm.value = presto.type;
      prestoForm.disabled = presto.morphCooldown > 0;
    }
  }

  function updateStatus(): void {
    syncMusic();
    if (!tank || tank.state.status === settledStatus) return;
    settledStatus = tank.state.status;
    if (settledStatus === "playing") return;
    levelBonus.hidden = true;
    pointer = undefined;
    const { mode } = tank;
    if (tank.shellBonus && settledStatus === "complete") {
      virtualSave.earn(tank.state.money);
      levelTanks.hidden = true;
      levelContinue.textContent = "Choose Tank";
      element("level-title").textContent = "Bonus Round Complete";
      element("level-message").textContent = `You collected ${formatCoins.format(tank.state.money)} shells.`;
      levelSaveStatus.textContent = virtualSave.message;
      levelSaveStatus.hidden = !virtualSave.message;
      updateBonusOffer();
      levelDialog.showModal();
      return;
    }
    let shellsEarned = 0;
    if (mode === "adventure" && settledStatus === "complete") {
      runs.adventure.delete(tank.tank);
      records.record(mode, tank.tank, tank.tank === FINAL_ADVENTURE_TANK ? tank.state.pets.length : tank.elapsedSeconds, tank.level);
      const [reward, nextReward] = adventureSave.completeLevel(tank.tank, tank.level);
      if (tank.tank === FINAL_ADVENTURE_TANK) shellsEarned = virtualSave.finishCyrax();
      else if (adventureSave.isComplete(FINAL_ADVENTURE_TANK)) {
        tank.startShellBonus();
        settledStatus = "playing";
        shop.hidden = true;
        menuToggle.hidden = true;
        screen.dataset.currency = "shells";
        balanceKind.textContent = "Shells";
        updateHud();
        draw();
        syncMusic();
        return;
      }
      if (reward) {
        pendingHatch = nextReward;
        screen.hidden = true;
        const note = shellsEarned ? `${formatCoins.format(shellsEarned)} shells earned.` : "";
        hatch.show(reward, [adventureSave.message, virtualSave.message, note].filter(Boolean).join(" "));
        syncAnimation();
        return;
      }
    }
    let title: string;
    let message: string;
    if (mode === "time-trial" || mode === "challenge") {
      runs[mode].delete(tank.tank);
      levelTanks.hidden = false;
      levelContinue.textContent = "Play Again";
      if (settledStatus === "complete") {
        const score = mode === "time-trial" ? tank.state.money : tank.elapsedSeconds;
        const best = records.record(mode, tank.tank, score);
        shellsEarned = mode === "time-trial" ? Math.floor(tank.state.money * 0.05) : [2000, 5000, 10000, 20000][tank.tank - 1];
        virtualSave.earn(shellsEarned);
        title = mode === "time-trial" ? "Time’s up!" : "Challenge complete";
        message = `${MODE_NAMES[mode]} · Tank ${tank.tank}. ${formatScore(mode, score)} this run. Best ${formatScore(mode, best)}.`;
      } else {
        title = "Tank lost";
        message = "There are no fish left in the tank.";
      }
    } else {
      const failedAdventure = mode === "adventure" && settledStatus === "failed";
      if (failedAdventure) runs.adventure.delete(tank.tank);
      levelTanks.hidden = !failedAdventure;
      levelContinue.textContent = settledStatus === "complete" ? "Choose Tank" : settledStatus === "failed" ? "Retry Level" : "Continue";
      const labels = {
        complete: ["Level complete", tank.tank === FINAL_ADVENTURE_TANK ? "You defeated Cyrax." : "You collected all three egg pieces."],
        failed: ["Tank lost", tank.tank === 5 ? "Your pets were defeated." : "There are no fish left in the tank."],
        rescue: ["A new guppy", "Here is another guppy so you can keep playing."],
        loan: ["A helping hand", "You received 100 coins to buy food."],
      };
      [title, message] = labels[settledStatus];
    }
    element("level-title").textContent = title;
    element("level-message").textContent = shellsEarned ? `${message} ${formatCoins.format(shellsEarned)} shells earned.` : message;
    levelSaveStatus.textContent = [mode === "adventure" ? adventureSave.message : "", shellsEarned ? virtualSave.message : ""].filter(Boolean).join(" ");
    levelSaveStatus.hidden = !levelSaveStatus.textContent;
    if (settledStatus === "complete" && (mode === "time-trial" || mode === "challenge" || tank.tank === FINAL_ADVENTURE_TANK)) {
      updateBonusOffer();
    }
    if (!levelDialog.open) levelDialog.showModal();
  }

  function updateBonusOffer(): void {
    levelBonus.hidden = !virtualSave.bonusPrice;
    if (!levelBonus.hidden) levelBonus.textContent = `Buy ${virtualSave.nextBonus} • ${formatCoins.format(virtualSave.bonusPrice)} shells`;
  }

  function formatScore(mode: ScoreMode, score: number): string {
    return mode === "time-trial" ? "$" + formatCoins.format(score) : formatTime(score);
  }

  function frame(timestamp: number): void {
    frameId = undefined;
    if (!active() || !tank) return;
    if (lastFrame !== undefined) pendingTime += Math.min(timestamp - lastFrame, 5 * TICK_MS);
    lastFrame = timestamp;
    while (pendingTime >= TICK_MS && tank.state.status === "playing") {
      tank.step();
      if (screensaver && virtualSave.settings.screensaverRotate && (tank.state.tick - screensaverStart) % 10800 === 0) {
        const current = tank.background;
        const backgrounds = virtualSave.backgrounds.filter((background) => background !== current);
        if (backgrounds.length) {
          tank.virtualDisplayBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];
          tank.syncVirtualTank();
        }
      }
      pendingTime -= TICK_MS;
      if (pointer && tank.state.tick >= pointer.nextTick) {
        const heldTicks = tank.state.tick - pointer.firstTick;
        if (coopActive && !coopHost) {
          sendCoopAction({ action: "click", x: aim.x, y: aim.y, heldTicks });
          pointer.nextTick = tank.state.tick + 16 - tank.foodLimit;
          continue;
        }
        const result = tank.click(aim.x, aim.y, heldTicks);
        if (coopActive) sendCoopAction({ action: "click", x: aim.x, y: aim.y, heldTicks });
        const interval = tank.alienSystem.battleActive && result !== "food" && result !== "food-limit"
          ? 5 : 16 - tank.foodLimit;
        pointer.nextTick = tank.state.tick + interval;
        handleFoodLimit(tank, result);
      }
    }
    updateHud();
    draw();
    updateStatus();
    if (active()) frameId = requestAnimationFrame(frame);
  }

  function syncAnimation(): void {
    syncMusic();
    lastFrame = undefined;
    if (active() && frameId === undefined) frameId = requestAnimationFrame(frame);
    if (!active() && frameId !== undefined) {
      cancelAnimationFrame(frameId);
      frameId = undefined;
    }
  }

  function handleFoodLimit(session: Tank, action: TankAction): void {
    if (action !== "food-limit" || session.mode !== "adventure" || session.tank !== 1 || activeHint(session)) return;
    if (session.level === 1) {
      showHint(session, "You can only drop 1 food pellet at a time for now", 185);
    } else if (session.level === 2 && session.shop.getSlot("quantity")?.unlocked) {
      showHint(session, "Upgrade Food Quantity to drop more food at once!", 185);
    }
  }

  function sendCoopAction(payload: Record<string, unknown>): void {
    document.dispatchEvent(new CustomEvent("fishweb:send-game", { detail: { kind: "action", ...payload } }));
  }

  function actAtAim(): void {
    if (!tank || !active()) return;
    if (coopActive && !coopHost) { sendCoopAction({ action: "click", x: aim.x, y: aim.y, heldTicks: 0 }); return; }
    handleFoodLimit(tank, tank.click(aim.x, aim.y));
    if (coopActive) sendCoopAction({ action: "click", x: aim.x, y: aim.y, heldTicks: 0 });
    updateHud();
    draw();
    updateStatus();
  }

  function moveAim(event: PointerEvent): boolean {
    const bounds = canvas.getBoundingClientRect();
    const x = portrait.matches ? (event.clientY - bounds.top) / bounds.height : (event.clientX - bounds.left) / bounds.width;
    const y = portrait.matches ? (bounds.right - event.clientX) / bounds.width : (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return false;
    aim.x = x * TANK_WIDTH;
    aim.y = y * TANK_HEIGHT;
    return true;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!tank || !active() || !event.isPrimary || event.button !== 0 || !moveAim(event)) return;
    keyboardAim = false;
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, firstTick: tank.state.tick, nextTick: tank.state.tick + (tank.alienSystem.battleActive ? 5 : 8) };
    actAtAim();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointer?.id === event.pointerId && !moveAim(event)) {
      aim.x = -1;
      aim.y = -1;
    }
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    canvas.addEventListener(eventName, (event) => {
      if (pointer?.id === event.pointerId) pointer = undefined;
    });
  }
  canvas.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowLeft": aim.x = Math.max(0, aim.x - 12); break;
      case "ArrowRight": aim.x = Math.min(TANK_WIDTH - 1, aim.x + 12); break;
      case "ArrowUp": aim.y = Math.max(0, aim.y - 12); break;
      case "ArrowDown": aim.y = Math.min(TANK_HEIGHT - 1, aim.y + 12); break;
      case " ":
      case "Enter":
        if (!event.repeat) actAtAim();
        break;
      default: return;
    }
    event.preventDefault();
    keyboardAim = true;
  });

  function setMenu(open: boolean, focus = true): void {
    if (open) virtualControls.closeFeed();
    menu.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    canvas.inert = open;
    pointer = undefined;
    updateHud();
    draw();
    syncAnimation();
    if (focus && !screen.hidden) (open ? menuOk : menuToggle.hidden ? canvas : menuToggle).focus();
  }

  function buildShop(): void {
    shop.replaceChildren();
    buttons.clear();
    const positions = [18, 87, 144, 217, 290, 363, 436];
    for (const slot of tank!.shop.slots) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "shop-slot";
      button.style.left = positions[slot.position] / 6.4 + "%";
      const icon = document.createElement("canvas");
      icon.width = 58;
      icon.height = 60;
      icon.className = "shop-icon";
      icon.setAttribute("aria-hidden", "true");
      const price = document.createElement("span");
      price.className = "shop-price";
      button.append(icon, price);
      button.addEventListener("click", () => buy(slot.id));
      buttons.set(slot.id, { button, icon: icon.getContext("2d")!, price });
      shop.append(button);
    }
  }

  function buy(id: ShopId): void {
    if (!tank || !active()) return;
    const result = tank.buy(id);
    const firstTank = tank.mode === "adventure" && tank.tank === 1;
    if (result === "no-money") {
      if (firstTank && tank.level === 1 && id === "guppy") {
        showHint(tank, "You can't afford new fish yet! Collect more money!", 185);
      }
    } else if (result === "bought") {
      if (!reducedMotion.matches && (id === "quality" || id === "quantity" || id === "weapon")) {
        buttons.get(id)!.hatchTick = tank.state.tick;
      }
      if (id === "potion" && tank.level < 3) {
        showHint(tank, "Click on tank to drop star potion!", 180);
      } else if (id === "egg" && tank.mode === "challenge" && tank.state.status === "playing") {
        showHint(tank, "Shop prices reset after each egg piece.", 185);
      } else if (id === "egg" && firstTank && tank.level === 1 && tank.shop.eggPieces === 1 && !activeHint(tank)) {
        showHint(tank, "Collect 2 more egg pieces to finish level!", 185);
      } else if (id === "quality" && firstTank && tank.level === 2 && tank.shop.foodLevel === 1) {
        showHint(tank, "Upgrade Food Quantity to drop more food at once!", 185);
      } else if (id === "quantity" && tank.tank === 1 && tank.shop.foodLimit === 2) {
        showHint(tank, "Hold down mouse button to Auto-Feed!", 100);
      } else if (id === "weapon" && tank.shop.weaponPower === MAX_WEAPON_POWER) {
        showHint(tank, "Hold down mouse button for Rapid Fire!", 100);
      }
    }
    updateHud();
    draw();
    updateStatus();
  }

  function openTank(session: Tank): void {
    if (session !== tank) {
      stopSong();
      audio.play("bubbles");
    }
    tank = session;
    if (!hints.has(session)) hints.set(session, { shown: new Set() });
    if (session.mode === "sandbox") {
      sandboxSession = session;
      sandboxFood.value = String(session.sandboxFood);
      sandbox.setAttribute("aria-haspopup", "dialog");
    } else if (session.mode !== "virtual") runs[session.mode].set(session.tank, session);
    selector.hidden = true;
    modeScreen.hidden = true;
    chooserMode = undefined;
    screen.hidden = false;
    shop.hidden = Boolean(session.virtualTank);
    virtualHud.hidden = !session.virtualTank;
    menuToggle.hidden = false;
    screen.dataset.currency = session.virtualTank ? "shells" : "coins";
    balanceKind.textContent = session.virtualTank ? "Shells" : "Coins";
    element("pointer-help").textContent = session.virtualTank
      ? "Click or tap to drop food, collect shells, or shoot aliens." : "Click or tap to drop food, collect coins, or shoot aliens.";
    sandboxTools.hidden = !session.sandbox;
    settledStatus = "playing";
    pendingTime = 0;
    aim.x = TANK_WIDTH / 2;
    aim.y = TANK_HEIGHT / 2;
    keyboardAim = false;
    prestoForm.replaceChildren();
    const unlocked = unlockedPets();
    const forms = session.sandbox ? petOptions : petOptions.filter(([type]) => unlocked.includes(type));
    fillOptions(prestoForm, forms);
    buildShop();
    setMenu(false, false);
    canvas.focus();
    draw();
    updateStatus();
  }

  function updateSelectorSpeech(): void {
    const button = hoveredMode ?? focusedMode;
    const greeting = adventureSave.started ? "Welcome back!" : "Welcome to Insane Aquarium Web!";
    const message = button ? modeHints.get(button) ?? greeting : greeting;
    if (selectorSpeech.textContent !== message) selectorSpeech.textContent = message;
  }

  function updateAdventureMenu(): void {
    start.textContent = adventureSave.isComplete(FINAL_ADVENTURE_TANK) ? "Replay Adventure"
      : adventureSave.started ? "Continue Adventure" : "Start Adventure";
    modeHints.set(start, adventureSave.started
      ? "Feed fish and fight aliens!\nClick here to continue\nyour adventure..."
      : "New to the game?\nStart your aquatic adventure!");
    updateSelectorSpeech();
    saveStatus.textContent = adventureSave.message;
    saveStatus.hidden = !adventureSave.message;
  }

  function showSelector(): void {
    const mode = chooserMode ?? tank?.mode;
    chooserMode = undefined;
    if (tank?.virtualTank) virtualSave.saveFullness(tank.virtualFish);
    stopSong();
    virtualControls.closeFeed();
    screen.hidden = true;
    modeScreen.hidden = true;
    selector.hidden = false;
    setMenu(false, false);
    updateAdventureMenu();
    const primary = mode === "time-trial" || mode === "challenge" ? modeButtons[mode] : mode === "virtual" ? startVirtual : start;
    (moreModes.hidden ? primary : sandbox).focus();
  }

  function syncVirtualView(): void {
    if (!tank?.virtualTank || screen.hidden) return;
    pointer = undefined;
    tank.syncVirtualTank();
    if (virtualSong && !virtualSave.fish.some((fish) => fish.id === virtualSong && fish.shown)) stopSong();
    updateHud();
    draw();
    syncAnimation();
  }

  async function playVirtualFishSong(fish: VirtualFish): Promise<void> {
    if (virtualSong || (screensaver && !virtualSave.settings.screensaverSound)) return;
    virtualSong = fish.id;
    try {
      const catalog = await loadFishSongCatalog();
      if (virtualSong !== fish.id || tank !== virtualSession || screen.hidden) return;
      const favorites = fish.spec.name === "Ludwig" ? catalog.filter(({ id }) =>
        /^(appassionata|emperor|fifthsymph|furelise|moonlight|odetojoy|pathetique|rageoverpenny|waldstein)/i.test(id))
        : fish.spec.name === "Kilgore" ? catalog.filter(({ id }) => id === "ridevalkery")
          : fish.spec.name === "Santa" ? catalog.filter(({ id }) =>
            /^(deckthehalls|harktheherald|jinglebells|joytotheworld|ochristmastree|olittletown|silentnight|wewishyou)/i.test(id))
            : catalog;
      const song = favorites[Math.floor(Math.random() * favorites.length)];
      if (song) await audio.playFishSong(song, () => { virtualSong = 0; });
      else virtualSong = 0;
    } catch {
      virtualSong = 0;
    }
  }

  async function startScreensaver(): Promise<boolean> {
    try {
      requestedFullscreen = !document.fullscreenElement;
      if (requestedFullscreen) await document.documentElement.requestFullscreen();
      screensaver = true;
      screensaverStart = tank?.state.tick ?? 0;
      screensaverShells = tank?.shellsCollected ?? 0;
      if (!virtualSave.settings.screensaverSound) stopSong();
      screen.classList.add("virtual-screensaver");
      endScreensaver.hidden = false;
      endScreensaver.focus();
      syncVirtualView();
      return true;
    } catch {
      requestedFullscreen = false;
      return false;
    }
  }

  function stopScreensaver(): void {
    if (!screensaver) return;
    screensaver = false;
    if (tank) tank.virtualDisplayBackground = undefined;
    screen.classList.remove("virtual-screensaver");
    endScreensaver.hidden = true;
    if (requestedFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    requestedFullscreen = false;
    canvas.focus();
    syncVirtualView();
  }

  startVirtual.addEventListener("click", () => {
    if (!virtualSession) virtualSession = createTank({ virtualTank: virtualSave, onFishSong: (fish) => void playVirtualFishSong(fish) });
    openTank(virtualSession);
    syncVirtualView();
    virtualControls.welcome();
  });
  startVirtual.disabled = false;
  virtualPets.addEventListener("click", () => {
    virtualSave.refresh();
    virtualControls.closeFeed();
    pointer = undefined;
    screen.hidden = true;
    syncAnimation();
    petScreen.show({
      mode: "virtual",
      ...virtualPetAvailability(),
      lineup: virtualSave.pets,
      confirm(pets) {
        virtualSave.choosePets(pets);
        screen.hidden = false;
        syncVirtualView();
        virtualPets.focus();
      },
    });
  });
  levelBonus.addEventListener("click", () => virtualControls.confirmBonus(updateBonusOffer));
  element("virtual-back").addEventListener("click", showSelector);
  endScreensaver.addEventListener("click", stopScreensaver);
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) stopScreensaver(); });
  window.addEventListener("storage", (event) => {
    if (event.key === VIRTUAL_SAVE_KEY) {
      virtualSave.refresh();
      syncVirtualView();
    }
  });

  function continueAdventure(): void {
    if (pendingHatch) {
      const reward = pendingHatch;
      pendingHatch = undefined;
      hatch.show(reward, adventureSave.message);
      return;
    }
    showModeChooser("adventure");
    if (tank && !adventureSave.isComplete(tank.tank)) choosePets(tank.tank);
    else if (!finalTankButton.disabled && !adventureSave.isComplete(FINAL_ADVENTURE_TANK)) finalTankButton.focus();
  }

  function virtualPetAvailability() {
    const available = unlockedPets();
    const unlocked = PET_TYPES.filter((pet) => available.includes(pet));
    const bonus = adventureSave.isComplete(FINAL_ADVENTURE_TANK) && virtualSave.bonusPrice ? {
      label: `Buy ${virtualSave.nextBonus}`,
      description: `${formatCoins.format(virtualSave.bonusPrice)} shells`,
      buy: () => virtualControls.confirmBonus(() => petScreen.setAvailability(virtualPetAvailability())),
    } : undefined;
    return { unlocked, limit: virtualSave.petLimit, bonus };
  }

  function leaveHatchScreen(): void {
    pendingHatch = undefined;
    showSelector();
  }

  function adventureTankName(tankNumber: number): string {
    return `Tank ${tankNumber}-${adventureSave.level(tankNumber)}`;
  }

  function chooseRun(mode: ScoreMode | "sandbox", tankNumber: number): void {
    const session = mode === "sandbox" ? sandboxSession : runs[mode].get(tankNumber);
    const options = mode === "sandbox" ? { sandbox: true, tank: tankNumber } : { mode, tank: tankNumber };
    if (!session) {
      openTank(createTank(options));
      return;
    }
    pendingRun = { session, options };
    element("run-title").textContent = `${mode === "sandbox" ? "Sandbox" : MODE_NAMES[mode]} · Tank ${tankNumber}`;
    runDialog.returnValue = "";
    runDialog.showModal();
  }

  runDialog.addEventListener("close", () => {
    const run = pendingRun;
    pendingRun = undefined;
    if (!run) return;
    if (runDialog.returnValue === "continue") openTank(run.session);
    else if (runDialog.returnValue === "restart") openTank(createTank(run.options));
  });

  function showModeChooser(mode: ChooserMode): void {
    element("mode-title").textContent = MODE_NAMES[mode];
    element("mode-description").textContent = mode === "adventure" ? "Choose a tank to play." : mode === "time-trial"
      ? "How much money can you earn before time runs out?"
      : "Can you fend off the increasingly hungry aliens?";
    const cards = Array.from({ length: TIME_TRIAL_SECONDS.length }, (_, index) => {
      const tankNumber = index + 1;
      const card = modeTankTemplate.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
      const button = card.querySelector("button")!;
      const detail = card.querySelector("p")!;
      const session = runs[mode].get(tankNumber);
      if (mode === "adventure") {
        button.setAttribute("aria-controls", "pets-screen");
        button.querySelector("span")!.textContent = adventureTankName(tankNumber);
        detail.textContent = session ? "In progress" : adventureSave.isComplete(tankNumber) ? "Completed · Replay level" : "";
        button.addEventListener("click", () => choosePets(tankNumber));
      } else {
        if (session) button.setAttribute("aria-haspopup", "dialog");
        button.disabled = !adventureSave.isComplete(tankNumber);
        button.querySelector("span")!.textContent = `${session ? "Resume Tank" : "Tank"} ${tankNumber}`;
        if (button.disabled) {
          detail.textContent = `Complete Tank ${tankNumber}-5\nin Adventure Mode\nto unlock this tank`;
        } else {
          const best = records.best(mode, tankNumber);
          detail.textContent = best === undefined ? "" : `Best ${formatScore(mode, best)}`;
          button.addEventListener("click", () => chooseRun(mode, tankNumber));
        }
      }
      if (!button.disabled) {
        const preview = card.querySelector("img")!;
        preview.src = `./images/tankbackdrop${BACKGROUNDS[index]}.gif`;
        preview.hidden = false;
      }
      if (detail.textContent) {
        detail.hidden = false;
        detail.id = `mode-tank-detail-${tankNumber}`;
        button.setAttribute("aria-describedby", detail.id);
      }
      return card;
    });
    finalTankButton.hidden = mode !== "adventure";
    if (mode === "adventure") {
      finalTankButton.disabled = !adventureSave.finalUnlocked;
      const detail = finalTankButton.disabled ? "Clear Tanks 1–4 to unlock"
        : runs.adventure.has(FINAL_ADVENTURE_TANK) ? "In progress"
        : adventureSave.isComplete(FINAL_ADVENTURE_TANK) ? "Replay Cyrax" : "Cyrax";
      finalTankButton.querySelector("span")!.textContent = `${adventureTankName(FINAL_ADVENTURE_TANK)} · ${detail}`;
    }
    chooserMode = mode;
    modeTanks.replaceChildren(...cards);
    selector.hidden = true;
    screen.hidden = true;
    modeScreen.hidden = false;
    setMenu(false, false);
    (modeTanks.querySelector<HTMLButtonElement>("button:enabled") ?? element("mode-menu")).focus();
  }

  function startLevel(tankNumber: number, level: number, pets: readonly PetType[]): void {
    adventureSave.savePets(tankNumber, pets);
    openTank(createTank({ tank: tankNumber, level, pets }));
  }

  function beginAdventureLevel(tankNumber: number, level: number, pets: readonly PetType[]): void {
    if (tankNumber !== 1 || level > 3) {
      startLevel(tankNumber, level, pets);
      return;
    }
    instructedLevel = { level, pets };
    instructionsDialog.returnValue = "";
    instructionsDialog.showModal();
  }

  instructionsDialog.addEventListener("close", () => {
    const pending = instructedLevel;
    instructedLevel = undefined;
    if (!pending) return;
    if (instructionsDialog.returnValue === "continue") startLevel(1, pending.level, pending.pets);
    else showModeChooser("adventure");
  });

  function choosePets(tankNumber: number): void {
    const finalBattle = tankNumber === FINAL_ADVENTURE_TANK;
    const unlocked = finalBattle ? [] : unlockedPets();
    const limit = virtualSave.adventurePetLimit;
    const saved = adventureSave.pets(tankNumber);
    const session = runs.adventure.get(tankNumber);
    const trigger = finalBattle ? finalTankButton
      : modeTanks.children[tankNumber - 1]?.querySelector("button");
    modeScreen.hidden = true;
    petScreen.show({
      mode: "adventure",
      note: finalBattle ? "This battle against Cyrax uses a preset team." : undefined,
      unlocked,
      limit,
      lineup: saved ?? unlocked.slice(0, limit),
      resume: session && saved ? { lineup: saved, run: () => openTank(session) } : undefined,
      confirm(pets) {
        modeScreen.hidden = false;
        beginAdventureLevel(tankNumber, adventureSave.level(tankNumber), pets);
      },
      back() {
        modeScreen.hidden = false;
        trigger?.focus();
      },
      menu: showSelector,
    });
  }

  finalTankButton.addEventListener("click", () => choosePets(FINAL_ADVENTURE_TANK));
  levelDialog.addEventListener("cancel", (event) => event.preventDefault());
  levelTanks.addEventListener("click", () => {
    const mode = tank?.mode;
    if (!mode || mode === "sandbox" || mode === "virtual") return;
    levelDialog.close();
    showModeChooser(mode);
  });
  levelContinue.addEventListener("click", () => {
    if (!tank) return;
    levelDialog.close();
    const { tank: tankNumber, level, mode, state } = tank;
    if (mode === "time-trial" || mode === "challenge") {
      openTank(createTank({ mode, tank: tankNumber }));
      return;
    }
    if (state.status === "complete") showModeChooser("adventure");
    else if (state.status === "failed") startLevel(tankNumber, level, adventureSave.pets(tankNumber) ?? []);
    else {
      tank.acknowledge();
      settledStatus = "playing";
      updateHud();
      draw();
      canvas.focus();
      syncAnimation();
    }
  });

  document.addEventListener("fishweb:game-request", (event) => {
    if (!coopActive || !coopHost || !tank) return;
    const payload = (event as CustomEvent<Record<string, unknown>>).detail;
    if (!payload || payload.kind !== "action") return;
    applyCoopAction(payload);
    sendCoopAction(payload);
  });
  document.addEventListener("fishweb:game", (event) => {
    if (!coopActive || coopHost || !tank) return;
    const payload = (event as CustomEvent<Record<string, unknown>>).detail;
    if (payload?.kind === "action") applyCoopAction(payload);
  });
  function applyCoopAction(payload: Record<string, unknown>): void {
    if (!tank) return;
    if (payload.action === "click" && typeof payload.x === "number" && typeof payload.y === "number") {
      const heldTicks = typeof payload.heldTicks === "number" ? Math.max(0, Math.min(120, payload.heldTicks)) : 0;
      handleFoodLimit(tank, tank.click(payload.x, payload.y, heldTicks));
    } else if (payload.action === "spawn-fish" && typeof payload.kind === "string" && payload.kind in SANDBOX_FISH) {
      tank.spawnSandboxFish(payload.kind as keyof typeof SANDBOX_FISH);
    } else if (payload.action === "spawn-pet" && typeof payload.kind === "string" && PET_TYPES.includes(payload.kind as PetType)) {
      tank.spawnSandboxPet(payload.kind as PetType);
    } else if (payload.action === "spawn-alien" && typeof payload.kind === "string" && payload.kind in SANDBOX_ALIENS) {
      tank.spawnSandboxAlien(payload.kind as keyof typeof SANDBOX_ALIENS);
    } else return;
    updateHud();
    draw();
    updateStatus();
  }
  document.addEventListener("fishweb:start-coop", (event) => {
    const detail = (event as CustomEvent<{ seed?: number; isHost?: boolean }>).detail;
    if (!detail || typeof detail.seed !== "number") return;
    coopActive = true;
    coopHost = detail.isHost === true;
    openTank(createTank({ sandbox: true, seed: detail.seed }));
  });
  start.addEventListener("click", () => showModeChooser("adventure"));
  for (const button of [start, ...Object.values(modeButtons), startVirtual]) {
    button.addEventListener("pointerenter", (event) => {
      if (button.disabled || event.pointerType === "touch") return;
      hoveredMode = button;
      updateSelectorSpeech();
    });
    button.addEventListener("pointerleave", () => {
      if (hoveredMode === button) hoveredMode = undefined;
      updateSelectorSpeech();
    });
    button.addEventListener("focus", () => {
      if (!button.matches(":focus-visible")) return;
      focusedMode = button;
      updateSelectorSpeech();
    });
    button.addEventListener("blur", () => {
      if (focusedMode === button) focusedMode = undefined;
      updateSelectorSpeech();
    });
  }
  for (const mode of ["time-trial", "challenge"] as const) {
    modeButtons[mode].addEventListener("click", () => showModeChooser(mode));
    modeButtons[mode].disabled = false;
  }
  menuToggle.addEventListener("click", () => setMenu(menu.hidden));
  menuOk.addEventListener("click", () => setMenu(false));
  menu.addEventListener("click", (event) => { if (event.target === menu) setMenu(false); });
  element("main-menu").addEventListener("click", showSelector);
  element("mode-menu").addEventListener("click", showSelector);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
    if (screensaver) {
      event.preventDefault();
      stopScreensaver();
    } else if (virtualControls.pageOpen) {
      event.preventDefault();
      virtualControls.closePage();
    } else if (virtualControls.feedOpen) {
      event.preventDefault();
      virtualControls.closeFeed(true);
    } else if (!modeScreen.hidden) {
      event.preventDefault();
      showSelector();
    } else if (!screen.hidden) {
      event.preventDefault();
      setMenu(menu.hidden);
    }
  });

  function fillOptions(select: HTMLSelectElement, entries: ReadonlyArray<readonly [string, string]>): void {
    for (const [value, label] of entries) select.add(new Option(label, value));
  }

  const petOptions = PET_TYPES.map((type) => [type, PET_INFO[type].name] as const);
  fillOptions(sandboxPet, petOptions);
  fillOptions(sandboxTank, ["1", "2", "3", "4", "5"].map((number) => [number, "Tank " + number]));
  fillOptions(sandboxFish, Object.entries(SANDBOX_FISH));
  fillOptions(sandboxAlien, Object.entries(SANDBOX_ALIENS));
  fillOptions(sandboxFood, [["0", "Regular food"], ["3", "Pizza"], ["4", "Ice cream"], ["5", "Chicken"]]);
  prestoForm.addEventListener("change", () => {
    tank?.changePresto(prestoForm.value as PetType);
    updateHud();
    draw();
  });
  canvas.addEventListener("contextmenu", (event) => {
    const presto = tank?.state.pets.find((pet) => pet.type === "presto" || pet.morph);
    if (!presto || !active() || !moveAim(event as PointerEvent) || Math.hypot(presto.x - aim.x, presto.y - aim.y) > 38) return;
    event.preventDefault();
    if (presto.morphCooldown > 0) return;
    setMenu(true, false);
    prestoForm.focus();
    if (event.isTrusted) prestoForm.showPicker?.();
  });
  sandbox.addEventListener("click", () => chooseRun("sandbox", sandboxSession?.tank ?? 1));
  sandboxTools.addEventListener("click", () => {
    if (!tank?.sandbox) return;
    sandboxTank.value = String(tank.tank);
    sandboxDialog.showModal();
    if (songs.length || loadingSongs) return;
    loadingSongs = true;
    void loadFishSongCatalog().then((catalog) => {
      songs = catalog;
      sandboxSong.replaceChildren();
      fillOptions(sandboxSong, songs.map(({ id, title, long }) => [id, long ? `${title} (Long)` : title]));
      sandboxSong.disabled = sandboxSongButton.disabled = !songs.length;
    }).catch(() => {
      sandboxSong.replaceChildren(new Option("Songs unavailable"));
    }).finally(() => { loadingSongs = false; });
  });
  element("sandbox-reset").addEventListener("click", () => {
    sandboxDialog.close();
    openTank(createTank({ sandbox: true, tank: Number(sandboxTank.value) }));
  });
  element("sandbox-add-fish").addEventListener("click", () => {
    const kind = sandboxFish.value as keyof typeof SANDBOX_FISH;
    if (coopActive && !coopHost) { sendCoopAction({ action: "spawn-fish", kind }); return; }
    tank?.spawnSandboxFish(kind);
    if (coopActive) sendCoopAction({ action: "spawn-fish", kind });
    draw();
  });
  element("sandbox-add-pet").addEventListener("click", () => {
    const kind = sandboxPet.value as PetType;
    if (coopActive && !coopHost) { sendCoopAction({ action: "spawn-pet", kind }); return; }
    tank?.spawnSandboxPet(kind);
    if (coopActive) sendCoopAction({ action: "spawn-pet", kind });
    updateHud();
    draw();
  });
  element("sandbox-add-alien").addEventListener("click", () => {
    const kind = sandboxAlien.value as keyof typeof SANDBOX_ALIENS;
    if (coopActive && !coopHost) { sendCoopAction({ action: "spawn-alien", kind }); return; }
    tank?.spawnSandboxAlien(kind);
    if (coopActive) sendCoopAction({ action: "spawn-alien", kind });
    draw();
    syncMusic();
  });
  sandboxFood.addEventListener("change", () => {
    if (tank?.sandbox) tank.sandboxFood = Number(sandboxFood.value);
  });
  sandboxSong.addEventListener("change", stopSong);
  sandboxSongButton.addEventListener("click", () => {
    if (songPlaying) {
      stopSong();
      return;
    }
    const song = songs.find(({ id }) => id === sandboxSong.value);
    if (!song) return;
    setSongPlaying(true);
    void audio.playFishSong(song, () => setSongPlaying(false));
  });

  function resize(): void {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(TANK_WIDTH * scale);
    canvas.height = Math.round(TANK_HEIGHT * scale);
    ctx.setTransform(canvas.width / TANK_WIDTH, 0, 0, canvas.height / TANK_HEIGHT, 0, 0);
    draw();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => { pointer = undefined; });
  document.addEventListener("visibilitychange", () => {
    if (tank?.virtualTank) {
      if (document.hidden) virtualSave.saveFullness(tank.virtualFish);
      else tank.syncVirtualTank();
    }
    syncAnimation();
  });
  helpDialog.addEventListener("close", syncAnimation);
  sandboxDialog.addEventListener("close", () => setMenu(false, false));
  updateAdventureMenu();
  start.disabled = false;
  sandbox.disabled = false;
  menuToggle.disabled = false;
  resize();
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
