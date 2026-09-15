import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function isNearWhite(r, g, b) {
  return r >= 246 && g >= 246 && b >= 246;
}

function removeWhiteAndCrop(png, { padding = 8, minAlpha = 18 } = {}) {
  const { width, height, data } = png;
  const out = Buffer.from(data);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (isNearWhite(r, g, b)) {
      out[i + 3] = 0;
      continue;
    }
    const dist = Math.hypot(255 - r, 255 - g, 255 - b);
    if (dist < 22) {
      out[i + 3] = 0;
    } else if (dist < 48) {
      out[i + 3] = Math.round(((dist - 22) / 26) * 255);
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = out[(width * y + x) * 4 + 3];
      if (alpha >= minAlpha) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    throw new Error("Nenhum pixel visível após remover o fundo.");
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = new PNG({ width: cropW, height: cropH });

  for (let y = 0; y < cropH; y += 1) {
    const srcStart = ((minY + y) * width + minX) * 4;
    const destStart = y * cropW * 4;
    out.copy(cropped.data, destStart, srcStart, srcStart + cropW * 4);
  }

  return cropped;
}

function toSquare(png, { fill = 0.92 } = {}) {
  const size = Math.max(png.width, png.height);
  const canvas = Math.round(size / fill);
  const square = new PNG({ width: canvas, height: canvas });
  square.data.fill(0);

  const offsetX = Math.round((canvas - png.width) / 2);
  const offsetY = Math.round((canvas - png.height) / 2);

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const src = (y * png.width + x) * 4;
      const dest = ((offsetY + y) * canvas + offsetX + x) * 4;
      png.data.copy(square.data, dest, src, src + 4);
    }
  }

  return square;
}

function writePng(filePath, png) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

const [, , input, output, mode = "logo"] = process.argv;
if (!input || !output) {
  console.error("Uso: node remove-logo-background.mjs <entrada.png> <saida.png> [logo|favicon]");
  process.exit(1);
}

const source = loadPng(input);
const cropped = removeWhiteAndCrop(source, {
  padding: mode === "favicon" ? 6 : 10,
});
const result = mode === "favicon" ? toSquare(cropped, { fill: 0.9 }) : cropped;
writePng(output, result);
console.log(`${mode}: ${source.width}x${source.height} → ${result.width}x${result.height} (${output})`);
