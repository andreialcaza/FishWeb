export const sidePortholePositions = [25, 119, 425, 519].flatMap((x) =>
  Array.from({ length: 5 }, (_, row) => ({ x, y: 41 + row * 83 })));

export function createPorthole({ x, y }: { x: number; y: number }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "porthole";
  button.style.setProperty("--porthole-x", String(x));
  button.style.setProperty("--porthole-y", String(y));
  const canvas = document.createElement("canvas");
  canvas.width = 90;
  canvas.height = 83;
  canvas.setAttribute("aria-hidden", "true");
  const glint = document.createElement("span");
  glint.className = "porthole-glint";
  glint.setAttribute("aria-hidden", "true");
  button.append(canvas, glint);
  return { button, canvas };
}
