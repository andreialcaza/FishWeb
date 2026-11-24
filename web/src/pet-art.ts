import { drawTankSprite } from "./art.js";
import { PET_INFO, type Pet } from "./pets.js";

export function drawPet(ctx: CanvasRenderingContext2D, pet: Pet, timeSeconds: number, backdrop: number): void {
  const { type, frame, row, animation } = pet;
  const { name, stem, columns, rows, width } = PET_INFO[type];
  const sneeze = animation === "sneeze" ? 7 * pet.action / 24 : 0;
  const x = pet.x + sneeze * Math.sin(pet.age * 4);
  const y = pet.y - (type === "amp" ? 10 : 0) + sneeze * Math.cos(pet.age * 3);
  const facesBothWays = type === "niko" || type === "clyde" || type === "rufus" || type === "rhubarb";
  const direction = facesBothWays ? -1 : pet.direction;
  const file = `${stem}.gif`;
  const mask = `_${stem}.gif`;

  ctx.save();
  if (type === "stinky" && pet.count > 150) ctx.filter = "sepia(1) saturate(2.5) hue-rotate(320deg)";
  const drawn = drawTankSprite(ctx, file, mask, columns, rows, frame, row, x, y, width, direction);
  ctx.restore();
  if (type === "niko" && !pet.morph && backdrop === 3) {
    drawTankSprite(ctx, "Nikotower.gif", "_Nikotower.gif", 1, 1, 0, 0, x - 2.5, y + 38.5);
  }
  if (!drawn) {
    drawPetFallback(ctx, x, y, width, name, animation === "hide");
    return;
  }

  const glow = Math.abs(Math.sin(timeSeconds * 8));
  if (type === "angie" || animation === "glow" || animation === "ready") {
    const effect = type === "amp" ? "ampcharge.gif" : type === "gumbo" ? "gumbolight.gif"
      : type === "angie" ? "halo.gif" : file;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = type === "amp" ? Math.min(1, glow + pet.count * 0.14) : glow * 0.7;
    drawTankSprite(ctx, effect, effect === file ? mask : undefined, columns, rows, frame, row, x, y, width, direction);
    ctx.restore();
  }

  if (type === "walter" && animation === "punch") drawWalterGlove(ctx, pet);
  if (animation === "sleep") {
    drawTankSprite(ctx, "zzz.gif", "zzz_.gif", 1, 1, 0, 0, x + direction * 10, y - 38);
  }
  if ((pet.morph || pet.transformed) && pet.morphAge < 20) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.7;
    drawTankSprite(ctx, "presto.gif", "_presto.gif", 10, 3, Math.floor(pet.morphAge / 2), 2, x, y, 80, direction);
    ctx.restore();
  }
  if (pet.morph && type !== "presto") drawPrestoLabel(ctx, pet);
}

function drawWalterGlove(ctx: CanvasRenderingContext2D, pet: Pet): void {
  const timer = pet.action - 6;
  if (timer <= 0 || timer >= 30) return;
  const distance = Math.abs(timer - 15);
  const frame = 9 - distance;
  if (frame > 0) {
    drawTankSprite(ctx, "walter.gif", "_walter.gif", 10, 3, Math.max(6, frame), 2,
      pet.x + pet.direction * 63, pet.y + 2, 80, pet.direction);
  }
  drawTankSprite(ctx, "walter.gif", "_walter.gif", 10, 3, 5, 2,
    pet.x + pet.direction * (80 - distance * 6), pet.y, 80, pet.direction);
}

function drawPrestoLabel(ctx: CanvasRenderingContext2D, pet: Pet): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.strokeStyle = "#102943";
  ctx.lineWidth = 3;
  ctx.fillStyle = "#aaffaa";
  const y = Math.min(pet.y + 34, 394);
  ctx.strokeText("Presto", pet.x, y);
  ctx.fillText("Presto", pet.x, y);
  if (pet.morphCooldown > 0) {
    ctx.fillStyle = "#102943";
    ctx.fillRect(pet.x - 17, y + 2, 34, 3);
    ctx.fillStyle = "#aaffaa";
    ctx.fillRect(pet.x - 17, y + 2, 34 * (1 - pet.morphCooldown / 360), 3);
  }
  ctx.restore();
}

function drawPetFallback(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, name: string, hidden: boolean): void {
  ctx.save();
  ctx.fillStyle = hidden ? "#658e9d" : "#69c2a8";
  ctx.strokeStyle = "#163d54";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, width * 0.28, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#142f47";
  ctx.fillText(name, x, y);
  ctx.restore();
}
