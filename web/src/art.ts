import { MAX_FOOD_LIMIT, type ShopId, type TankShop } from "./shop.js";
import type { Coin, FishChomp, Food } from "./simulation.js";

export interface TankArt {
  readonly customFish: boolean;
  readonly customFood: boolean;
  readonly customCoin: boolean;
  drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, timeSeconds: number, background?: number): void;
  drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: number, timeSeconds: number, stage: number): void;
  drawFood(ctx: CanvasRenderingContext2D, x: number, y: number, timeSeconds?: number): void;
  drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, timeSeconds: number, value: number): void;
}

const assetNames = ["background", "fish", "food", "coin"] as const;
type AssetName = typeof assetNames[number];

interface AssetConfig {
  src: string;
  alpha?: string;
  columns: number;
  rows: number;
  row: number;
  variantRows?: Record<number, number>;
  firstColumn: number;
  frameCount: number;
  fps: number;
  faces: "left" | "right";
  drawSize?: number;
}

interface TankImage {
  image: HTMLImageElement | HTMLCanvasElement;
  config: AssetConfig;
  frameWidth: number;
  frameHeight: number;
}

const tankWidth = 640;
const tankHeight = 400;
const sprites = new Map<string, TankImage | null>();
const chompSheet = ["Chomp.gif", "Chomp_.gif", 5, 1] as const;
let redrawSprites: (() => void) | undefined;

function getTankSprite(src: string, alpha: string | undefined, columns: number, rows: number): TankImage | null | undefined {
  const key = [src, alpha, columns, rows].join("/");
  if (!sprites.has(key)) {
    sprites.set(key, null);
    const baseUrl = new URL("./images/", document.baseURI);
    const config = { src, alpha, columns, rows, row: 0, firstColumn: 0, frameCount: columns, fps: 0, faces: "left" } as const;
    void loadTankImage(config, baseUrl).catch(() => null).then((sprite) => {
      if (!sprite) return;
      sprites.set(key, sprite);
      redrawSprites?.();
    });
  }
  return sprites.get(key);
}

export function drawTankSprite(
  ctx: CanvasRenderingContext2D, src: string, alpha: string | undefined, columns: number, rows: number,
  column: number, row: number, x: number, y: number, width?: number, direction = -1,
): boolean {
  const sprite = getTankSprite(src, alpha, columns, rows);
  if (!sprite) return false;
  const { image, frameWidth, frameHeight } = sprite;
  const drawWidth = width ?? frameWidth;
  const drawHeight = drawWidth * frameHeight / frameWidth;
  const frame = Math.max(0, Math.min(columns - 1, Math.floor(column)));
  const strip = Math.max(0, Math.min(rows - 1, Math.floor(row)));
  ctx.save();
  ctx.translate(x, y);
  if (direction > 0) ctx.scale(-1, 1);
  ctx.drawImage(image, frame * frameWidth, strip * frameHeight, frameWidth, frameHeight,
    -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
  return true;
}
const lightRays = [
  [102, 15, 170], [191, 80, 94], [306, 267, 103], [403, 458, 165], [507, 602, 147],
] as const;
const grassBlades = [
  [98, -38, 8], [120, -21, 10], [88, 5, 8], [108, 32, 9], [63, 51, 8], [49, -44, 6],
] as const;
const bubbles = [
  [91, 25, 72, 2.7], [94, 23, 13, 1.6], [126, 24, 271, 3.7], [173, 29, 131, 1.3],
  [449, 26, 192, 1.4], [499, 30, 289, 2.5], [547, 28, 42, 2.8], [551, 27, 91, 1.7],
] as const;

export function loadTankArt(onLoad?: () => void): TankArt {
  redrawSprites = onLoad;
  getTankSprite(...chompSheet);
  const images: Partial<Record<AssetName, TankImage>> = {};
  const manifestUrl = new URL("./art/manifest.json", document.baseURI);
  void loadImages(manifestUrl, images).then(onLoad);

  const background = document.createElement("canvas");
  background.width = tankWidth;
  background.height = tankHeight;
  const backgroundContext = background.getContext("2d");
  if (backgroundContext) drawWaterAndPlants(backgroundContext);

  return {
    get customFish() {
      return !!images.fish && images.fish.config.src !== "../images/smallswim.gif";
    },
    get customFood() {
      return !!images.food && images.food.config.src !== "../images/food.gif";
    },
    get customCoin() {
      return !!images.coin && images.coin.config.src !== "../images/money.gif";
    },
    drawBackground(ctx, width, height, timeSeconds, backgroundId = 1) {
      if (backgroundId !== 1 || images.background?.config.src === "../images/aquarium1.jpg") {
        const filename = backgroundId === 5 ? "Aquarium5.jpg" : "aquarium" + backgroundId + ".jpg";
        if (drawTankSprite(ctx, filename, undefined, 1, 1, 0, 0, width / 2, height / 2 - 40, width)) return;
      }
      if (images.background) {
        ctx.clearRect(0, 0, width, height);
        drawCover(ctx, images.background, width, height, timeSeconds);
        return;
      }

      ctx.save();
      ctx.scale(width / tankWidth, height / tankHeight);
      if (backgroundContext) {
        ctx.drawImage(background, 0, 0);
      } else {
        drawWaterAndPlants(ctx);
      }
      drawWaterMotion(ctx, timeSeconds);
      ctx.restore();
    },

    drawFish(ctx, x, y, size, direction, timeSeconds, stage) {
      ctx.save();
      ctx.translate(x, y);
      const flip = direction < 0 ? -1 : 1;
      if (images.fish) {
        const fish = images.fish;
        ctx.scale(fish.config.faces === "left" ? -flip : flip, 1);
        const width = fish.config.drawSize ?? size;
        const height = width * fish.frameHeight / fish.frameWidth;
        drawFrame(ctx, fish, -width / 2, -height / 2, width, height, timeSeconds, stage);
      } else {
        const scale = size / 54;
        ctx.scale(flip * scale, scale);
        drawMinnow(ctx, timeSeconds * 11 + x * 0.04 + y * 0.03);
      }
      ctx.restore();
    },

    drawFood(ctx, x, y, timeSeconds = 0) {
      if (images.food) {
        drawContained(ctx, images.food, x, y, 7, timeSeconds);
        return;
      }
      drawPellet(ctx, x, y);
    },

    drawCoin(ctx, x, y, timeSeconds, value) {
      if (images.coin) {
        drawContained(ctx, images.coin, x, y, 20, timeSeconds, value);
        return;
      }
      drawToken(ctx, x, y, timeSeconds);
    },
  };
}

export function drawFishChomps(ctx: CanvasRenderingContext2D, chomps: readonly FishChomp[], tick: number): void {
  for (const { x, y, startTick, opacity } of chomps) {
    const frame = Math.max(0, Math.floor((tick - startTick) / 2) - 1);
    ctx.save();
    ctx.globalAlpha *= opacity;
    drawTankSprite(ctx, ...chompSheet, frame, 0, x, y);
    ctx.restore();
  }
}

const shopFish = {
  breeder: "scl_breeder", oscar: "scl_oscar", penta: "scl_starcatcher",
  grubber: "scl_grubber", gekko: "scl_gekko", ultra: "scl_ultra",
} as const;

export function drawShopIcon(
  ctx: CanvasRenderingContext2D, id: ShopId, shop: TankShop, seconds: number, showItem: boolean, hatchFrame?: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (showItem) drawShopItem(ctx, id, shop, seconds);
  if (hatchFrame !== undefined) {
    drawTankSprite(ctx, "HatchANIMATION.gif", "_HatchANIMATION.gif", 3, 1, hatchFrame, 0, width / 2, height / 2);
  }
}

function drawShopItem(ctx: CanvasRenderingContext2D, id: ShopId, shop: TankShop, seconds: number): void {
  const { width } = ctx.canvas;
  const x = width / 2;
  const y = 23.5;
  const frame = Math.floor(seconds * 15) % 10;
  let drawn = false;
  switch (id) {
    case "guppy": drawn = drawTankSprite(ctx, "smallswim.gif", "smallswim_.gif", 10, 5, frame, 0, x, y, 70); break;
    case "breeder":
    case "oscar":
    case "penta":
    case "grubber":
    case "gekko":
    case "ultra": drawn = drawTankSprite(ctx, shopFish[id] + ".gif", "_" + shopFish[id] + ".gif", 10, 1, frame, 0, x, y); break;
    case "quality":
    case "potion": drawn = drawTankSprite(ctx, "food.gif", "_food.gif", 10, 5, 0,
      id === "potion" ? 3 : Math.min(2, shop.foodLevel + 1), x, y); break;
    case "weapon": drawn = drawTankSprite(ctx, "LazerGunz.gif", "_LazerGunz.gif", 10, 1, shop.weaponPower - 2, 0, x, y); break;
    case "egg": drawn = drawTankSprite(ctx, "EggPieces.gif", "_EggPieces.gif", 3, 1,
      shop.hatchesPets || shop.tank === 5 ? 2 : Math.min(2, shop.eggPieces), 0, x, y); break;
  }
  if (!drawn) {
    ctx.font = id === "quantity" ? "bold 16px system-ui" : "bold 13px system-ui";
    ctx.fillStyle = id === "quantity" ? "#6efa6e" : "#fff4ca";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(id === "quantity" ? String(Math.min(MAX_FOOD_LIMIT, shop.foodLimit + 1)) : id, x, y, width - 4);
  }
}

const exoticFood = { 3: "pizza2", 4: "icecream", 5: "chicken" } as const;
const coinRows: Partial<Record<Coin["kind"], number>> = {
  silver: 0, gold: 1, star: 2, diamond: 3, "penta-diamond": 3, treasure: 4, larva: 5, "shell-star": 2,
};
const shellRows: Partial<Record<Coin["kind"], number>> = {
  silver: 0, gold: 1, diamond: 2, "penta-diamond": 2, "shell-diamond": 2, pearl: 3, "shell-pearl": 3,
};

export function drawTankDrops(
  ctx: CanvasRenderingContext2D, art: TankArt, food: readonly Food[], coins: readonly Coin[], seconds: number,
): void {
  for (const pellet of food) {
    const { x, y, exotic, level, age, fade } = pellet;
    const frame = Math.floor(age / 3) % 10;
    ctx.save();
    ctx.globalAlpha = 1 - fade / 16;
    let drawn = false;
    if (exotic === 3 || exotic === 4 || exotic === 5) {
      const name = exoticFood[exotic];
      drawn = drawTankSprite(ctx, name + ".gif", name + "_.gif", 1, 1, 0, 0, x, y, 25);
    } else if (exotic || level || !art.customFood) {
      drawn = drawTankSprite(ctx, "food.gif", "_food.gif", 10, 5, frame, exotic === 2 ? 4 : level, x, y, 25);
    }
    if (!drawn) art.drawFood(ctx, x, y, seconds);
    ctx.restore();
  }
  for (const coin of coins) {
    const { x, y, kind, age, fade, value, bounced } = coin;
    if (kind === "niko-pearl" && coin.owner?.type === "niko") continue;
    const frame = Math.floor(age / 2) % 10;
    ctx.save();
    ctx.globalAlpha = 1 - fade / 16;
    let drawn = false;
    const shell = shellRows[kind];
    const row = coinRows[kind];
    if (shell !== undefined && ((coin.shell && !coin.specialFood) || bounced || kind.startsWith("shell-"))) {
      drawn = drawTankSprite(ctx, "shells.gif", "shells_.gif", 20, 4, coin.shell ? Math.floor(age / 2) % 20 : frame, shell, x, y, 32);
    } else if (((coin.shell || bounced) && kind === "treasure") || kind === "shell-treasure") {
      drawn = drawTankSprite(ctx, "bag.gif", "bag_.gif", 1, 1, 0, 0, x, y, 42);
    } else if (kind === "pearl" || kind === "niko-pearl") {
      drawn = drawTankSprite(ctx, "pearl.gif", "pearl_.gif", 1, 1, 0, 0, x, y, 48);
    } else if (kind === "note" || kind === "peanut" || kind === "bomb") {
      drawn = drawTankSprite(ctx, "miscitems.gif", "miscitems_.gif", 3, 1,
        kind === "note" ? 1 : kind === "peanut" ? 2 : 0, 0, x, y, 44);
    } else if (row !== undefined && (!art.customCoin || row > 1)) {
      drawn = drawTankSprite(ctx, "money.gif", "money_.gif", 10, 6, frame, row, x, y, 52);
    }
    if (!drawn) art.drawCoin(ctx, x, y, seconds, value);
    ctx.restore();
  }
}

async function loadImages(
  manifestUrl: URL,
  images: Partial<Record<AssetName, TankImage>>,
): Promise<void> {
  try {
    const response = await fetch(manifestUrl, { mode: "same-origin" });
    if (!response.ok) return;
    const manifest: unknown = await response.json();
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return;

    const baseUrl = new URL(response.url || manifestUrl);
    await Promise.all(assetNames.map(async (name) => {
      const config = parseAssetConfig((manifest as Record<string, unknown>)[name]);
      if (!config) return;
      const asset = await loadTankImage(config, baseUrl).catch(() => null);
      if (asset) images[name] = asset;
    }));
  } catch {
    // The built-in art is available while optional files load and when they fail.
  }
}

function parseAssetConfig(input: unknown): AssetConfig | null {
  const entry = typeof input === "string" ? { src: input } : input;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const {
    src, alpha, columns = 1, rows = 1, row = 0, variantRows, firstColumn = 0,
    frameCount = 1, fps = 8, faces = "right", drawSize,
  } = entry as Record<string, unknown>;

  if (typeof src !== "string" || !src.trim()) return null;
  if (alpha !== undefined && (typeof alpha !== "string" || !alpha.trim())) return null;
  if (!isIntegerAtLeast(columns, 1) || !isIntegerAtLeast(rows, 1)) return null;
  if (!isIntegerAtLeast(row, 0) || row >= rows) return null;
  if (variantRows !== undefined && (
    !variantRows || typeof variantRows !== "object" || Array.isArray(variantRows)
    || Object.values(variantRows).some((index) => !isIntegerAtLeast(index, 0) || index >= rows)
  )) return null;
  if (!isIntegerAtLeast(firstColumn, 0) || firstColumn >= columns) return null;
  if (!isIntegerAtLeast(frameCount, 1) || frameCount > columns - firstColumn) return null;
  if (typeof fps !== "number" || !Number.isFinite(fps) || fps < 0 || fps > 120) return null;
  if (faces !== "left" && faces !== "right") return null;
  if (drawSize !== undefined && (typeof drawSize !== "number" || !Number.isFinite(drawSize) || drawSize <= 0)) return null;

  return {
    src: src.trim(), alpha: alpha?.trim(), columns, rows, row,
    variantRows: variantRows as AssetConfig["variantRows"], firstColumn, frameCount, fps, faces, drawSize,
  };
}

function isIntegerAtLeast(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min;
}

async function loadTankImage(config: AssetConfig, baseUrl: URL): Promise<TankImage | null> {
  const [image, alpha] = await Promise.all([
    loadImage(config.src, baseUrl),
    config.alpha ? loadImage(config.alpha, baseUrl) : null,
  ]);
  if (!image) return null;

  const frameWidth = image.naturalWidth / config.columns;
  const frameHeight = image.naturalHeight / config.rows;
  if (!isIntegerAtLeast(frameWidth, 1) || !isIntegerAtLeast(frameHeight, 1)) return null;

  if (!config.alpha) return { image, config, frameWidth, frameHeight };
  if (!alpha || alpha.naturalWidth !== image.naturalWidth || alpha.naturalHeight !== image.naturalHeight) {
    return null;
  }

  const maskedImage = applyAlphaMask(image, alpha);
  return maskedImage ? { image: maskedImage, config, frameWidth, frameHeight } : null;
}

async function loadImage(path: string, baseUrl: URL): Promise<HTMLImageElement | null> {
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl.origin || (url.protocol !== "http:" && url.protocol !== "https:")) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.src = url.href;
  });
}

function applyAlphaMask(image: HTMLImageElement, alpha: HTMLImageElement): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  const width = canvas.width = image.naturalWidth;
  const height = canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(alpha, 0, 0);
  const mask = ctx.getImageData(0, 0, width, height).data;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, width, height);
  for (let offset = 0; offset < frame.data.length; offset += 4) {
    const gray = (mask[offset]! + mask[offset + 1]! + mask[offset + 2]!) / 3;
    const maskOpacity = (gray / 255) * (mask[offset + 3]! / 255);
    frame.data[offset + 3] = frame.data[offset + 3]! * maskOpacity;
  }
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  asset: TankImage,
  x: number,
  y: number,
  width: number,
  height: number,
  timeSeconds: number,
  variant = 0,
): void {
  const { image, config, frameWidth, frameHeight } = asset;
  const column = config.firstColumn + Math.floor(timeSeconds * config.fps) % config.frameCount;
  const row = config.variantRows?.[variant] ?? config.row;
  ctx.drawImage(image, column * frameWidth, row * frameHeight, frameWidth, frameHeight, x, y, width, height);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  asset: TankImage,
  width: number,
  height: number,
  timeSeconds: number,
): void {
  const scale = Math.max(width / asset.frameWidth, height / asset.frameHeight);
  const drawnWidth = asset.frameWidth * scale;
  const drawnHeight = asset.frameHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  drawFrame(ctx, asset, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight, timeSeconds);
  ctx.restore();
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  asset: TankImage,
  x: number,
  y: number,
  size: number,
  timeSeconds: number,
  variant?: number,
): void {
  const scale = (asset.config.drawSize ?? size) / Math.max(asset.frameWidth, asset.frameHeight);
  const width = asset.frameWidth * scale;
  const height = asset.frameHeight * scale;
  drawFrame(ctx, asset, x - width / 2, y - height / 2, width, height, timeSeconds, variant);
}

function drawWaterAndPlants(ctx: CanvasRenderingContext2D): void {
  const water = ctx.createLinearGradient(0, 0, 0, tankHeight);
  water.addColorStop(0, "#164b58");
  water.addColorStop(0.32, "#103d49");
  water.addColorStop(0.77, "#0d2934");
  water.addColorStop(1, "#091d29");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, tankWidth, tankHeight);

  const glow = ctx.createRadialGradient(343, -45, 20, 343, -45, 436);
  glow.addColorStop(0, "#b1fbcd70");
  glow.addColorStop(0.45, "#71d3b632");
  glow.addColorStop(1, "#377f7a00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, tankWidth, tankHeight);

  const light = ctx.createLinearGradient(0, 0, 0, 335);
  light.addColorStop(0, "#e0ffcb24");
  light.addColorStop(0.52, "#a2edc50b");
  light.addColorStop(1, "#b1fbcd00");
  ctx.fillStyle = light;
  for (const [mouth, end, width] of lightRays) {
    ctx.beginPath();
    ctx.moveTo(mouth - 11, 0);
    ctx.lineTo(mouth + 14, 0);
    ctx.lineTo(end + width / 2, 335);
    ctx.lineTo(end - width / 2, 335);
    ctx.closePath();
    ctx.fill();
  }

  const sand = ctx.createLinearGradient(0, 325, 0, tankHeight);
  sand.addColorStop(0, "#365350");
  sand.addColorStop(0.62, "#263e40");
  sand.addColorStop(1, "#172d35");
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(0, 346);
  ctx.bezierCurveTo(125, 334, 155, 365, 258, 355);
  ctx.bezierCurveTo(359, 346, 418, 338, 492, 348);
  ctx.bezierCurveTo(557, 359, 579, 337, tankWidth, 346);
  ctx.lineTo(tankWidth, tankHeight);
  ctx.lineTo(0, tankHeight);
  ctx.closePath();
  ctx.fill();

  for (let index = 0; index < 96; index++) {
    const x = (index * 197) % tankWidth;
    const y = 361 + (index * 23) % 38;
    ctx.fillStyle = index % 3 === 0 ? "#a0a98538" : "#091e285c";
    ctx.beginPath();
    ctx.ellipse(x, y, 0.7 + index % 6 * 0.46, 0.5 + index % 3 * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGrass(ctx, 42, 371, 0.72, -1, "#153b3b", "#44775b");
  drawGrass(ctx, 101, 374, 1.08, 1, "#183d3c", "#35665b");
  drawGrass(ctx, 591, 362, 1.19, -1, "#163737", "#386b54");
  drawRock(ctx, 0, 385, 78, 58, "#386162");
  drawRock(ctx, 62, 388, 64, 34, "#45685e");
  drawRock(ctx, 118, 389, 48, 18, "#4c6c61");
  drawRock(ctx, 540, 388, 73, 37, "#355c5c");
  drawRock(ctx, 608, 388, 82, 56, "#426461");
  drawGrass(ctx, 62, 391, 1.23, 1, "#112f35", "#4c7c63");
  drawGrass(ctx, 571, 392, 0.73, -1, "#122f38", "#55866b");
  drawGrass(ctx, 640, 394, 1.13, -1, "#123038", "#5a8f6d");
}

function drawGrass(
  ctx: CanvasRenderingContext2D, x: number, y: number, size: number, direction: number, base: string, tip: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction * size, size);
  for (const [height, bend, width] of grassBlades) {
    const color = ctx.createLinearGradient(0, 0, bend, -height);
    color.addColorStop(0, base);
    color.addColorStop(1, tip);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.bezierCurveTo(-width, -height * 0.59, bend * 0.76 - width * 1.5, -height * 0.6, bend, -height);
    ctx.bezierCurveTo(bend * 0.72 + width * 0.95, -height * 0.62, width * 1.7, -height * 0.42, width / 2, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, upperColor: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, height);
  const stone = ctx.createLinearGradient(0, -1, 0, 0);
  stone.addColorStop(0, upperColor);
  stone.addColorStop(1, "#132930");
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(-0.57, 0);
  ctx.quadraticCurveTo(-0.63, -0.16, -0.44, -0.45);
  ctx.lineTo(-0.29, -0.83);
  ctx.quadraticCurveTo(-0.08, -1.03, 0.19, -0.92);
  ctx.lineTo(0.42, -0.58);
  ctx.quadraticCurveTo(0.53, -0.35, 0.52, -0.11);
  ctx.quadraticCurveTo(0.1, 0.08, -0.57, 0);
  ctx.fill();

  ctx.fillStyle = "#86a59426";
  ctx.beginPath();
  ctx.moveTo(-0.42, -0.43);
  ctx.lineTo(-0.28, -0.79);
  ctx.quadraticCurveTo(-0.08, -0.96, 0.17, -0.88);
  ctx.lineTo(0.3, -0.68);
  ctx.lineTo(-0.07, -0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWaterMotion(ctx: CanvasRenderingContext2D, timeSeconds: number): void {
  ctx.lineWidth = 0.85;
  ctx.strokeStyle = "#a8efe334";
  for (const [origin, speed, delay, radius] of bubbles) {
    const y = 358 - (timeSeconds * speed + delay) % 368;
    const x = origin + Math.sin(y / 27 + delay) * 7;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#d2ffda1c";
  for (let index = 0; index < 7; index++) {
    const x = 21 + index * 95 + Math.sin(timeSeconds * 0.65 + index) * 12;
    const y = 18 + Math.sin(timeSeconds * 0.9 + index * 0.7) * 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 19, y - 8, x + 32, y + 6, x + 54, y - 2);
    ctx.stroke();
  }
}

function drawMinnow(ctx: CanvasRenderingContext2D, phase: number): void {
  const fin = ctx.createLinearGradient(0, -17, 0, 17);
  fin.addColorStop(0, "#fbd0a7");
  fin.addColorStop(0.56, "#c57f79");
  fin.addColorStop(1, "#845a73");
  ctx.fillStyle = fin;
  ctx.strokeStyle = "#552e48";
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(-11, -7);
  ctx.quadraticCurveTo(-9, -14, -3, -16);
  ctx.quadraticCurveTo(3, -17, 12, -9);
  ctx.lineTo(0, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(-14, 0);
  ctx.rotate(Math.sin(phase) * 0.24);
  const tailTip = -13 + Math.cos(phase) * 1.7;
  ctx.beginPath();
  ctx.moveTo(1, -3);
  ctx.quadraticCurveTo(tailTip + 7, -4, tailTip, -11);
  ctx.quadraticCurveTo(tailTip + 1, -4, tailTip + 3, 0);
  ctx.quadraticCurveTo(tailTip + 2, 5, tailTip, 10);
  ctx.quadraticCurveTo(tailTip + 8, 6, 2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const body = ctx.createLinearGradient(0, -12, 0, 12);
  body.addColorStop(0, "#508681");
  body.addColorStop(0.35, "#83d4b9");
  body.addColorStop(0.62, "#a8dbcd");
  body.addColorStop(1, "#597d9a");
  ctx.fillStyle = body;
  ctx.strokeStyle = "#223b52";
  ctx.beginPath();
  ctx.moveTo(-17, -2.5);
  ctx.bezierCurveTo(-8, -8, -6, -12, 5, -12);
  ctx.bezierCurveTo(15, -12, 22, -9, 24, -4);
  ctx.quadraticCurveTo(26, -1, 26, 2);
  ctx.bezierCurveTo(19, 8, 14, 11, 3, 11);
  ctx.bezierCurveTo(-5, 11, -11, 7, -17, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#286c79a8";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.bezierCurveTo(-3, -2.5, 0, 3.5, 11, 0.5);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "#ebfff0bd";
  ctx.beginPath();
  ctx.moveTo(-7, -4.6);
  ctx.quadraticCurveTo(3, -8.5, 12, -6);
  ctx.stroke();

  ctx.fillStyle = "#ae686c";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.quadraticCurveTo(10, 5, -1, 8 + Math.sin(phase) * 2);
  ctx.quadraticCurveTo(0, 4, 9, 0);
  ctx.fill();

  ctx.strokeStyle = "#466b79";
  ctx.beginPath();
  ctx.moveTo(14, -5.4);
  ctx.quadraticCurveTo(11.5, 0.2, 14, 5.4);
  ctx.stroke();

  ctx.fillStyle = "#f3e8ba";
  ctx.beginPath();
  ctx.arc(18.7, -2.5, 3.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#192c44";
  ctx.beginPath();
  ctx.arc(19.35, -2.5, 2.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6fbec";
  ctx.beginPath();
  ctx.arc(19.95, -3.25, 0.78, 0, Math.PI * 2);
  ctx.fill();
}

function drawPellet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#eaa765";
  ctx.strokeStyle = "#5c3331";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(-2.8, -0.4);
  ctx.lineTo(-1.1, -2.8);
  ctx.lineTo(2.2, -2);
  ctx.lineTo(3.1, 0.8);
  ctx.lineTo(0.6, 2.8);
  ctx.lineTo(-2.3, 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe4a6";
  ctx.fillRect(-1.1, -1.6, 1.2, 1.1);
  ctx.restore();
}

function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, timeSeconds: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.77 + Math.sin(timeSeconds * 5 + x * 0.03) * 0.22, 1);
  const metal = ctx.createLinearGradient(-7, -8, 7, 8);
  metal.addColorStop(0, "#fff5b7");
  metal.addColorStop(0.45, "#ebbf62");
  metal.addColorStop(1, "#a96836");
  ctx.fillStyle = metal;
  ctx.strokeStyle = "#5e412c";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, 9.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#fff2ae";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(0, 0, 6.65, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#8d552f";
  ctx.beginPath();
  ctx.moveTo(0, -4.7);
  ctx.quadraticCurveTo(1.1, -1.1, 4.6, 0);
  ctx.quadraticCurveTo(1.1, 1.1, 0, 4.7);
  ctx.quadraticCurveTo(-1.1, 1.1, -4.6, 0);
  ctx.quadraticCurveTo(-1.1, -1.1, 0, -4.7);
  ctx.fill();
  ctx.restore();
}
