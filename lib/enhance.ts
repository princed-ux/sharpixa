import { PRESETS, type Preset, type AdvancedControls } from "./constants";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function clamp(val: number): number {
  return val < 0 ? 0 : val > 255 ? 255 : val;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

// Videos re-decode the same mask for every frame — cache the decoded image.
const maskImageCache = new Map<string, HTMLImageElement>();

async function loadMaskImage(maskDataUrl: string): Promise<HTMLImageElement> {
  const cached = maskImageCache.get(maskDataUrl);
  if (cached) return cached;
  const img = await loadImage(maskDataUrl);
  maskImageCache.clear();
  maskImageCache.set(maskDataUrl, img);
  return img;
}

function sharpenKernel(
  data: Uint8ClampedArray<ArrayBuffer>,
  w: number,
  h: number,
  amount: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(data);
  const k = amount;
  // Overshoot beyond this is clipped so edges get crisper without the bright
  // halos that make results look artificially "sharpie".
  const HALO_LIMIT = 40;
  // Sharpening only kicks in on real edges; flat and noisy areas are left
  // alone so grain never gets amplified.
  const EDGE_LO = 10;
  const EDGE_HI = 26;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      // Edge measure on luma
      const lum = (i: number) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const gx = Math.abs(lum(idx + 4) - lum(idx - 4));
      const gy = Math.abs(lum(idx + w * 4) - lum(idx - w * 4));
      const grad = gx > gy ? gx : gy;
      if (grad <= EDGE_LO) continue;
      const gate = grad >= EDGE_HI ? 1 : (grad - EDGE_LO) / (EDGE_HI - EDGE_LO);
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const up = data[idx - w * 4 + c];
        const down = data[idx + w * 4 + c];
        const left = data[idx - 4 + c];
        const right = data[idx + 4 + c];
        let delta = k * gate * (4 * center - up - down - left - right);
        if (delta > HALO_LIMIT) delta = HALO_LIMIT;
        else if (delta < -HALO_LIMIT) delta = -HALO_LIMIT;
        out[idx + c] = clamp(center + delta);
      }
    }
  }
  return out;
}

// Edge-preserving denoise: each pixel is blended with neighbors weighted by
// how similar their brightness is. Flat, noisy areas get smoothed while real
// edges keep their contrast — "clean", not blurry.
function denoisePass(
  data: Uint8ClampedArray<ArrayBuffer>,
  w: number,
  h: number,
  amount: number,
): Uint8ClampedArray<ArrayBuffer> {
  if (amount <= 0) return data;
  const out = new Uint8ClampedArray(data);
  const mix = amount > 1 ? 1 : amount;

  const luma = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    luma[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }

  const sigma = 8 + amount * 22;
  const lut = new Float32Array(256);
  const inv = -1 / (2 * sigma * sigma);
  for (let d = 0; d < 256; d++) lut[d] = Math.exp(d * d * inv);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const idx = i * 4;
      const centerL = luma[i];
      let r = 0,
        g = 0,
        b = 0,
        wsum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = i + dy * w + dx;
          const diff = luma[ni] - centerL;
          const wgt = lut[diff < 0 ? -diff : diff];
          const si = ni * 4;
          r += data[si] * wgt;
          g += data[si + 1] * wgt;
          b += data[si + 2] * wgt;
          wsum += wgt;
        }
      }
      out[idx] = clamp(data[idx] * (1 - mix) + (r / wsum) * mix);
      out[idx + 1] = clamp(data[idx + 1] * (1 - mix) + (g / wsum) * mix);
      out[idx + 2] = clamp(data[idx + 2] * (1 - mix) + (b / wsum) * mix);
    }
  }
  return out;
}

function applyPixelOps(
  data: Uint8ClampedArray<ArrayBuffer>,
  brightness: number,
  contrast: number,
  saturation: number,
): Uint8ClampedArray<ArrayBuffer> {
  const brightnessFactor = 1 + brightness / 100;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(contrastFactor * (data[i] * brightnessFactor - 128) + 128);
    data[i + 1] = clamp(contrastFactor * (data[i + 1] * brightnessFactor - 128) + 128);
    data[i + 2] = clamp(contrastFactor * (data[i + 2] * brightnessFactor - 128) + 128);
  }

  const satFactor = 1 + saturation / 100;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = clamp(gray + (data[i] - gray) * satFactor);
    data[i + 1] = clamp(gray + (data[i + 1] - gray) * satFactor);
    data[i + 2] = clamp(gray + (data[i + 2] - gray) * satFactor);
  }

  return data;
}

export async function enhanceImage(
  img: HTMLImageElement,
  presetName: string,
  scale: string,
  ctrl?: AdvancedControls,
  maskDataUrl?: string | null,
): Promise<HTMLCanvasElement> {
  const p = (PRESETS as Record<string, Preset>)[presetName] || PRESETS.standard;
  const controls = ctrl || { brightness: 0, contrast: 0, saturation: 0, sharpness: 0 };

  const brightness = p.brightness + controls.brightness;
  const contrast = p.contrast + controls.contrast;
  const saturation = p.saturation + controls.saturation;
  const sharpness = p.sharpness + controls.sharpness / 100;
  const denoise = p.denoise;

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const scaleFactor = scale === "2x" ? 2 : scale === "4x" ? 4 : 1;
  w = Math.round(w * scaleFactor);
  h = Math.round(h * scaleFactor);

  const MAX_DIM = 4096;
  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  if (maskDataUrl) {
    const plan = await buildInpaintPlan(maskDataUrl, w, h);
    if (plan) applyInpaintPlan(ctx, plan);
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  let data: Uint8ClampedArray<ArrayBuffer> = imageData.data;

  data = applyPixelOps(data, brightness, contrast, saturation);

  // Denoise first so sharpening doesn't amplify grain. Stronger presets get
  // a second, lighter pass — two gentle passes clean more than one hard one.
  if (denoise > 0) {
    data = denoisePass(data, w, h, denoise);
    if (denoise > 0.45) {
      data = denoisePass(data, w, h, denoise * 0.6);
    }
  }

  if (sharpness > 0) {
    data = sharpenKernel(data, w, h, sharpness);
  }

  const outputImageData = new ImageData(data, w, h);
  ctx.putImageData(outputImageData, 0, 0);

  return canvas;
}

// ---------------------------------------------------------------------------
// Inpainting
//
// Content-copy fill (PatchMatch-style), all confined to the brushed region:
//   1. The binary mask is dilated a few pixels so the anti-aliased fringe of
//      the watermark (which the brush threshold alone would miss) is covered.
//   2. A coarse grid over the region is solved with diffusion (masked cells
//      relax toward their neighbors, unmasked cells are fixed boundary
//      values). Upsampled, this gives a smooth low-frequency color base.
//   3. On the first frame that base is refined by diffusion and used as the
//      guess for a PatchMatch search: every masked pixel gets matched to a
//      real patch of unmasked content that fits its surroundings. The repair
//      then COPIES real pixels, so the filled area keeps genuine texture,
//      grain and detail instead of turning into a smooth "airbrushed" patch.
//   4. On every frame the copies are re-read from the current frame at those
//      fixed source positions, with their low frequency aligned to the
//      per-frame coarse field so lighting gradients stay continuous. The
//      mapping never changes between frames — temporally stable, no flicker.
//   5. Junctions between copies from unrelated places, plus a 2px ring along
//      the mask boundary, get a light feathered blend.
//
// Masks that leave no clean source patches anywhere fall back to the old
// diffusion + mirrored-texture fill. Nothing outside the dilated mask plus
// the feather ring is ever modified.
// ---------------------------------------------------------------------------

interface InpaintPlan {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  targets: Int32Array; // box indices of masked pixels
  boxMask: Uint8Array;
  // Coarse grid
  cs: number; // cell size in px
  cw: number;
  ch: number;
  coarseKnown: Uint8Array;
  coarseIters: number;
  // Bilinear sampling of the coarse solution, per target (4 cells + weights)
  bilinCells: Int32Array;
  bilinW: Float32Array;
  // Texture source (mirrored across nearest boundary), per target
  mirror: Int32Array; // box index of unmasked source pixel, -1 = none
  mirrorCells: Int32Array; // coarse bilinear at the mirror position
  mirrorW: Float32Array;
  texScale: Float32Array; // per-target texture strength, decays with depth
  fineIterations: number;
  maxDepth: number; // deepest masked pixel's distance to the boundary
  blurPixels: Int32Array;
  blurBlend: Float32Array;
  scratch: Uint8ClampedArray;
  tScratch: Float32Array; // per-target rgb scratch
  coarseVal: Float32Array; // cw*ch*3 solution buffer
  coarseSum: Float32Array;
  coarseCnt: Int32Array;
  // Patch-copy fill, computed from the first frame's content and then fixed
  // so every video frame uses the identical mapping:
  offsets: Int32Array | null; // per-target box index of the copied source px
  offsetsFailed: boolean; // mask leaves no usable source patches
  srcCells: Int32Array | null; // coarse bilinear at each source position
  srcW: Float32Array | null;
  offsetSeam: Int32Array | null; // targets where adjacent copies disagree
  // First frame's (target - source) coarse-field difference. The per-frame
  // lighting correction applies only the CHANGE relative to this baseline, so
  // the first frame's copies are untouched (the coarse field is a smooth
  // approximation that misrepresents sharp region boundaries — correcting
  // toward it within one frame washes out texture near edges) while later
  // frames still track genuine lighting drift.
  corrBase: Float32Array | null;
  // Motion adaptation. rimIdx samples real pixels hugging the mask; when
  // their luma drifts from the reference (scene moved under the mask), the
  // offsets are re-verified against the current frame instead of copying
  // stale content. clearMap/ordMap persist the level-0 matcher context.
  rimIdx: Int32Array;
  rimRef: Float32Array | null;
  clearMap: Uint8Array | null;
  ordMap: Int32Array | null;
  refineBuf: Uint8ClampedArray | null;
  baseScore: number; // mean patch cost when the offsets were computed
}

// TEMP debug switches for in-browser stage isolation; removed after tuning.
export const __inpaintDbg = { noCorr: false, noSeamBlur: false, noEdgeBlur: false };

const MASK_DILATE = 5;
const MASK_ALPHA_THRESHOLD = 16;
const BOX_MARGIN = 48;
const TEXTURE_STRENGTH = 0.95;
const TEXTURE_CLAMP = 36;
// Below this many masked pixels the diffusion fill is already invisible and
// the patch search isn't worth its cost.
const PATCH_MIN_TARGETS = 64;

function bilinearSetup(
  xx: number,
  yy: number,
  cs: number,
  cw: number,
  ch: number,
  outCells: Int32Array,
  outW: Float32Array,
  o: number,
): void {
  const fx = (xx + 0.5) / cs - 0.5;
  const fy = (yy + 0.5) / cs - 0.5;
  let x0 = Math.floor(fx);
  let y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  let x1 = x0 + 1;
  let y1 = y0 + 1;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > cw - 1) x1 = cw - 1;
  if (y1 > ch - 1) y1 = ch - 1;
  if (x0 > cw - 1) x0 = cw - 1;
  if (y0 > ch - 1) y0 = ch - 1;
  outCells[o] = y0 * cw + x0;
  outCells[o + 1] = y0 * cw + x1;
  outCells[o + 2] = y1 * cw + x0;
  outCells[o + 3] = y1 * cw + x1;
  outW[o] = (1 - tx) * (1 - ty);
  outW[o + 1] = tx * (1 - ty);
  outW[o + 2] = (1 - tx) * ty;
  outW[o + 3] = tx * ty;
}

async function buildInpaintPlan(
  maskDataUrl: string,
  w: number,
  h: number,
  fineIterationCap = 400,
): Promise<InpaintPlan | null> {
  const maskImg = await loadMaskImage(maskDataUrl);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Canvas 2D context not available");
  maskCtx.imageSmoothingEnabled = true;
  maskCtx.drawImage(maskImg, 0, 0, w, h);
  const maskPixels = maskCtx.getImageData(0, 0, w, h).data;

  const maskedFull = new Uint8Array(w * h);
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (maskPixels[i * 4 + 3] > MASK_ALPHA_THRESHOLD) {
        maskedFull[i] = 1;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count === 0) return null;

  // Work inside the mask's bounding box plus margin for boundary context.
  const margin = BOX_MARGIN + MASK_DILATE;
  const bx = Math.max(0, minX - margin);
  const by = Math.max(0, minY - margin);
  const bw = Math.min(w - 1, maxX + margin) - bx + 1;
  const bh = Math.min(h - 1, maxY + margin) - by + 1;

  const boxMaskRaw = new Uint8Array(bw * bh);
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      if (maskedFull[(by + yy) * w + (bx + xx)]) {
        boxMaskRaw[yy * bw + xx] = 1;
      }
    }
  }

  // Dilate the mask (separable square kernel) so the soft anti-aliased edge
  // of the watermark just outside the brushed core is repaired as well.
  const dilatedH = new Uint8Array(bw * bh);
  for (let yy = 0; yy < bh; yy++) {
    const row = yy * bw;
    for (let xx = 0; xx < bw; xx++) {
      const x0 = xx - MASK_DILATE < 0 ? 0 : xx - MASK_DILATE;
      const x1 = xx + MASK_DILATE > bw - 1 ? bw - 1 : xx + MASK_DILATE;
      for (let nx = x0; nx <= x1; nx++) {
        if (boxMaskRaw[row + nx]) {
          dilatedH[row + xx] = 1;
          break;
        }
      }
    }
  }
  const boxMask = new Uint8Array(bw * bh);
  for (let xx = 0; xx < bw; xx++) {
    for (let yy = 0; yy < bh; yy++) {
      const y0 = yy - MASK_DILATE < 0 ? 0 : yy - MASK_DILATE;
      const y1 = yy + MASK_DILATE > bh - 1 ? bh - 1 : yy + MASK_DILATE;
      let hit = 0;
      for (let ny = y0; ny <= y1; ny++) {
        if (dilatedH[ny * bw + xx]) {
          hit = 1;
          break;
        }
      }
      if (hit) boxMask[yy * bw + xx] = 1;
    }
  }

  let t = 0;
  for (let i = 0; i < bw * bh; i++) {
    if (boxMask[i]) t++;
  }
  const targets = new Int32Array(t);
  for (let i = 0, k = 0; i < bw * bh; i++) {
    if (boxMask[i]) targets[k++] = i;
  }

  // Coarse grid setup.
  const cs = Math.min(12, Math.max(3, Math.ceil(Math.max(bw, bh) / 64)));
  const cw = Math.ceil(bw / cs);
  const ch = Math.ceil(bh / cs);
  const coarseKnown = new Uint8Array(cw * ch);
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      if (!boxMask[yy * bw + xx]) {
        coarseKnown[((yy / cs) | 0) * cw + ((xx / cs) | 0)] = 1;
      }
    }
  }
  const coarseIters = Math.min(240, Math.max(80, 3 * Math.max(cw, ch)));

  // Bilinear weights for sampling the coarse solution at each target pixel.
  const bilinCells = new Int32Array(t * 4);
  const bilinW = new Float32Array(t * 4);
  for (let i = 0; i < t; i++) {
    const idx = targets[i];
    const xx = idx % bw;
    const yy = (idx - xx) / bw;
    bilinearSetup(xx, yy, cs, cw, ch, bilinCells, bilinW, i * 4);
  }

  // Nearest boundary pixel for every masked pixel (multi-source BFS from the
  // unmasked ring), then mirror the position across it for texture sourcing.
  const nearest = new Int32Array(bw * bh).fill(-1);
  const bfsDepth = new Int32Array(bw * bh);
  const queue = new Int32Array(t + bw * bh);
  let qHead = 0,
    qTail = 0;
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const i = yy * bw + xx;
      if (boxMask[i]) continue;
      // Seed: unmasked pixels that touch the mask.
      const touching =
        (xx > 0 && boxMask[i - 1]) ||
        (xx < bw - 1 && boxMask[i + 1]) ||
        (yy > 0 && boxMask[i - bw]) ||
        (yy < bh - 1 && boxMask[i + bw]);
      if (touching) {
        nearest[i] = i;
        queue[qTail++] = i;
      }
    }
  }
  let maxDepth = 0;
  while (qHead < qTail) {
    const i = queue[qHead++];
    const xx = i % bw;
    const yy = (i - xx) / bw;
    const nb = nearest[i];
    const nd = bfsDepth[i] + 1;
    if (nd > maxDepth) maxDepth = nd;
    if (xx > 0 && boxMask[i - 1] && nearest[i - 1] < 0) {
      nearest[i - 1] = nb;
      bfsDepth[i - 1] = nd;
      queue[qTail++] = i - 1;
    }
    if (xx < bw - 1 && boxMask[i + 1] && nearest[i + 1] < 0) {
      nearest[i + 1] = nb;
      bfsDepth[i + 1] = nd;
      queue[qTail++] = i + 1;
    }
    if (yy > 0 && boxMask[i - bw] && nearest[i - bw] < 0) {
      nearest[i - bw] = nb;
      bfsDepth[i - bw] = nd;
      queue[qTail++] = i - bw;
    }
    if (yy < bh - 1 && boxMask[i + bw] && nearest[i + bw] < 0) {
      nearest[i + bw] = nb;
      bfsDepth[i + bw] = nd;
      queue[qTail++] = i + bw;
    }
  }

  // Enough fine passes for the diffusion to fully converge across the widest
  // part of the brush (narrow bands converge quickly; the cap protects video).
  const fineIterations = Math.min(
    fineIterationCap,
    Math.max(24, Math.round(maxDepth * maxDepth * 0.5)),
  );

  const mirror = new Int32Array(t).fill(-1);
  const mirrorCells = new Int32Array(t * 4);
  const mirrorW = new Float32Array(t * 4);
  const texScale = new Float32Array(t);
  for (let i = 0; i < t; i++) {
    const idx = targets[i];
    const xx = idx % bw;
    const yy = (idx - xx) / bw;
    const nb = nearest[idx];
    if (nb < 0) continue;
    const nbx = nb % bw;
    const nby = (nb - nbx) / bw;
    // Texture fades with depth: strong right at the seam, almost none deep
    // inside, so mirrored content can never form visible structures.
    const bdx = nbx - xx;
    const bdy = nby - yy;
    const dist = Math.sqrt(bdx * bdx + bdy * bdy);
    texScale[i] = 1 / (1 + dist / 7);
    // Reflect across the boundary point, shrinking the step if the mirrored
    // spot is itself masked or out of bounds.
    let src = -1;
    for (const s of [1, 0.6, 0.3, 0]) {
      const mx = Math.round(nbx + (nbx - xx) * s);
      const my = Math.round(nby + (nby - yy) * s);
      if (mx < 0 || mx >= bw || my < 0 || my >= bh) continue;
      const mi = my * bw + mx;
      if (!boxMask[mi]) {
        src = mi;
        break;
      }
    }
    if (src < 0) continue;
    mirror[i] = src;
    const sx = src % bw;
    const sy = (src - sx) / bw;
    bilinearSetup(sx, sy, cs, cw, ch, mirrorCells, mirrorW, i * 4);
  }

  // Feathered seam: pixels within 2px of the mask boundary, inside and out.
  // The outside half doubles as the motion-watch rim: real pixels whose
  // change signals that the scene moved under the mask.
  const blurList: number[] = [];
  const blendList: number[] = [];
  const rimList: number[] = [];
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      const i = yy * bw + xx;
      const inside = boxMask[i] === 1;
      let nearOpposite = false;
      for (let dy = -2; dy <= 2 && !nearOpposite; dy++) {
        const ny = yy + dy;
        if (ny < 0 || ny >= bh) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const nx = xx + dx;
          if (nx < 0 || nx >= bw) continue;
          if ((boxMask[ny * bw + nx] === 1) !== inside) {
            nearOpposite = true;
            break;
          }
        }
      }
      if (nearOpposite) {
        blurList.push(i);
        blendList.push(inside ? 0.2 : 0.1);
        if (!inside) rimList.push(i);
      }
    }
  }

  return {
    bx,
    by,
    bw,
    bh,
    targets,
    boxMask,
    cs,
    cw,
    ch,
    coarseKnown,
    coarseIters,
    bilinCells,
    bilinW,
    mirror,
    mirrorCells,
    mirrorW,
    texScale,
    fineIterations,
    maxDepth,
    blurPixels: Int32Array.from(blurList),
    blurBlend: Float32Array.from(blendList),
    scratch: new Uint8ClampedArray(bw * bh * 4),
    tScratch: new Float32Array(t * 3),
    coarseVal: new Float32Array(cw * ch * 3),
    coarseSum: new Float32Array(cw * ch * 3),
    coarseCnt: new Int32Array(cw * ch),
    offsets: null,
    offsetsFailed: false,
    srcCells: null,
    srcW: null,
    offsetSeam: null,
    corrBase: null,
    rimIdx: Int32Array.from(rimList),
    rimRef: null,
    clearMap: null,
    ordMap: null,
    refineBuf: null,
    baseScore: 0,
  };
}

// Find, for every masked pixel, a real content pixel to copy from — an
// approximate nearest-neighbor field solved coarse-to-fine (PatchMatch over
// an image pyramid). At the coarsest level the brushed hole is only a few
// pixels wide, so the structure around it (edges, lines, patterns) bridges
// straight across and locks the offsets onto content that continues that
// structure; every finer level inherits those offsets and refines them with
// scanline propagation plus a short random search. `px` is the box's RGBA
// with the diffusion estimate already filled in; it seeds the matching and
// is progressively replaced by real copies as offsets improve. Runs once
// (first frame); the offsets are reused for all frames.
function computePatchOffsets(plan: InpaintPlan, px: Uint8ClampedArray): void {
  const { bw, bh, targets, boxMask, cs, cw, ch, maxDepth } = plan;
  const t = targets.length;
  if (t < PATCH_MIN_TARGETS) {
    plan.offsetsFailed = true;
    return;
  }
  // 7x7 patches: wide enough to span a full cycle of typical fabric/texture
  // patterns, so matches lock onto the pattern's phase instead of drifting.
  const R = 3;
  const P = (2 * R + 1) * (2 * R + 1);
  // Enough levels that the hole shrinks to ~5px at the top of the pyramid.
  const levelCount =
    Math.max(0, Math.min(4, Math.ceil(Math.log2(Math.max(1, maxDepth) / 5)))) + 1;

  // Image/mask pyramid, level 0 = full resolution. A coarse pixel counts as
  // masked if any of its children is, so sources never contain fill.
  const lw: number[] = [bw];
  const lh: number[] = [bh];
  const lest: Uint8ClampedArray[] = [new Uint8ClampedArray(px)];
  const lmask: Uint8Array[] = [boxMask];
  for (let l = 1; l < levelCount; l++) {
    const pw = lw[l - 1];
    const ph = lh[l - 1];
    const w2 = Math.max(1, Math.ceil(pw / 2));
    const h2 = Math.max(1, Math.ceil(ph / 2));
    const e = new Uint8ClampedArray(w2 * h2 * 4);
    const m = new Uint8Array(w2 * h2);
    const pe = lest[l - 1];
    const pm = lmask[l - 1];
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        let r = 0, g = 0, b = 0, n = 0, masked = 0;
        for (let dy = 0; dy < 2; dy++) {
          const sy = y * 2 + dy;
          if (sy >= ph) continue;
          for (let dx = 0; dx < 2; dx++) {
            const sx = x * 2 + dx;
            if (sx >= pw) continue;
            const si = (sy * pw + sx) * 4;
            r += pe[si];
            g += pe[si + 1];
            b += pe[si + 2];
            n++;
            masked |= pm[sy * pw + sx];
          }
        }
        const di = (y * w2 + x) * 4;
        e[di] = r / n;
        e[di + 1] = g / n;
        e[di + 2] = b / n;
        m[y * w2 + x] = masked;
      }
    }
    lw.push(w2);
    lh.push(h2);
    lest.push(e);
    lmask.push(m);
  }

  let prevOffsets: Int32Array | null = null;
  let prevOrd: Int32Array | null = null;
  let prevW = 0;
  let offsets: Int32Array | null = null;
  let ord: Int32Array | null = null;
  let est: Uint8ClampedArray = lest[0];

  for (let l = levelCount - 1; l >= 0; l--) {
    const w = lw[l];
    const h = lh[l];
    const mask = lmask[l];
    est = lest[l];

    let tc = 0;
    for (let i = 0; i < w * h; i++) if (mask[i]) tc++;
    const tg = new Int32Array(tc);
    const od = new Int32Array(w * h).fill(-1);
    for (let i = 0, k = 0; i < w * h; i++) {
      if (mask[i]) {
        od[i] = k;
        tg[k++] = i;
      }
    }

    // Luma gradients of the current estimate. Matching on gradients as well
    // as color forces edges to land on edges, so a boundary crossing the
    // hole is continued straight instead of following the smooth estimate.
    const luma = new Float32Array(w * h);
    const gx = new Float32Array(w * h);
    const gy = new Float32Array(w * h);
    const rebuildGrad = (): void => {
      for (let i = 0, p = 0; i < w * h; i++, p += 4) {
        luma[i] = est[p] * 0.299 + est[p + 1] * 0.587 + est[p + 2] * 0.114;
      }
      for (let y = 0; y < h; y++) {
        const row = y * w;
        const up = y > 0 ? row - w : row;
        const dn = y < h - 1 ? row + w : row;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          gx[i] = luma[x < w - 1 ? i + 1 : i] - luma[x > 0 ? i - 1 : i];
          gy[i] = luma[dn + x] - luma[up + x];
        }
      }
    };
    rebuildGrad();

    // Summed-area table of the mask → O(1) "is this patch fully unmasked".
    const satW = w + 1;
    const sat = new Int32Array(satW * (h + 1));
    for (let y = 0; y < h; y++) {
      let run = 0;
      for (let x = 0; x < w; x++) {
        run += mask[y * w + x];
        sat[(y + 1) * satW + (x + 1)] = sat[y * satW + (x + 1)] + run;
      }
    }
    const clear = (cx: number, cy: number): boolean => {
      if (cx < R || cy < R || cx > w - 1 - R || cy > h - 1 - R) return false;
      const x0 = cx - R, y0 = cy - R, x1 = cx + R + 1, y1 = cy + R + 1;
      return sat[y1 * satW + x1] - sat[y0 * satW + x1] - sat[y1 * satW + x0] + sat[y0 * satW + x0] === 0;
    };

    let validCount = 0;
    for (let y = R; y <= h - 1 - R; y++) {
      for (let x = R; x <= w - 1 - R; x++) {
        if (clear(x, y)) validCount++;
      }
    }
    if (validCount === 0) {
      if (l === 0) {
        plan.offsetsFailed = true;
        return;
      }
      prevOffsets = null;
      prevOrd = null;
      continue;
    }
    const validList = new Int32Array(validCount);
    for (let y = R, k = 0; y <= h - 1 - R; y++) {
      for (let x = R; x <= w - 1 - R; x++) {
        if (clear(x, y)) validList[k++] = y * w + x;
      }
    }

    const offs = new Int32Array(tc).fill(-1);
    const best = new Float32Array(tc).fill(Infinity);
    // Mild preference for nearby sources — breaks ties, never outweighs a
    // genuinely better texture match.
    const distW = 600 / (w * w + h * h);

    // Patch distance normalized to full-patch scale; bails out early past
    // `cutoff` (weights are <= 1, so the normalized score >= the raw sum).
    // Real (unmasked) pixels of the target patch carry full weight while
    // estimate/fill pixels carry only FILL_W — the surrounding true content
    // decides the match, so the smooth estimate can never drag the search
    // toward flat fill or the wrong side of an object boundary.
    const FILL_W = 0.35;
    const GRAD_W = 2;
    const patchDist = (ti: number, si: number, cutoff: number): number => {
      const tx = ti % w, ty = (ti - tx) / w;
      const sx = si % w, sy = (si - sx) / w;
      let sum = 0, wsum = 0;
      for (let dy = -R; dy <= R; dy++) {
        const tyy = ty + dy;
        if (tyy < 0 || tyy >= h) continue;
        const tRow = tyy * w + tx;
        const sRow = (sy + dy) * w + sx;
        for (let dx = -R; dx <= R; dx++) {
          const txx = tx + dx;
          if (txx < 0 || txx >= w) continue;
          const tp = tRow + dx;
          const sp = sRow + dx;
          const wgt = mask[tp] ? FILL_W : 1;
          const a = tp * 4;
          const b = sp * 4;
          const dr = est[a] - est[b];
          const dg = est[a + 1] - est[b + 1];
          const db = est[a + 2] - est[b + 2];
          const dgx = gx[tp] - gx[sp];
          const dgy = gy[tp] - gy[sp];
          sum += wgt * (dr * dr + dg * dg + db * db + GRAD_W * (dgx * dgx + dgy * dgy));
          wsum += wgt;
        }
        if (sum >= cutoff) return Infinity;
      }
      return wsum > 0 ? (sum * P) / wsum : Infinity;
    };

    const consider = (i: number, si: number): void => {
      const ti = tg[i];
      const tx = ti % w, ty = (ti - tx) / w;
      const sx = si % w, sy = (si - sx) / w;
      const ddx = sx - tx, ddy = sy - ty;
      const pen = (ddx * ddx + ddy * ddy) * distW;
      if (pen >= best[i]) return;
      const d = patchDist(ti, si, best[i] - pen);
      if (d + pen < best[i]) {
        best[i] = d + pen;
        offs[i] = si;
      }
    };

    const isCoarsest = l === levelCount - 1;

    if (isCoarsest) {
      // Onion-peel init: fill from the hole's rim inward, in BFS-depth order.
      // Each pixel adopts (shifted) offsets from already-settled neighbors or
      // random candidates, scored against mostly-real surroundings, and its
      // copy is written into the estimate immediately so deeper peels grow
      // from real structure. Structure crossing the hole gets continued from
      // both sides instead of the fill following the smooth estimate.
      const depth = new Int32Array(w * h).fill(-1);
      const q = new Int32Array(w * h);
      let qh = 0, qt = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (mask[i]) continue;
          if (
            (x > 0 && mask[i - 1]) ||
            (x < w - 1 && mask[i + 1]) ||
            (y > 0 && mask[i - w]) ||
            (y < h - 1 && mask[i + w])
          ) {
            depth[i] = 0;
            q[qt++] = i;
          }
        }
      }
      while (qh < qt) {
        const i = q[qh++];
        const x = i % w;
        const y = (i - x) / w;
        const nd = depth[i] + 1;
        if (x > 0 && mask[i - 1] && depth[i - 1] < 0) { depth[i - 1] = nd; q[qt++] = i - 1; }
        if (x < w - 1 && mask[i + 1] && depth[i + 1] < 0) { depth[i + 1] = nd; q[qt++] = i + 1; }
        if (y > 0 && mask[i - w] && depth[i - w] < 0) { depth[i - w] = nd; q[qt++] = i - w; }
        if (y < h - 1 && mask[i + w] && depth[i + w] < 0) { depth[i + w] = nd; q[qt++] = i + w; }
      }
      const order = new Int32Array(tc);
      {
        let maxD = 0;
        for (let i = 0; i < tc; i++) if (depth[tg[i]] > maxD) maxD = depth[tg[i]];
        const cnt = new Int32Array(maxD + 2);
        for (let i = 0; i < tc; i++) cnt[depth[tg[i]] + 1]++;
        for (let d2 = 1; d2 <= maxD + 1; d2++) cnt[d2] += cnt[d2 - 1];
        for (let i = 0; i < tc; i++) order[cnt[depth[tg[i]]]++] = i;
      }
      for (let k = 0; k < tc; k++) {
        const i = order[k];
        const ti = tg[i];
        const tx = ti % w, ty = (ti - tx) / w;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = ty + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = tx + dx;
            if (nx < 0 || nx >= w) continue;
            const j = od[ny * w + nx];
            if (j < 0 || offs[j] < 0) continue;
            const cand = offs[j] - dy * w - dx;
            const cx = cand % w;
            if (clear(cx, (cand - cx) / w)) consider(i, cand);
          }
        }
        for (let r2 = 0; r2 < 8; r2++) {
          consider(i, validList[(Math.random() * validCount) | 0]);
        }
        for (let r2 = 8; r2 >= 1; r2 >>= 1) {
          const cur = offs[i];
          if (cur < 0) break;
          const cx = cur % w, cy = (cur - cx) / w;
          const rx = cx + (((Math.random() * (2 * r2 + 1)) | 0) - r2);
          const ry = cy + (((Math.random() * (2 * r2 + 1)) | 0) - r2);
          if (clear(rx, ry)) consider(i, ry * w + rx);
        }
        if (offs[i] >= 0) {
          const di = ti * 4;
          const si = offs[i] * 4;
          est[di] = est[si];
          est[di + 1] = est[si + 1];
          est[di + 2] = est[si + 2];
        }
      }
    } else {
      // Init: adopt the coarser level's offset (doubled) AS-IS. The estimate
      // at this level is still smooth inside the hole, so score-competing the
      // inherited guess against random candidates here would reject real
      // structure in favor of flat content — the classic over-smooth trap.
      // Only targets with nothing to inherit fall back to best-of-random.
      for (let i = 0; i < tc; i++) {
        const ti = tg[i];
        const tx = ti % w, ty = (ti - tx) / w;
        if (prevOffsets && prevOrd) {
          const pi = prevOrd[(ty >> 1) * prevW + (tx >> 1)];
          if (pi >= 0 && prevOffsets[pi] >= 0) {
            const ps = prevOffsets[pi];
            const psx = ps % prevW, psy = (ps - psx) / prevW;
            const sx = tx + (psx - (tx >> 1)) * 2;
            const sy = ty + (psy - (ty >> 1)) * 2;
            if (clear(sx, sy)) offs[i] = sy * w + sx;
          }
        }
        if (offs[i] < 0) {
          for (let k = 0; k < 8; k++) {
            consider(i, validList[(Math.random() * validCount) | 0]);
          }
        }
      }
    }
    // Make the estimate real from those offsets, then score everything
    // against the rebuilt estimate so the sweeps start from honest costs.
    for (let i = 0; i < tc; i++) {
      if (offs[i] < 0) continue;
      const di = tg[i] * 4;
      const si = offs[i] * 4;
      est[di] = est[si];
      est[di + 1] = est[si + 1];
      est[di + 2] = est[si + 2];
    }
    rebuildGrad();
    for (let i = 0; i < tc; i++) {
      const s = offs[i];
      if (s < 0) continue;
      const ti = tg[i];
      const tx = ti % w, ty = (ti - tx) / w;
      const sx = s % w, sy = (s - sx) / w;
      const pen = ((sx - tx) * (sx - tx) + (sy - ty) * (sy - ty)) * distW;
      best[i] = patchDist(ti, s, Infinity) + pen;
    }

    const searchStart = isCoarsest ? Math.min(Math.max(w, h), 512) : 16;
    const iters = isCoarsest ? 8 : l === 0 && t > 600_000 ? 2 : 4;
    for (let iter = 0; iter < iters; iter++) {
      const rev = iter & 1;
      // Neighbors already visited this sweep sit at `step`; adopting their
      // offset shifted to stay parallel is what makes the copies coherent.
      const step = rev ? 1 : -1;
      for (let s = 0; s < tc; s++) {
        const i = rev ? tc - 1 - s : s;
        const ti = tg[i];
        const tx = ti % w;
        const nx = tx + step;
        if (nx >= 0 && nx < w) {
          const j = od[ti + step];
          if (j >= 0 && offs[j] >= 0) {
            const cand = offs[j] - step;
            if (clear(cand % w, (cand - (cand % w)) / w)) consider(i, cand);
          }
        }
        const ny = ti + step * w;
        if (ny >= 0 && ny < w * h) {
          const j = od[ny];
          if (j >= 0 && offs[j] >= 0) {
            const cand = offs[j] - step * w;
            if (cand >= 0 && cand < w * h && clear(cand % w, (cand - (cand % w)) / w)) {
              consider(i, cand);
            }
          }
        }
        for (let r = searchStart; r >= 1; r >>= 1) {
          const cur = offs[i];
          if (cur < 0) break;
          const cx = cur % w, cy = (cur - cx) / w;
          const rx = cx + (((Math.random() * (2 * r + 1)) | 0) - r);
          const ry = cy + (((Math.random() * (2 * r + 1)) | 0) - r);
          if (clear(rx, ry)) consider(i, ry * w + rx);
        }
      }
      for (let i = 0; i < tc; i++) {
        if (offs[i] < 0) continue;
        const di = tg[i] * 4;
        const si = offs[i] * 4;
        est[di] = est[si];
        est[di + 1] = est[si + 1];
        est[di + 2] = est[si + 2];
      }
      rebuildGrad();
    }

    if (l === 0) {
      // Coherence pass: a pixel whose offset disagrees with all its neighbors
      // is a one-pixel island copying from somewhere unrelated — even when its
      // own patch score is fine, islands read as kinks and torn structure in
      // patterned content. Adopt a neighbor's parallel-shifted offset whenever
      // its score is close, consolidating the field into larger rigid copies
      // that stay seamless inside.
      const dirs = [1, -1, w, -w];
      for (let pass = 0; pass < 2; pass++) {
        const rev = pass & 1;
        for (let s2 = 0; s2 < tc; s2++) {
          const i = rev ? tc - 1 - s2 : s2;
          const ti = tg[i];
          const cur = offs[i];
          if (cur < 0) continue;
          const tx = ti % w, ty = (ti - tx) / w;
          let agree = 0;
          const cands: number[] = [];
          for (const d of dirs) {
            const nx = tx + (d === 1 ? 1 : d === -1 ? -1 : 0);
            const ny = ty + (d === w ? 1 : d === -w ? -1 : 0);
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const j = od[ti + d];
            if (j < 0 || offs[j] < 0) continue;
            const cand = offs[j] - d;
            if (cand === cur) agree++;
            else if (cand >= 0 && cand < w * h) cands.push(cand);
          }
          if (agree >= 2 || cands.length === 0) continue;
          let bc = -1, bd = Infinity;
          for (const cand of cands) {
            const cx = cand % w;
            if (!clear(cx, (cand - cx) / w)) continue;
            const sx = cand % w, sy = (cand - sx) / w;
            const pen = ((sx - tx) * (sx - tx) + (sy - ty) * (sy - ty)) * distW;
            const d2 = patchDist(ti, cand, Infinity) + pen;
            if (d2 < bd) { bd = d2; bc = cand; }
          }
          if (bc >= 0 && bd <= best[i] * 1.25 + 300) {
            offs[i] = bc;
            best[i] = bd;
            const di = ti * 4;
            const si = bc * 4;
            est[di] = est[si];
            est[di + 1] = est[si + 1];
            est[di + 2] = est[si + 2];
          }
        }
      }
    }

    prevOffsets = offs;
    prevOrd = od;
    prevW = w;
    if (l === 0) {
      offsets = offs;
      ord = od;
    }
  }

  if (!offsets || !ord) {
    plan.offsetsFailed = true;
    return;
  }

  const srcCells = new Int32Array(t * 4);
  const srcWeights = new Float32Array(t * 4);
  for (let i = 0; i < t; i++) {
    const s = offsets[i];
    if (s < 0) continue;
    const sx = s % bw;
    bilinearSetup(sx, (s - sx) / bw, cs, cw, ch, srcCells, srcWeights, i * 4);
  }

  // A junction between two copies only needs blending when it actually looks
  // discontinuous: parallel offsets (≤2px drift) are seamless by definition,
  // and even unrelated offsets are fine when each side agrees with the other
  // side's natural continuation (typical on grain). Keeping the blur set
  // minimal is what keeps the fill as crisp as the untouched pixels.
  const seamFlag = new Uint8Array(bw * bh);
  let seamCount = 0;
  const flag = (idx: number): void => {
    if (!seamFlag[idx]) {
      seamFlag[idx] = 1;
      seamCount++;
    }
  };
  const misfit = (ai: number, bi: number): number => {
    const a = ai * 4;
    const b = bi * 4;
    return (
      Math.abs(est[a] - est[b]) +
      Math.abs(est[a + 1] - est[b + 1]) +
      Math.abs(est[a + 2] - est[b + 2])
    );
  };
  const SEAM_TOL = 60;
  for (let i = 0; i < t; i++) {
    const ti = targets[i];
    const s = offsets[i];
    if (s < 0) continue;
    const tx = ti % bw;
    const sx = s % bw, sy = (s - sx) / bw;
    if (tx < bw - 1) {
      const j = ord[ti + 1];
      if (j >= 0 && offsets[j] >= 0) {
        const s2 = offsets[j];
        const sx2 = s2 % bw, sy2 = (s2 - sx2) / bw;
        if (
          Math.abs(sx2 - sx - 1) + Math.abs(sy2 - sy) > 2 &&
          Math.min(misfit(ti + 1, s + 1), misfit(ti, s2 - 1)) > SEAM_TOL
        ) {
          flag(ti);
          flag(ti + 1);
        }
      }
    }
    if (ti + bw < bw * bh) {
      const j = ord[ti + bw];
      if (j >= 0 && offsets[j] >= 0) {
        const s2 = offsets[j];
        const sx2 = s2 % bw, sy2 = (s2 - sx2) / bw;
        if (
          Math.abs(sx2 - sx) + Math.abs(sy2 - sy - 1) > 2 &&
          Math.min(misfit(ti + bw, s + bw), misfit(ti, s2 - bw)) > SEAM_TOL
        ) {
          flag(ti);
          flag(ti + bw);
        }
      }
    }
  }
  const offsetSeam = new Int32Array(seamCount);
  for (let idx = 0, k = 0; idx < bw * bh; idx++) {
    if (seamFlag[idx]) offsetSeam[k++] = idx;
  }

  plan.offsets = offsets;
  plan.srcCells = srcCells;
  plan.srcW = srcWeights;
  plan.offsetSeam = offsetSeam;
  plan.ordMap = ord;

  // Valid source centers at full resolution, kept for per-frame re-checks.
  const satW = bw + 1;
  const sat = new Int32Array(satW * (bh + 1));
  for (let y = 0; y < bh; y++) {
    let run = 0;
    for (let x = 0; x < bw; x++) {
      run += boxMask[y * bw + x];
      sat[(y + 1) * satW + (x + 1)] = sat[y * satW + (x + 1)] + run;
    }
  }
  const clearMap = new Uint8Array(bw * bh);
  for (let y = R; y <= bh - 1 - R; y++) {
    for (let x = R; x <= bw - 1 - R; x++) {
      const x0 = x - R, y0 = y - R, x1 = x + R + 1, y1 = y + R + 1;
      if (sat[y1 * satW + x1] - sat[y0 * satW + x1] - sat[y1 * satW + x0] + sat[y0 * satW + x0] === 0) {
        clearMap[y * bw + x] = 1;
      }
    }
  }
  plan.clearMap = clearMap;
}

// Re-verify the fixed offsets against the CURRENT frame. When the scene has
// moved under the mask, some frame-1 sources now sit on the wrong content
// (e.g. an object edge slid over them) and would copy a visible smudge into
// the fill. Each such offset re-matches locally: its current patch cost is
// compared against propagated neighbor offsets and a short random search on
// this frame's pixels, switching only on a decisive improvement so stable
// copies never churn between frames.
function refinePatchOffsets(plan: InpaintPlan, px: Uint8ClampedArray): void {
  const { bw, bh, targets, boxMask, cs, cw, ch, bilinCells, bilinW, coarseVal } = plan;
  const offs = plan.offsets;
  const clearMap = plan.clearMap;
  const od = plan.ordMap;
  const srcCells = plan.srcCells;
  const srcW = plan.srcW;
  const base = plan.corrBase;
  if (!offs || !clearMap || !od || !srcCells || !srcW) return;
  const t = targets.length;
  const R = 3;
  const FILL_W = 0.35;
  if (!plan.refineBuf) plan.refineBuf = new Uint8ClampedArray(bw * bh * 4);
  const est = plan.refineBuf;
  est.set(px);
  for (let i = 0; i < t; i++) {
    const s = offs[i];
    if (s < 0) continue;
    const di = targets[i] * 4;
    const si = s * 4;
    est[di] = px[si];
    est[di + 1] = px[si + 1];
    est[di + 2] = px[si + 2];
  }

  const distW = 600 / (bw * bw + bh * bh);
  const patchDist = (ti: number, si: number, cutoff: number): number => {
    const tx = ti % bw, ty = (ti - tx) / bw;
    const sx = si % bw, sy = (si - sx) / bw;
    let sum = 0, wsum = 0;
    for (let dy = -R; dy <= R; dy++) {
      const tyy = ty + dy;
      if (tyy < 0 || tyy >= bh) continue;
      const tRow = tyy * bw + tx;
      const sRow = (sy + dy) * bw + sx;
      for (let dx = -R; dx <= R; dx++) {
        const txx = tx + dx;
        if (txx < 0 || txx >= bw) continue;
        const tp = tRow + dx;
        const sp = sRow + dx;
        const wgt = boxMask[tp] ? FILL_W : 1;
        const a = tp * 4;
        const b = sp * 4;
        const dr = est[a] - est[b];
        const dg = est[a + 1] - est[b + 1];
        const db = est[a + 2] - est[b + 2];
        sum += wgt * (dr * dr + dg * dg + db * db);
        wsum += wgt;
      }
      if (sum >= cutoff) return Infinity;
    }
    return wsum > 0 ? (sum * 49) / wsum : Infinity;
  };

  const cur = new Float32Array(t).fill(Infinity);
  for (let i = 0; i < t; i++) {
    const s = offs[i];
    if (s < 0) continue;
    const ti = targets[i];
    const tx = ti % bw, ty = (ti - tx) / bw;
    const sx = s % bw, sy = (s - sx) / bw;
    cur[i] = patchDist(ti, s, Infinity) + ((sx - tx) * (sx - tx) + (sy - ty) * (sy - ty)) * distW;
  }

  const adopt = (i: number, cand: number, d: number): void => {
    offs[i] = cand;
    cur[i] = d;
    const ti = targets[i];
    const di = ti * 4;
    const si = cand * 4;
    est[di] = px[si];
    est[di + 1] = px[si + 1];
    est[di + 2] = px[si + 2];
    const cx = cand % bw;
    bilinearSetup(cx, (cand - cx) / bw, cs, cw, ch, srcCells, srcW, i * 4);
    // Re-anchor the lighting baseline for the new source on this frame.
    if (base) {
      const o = i * 4;
      for (let c = 0; c < 3; c++) {
        const lowT =
          coarseVal[bilinCells[o] * 3 + c] * bilinW[o] +
          coarseVal[bilinCells[o + 1] * 3 + c] * bilinW[o + 1] +
          coarseVal[bilinCells[o + 2] * 3 + c] * bilinW[o + 2] +
          coarseVal[bilinCells[o + 3] * 3 + c] * bilinW[o + 3];
        const lowS =
          coarseVal[srcCells[o] * 3 + c] * srcW[o] +
          coarseVal[srcCells[o + 1] * 3 + c] * srcW[o + 1] +
          coarseVal[srcCells[o + 2] * 3 + c] * srcW[o + 2] +
          coarseVal[srcCells[o + 3] * 3 + c] * srcW[o + 3];
        base[i * 3 + c] = lowT - lowS;
      }
    }
  };

  // A broken copy must beat its current cost decisively before switching —
  // hysteresis that keeps the mapping temporally stable on intact areas.
  const ACCEPT = 0.7;
  for (let iter = 0; iter < 2; iter++) {
    const rev = iter & 1;
    const step = rev ? 1 : -1;
    for (let s2 = 0; s2 < t; s2++) {
      const i = rev ? t - 1 - s2 : s2;
      const ti = targets[i];
      const tx = ti % bw, ty = (ti - tx) / bw;
      const tryCand = (cand: number): void => {
        if (cand < 0 || cand >= bw * bh) return;
        if (!clearMap[cand] || cand === offs[i]) return;
        const cx = cand % bw, cy = (cand - cx) / bw;
        const pen = ((cx - tx) * (cx - tx) + (cy - ty) * (cy - ty)) * distW;
        const limit = cur[i] * ACCEPT;
        if (pen >= limit) return;
        const d = patchDist(ti, cand, limit - pen);
        if (d + pen < limit) adopt(i, cand, d + pen);
      };
      const nx = tx + step;
      if (nx >= 0 && nx < bw) {
        const j = od[ti + step];
        if (j >= 0 && offs[j] >= 0) tryCand(offs[j] - step);
      }
      const ny = ti + step * bw;
      if (ny >= 0 && ny < bw * bh) {
        const j = od[ny];
        if (j >= 0 && offs[j] >= 0) tryCand(offs[j] - step * bw);
      }
      for (let r = 6; r >= 1; r >>= 1) {
        const curOff = offs[i];
        if (curOff < 0) break;
        const cx2 = curOff % bw, cy2 = (curOff - cx2) / bw;
        const rx = cx2 + (((Math.random() * (2 * r + 1)) | 0) - r);
        const ry = cy2 + (((Math.random() * (2 * r + 1)) | 0) - r);
        if (rx >= 0 && rx < bw && ry >= 0 && ry < bh) tryCand(ry * bw + rx);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Semi-transparent watermark (ash overlay) removal
//
// "Ash-colored" watermarks are semi-transparent white/gray overlays. The
// original image content is preserved underneath — it's just blended with
// the watermark color. Inpainting replaces the content entirely (making it
// blurry and losing detail like hair), but reversing the blend recovers the
// original pixels. This function detects such overlays by comparing masked
// boundary pixels to their nearest unmasked neighbors, and if a systematic
// lightening (ash cast) is found, subtracts it from the entire mask region.
// ---------------------------------------------------------------------------
function removeAshWatermark(
  px: Uint8ClampedArray,
  targets: Int32Array,
  mirror: Int32Array,
  t: number,
): boolean {
  let sumDr = 0, sumDg = 0, sumDb = 0, n = 0;
  let posLum = 0;

  for (let i = 0; i < t; i++) {
    const m = mirror[i];
    if (m < 0) continue;
    const di = targets[i] * 4;
    const mi = m * 4;
    const dr = px[di] - px[mi];
    const dg = px[di + 1] - px[mi + 1];
    const db = px[di + 2] - px[mi + 2];
    sumDr += dr; sumDg += dg; sumDb += db;
    const lIn = px[di] * 0.299 + px[di + 1] * 0.587 + px[di + 2] * 0.114;
    const lOut = px[mi] * 0.299 + px[mi + 1] * 0.587 + px[mi + 2] * 0.114;
    if (lIn > lOut) posLum++;
    n++;
  }

  if (n < 20) return false;

  // Ash watermarks are light-colored — most masked pixels should be lighter
  const lightRatio = posLum / n;
  if (lightRatio < 0.55) return false;

  const avgDr = sumDr / n;
  const avgDg = sumDg / n;
  const avgDb = sumDb / n;
  const avgLumShift = avgDr * 0.299 + avgDg * 0.587 + avgDb * 0.114;

  if (avgLumShift < 3) return false;

  for (let i = 0; i < t; i++) {
    const di = targets[i] * 4;
    px[di] = clamp(px[di] - avgDr);
    px[di + 1] = clamp(px[di + 1] - avgDg);
    px[di + 2] = clamp(px[di + 2] - avgDb);
  }

  return true;
}

function applyInpaintPlan(ctx: Ctx2D, plan: InpaintPlan): void {
  const {
    bx, by, bw, bh,
    targets, boxMask,
    cs, cw, ch, coarseKnown, coarseIters,
    bilinCells, bilinW, mirror, mirrorCells, mirrorW, texScale,
    fineIterations, blurPixels, blurBlend, scratch, tScratch,
    coarseVal, coarseSum, coarseCnt,
  } = plan;
  const imageData = ctx.getImageData(bx, by, bw, bh);
  const px = imageData.data;
  const t = targets.length;

  // Stage 0: detect and remove semi-transparent "ash" watermark overlay.
  // This preserves the original pixels under light-colored watermarks,
  // keeping detail (hair, edges, texture) that inpainting would replace.
  removeAshWatermark(px, targets, mirror, t);

  // Stage 1: coarse color field. Average the unmasked pixels of each cell,
  // then diffuse into the masked cells.
  coarseSum.fill(0);
  coarseCnt.fill(0);
  for (let yy = 0; yy < bh; yy++) {
    const cy = (yy / cs) | 0;
    for (let xx = 0; xx < bw; xx++) {
      const i = yy * bw + xx;
      if (boxMask[i]) continue;
      const cell = cy * cw + ((xx / cs) | 0);
      const si = i * 4;
      coarseSum[cell * 3] += px[si];
      coarseSum[cell * 3 + 1] += px[si + 1];
      coarseSum[cell * 3 + 2] += px[si + 2];
      coarseCnt[cell]++;
    }
  }
  let mr = 0, mg = 0, mb2 = 0, mn = 0;
  for (let c = 0; c < cw * ch; c++) {
    if (coarseCnt[c] > 0) {
      coarseVal[c * 3] = coarseSum[c * 3] / coarseCnt[c];
      coarseVal[c * 3 + 1] = coarseSum[c * 3 + 1] / coarseCnt[c];
      coarseVal[c * 3 + 2] = coarseSum[c * 3 + 2] / coarseCnt[c];
      mr += coarseVal[c * 3];
      mg += coarseVal[c * 3 + 1];
      mb2 += coarseVal[c * 3 + 2];
      mn++;
    }
  }
  if (mn > 0) {
    mr /= mn; mg /= mn; mb2 /= mn;
  }
  for (let c = 0; c < cw * ch; c++) {
    if (!coarseKnown[c]) {
      coarseVal[c * 3] = mr;
      coarseVal[c * 3 + 1] = mg;
      coarseVal[c * 3 + 2] = mb2;
    }
  }
  // Gauss-Seidel relaxation, alternating sweep direction.
  for (let iter = 0; iter < coarseIters; iter++) {
    const rev = iter & 1;
    for (let s = 0; s < cw * ch; s++) {
      const c = rev ? cw * ch - 1 - s : s;
      if (coarseKnown[c]) continue;
      const x = c % cw;
      const y = (c - x) / cw;
      const l = (x > 0 ? c - 1 : c) * 3;
      const r = (x < cw - 1 ? c + 1 : c) * 3;
      const u = (y > 0 ? c - cw : c) * 3;
      const d = (y < ch - 1 ? c + cw : c) * 3;
      coarseVal[c * 3] = (coarseVal[l] + coarseVal[r] + coarseVal[u] + coarseVal[d]) * 0.25;
      coarseVal[c * 3 + 1] = (coarseVal[l + 1] + coarseVal[r + 1] + coarseVal[u + 1] + coarseVal[d + 1]) * 0.25;
      coarseVal[c * 3 + 2] = (coarseVal[l + 2] + coarseVal[r + 2] + coarseVal[u + 2] + coarseVal[d + 2]) * 0.25;
    }
  }

  // Stage 2: upsample the coarse field into the masked pixels.
  for (let i = 0; i < t; i++) {
    const o = i * 4;
    const c0 = bilinCells[o] * 3, c1 = bilinCells[o + 1] * 3, c2 = bilinCells[o + 2] * 3, c3 = bilinCells[o + 3] * 3;
    const w0 = bilinW[o], w1 = bilinW[o + 1], w2 = bilinW[o + 2], w3 = bilinW[o + 3];
    const di = targets[i] * 4;
    px[di] = coarseVal[c0] * w0 + coarseVal[c1] * w1 + coarseVal[c2] * w2 + coarseVal[c3] * w3;
    px[di + 1] = coarseVal[c0 + 1] * w0 + coarseVal[c1 + 1] * w1 + coarseVal[c2 + 1] * w2 + coarseVal[c3 + 1] * w3;
    px[di + 2] = coarseVal[c0 + 2] * w0 + coarseVal[c1 + 2] * w1 + coarseVal[c2 + 2] * w2 + coarseVal[c3 + 2] * w3;
  }

  // Stages 3+4 (fallback path): fine diffusion anchored to the boundary,
  // then mirrored texture. Runs once to build the matching estimate, and
  // stays the per-frame path only for masks with no usable source patches.
  const diffuseAndTexture = (): void => {
    for (let iter = 0; iter < fineIterations; iter++) {
      for (let i = 0; i < t; i++) {
        const idx = targets[i];
        const x = idx % bw;
        const y = (idx - x) / bw;
        const li = (x > 0 ? idx - 1 : idx) * 4;
        const ri = (x < bw - 1 ? idx + 1 : idx) * 4;
        const ui = (y > 0 ? idx - bw : idx) * 4;
        const di = (y < bh - 1 ? idx + bw : idx) * 4;
        tScratch[i * 3] = (px[li] + px[ri] + px[ui] + px[di]) * 0.25;
        tScratch[i * 3 + 1] = (px[li + 1] + px[ri + 1] + px[ui + 1] + px[di + 1]) * 0.25;
        tScratch[i * 3 + 2] = (px[li + 2] + px[ri + 2] + px[ui + 2] + px[di + 2]) * 0.25;
      }
      for (let i = 0; i < t; i++) {
        const di = targets[i] * 4;
        px[di] = tScratch[i * 3];
        px[di + 1] = tScratch[i * 3 + 1];
        px[di + 2] = tScratch[i * 3 + 2];
      }
    }

    for (let i = 0; i < t; i++) {
      const m = mirror[i];
      if (m < 0) continue;
      let strength = TEXTURE_STRENGTH * texScale[i];
      if (strength < 0.04) continue;
      const o = i * 4;
      const c0 = mirrorCells[o] * 3, c1 = mirrorCells[o + 1] * 3, c2 = mirrorCells[o + 2] * 3, c3 = mirrorCells[o + 3] * 3;
      const w0 = mirrorW[o], w1 = mirrorW[o + 1], w2 = mirrorW[o + 2], w3 = mirrorW[o + 3];
      const si = m * 4;
      const di = targets[i] * 4;
      // Similarity guard: if the mirrored source sits in a differently colored
      // region than the fill (e.g. across an object edge), fade the transfer so
      // foreign content is never copied in.
      let regionDiff = 0;
      for (let c = 0; c < 3; c++) {
        const low = coarseVal[c0 + c] * w0 + coarseVal[c1 + c] * w1 + coarseVal[c2 + c] * w2 + coarseVal[c3 + c] * w3;
        const d = px[di + c] - low;
        regionDiff += d < 0 ? -d : d;
      }
      strength *= 1 / (1 + regionDiff / 60);
      for (let c = 0; c < 3; c++) {
        const low = coarseVal[c0 + c] * w0 + coarseVal[c1 + c] * w1 + coarseVal[c2 + c] * w2 + coarseVal[c3 + c] * w3;
        let res = (px[si + c] - low) * strength;
        if (res > TEXTURE_CLAMP) res = TEXTURE_CLAMP;
        else if (res < -TEXTURE_CLAMP) res = -TEXTURE_CLAMP;
        px[di + c] = clamp(px[di + c] + res);
      }
    }
  };

  // Motion watch: compare the real pixels hugging the mask against their
  // state when the offsets were last computed. Small drift = the scene moved
  // under the mask, so re-verify the copies on this frame; large drift = a
  // scene change, so rebuild the mapping from scratch. A static scene skips
  // both, keeping the fill bit-identical across frames.
  const rim = plan.rimIdx;
  const captureRim = (): void => {
    if (!plan.rimRef) plan.rimRef = new Float32Array(rim.length);
    for (let j = 0; j < rim.length; j++) {
      const si = rim[j] * 4;
      plan.rimRef[j] = px[si] * 0.299 + px[si + 1] * 0.587 + px[si + 2] * 0.114;
    }
  };
  if (plan.offsets && plan.rimRef && rim.length > 0) {
    let drift = 0;
    for (let j = 0; j < rim.length; j++) {
      const si = rim[j] * 4;
      const lum = px[si] * 0.299 + px[si + 1] * 0.587 + px[si + 2] * 0.114;
      const d = lum - plan.rimRef[j];
      drift += d < 0 ? -d : d;
    }
    drift /= rim.length;
    if (drift > 26) {
      plan.offsets = null;
      plan.corrBase = null;
    } else if (drift > 3) {
      refinePatchOffsets(plan, px);
      captureRim();
    }
  }

  if (!plan.offsets && !plan.offsetsFailed) {
    // First frame (or a scene change): build the diffusion estimate, then
    // match every masked pixel to a real patch of surrounding content.
    diffuseAndTexture();
    computePatchOffsets(plan, px);
    if (plan.offsets) captureRim();
  } else if (!plan.offsets) {
    diffuseAndTexture();
  }

  if (plan.offsets) {
    // Patch path: copy real pixels from the matched sources. The coarse
    // field, recomputed each frame, aligns the copy's low frequency with the
    // target's surroundings so lighting gradients stay continuous — genuine
    // texture, nothing airbrushed.
    const offs = plan.offsets;
    const sCells = plan.srcCells!;
    const sWgt = plan.srcW!;
    let base = plan.corrBase;
    const isFirstFrame = !base;
    if (!base) {
      base = new Float32Array(t * 3);
      plan.corrBase = base;
    }
    for (let i = 0; i < t; i++) {
      const s = offs[i];
      if (s < 0) continue;
      const o = i * 4;
      const si = s * 4;
      const di = targets[i] * 4;
      const b0 = bilinCells[o] * 3, b1 = bilinCells[o + 1] * 3, b2 = bilinCells[o + 2] * 3, b3 = bilinCells[o + 3] * 3;
      const v0 = bilinW[o], v1 = bilinW[o + 1], v2 = bilinW[o + 2], v3 = bilinW[o + 3];
      const c0 = sCells[o] * 3, c1 = sCells[o + 1] * 3, c2 = sCells[o + 2] * 3, c3 = sCells[o + 3] * 3;
      const u0 = sWgt[o], u1 = sWgt[o + 1], u2 = sWgt[o + 2], u3 = sWgt[o + 3];
      for (let c = 0; c < 3; c++) {
        const lowT = coarseVal[b0 + c] * v0 + coarseVal[b1 + c] * v1 + coarseVal[b2 + c] * v2 + coarseVal[b3 + c] * v3;
        const lowS = coarseVal[c0 + c] * u0 + coarseVal[c1 + c] * u1 + coarseVal[c2 + c] * u2 + coarseVal[c3 + c] * u3;
        const delta = lowT - lowS;
        if (isFirstFrame) base[i * 3 + c] = delta;
        // Only the change since the first frame is applied, attenuated and
        // capped: it follows genuine lighting drift across frames while the
        // matcher's frame-1 copies stay untouched.
        let corr = (delta - base[i * 3 + c]) * 0.6;
        if (corr > 32) corr = 32;
        else if (corr < -32) corr = -32;
        if (__inpaintDbg.noCorr) corr = 0;
        px[di + c] = clamp(px[si + c] + corr);
      }
    }

    // Soften junctions where neighboring copies came from unrelated places.
    const seams = plan.offsetSeam;
    if (seams && seams.length > 0 && !__inpaintDbg.noSeamBlur) {
      scratch.set(px);
      for (let j = 0; j < seams.length; j++) {
        const idx = seams[j];
        const x = idx % bw;
        const y = (idx - x) / bw;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        const y0 = y > 0 ? y - 1 : 0;
        const y1 = y < bh - 1 ? y + 1 : bh - 1;
        const x0 = x > 0 ? x - 1 : 0;
        const x1 = x < bw - 1 ? x + 1 : bw - 1;
        for (let ny = y0; ny <= y1; ny++) {
          for (let nx = x0; nx <= x1; nx++) {
            const si = (ny * bw + nx) * 4;
            r += scratch[si];
            g += scratch[si + 1];
            b += scratch[si + 2];
            n++;
          }
        }
        const di = idx * 4;
        px[di] = px[di] * 0.65 + (r / n) * 0.35;
        px[di + 1] = px[di + 1] * 0.65 + (g / n) * 0.35;
        px[di + 2] = px[di + 2] * 0.65 + (b / n) * 0.35;
      }
    }
  }

  // Stage 5: feathered blur along the seam.
  scratch.set(px);
  for (let j = __inpaintDbg.noEdgeBlur ? blurPixels.length : 0; j < blurPixels.length; j++) {
    const idx = blurPixels[j];
    const x = idx % bw;
    const y = (idx - x) / bw;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    const y0 = y - 2 < 0 ? 0 : y - 2;
    const y1 = y + 2 > bh - 1 ? bh - 1 : y + 2;
    const x0 = x - 2 < 0 ? 0 : x - 2;
    const x1 = x + 2 > bw - 1 ? bw - 1 : x + 2;
    for (let ny = y0; ny <= y1; ny++) {
      for (let nx = x0; nx <= x1; nx++) {
        const si = (ny * bw + nx) * 4;
        r += scratch[si];
        g += scratch[si + 1];
        b += scratch[si + 2];
        n++;
      }
    }
    const blend = blurBlend[j];
    const di = idx * 4;
    px[di] = px[di] * (1 - blend) + (r / n) * blend;
    px[di + 1] = px[di + 1] * (1 - blend) + (g / n) * blend;
    px[di + 2] = px[di + 2] * (1 - blend) + (b / n) * blend;
  }

  // Light sharpen pass on inpainted pixels to counteract blur. A 3×3
  // unsharp-mask lifts edges that the diffusion and seam blur softened.
  scratch.set(px);
  for (let j = 0; j < t; j++) {
    const idx = targets[j];
    const x = idx % bw;
    const y = (idx - x) / bw;
    if (x < 1 || x >= bw - 1 || y < 1 || y >= bh - 1) continue;
    for (let c = 0; c < 3; c++) {
      const center = scratch[idx * 4 + c];
      const sum =
        scratch[((y - 1) * bw + x) * 4 + c] +
        scratch[((y + 1) * bw + x) * 4 + c] +
        scratch[(y * bw + x - 1) * 4 + c] +
        scratch[(y * bw + x + 1) * 4 + c];
      const blurred = sum * 0.25;
      // 0.35 strength — subtle but enough to restore edge contrast
      const sharpened = center + 0.35 * (center - blurred);
      px[idx * 4 + c] = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened;
    }
  }

  ctx.putImageData(imageData, bx, by);
}

export async function removeWatermarkFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  maskDataUrl: string | null,
): Promise<HTMLCanvasElement> {
  if (!maskDataUrl) return sourceCanvas;
  const plan = await buildInpaintPlan(maskDataUrl, sourceCanvas.width, sourceCanvas.height);
  if (!plan) return sourceCanvas;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = sourceCanvas.width;
  outCanvas.height = sourceCanvas.height;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context not available");
  outCtx.drawImage(sourceCanvas, 0, 0);
  applyInpaintPlan(outCtx, plan);
  return outCanvas;
}

// Watermark mode: repair only the brushed region, leave everything else
// untouched (no enhancement, no rescaling).
export async function removeWatermarkFromImage(
  img: HTMLImageElement,
  maskDataUrl: string | null,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.drawImage(img, 0, 0);
  if (maskDataUrl) {
    const plan = await buildInpaintPlan(maskDataUrl, canvas.width, canvas.height);
    if (plan) applyInpaintPlan(ctx, plan);
  }
  return canvas;
}

export async function removeBackgroundFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  maskDataUrl: string | null,
): Promise<HTMLCanvasElement> {
  if (!maskDataUrl) return sourceCanvas;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context not available");
  outCtx.drawImage(sourceCanvas, 0, 0);
  const outData = outCtx.getImageData(0, 0, w, h);
  const pixels = outData.data;

  const maskImg = await loadMaskImage(maskDataUrl);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Canvas 2D context not available");
  maskCtx.imageSmoothingEnabled = true;
  maskCtx.drawImage(maskImg, 0, 0, w, h);
  const maskPixels = maskCtx.getImageData(0, 0, w, h).data;

  // Soft matte: fully brushed pixels go transparent, the brush's anti-aliased
  // edge gets a graded alpha so the cutout edge is feathered, not jagged.
  const SOLID = 130;
  const EDGE = 24;
  for (let i = 0; i < w * h; i++) {
    const a = maskPixels[i * 4 + 3];
    if (a <= EDGE) continue;
    const m = a >= SOLID ? 1 : (a - EDGE) / (SOLID - EDGE);
    pixels[i * 4 + 3] = Math.round(pixels[i * 4 + 3] * (1 - m));
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

export async function removeBackgroundFromImage(
  img: HTMLImageElement,
  maskDataUrl: string | null,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.drawImage(img, 0, 0);
  return removeBackgroundFromCanvas(canvas, maskDataUrl);
}

// Automatically remove the background from an image without a brush mask.
// Samples the dominant color at the image edges and removes matching pixels
// with a soft matte transition. Works best on images with uniform backgrounds.
export async function autoRemoveBackgroundFromImage(
  img: HTMLImageElement,
): Promise<HTMLCanvasElement> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  // ── Step 1: Sample a thick border strip ──
  // Using a thicker border (up to 5% of min dimension) avoids sampling the
  // subject when it extends to the image edge. We also skip the center 60%
  // region when building the background model so the subject's own colors
  // don't contaminate it.
  const borderW = Math.max(2, Math.floor(Math.min(w, h) * 0.04));
  const step = Math.max(1, Math.floor(Math.min(w, h) / 120));
  const centerCx = w >> 1, centerCy = h >> 1;
  const centerR = Math.min(w, h) * 0.25;

  const samples: number[][] = [];

  const addSample = (x: number, y: number) => {
    // Skip points inside the central region (likely subject).
    const dx = x - centerCx, dy = y - centerCy;
    if (dx * dx + dy * dy < centerR * centerR) return;
    const i = (y * w + x) * 4;
    samples.push([px[i], px[i + 1], px[i + 2]]);
  };

  // Top and bottom strips
  for (let x = 0; x < w; x += step) {
    for (let by = 0; by < borderW; by++) {
      addSample(x, by);
      addSample(x, h - 1 - by);
    }
  }
  // Left and right strips (avoid re-sampling corners)
  for (let y = borderW; y < h - borderW; y += step) {
    for (let bx = 0; bx < borderW; bx++) {
      addSample(bx, y);
      addSample(w - 1 - bx, y);
    }
  }

  if (samples.length < 10) {
    // Fallback: sample everywhere
    for (let y = 0; y < h; y += step * 2) {
      for (let x = 0; x < w; x += step * 2) {
        const i = (y * w + x) * 4;
        samples.push([px[i], px[i + 1], px[i + 2]]);
      }
    }
  }

  // ── Step 2: Find up to 3 dominant background color clusters ──
  // Quantise colours to 4-bit per channel (16³ = 4096 bins) and pick the
  // most frequent bins that are sufficiently far apart in colour space.
  const quant = (v: number) => Math.floor(v / 18);
  const hist = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (const [r, g, b] of samples) {
    const key = (quant(r) << 10) | (quant(g) << 5) | quant(b);
    const entry = hist.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    entry.count++;
    entry.r += r; entry.g += g; entry.b += b;
    hist.set(key, entry);
  }

  const avgClusters = [...hist.entries()]
    .map(([_, v]) => ({
      r: v.r / v.count, g: v.g / v.count, b: v.b / v.count,
      weight: v.count,
    }))
    .sort((a, b) => b.weight - a.weight);

  // Greedily pick top clusters that are at least 40 apart in colour space.
  const clusters: typeof avgClusters = [];
  for (const c of avgClusters) {
    let tooClose = false;
    for (const existing of clusters) {
      const d = Math.sqrt(
        (c.r - existing.r) ** 2 +
        (c.g - existing.g) ** 2 +
        (c.b - existing.b) ** 2,
      );
      if (d < 40) { tooClose = true; break; }
    }
    if (!tooClose) clusters.push(c);
    if (clusters.length >= 3) break;
  }

  if (clusters.length === 0) clusters.push(avgClusters[0] || { r: 255, g: 255, b: 255, weight: 1 });

  // ── Step 3: Per-cluster tolerance ──
  const bgModels = clusters.map((bg) => {
    let devR = 0, devG = 0, devB = 0, n = 0;
    for (const [r, g, b] of samples) {
      devR += Math.abs(r - bg.r);
      devG += Math.abs(g - bg.g);
      devB += Math.abs(b - bg.b);
      n++;
    }
    return {
      r: bg.r, g: bg.g, b: bg.b,
      tolR: Math.max(28, Math.min(75, (devR / n) * 1.8)),
      tolG: Math.max(28, Math.min(75, (devG / n) * 1.8)),
      tolB: Math.max(28, Math.min(75, (devB / n) * 1.8)),
    };
  });

  // ── Step 4: Build soft alpha mask ──
  // For each pixel, find the closest-matching background cluster. If the
  // normalised distance is below 1.0 the pixel is progressively made
  // transparent; above 1.4 it stays fully opaque. The 0.4-wide ramp gives
  // a natural feather.
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = px[idx], g = px[idx + 1], b = px[idx + 2];

    let bestD = Infinity;
    for (const m of bgModels) {
      const dr = Math.abs(r - m.r) / m.tolR;
      const dg = Math.abs(g - m.g) / m.tolG;
      const db = Math.abs(b - m.b) / m.tolB;
      const d = Math.max(dr, dg, db);
      if (d < bestD) bestD = d;
    }

    if (bestD < 1.4) {
      mask[i] = bestD <= 1.0 ? 0 : Math.round(((bestD - 1.0) / 0.4) * 255);
    } else {
      mask[i] = 255;
    }
  }

  // ── Step 5: Feather the transition band ──
  // A wider neighbourhood (3×3 → 8 neighbours) on intermediate values
  // gives smoother edges without washing out solid areas.
  const featherPass = (passes: number): void => {
    const tmp = new Uint8Array(w * h);
    for (let p = 0; p < passes; p++) {
      tmp.set(mask);
      for (let y = 2; y < h - 2; y++) {
        for (let x = 2; x < w - 2; x++) {
          const i = y * w + x;
          const v = mask[i];
          if (v === 0 || v === 255) continue;
          let sum = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              sum += tmp[i + dy * w + dx];
              count++;
            }
          }
          mask[i] = (sum + (count >> 1)) / count;
        }
      }
    }
  };
  featherPass(3);

  // ── Step 6: Apply mask → alpha channel ──
  for (let i = 0; i < w * h; i++) {
    const a = mask[i];
    if (a < 255) {
      px[i * 4 + 3] = (px[i * 4 + 3] * a) >> 8;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function captureVideoFrame(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = videoUrl;
    const timer = setTimeout(() => reject(new Error("Video frame capture timeout")), 15000);
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to load video"));
    };
    video.onloadedmetadata = () => {
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          clearTimeout(timer);
          reject(new Error("Canvas 2D context not available"));
          return;
        }
        ctx.drawImage(video, 0, 0);
        clearTimeout(timer);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      video.currentTime = Math.min(0.05, video.duration || 0.05);
    };
  });
}

function buildEnhanceFilter(presetName: string, ctrl?: AdvancedControls): string {
  if (presetName === "none") return "none";
  const p = (PRESETS as Record<string, Preset>)[presetName] || PRESETS.standard;
  const controls = ctrl || { brightness: 0, contrast: 0, saturation: 0, sharpness: 0 };
  const b = 1 + (p.brightness + controls.brightness) / 100;
  const c = 1 + (p.contrast + controls.contrast) / 100;
  const s = 1 + (p.saturation + controls.saturation) / 100;
  return `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)}) saturate(${s.toFixed(3)})`;
}

// ---------------------------------------------------------------------------
// Video processing
//
// Primary path: an offline WebCodecs pipeline (via mediabunny). Every frame is
// decoded, processed and re-encoded with its ORIGINAL timestamp, and the audio
// track is copied (or transcoded) losslessly with respect to timing. Output
// duration therefore always equals input duration and speech stays at normal
// speed, no matter how slow the machine is — a slower machine just takes
// longer, it never stretches the video.
//
// Fallback (browsers without WebCodecs): real-time canvas capture via
// MediaRecorder, kept at the source resolution so the machine can keep up.
// ---------------------------------------------------------------------------

export async function processVideo(
  videoFile: File,
  videoUrl: string,
  presetName: string,
  scale: string,
  ctrl?: AdvancedControls,
  onProgress?: (pct: number) => void,
  maskDataUrl?: string | null,
): Promise<Blob> {
  const hasWebCodecs =
    typeof window !== "undefined" &&
    "VideoEncoder" in window &&
    "VideoDecoder" in window;

  if (hasWebCodecs) {
    try {
      return await processVideoOffline(videoFile, presetName, scale, ctrl, onProgress, maskDataUrl);
    } catch (err) {
      console.warn("Offline video pipeline failed, using realtime fallback:", err);
    }
  }
  return processVideoRealtime(videoUrl, presetName, ctrl, onProgress, maskDataUrl);
}

async function processVideoOffline(
  videoFile: File,
  presetName: string,
  scale: string,
  ctrl?: AdvancedControls,
  onProgress?: (pct: number) => void,
  maskDataUrl?: string | null,
): Promise<Blob> {
  const mb = await import("mediabunny");

  const input = new mb.Input({
    source: new mb.BlobSource(videoFile),
    formats: mb.ALL_FORMATS,
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("The file has no video track");

  const srcW = videoTrack.displayWidth;
  const srcH = videoTrack.displayHeight;
  const scaleFactor = scale === "2x" ? 2 : scale === "4x" ? 4 : scale === "8k" ? 8 : 1;
  let w = Math.round(srcW * scaleFactor);
  let h = Math.round(srcH * scaleFactor);
  // Keep within what hardware H.264/VP9 encoders reliably accept.
  const MAX_DIM = 3840;
  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  if (w % 2) w--;
  if (h % 2) h--;

  // Cap the fine smoothing passes lower than for stills — it runs per frame.
  const plan = maskDataUrl ? await buildInpaintPlan(maskDataUrl, w, h, 120) : null;
  const filter = buildEnhanceFilter(presetName, ctrl);
  const resized = w !== srcW || h !== srcH;
  const needsCanvas = !!plan || filter !== "none";

  let ctx: OffscreenCanvasRenderingContext2D | null = null;
  let canvas: OffscreenCanvas | null = null;
  if (needsCanvas) {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext("2d", { willReadFrequently: !!plan });
    if (!ctx) throw new Error("Canvas 2D context not available");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  // Prefer MP4 (H.264 + AAC): plays everywhere, including Windows players.
  // Fall back to WebM when the browser can't encode an MP4-compatible codec.
  const mp4 = new mb.Mp4OutputFormat();
  const webm = new mb.WebMOutputFormat();
  let format: InstanceType<typeof mb.Mp4OutputFormat> | InstanceType<typeof mb.WebMOutputFormat> = mp4;
  let videoCodec = await mb.getFirstEncodableVideoCodec(
    mp4.getSupportedVideoCodecs(),
    { width: w, height: h },
  );
  if (!videoCodec) {
    format = webm;
    videoCodec = await mb.getFirstEncodableVideoCodec(
      webm.getSupportedVideoCodecs(),
      { width: w, height: h },
    );
  }
  if (!videoCodec) throw new Error("This browser has no supported video encoder");

  // Audio: copy the original track when the container supports its codec so
  // timing and quality are untouched; otherwise transcode it.
  const audioTrack = await input.getPrimaryAudioTrack();
  let audioOptions: Record<string, unknown> | undefined;
  if (audioTrack) {
    const inCodec = await audioTrack.getCodec();
    const supported = format.getSupportedAudioCodecs();
    if (!inCodec || !supported.includes(inCodec)) {
      const encodable = await mb.getFirstEncodableAudioCodec(supported, {
        numberOfChannels: audioTrack.numberOfChannels,
        sampleRate: audioTrack.sampleRate,
      });
      audioOptions = encodable
        ? { codec: encodable, bitrate: 192000 }
        : { discard: true };
    }
  }

  const target = new mb.BufferTarget();
  const output = new mb.Output({ format, target });

  const conversion = await mb.Conversion.init({
    input,
    output,
    video: {
      ...(resized ? { width: w, height: h, fit: "fill" as const } : {}),
      codec: videoCodec,
      bitrate: mb.QUALITY_HIGH,
      ...(needsCanvas
        ? {
            process: (sample: InstanceType<typeof mb.VideoSample>) => {
              const c = ctx!;
              if (filter !== "none") c.filter = filter;
              sample.draw(c, 0, 0, w, h);
              if (filter !== "none") c.filter = "none";
              if (plan) applyInpaintPlan(c, plan);
              return canvas!;
            },
            processedWidth: w,
            processedHeight: h,
          }
        : {}),
    },
    ...(audioOptions ? { audio: audioOptions } : {}),
  });

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks
      .map((d) => `${d.track.type}: ${d.reason}`)
      .join("; ");
    throw new Error(`Cannot convert this file (${reasons})`);
  }

  if (onProgress) {
    conversion.onProgress = (progress: number) => {
      onProgress(Math.min(99, Math.round(progress * 100)));
    };
  }

  await conversion.execute();

  const buffer = target.buffer;
  if (!buffer || !buffer.byteLength) throw new Error("Video encoding produced no data");
  if (onProgress) onProgress(100);

  const type = format === mp4 ? "video/mp4" : "video/webm";
  return new Blob([buffer], { type });
}

// Fallback for browsers without WebCodecs. Records in real time at the source
// resolution (so the machine keeps up and playback never stretches). Audio is
// routed through a muted WebAudio graph: captured in the recording without
// playing out loud.
async function processVideoRealtime(
  videoUrl: string,
  presetName: string,
  ctrl?: AdvancedControls,
  onProgress?: (pct: number) => void,
  maskDataUrl?: string | null,
): Promise<Blob> {
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Video load timeout")), 30000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to load video"));
    };
  });

  let w = video.videoWidth;
  let h = video.videoHeight;
  if (w % 2) w--;
  if (h % 2) h--;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: !!maskDataUrl });
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const plan = maskDataUrl ? await buildInpaintPlan(maskDataUrl, w, h, 60) : null;
  const filter = buildEnhanceFilter(presetName, ctrl);

  // Capture every drawn frame so the recording matches the source cadence.
  // The draw loop below only pushes frames when currentTime actually changes,
  // avoiding duplicate work and judder.
  const stream = canvas.captureStream(0);

  // Route the element's audio into the recording without playing it aloud
  // (the source node is connected to the recording destination only, never
  // to the speakers). WebAudio captures the decoded audio buffer regardless
  // of the mute flag, so muting the video later for autoplay won't silence
  // the recording track.
  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const sourceNode = audioCtx.createMediaElementSource(video);
    const destNode = audioCtx.createMediaStreamDestination();
    sourceNode.connect(destNode);
    const audioTrack = destNode.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
  } catch {
    audioCtx = null;
  }

  // Higher bitrate for better quality on the realtime path.
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  let mimeType = "";
  let recorderOptions: Record<string, unknown> = { videoBitsPerSecond: 8000000 };
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      mimeType = mt;
      recorderOptions = { mimeType: mt, videoBitsPerSecond: 8000000 };
      break;
    }
  }
  const recorder = new MediaRecorder(stream, recorderOptions);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const drawFrame = () => {
    if (filter !== "none") ctx.filter = filter;
    ctx.drawImage(video, 0, 0, w, h);
    if (filter !== "none") ctx.filter = "none";
    if (plan) applyInpaintPlan(ctx, plan);
    if (onProgress && isFinite(video.duration) && video.duration > 0) {
      onProgress(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
    }
  };

  // Warm the inpaint plan on the first frame before recording starts — the
  // one-time patch analysis would otherwise stall the realtime capture.
  if (plan) {
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      const timer = setTimeout(() => resolve(), 8000);
      video.addEventListener(
        "loadeddata",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    if (video.readyState >= 2) drawFrame();
  }

  recorder.start(1000);
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play();
  }

  // Track currentTime to skip duplicate frames and avoid judder.
  // requestAnimationFrame often fires faster than the video frame rate,
  // so drawing the same frame twice wastes CPU and can confuse the encoder.
  let rafId = 0;
  let lastFrameTime = -1;
  const frameLoop = () => {
    const ct = video.currentTime;
    if (ct !== lastFrameTime) {
      drawFrame();
      lastFrameTime = ct;
    }
    rafId = requestAnimationFrame(frameLoop);
  };
  rafId = requestAnimationFrame(frameLoop);

  await new Promise<void>((resolve) => {
    const finish = () => {
      clearInterval(guard);
      resolve();
    };
    const guard = setInterval(() => {
      if (video.ended) finish();
    }, 500);
    video.onended = finish;
  });

  cancelAnimationFrame(rafId);
  recorder.stop();
  await stopped;
  if (audioCtx) {
    audioCtx.close().catch(() => undefined);
  }
  if (onProgress) onProgress(100);

  const mimeBase = mimeType.startsWith("video/webm") ? "video/webm" : "video/mp4";
  const blob = new Blob(chunks, { type: mimeBase });
  if (!blob.size) throw new Error("Video encoding produced no data");
  return blob;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format?: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode the result — the image may be too large"));
      },
      format || "image/png",
      0.95,
    );
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function generateSampleImage(): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 0, 600);
    grad.addColorStop(0, "#4a6fa5");
    grad.addColorStop(0.5, "#7eb8da");
    grad.addColorStop(1, "#d4b896");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = "rgba(255, 220, 100, 0.8)";
    ctx.beginPath();
    ctx.arc(600, 200, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3a5a40";
    ctx.beginPath();
    ctx.moveTo(0, 450);
    ctx.lineTo(200, 300);
    ctx.lineTo(350, 380);
    ctx.lineTo(500, 280);
    ctx.lineTo(700, 360);
    ctx.lineTo(800, 320);
    ctx.lineTo(800, 600);
    ctx.lineTo(0, 600);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(100, 150, 200, 0.5)";
    ctx.fillRect(0, 480, 800, 120);

    ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
    ctx.font = "bold 40px Arial";
    ctx.fillText("SAMPLE", 280, 300);

    canvas.toBlob(
      (blob) => {
        resolve(new File([blob!], "sample-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.7,
    );
  });
}

// Exposed for automated end-to-end testing and for generating the marketing
// before/after assets with the real production algorithms.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__sharpixa = {
    __inpaintDbg,
    buildInpaintPlan,
    applyInpaintPlan,
    enhanceImage,
    removeWatermarkFromImage,
    removeWatermarkFromCanvas,
    removeBackgroundFromImage,
    removeBackgroundFromCanvas,
    processVideo,
    canvasToBlob,
  };
}
