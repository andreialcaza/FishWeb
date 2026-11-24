import { startTank } from "./tank-ui.js";

import { GameAudio } from "./audio.js";

const canvas = document.querySelector<HTMLCanvasElement>("#tank")!;
const audio = new GameAudio();
setupAudio();
setupHelp();

const context = canvas.getContext("2d");
if (context) {
  startTank(context, audio);
} else {
  document.querySelector<HTMLElement>("#start-error")!.hidden = false;
}

setupSelector();

function setupHelp(): void {
  const dialog = document.querySelector<HTMLDialogElement>("#help-dialog")!;
  const content = document.querySelector<HTMLElement>("#help-pages")!;
  const title = document.querySelector<HTMLElement>("#help-topic")!;
  const pageNumber = document.querySelector<HTMLElement>("#help-page-number")!;
  const returnButton = document.querySelector<HTMLButtonElement>("#help-return")!;
  const menuHelp = document.querySelector<HTMLButtonElement>("#start-help")!;
  const tankHelp = document.querySelector<HTMLButtonElement>("#options-help")!;
  const pages = Array.from(content.querySelectorAll<HTMLElement>("[data-help-topic]"));
  let page = 0;

  function turnPage(offset: number): void {
    pages[page].hidden = true;
    page = (page + offset + pages.length) % pages.length;
    pages[page].hidden = false;
    title.textContent = pages[page].dataset.helpTopic!;
    pageNumber.textContent = `Page ${page + 1} of ${pages.length}`;
    content.scrollTop = 0;
  }

  function openHelp(label: string): void {
    returnButton.textContent = label;
    dialog.showModal();
    content.scrollTop = 0;
  }

  document.querySelector("#help-previous")!.addEventListener("click", () => turnPage(-1));
  document.querySelector("#help-next")!.addEventListener("click", () => turnPage(1));
  menuHelp.addEventListener("click", () => openHelp("Menu"));
  tankHelp.addEventListener("click", () => openHelp("Back to Game"));
  turnPage(0);
  menuHelp.disabled = false;
}

function setupAudio(): void {
  for (const gesture of ["pointerdown", "pointerup", "keydown", "click"]) {
    document.addEventListener(gesture, (event) => {
      if (event.isTrusted) audio.unlock();
    }, { capture: true });
  }
  document.addEventListener("visibilitychange", () => audio.visibilityChanged());
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (button && !button.disabled && !button.matches('.shop-slot, #selector-meryl, [aria-disabled="true"]')) audio.play("buttonclick");
  }, { capture: true });

  for (const channel of ["music", "effects"] as const) {
    const sliders = Array.from(document.querySelectorAll<HTMLInputElement>(`[data-audio-volume="${channel}"]`));
    for (const slider of sliders) {
      slider.value = String(audio.volumes[channel]);
      slider.addEventListener("input", () => {
        audio.setVolume(channel, slider.valueAsNumber);
        for (const other of sliders) other.value = slider.value;
      });
      if (channel === "effects") slider.addEventListener("change", () => audio.play("buttonclick"));
    }
  }
}

function setupSelector(): void {
  const optionsDialog = document.querySelector<HTMLDialogElement>("#options-dialog")!;
  const optionsButton = document.querySelector<HTMLButtonElement>("#start-options")!;
  const fullscreenButton = document.querySelector<HTMLButtonElement>("#fullscreen")!;
  const fullscreenStatus = document.querySelector<HTMLElement>("#fullscreen-status")!;
  const tankFullscreen = document.querySelector<HTMLInputElement>("#tank-fullscreen")!;
  const tankFullscreenStatus = document.querySelector<HTMLElement>("#tank-fullscreen-status")!;
  optionsButton.addEventListener("click", () => optionsDialog.showModal());
  optionsButton.disabled = false;

  function showFullscreenStatus(available: boolean): void {
    fullscreenStatus.hidden = available;
    tankFullscreenStatus.hidden = available;
  }

  function syncFullscreenControls(): void {
    const enabled = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute("aria-pressed", String(enabled));
    tankFullscreen.checked = enabled;
  }

  async function setFullscreen(enabled: boolean): Promise<void> {
    try {
      if (enabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as (ScreenOrientation & {
          lock?: (mode: "landscape") => Promise<void>;
        }) | undefined;
        void orientation?.lock?.("landscape").catch(() => {});
      } else if (!enabled && document.fullscreenElement) {
        await document.exitFullscreen();
      }
      showFullscreenStatus(true);
    } catch {
      showFullscreenStatus(false);
    }
    syncFullscreenControls();
  }

  fullscreenButton.disabled = tankFullscreen.disabled = !document.fullscreenEnabled;
  showFullscreenStatus(document.fullscreenEnabled);
  syncFullscreenControls();
  fullscreenButton.addEventListener("click", () => void setFullscreen(!document.fullscreenElement));
  tankFullscreen.addEventListener("change", () => void setFullscreen(tankFullscreen.checked));
  document.addEventListener("fullscreenchange", syncFullscreenControls);

  const moreButton = document.querySelector<HTMLButtonElement>("#start-more")!;
  const primaryModes = document.querySelector<HTMLElement>("#selector-primary-modes")!;
  const moreModes = document.querySelector<HTMLElement>("#selector-more-modes")!;
  moreButton.addEventListener("click", () => {
    const showMore = moreModes.hidden;
    primaryModes.hidden = showMore;
    moreModes.hidden = !showMore;
    moreButton.setAttribute("aria-pressed", String(showMore));
  });
  moreButton.disabled = false;

  const merylButton = document.querySelector<HTMLButtonElement>("#selector-meryl")!;
  const tailStrip = document.querySelector<HTMLElement>("#selector-tail-strip")!;
  merylButton.addEventListener("click", () => {
    const [flop] = tailStrip.getAnimations();
    if (flop?.effect) flop.currentTime = flop.effect.getTiming().delay ?? 0;
  });
  merylButton.disabled = false;
}

