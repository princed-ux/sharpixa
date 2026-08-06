import {
  PRESETS,
  type AdvancedControls,
  type PresetName,
} from "../lib/constants";
import { MAX_INPAINT_SELECTION_RATIO } from "../lib/processingLimits";

export type CheckCancelled = () => void;
export type YieldControl = () => Promise<void>;

export interface InpaintPlan {
  mask: Uint8Array;
  coverage: Uint8Array;
  order: Int32Array;
  orderLength: number;
  nearestSource: Int32Array;
  distance: Uint16Array;
  boundary: Int32Array;
  donorOffsets: Int32Array;
  preferredDonor: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface MaskAnalysis {
  selectedPixels: number;
  selectedRatio: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

const TILE_SIZE = 384;
const MASK_TILE_SIZE = 512;
const MASK_ALPHA_THRESHOLD = 24;
const MASK_DILATION = 3;
const MIN_CONTEXT_PADDING = 48;
const MAX_CONTEXT_PADDING = 192;
const MAX_BOUNDARY_SAMPLES = 4096;
const MAX_COVERAGE_SAMPLES = 2048;

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

function clamp(
  value: number,
  min = 0,
  max = 255,
): number {
  return value < min
    ? min
    : value > max
      ? max
      : value;
}

function inside(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return (
    x >= 0 &&
    x < width &&
    y >= 0 &&
    y < height
  );
}

export function createOffscreenCanvas(
  width: number,
  height: number,
): OffscreenCanvas {
  try {
    return new OffscreenCanvas(
      Math.max(
        1,
        Math.round(width),
      ),

      Math.max(
        1,
        Math.round(height),
      ),
    );
  } catch {
    throw new Error(
      "canvas-allocation-failed",
    );
  }
}

export function getOffscreenContext(
  canvas: OffscreenCanvas,
  willReadFrequently = false,
): OffscreenCanvasRenderingContext2D {
  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently,
      },
    );

  if (!context) {
    throw new Error(
      "canvas-context-unavailable",
    );
  }

  return context;
}

export function releaseCanvas(
  canvas: OffscreenCanvas | null,
): void {
  if (!canvas) {
    return;
  }

  canvas.width = 1;
  canvas.height = 1;
}

export function getEnhanceFilter(
  presetName:
    | PresetName
    | "none",

  controls: AdvancedControls,
): string {
  if (
    presetName ===
    "none"
  ) {
    return "none";
  }

  const preset =
    PRESETS[presetName];

  const brightness =
    1 +
    (
      preset.brightness +
      controls.brightness
    ) /
      100;

  const contrast =
    1 +
    (
      preset.contrast +
      controls.contrast
    ) /
      100;

  const saturation =
    1 +
    (
      preset.saturation +
      controls.saturation
    ) /
      100;

  return (
    `brightness(${brightness.toFixed(3)}) ` +
    `contrast(${contrast.toFixed(3)}) ` +
    `saturate(${saturation.toFixed(3)})`
  );
}

function adjustColors(
  pixels: Uint8ClampedArray,
  brightness: number,
  contrast: number,
  saturation: number,
): void {
  const brightnessFactor =
    1 +
    clamp(
      brightness,
      -80,
      80,
    ) /
      100;

  const safeContrast =
    clamp(
      contrast,
      -90,
      90,
    );

  const contrastFactor =
    (
      259 *
      (
        safeContrast +
        255
      )
    ) /
    (
      255 *
      (
        259 -
        safeContrast
      )
    );

  const saturationFactor =
    1 +
    clamp(
      saturation,
      -100,
      100,
    ) /
      100;

  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    let red =
      contrastFactor *
        (
          pixels[index] *
            brightnessFactor -
          128
        ) +
      128;

    let green =
      contrastFactor *
        (
          pixels[
            index + 1
          ] *
            brightnessFactor -
          128
        ) +
      128;

    let blue =
      contrastFactor *
        (
          pixels[
            index + 2
          ] *
            brightnessFactor -
          128
        ) +
      128;

    const gray =
      red * 0.2989 +
      green * 0.587 +
      blue * 0.114;

    red =
      gray +
      (
        red -
        gray
      ) *
        saturationFactor;

    green =
      gray +
      (
        green -
        gray
      ) *
        saturationFactor;

    blue =
      gray +
      (
        blue -
        gray
      ) *
        saturationFactor;

    pixels[index] =
      clamp(red);

    pixels[index + 1] =
      clamp(green);

    pixels[index + 2] =
      clamp(blue);
  }
}

function denoise(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  if (
    amount <= 0
  ) {
    return source;
  }

  const output =
    new Uint8ClampedArray(
      source.length,
    );

  const sigma =
    10 +
    amount * 24;

  const inverseVariance =
    -1 /
    (
      2 *
      sigma *
      sigma
    );

  const lookup =
    new Float32Array(
      256,
    );

  for (
    let difference = 0;
    difference < 256;
    difference++
  ) {
    lookup[difference] =
      Math.exp(
        difference *
          difference *
          inverseVariance,
      );
  }

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      const pixel =
        y *
          width +
        x;

      const index =
        pixel * 4;

      const centerLuma =
        (
          source[index] *
            77 +
          source[
            index + 1
          ] *
            150 +
          source[
            index + 2
          ] *
            29
        ) >>
        8;

      let red = 0;
      let green = 0;
      let blue = 0;
      let totalWeight = 0;

      for (
        let offsetY = -1;
        offsetY <= 1;
        offsetY++
      ) {
        const sampleY =
          clamp(
            y + offsetY,
            0,
            height - 1,
          );

        for (
          let offsetX = -1;
          offsetX <= 1;
          offsetX++
        ) {
          const sampleX =
            clamp(
              x + offsetX,
              0,
              width - 1,
            );

          const sampleIndex =
            (
              sampleY *
                width +
              sampleX
            ) *
            4;

          const sampleLuma =
            (
              source[
                sampleIndex
              ] *
                77 +
              source[
                sampleIndex +
                  1
              ] *
                150 +
              source[
                sampleIndex +
                  2
              ] *
                29
            ) >>
            8;

          const weight =
            lookup[
              Math.abs(
                sampleLuma -
                  centerLuma,
              )
            ] *
            (
              offsetX === 0 &&
              offsetY === 0
                ? 1.4
                : 1
            );

          red +=
            source[
              sampleIndex
            ] *
            weight;

          green +=
            source[
              sampleIndex +
                1
            ] *
            weight;

          blue +=
            source[
              sampleIndex +
                2
            ] *
            weight;

          totalWeight +=
            weight;
        }
      }

      output[index] =
        clamp(
          source[index] *
            (
              1 -
              amount
            ) +
            (
              red /
              totalWeight
            ) *
              amount,
        );

      output[
        index + 1
      ] = clamp(
        source[
          index + 1
        ] *
          (
            1 -
            amount
          ) +
          (
            green /
            totalWeight
          ) *
            amount,
      );

      output[
        index + 2
      ] = clamp(
        source[
          index + 2
        ] *
          (
            1 -
            amount
          ) +
          (
            blue /
            totalWeight
          ) *
            amount,
      );

      output[
        index + 3
      ] =
        source[
          index + 3
        ];
    }
  }

  return output;
}

export async function processEnhancementTiles(
  options: {
    source:
      OffscreenCanvasRenderingContext2D;

    output:
      OffscreenCanvasRenderingContext2D;

    width: number;
    height: number;
    presetName: PresetName;
    controls: AdvancedControls;
    checkCancelled: CheckCancelled;
    yieldControl: YieldControl;

    onProgress?: (
      ratio: number,
    ) => void;
  },
): Promise<void> {
  const preset =
    PRESETS[
      options.presetName
    ];

  const userSharpness =
    clamp(
      options.controls
        .sharpness,
      0,
      100,
    ) /
    100;

  const denoiseAmount =
    clamp(
      preset.denoise *
        0.9,
      0,
      0.9,
    );

  const detail =
    clamp(
      preset.sharpness *
        2.2 +
        userSharpness *
          2.35,
      0,
      3,
    );

  const haloLimit =
    18 +
    userSharpness *
      24;

  const totalTiles =
    Math.ceil(
      options.width /
        TILE_SIZE,
    ) *
    Math.ceil(
      options.height /
        TILE_SIZE,
    );

  let completed = 0;

  for (
    let tileY = 0;
    tileY < options.height;
    tileY += TILE_SIZE
  ) {
    for (
      let tileX = 0;
      tileX < options.width;
      tileX += TILE_SIZE
    ) {
      options.checkCancelled();

      const tileWidth =
        Math.min(
          TILE_SIZE,
          options.width -
            tileX,
        );

      const tileHeight =
        Math.min(
          TILE_SIZE,
          options.height -
            tileY,
        );

      const sourceX =
        Math.max(
          0,
          tileX - 2,
        );

      const sourceY =
        Math.max(
          0,
          tileY - 2,
        );

      const sourceEndX =
        Math.min(
          options.width,
          tileX +
            tileWidth +
            2,
        );

      const sourceEndY =
        Math.min(
          options.height,
          tileY +
            tileHeight +
            2,
        );

      const sourceWidth =
        sourceEndX -
        sourceX;

      const sourceHeight =
        sourceEndY -
        sourceY;

      const imageData =
        options.source.getImageData(
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
        );

      adjustColors(
        imageData.data,

        preset.brightness +
          options.controls
            .brightness,

        preset.contrast +
          options.controls
            .contrast,

        preset.saturation +
          options.controls
            .saturation,
      );

      const cleaned =
        denoise(
          imageData.data,
          sourceWidth,
          sourceHeight,
          denoiseAmount,
        );

      const outputData =
        new ImageData(
          tileWidth,
          tileHeight,
        );

      for (
        let y = 0;
        y < tileHeight;
        y++
      ) {
        const localY =
          tileY +
          y -
          sourceY;

        for (
          let x = 0;
          x < tileWidth;
          x++
        ) {
          const localX =
            tileX +
            x -
            sourceX;

          const sourceIndex =
            (
              localY *
                sourceWidth +
              localX
            ) *
            4;

          const outputIndex =
            (
              y *
                tileWidth +
              x
            ) *
            4;

          for (
            let channel = 0;
            channel < 3;
            channel++
          ) {
            let blurred = 0;

            for (
              let offsetY = -1;
              offsetY <= 1;
              offsetY++
            ) {
              const sampleY =
                clamp(
                  localY +
                    offsetY,
                  0,
                  sourceHeight -
                    1,
                );

              for (
                let offsetX = -1;
                offsetX <= 1;
                offsetX++
              ) {
                const sampleX =
                  clamp(
                    localX +
                      offsetX,
                    0,
                    sourceWidth -
                      1,
                  );

                blurred +=
                  cleaned[
                    (
                      sampleY *
                        sourceWidth +
                      sampleX
                    ) *
                      4 +
                      channel
                  ];
              }
            }

            blurred /= 9;

            const center =
              cleaned[
                sourceIndex +
                  channel
              ];

            const edge =
              clamp(
                (
                  center -
                  blurred
                ) *
                  detail,
                -haloLimit,
                haloLimit,
              );

            outputData.data[
              outputIndex +
                channel
            ] =
              clamp(
                center +
                  edge,
              );
          }

          outputData.data[
            outputIndex +
              3
          ] =
            cleaned[
              sourceIndex +
                3
            ];
        }
      }

      options.output.putImageData(
        outputData,
        tileX,
        tileY,
      );

      completed++;

      options.onProgress?.(
        completed /
          totalTiles,
      );

      await options.yieldControl();
    }
  }
}

function createMaskTile(): {
  canvas: OffscreenCanvas;
  context:
    OffscreenCanvasRenderingContext2D;
} {
  const canvas =
    createOffscreenCanvas(
      MASK_TILE_SIZE,
      MASK_TILE_SIZE,
    );

  const context =
    getOffscreenContext(
      canvas,
      true,
    );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  return {
    canvas,
    context,
  };
}

function renderMaskTile(
  mask: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  canvas: OffscreenCanvas,
  context:
    OffscreenCanvasRenderingContext2D,
): ImageData {
  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  context.drawImage(
    mask,

    (
      x /
      targetWidth
    ) *
      mask.width,

    (
      y /
      targetHeight
    ) *
      mask.height,

    (
      width /
      targetWidth
    ) *
      mask.width,

    (
      height /
      targetHeight
    ) *
      mask.height,

    0,
    0,
    width,
    height,
  );

  return context.getImageData(
    0,
    0,
    width,
    height,
  );
}

export async function applyTransparencyMask(
  options: {
    context:
      OffscreenCanvasRenderingContext2D;

    mask: ImageBitmap;
    width: number;
    height: number;
    checkCancelled: CheckCancelled;
    yieldControl: YieldControl;

    onProgress?: (
      ratio: number,
    ) => void;
  },
): Promise<void> {
  const tile =
    createMaskTile();

  const totalTiles =
    Math.ceil(
      options.width /
        MASK_TILE_SIZE,
    ) *
    Math.ceil(
      options.height /
        MASK_TILE_SIZE,
    );

  let completed = 0;

  try {
    for (
      let tileY = 0;
      tileY < options.height;
      tileY += MASK_TILE_SIZE
    ) {
      for (
        let tileX = 0;
        tileX < options.width;
        tileX += MASK_TILE_SIZE
      ) {
        options.checkCancelled();

        const width =
          Math.min(
            MASK_TILE_SIZE,
            options.width -
              tileX,
          );

        const height =
          Math.min(
            MASK_TILE_SIZE,
            options.height -
              tileY,
          );

        const imageData =
          options.context.getImageData(
            tileX,
            tileY,
            width,
            height,
          );

        const maskData =
          renderMaskTile(
            options.mask,
            options.width,
            options.height,
            tileX,
            tileY,
            width,
            height,
            tile.canvas,
            tile.context,
          );

        for (
          let pixel = 0;
          pixel <
          width * height;
          pixel++
        ) {
          if (
            maskData.data[
              pixel * 4 +
                3
            ] >
            MASK_ALPHA_THRESHOLD
          ) {
            imageData.data[
              pixel * 4 +
                3
            ] = 0;
          }
        }

        options.context.putImageData(
          imageData,
          tileX,
          tileY,
        );

        completed++;

        options.onProgress?.(
          completed /
            totalTiles,
        );

        await options.yieldControl();
      }
    }
  } finally {
    releaseCanvas(
      tile.canvas,
    );
  }
}

export async function analyzeMask(
  options: {
    mask: ImageBitmap;
    width: number;
    height: number;
    checkCancelled: CheckCancelled;
    yieldControl: YieldControl;

    onProgress?: (
      ratio: number,
    ) => void;
  },
): Promise<MaskAnalysis> {
  const tile =
    createMaskTile();

  const totalTiles =
    Math.ceil(
      options.width /
        MASK_TILE_SIZE,
    ) *
    Math.ceil(
      options.height /
        MASK_TILE_SIZE,
    );

  let completed = 0;
  let selectedPixels = 0;
  let minX = options.width;
  let minY = options.height;
  let maxX = -1;
  let maxY = -1;

  try {
    for (
      let tileY = 0;
      tileY < options.height;
      tileY += MASK_TILE_SIZE
    ) {
      for (
        let tileX = 0;
        tileX < options.width;
        tileX += MASK_TILE_SIZE
      ) {
        options.checkCancelled();

        const width =
          Math.min(
            MASK_TILE_SIZE,
            options.width -
              tileX,
          );

        const height =
          Math.min(
            MASK_TILE_SIZE,
            options.height -
              tileY,
          );

        const maskData =
          renderMaskTile(
            options.mask,
            options.width,
            options.height,
            tileX,
            tileY,
            width,
            height,
            tile.canvas,
            tile.context,
          );

        for (
          let y = 0;
          y < height;
          y++
        ) {
          for (
            let x = 0;
            x < width;
            x++
          ) {
            if (
              maskData.data[
                (
                  y *
                    width +
                  x
                ) *
                  4 +
                  3
              ] <=
              MASK_ALPHA_THRESHOLD
            ) {
              continue;
            }

            selectedPixels++;

            minX =
              Math.min(
                minX,
                tileX + x,
              );

            minY =
              Math.min(
                minY,
                tileY + y,
              );

            maxX =
              Math.max(
                maxX,
                tileX + x,
              );

            maxY =
              Math.max(
                maxY,
                tileY + y,
              );
          }
        }

        completed++;

        options.onProgress?.(
          completed /
            totalTiles,
        );

        await options.yieldControl();
      }
    }
  } finally {
    releaseCanvas(
      tile.canvas,
    );
  }

  return {
    selectedPixels,

    selectedRatio:
      selectedPixels /
      Math.max(
        1,
        options.width *
          options.height,
      ),

    bounds:
      maxX >= minX &&
      maxY >= minY
        ? {
            x: minX,
            y: minY,

            width:
              maxX -
              minX +
              1,

            height:
              maxY -
              minY +
              1,
          }
        : null,
  };
}

const INPAINT_BINARY_THRESHOLD = 4;
const INPAINT_DILATION = 1;
const INPAINT_RING_COVERAGE = 192;
const INPAINT_MIN_CONTEXT_PADDING = 48;
const INPAINT_MAX_CONTEXT_PADDING = 176;
const INPAINT_MAX_BOUNDARY_SAMPLES = 1024;
const INPAINT_MAX_DONOR_CANDIDATES = 128;
const INPAINT_MIN_PATCH_SELECTION_PIXELS = 24_000;
const INPAINT_MIN_PATCH_DEPTH = 10;
const INPAINT_MAX_ACCEPTABLE_DONOR_SCORE = 34;

const INPAINT_DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

function inpaintInside(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function regionForMask(
  bounds: NonNullable<MaskAnalysis["bounds"]>,
  targetWidth: number,
  targetHeight: number,
  maxRegionPixels: number,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let padding = clamp(
    Math.ceil(Math.max(bounds.width, bounds.height) * 1.4),
    INPAINT_MIN_CONTEXT_PADDING,
    INPAINT_MAX_CONTEXT_PADDING,
  );

  let x = 0;
  let y = 0;
  let endX = 0;
  let endY = 0;

  const update = () => {
    x = Math.max(0, bounds.x - padding);
    y = Math.max(0, bounds.y - padding);

    endX = Math.min(
      targetWidth,
      bounds.x + bounds.width + padding,
    );

    endY = Math.min(
      targetHeight,
      bounds.y + bounds.height + padding,
    );
  };

  update();

  while (
    (endX - x) * (endY - y) >
      maxRegionPixels &&
    padding > 8
  ) {
    padding = Math.max(
      8,
      Math.floor(padding * 0.8),
    );

    update();
  }

  const width = endX - x;
  const height = endY - y;

  if (
    width <= 0 ||
    height <= 0 ||
    width * height > maxRegionPixels
  ) {
    throw new Error("selection-too-large");
  }

  return {
    x,
    y,
    width,
    height,
  };
}

async function buildMaskData(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  checkCancelled: CheckCancelled,
  yieldControl: YieldControl,
): Promise<{
  mask: Uint8Array;
  coverage: Uint8Array;
}> {
  const total = width * height;
  let mask = new Uint8Array(total);
  const coverage = new Uint8Array(total);

  for (
    let pixel = 0;
    pixel < total;
    pixel++
  ) {
    const alpha =
      rgba[pixel * 4 + 3];

    if (
      alpha >
      INPAINT_BINARY_THRESHOLD
    ) {
      mask[pixel] = 1;

      // Every visible painted pixel is a full reconstruction target.
      // Alpha-weighted core coverage used to blend parts of translucent
      // watermarks back into the output and leave a visible halo.
      coverage[pixel] = 255;
    }

    if (
      pixel > 0 &&
      pixel % 250_000 === 0
    ) {
      await yieldControl();
      checkCancelled();
    }
  }

  for (
    let pass = 0;
    pass < INPAINT_DILATION;
    pass++
  ) {
    checkCancelled();

    const next =
      new Uint8Array(mask);

    const ringCoverage =
      INPAINT_RING_COVERAGE;

    for (
      let y = 0;
      y < height;
      y++
    ) {
      for (
        let x = 0;
        x < width;
        x++
      ) {
        const pixel =
          y * width + x;

        if (!mask[pixel]) {
          continue;
        }

        for (
          let offsetY = -1;
          offsetY <= 1;
          offsetY++
        ) {
          const nextY =
            y + offsetY;

          if (
            nextY < 0 ||
            nextY >= height
          ) {
            continue;
          }

          for (
            let offsetX = -1;
            offsetX <= 1;
            offsetX++
          ) {
            const nextX =
              x + offsetX;

            if (
              nextX < 0 ||
              nextX >= width
            ) {
              continue;
            }

            const nextPixel =
              nextY * width +
              nextX;

            if (
              !mask[nextPixel]
            ) {
              next[nextPixel] = 1;

              coverage[nextPixel] =
                Math.max(
                  coverage[nextPixel],
                  ringCoverage,
                );
            }
          }
        }
      }

      if (
        y > 0 &&
        y % 128 === 0
      ) {
        await yieldControl();
        checkCancelled();
      }
    }

    mask = next;
  }

  return {
    mask,
    coverage,
  };
}

function maskBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      if (
        !mask[
          y * width + x
        ]
      ) {
        continue;
      }

      minX = Math.min(
        minX,
        x,
      );

      minY = Math.min(
        minY,
        y,
      );

      maxX = Math.max(
        maxX,
        x,
      );

      maxY = Math.max(
        maxY,
        y,
      );
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

function integralMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Int32Array {
  const stride =
    width + 1;

  const integral =
    new Int32Array(
      stride *
        (height + 1),
    );

  for (
    let y = 1;
    y <= height;
    y++
  ) {
    let row = 0;

    for (
      let x = 1;
      x <= width;
      x++
    ) {
      row +=
        mask[
          (y - 1) *
            width +
            x -
            1
        ];

      integral[
        y * stride + x
      ] =
        integral[
          (y - 1) *
            stride +
            x
        ] + row;
    }
  }

  return integral;
}

function rectangleSum(
  integral: Int32Array,
  width: number,
  x: number,
  y: number,
  rectangleWidth: number,
  rectangleHeight: number,
): number {
  const stride =
    width + 1;

  const x2 =
    x + rectangleWidth;

  const y2 =
    y + rectangleHeight;

  return (
    integral[
      y2 * stride + x2
    ] -
    integral[
      y * stride + x2
    ] -
    integral[
      y2 * stride + x
    ] +
    integral[
      y * stride + x
    ]
  );
}

function donorOffsets(
  mask: Uint8Array,
  width: number,
  height: number,
): Int32Array {
  const bounds =
    maskBounds(
      mask,
      width,
      height,
    );

  if (
    bounds.maxX <
      bounds.minX ||
    bounds.maxY <
      bounds.minY
  ) {
    return new Int32Array();
  }

  const boxWidth =
    bounds.maxX -
    bounds.minX +
    1;

  const boxHeight =
    bounds.maxY -
    bounds.minY +
    1;

  const maxX =
    width - boxWidth;

  const maxY =
    height - boxHeight;

  const integral =
    integralMask(
      mask,
      width,
      height,
    );

  const step =
    Math.max(
      2,

      Math.round(
        Math.min(
          boxWidth,
          boxHeight,
        ) / 5,
      ),
    );

  const xPositions =
    new Set<number>([
      0,
      maxX,
    ]);

  const yPositions =
    new Set<number>([
      0,
      maxY,
    ]);

  for (
    let x = 0;
    x <= maxX;
    x += step
  ) {
    xPositions.add(x);
  }

  for (
    let y = 0;
    y <= maxY;
    y += step
  ) {
    yPositions.add(y);
  }

  const candidates: Array<{
    dx: number;
    dy: number;
    distance: number;
  }> = [];

  for (
    const candidateY of
    yPositions
  ) {
    for (
      const candidateX of
      xPositions
    ) {
      const dx =
        candidateX -
        bounds.minX;

      const dy =
        candidateY -
        bounds.minY;

      if (
        dx === 0 &&
        dy === 0
      ) {
        continue;
      }

      if (
        rectangleSum(
          integral,
          width,
          candidateX,
          candidateY,
          boxWidth,
          boxHeight,
        ) !== 0
      ) {
        continue;
      }

      candidates.push({
        dx,
        dy,

        distance:
          dx * dx +
          dy * dy,
      });
    }
  }

  candidates.sort(
    (
      left,
      right,
    ) =>
      left.distance -
      right.distance,
  );

  const result: number[] =
    [];

  const buckets =
    new Set<string>();

  for (
    const candidate of
    candidates
  ) {
    const length =
      Math.max(
        1,

        Math.hypot(
          candidate.dx,
          candidate.dy,
        ),
      );

    const directionX =
      Math.round(
        (
          candidate.dx /
          length
        ) * 6,
      );

    const directionY =
      Math.round(
        (
          candidate.dy /
          length
        ) * 6,
      );

    const distanceBucket =
      Math.floor(
        Math.sqrt(
          candidate.distance,
        ) /
          Math.max(
            4,

            Math.min(
              boxWidth,
              boxHeight,
            ),
          ),
      );

    const key =
      `${directionX}:${directionY}:${distanceBucket}`;

    if (
      buckets.has(key)
    ) {
      continue;
    }

    buckets.add(key);

    result.push(
      candidate.dx,
      candidate.dy,
    );

    if (
      result.length / 2 >=
      INPAINT_MAX_DONOR_CANDIDATES
    ) {
      break;
    }
  }

  return Int32Array.from(
    result,
  );
}

function boundarySamples(
  mask: Uint8Array,
  width: number,
  height: number,
): Int32Array {
  const samples: number[] =
    [];

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      const pixel =
        y * width + x;

      if (mask[pixel]) {
        continue;
      }

      let touches = false;

      for (
        const [
          offsetX,
          offsetY,
        ] of
        INPAINT_DIRECTIONS
      ) {
        const nextX =
          x + offsetX;

        const nextY =
          y + offsetY;

        if (
          inpaintInside(
            nextX,
            nextY,
            width,
            height,
          ) &&
          mask[
            nextY *
              width +
              nextX
          ]
        ) {
          touches = true;
          break;
        }
      }

      if (touches) {
        samples.push(pixel);
      }
    }
  }

  if (
    samples.length <=
    INPAINT_MAX_BOUNDARY_SAMPLES
  ) {
    return Int32Array.from(
      samples,
    );
  }

  const result =
    new Int32Array(
      INPAINT_MAX_BOUNDARY_SAMPLES,
    );

  const stride =
    samples.length /
    INPAINT_MAX_BOUNDARY_SAMPLES;

  for (
    let index = 0;
    index < result.length;
    index++
  ) {
    result[index] =
      samples[
        Math.floor(
          index * stride,
        )
      ];
  }

  return result;
}

async function buildTraversal(
  mask: Uint8Array,
  coverage: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  checkCancelled: CheckCancelled,
  yieldControl: YieldControl,
): Promise<InpaintPlan> {
  const total =
    width * height;

  const order =
    new Int32Array(total);

  const nearestSource =
    new Int32Array(total);

  const distance =
    new Uint16Array(total);

  const visited =
    new Uint8Array(total);

  nearestSource.fill(-1);

  let read = 0;
  let write = 0;

  for (
    let localY = 0;
    localY < height;
    localY++
  ) {
    for (
      let localX = 0;
      localX < width;
      localX++
    ) {
      const pixel =
        localY *
          width +
        localX;

      if (!mask[pixel]) {
        continue;
      }

      for (
        const [
          offsetX,
          offsetY,
        ] of
        INPAINT_DIRECTIONS
      ) {
        const nextX =
          localX +
          offsetX;

        const nextY =
          localY +
          offsetY;

        if (
          !inpaintInside(
            nextX,
            nextY,
            width,
            height,
          )
        ) {
          continue;
        }

        const neighbor =
          nextY *
            width +
          nextX;

        if (
          !mask[neighbor]
        ) {
          visited[pixel] = 1;

          nearestSource[pixel] =
            neighbor;

          distance[pixel] = 1;

          order[write++] =
            pixel;

          break;
        }
      }
    }

    if (
      localY > 0 &&
      localY % 128 === 0
    ) {
      await yieldControl();
      checkCancelled();
    }
  }

  while (
    read < write
  ) {
    const pixel =
      order[read++];

    const localX =
      pixel % width;

    const localY =
      (
        pixel -
        localX
      ) /
      width;

    for (
      const [
        offsetX,
        offsetY,
      ] of
      INPAINT_DIRECTIONS
    ) {
      const nextX =
        localX +
        offsetX;

      const nextY =
        localY +
        offsetY;

      if (
        !inpaintInside(
          nextX,
          nextY,
          width,
          height,
        )
      ) {
        continue;
      }

      const neighbor =
        nextY *
          width +
        nextX;

      if (
        !mask[neighbor] ||
        visited[neighbor]
      ) {
        continue;
      }

      visited[neighbor] = 1;

      nearestSource[neighbor] =
        nearestSource[pixel];

      distance[neighbor] =
        Math.min(
          65_535,

          distance[pixel] +
            1,
        );

      order[write++] =
        neighbor;
    }

    if (
      read > 0 &&
      read % 50_000 === 0
    ) {
      await yieldControl();
      checkCancelled();
    }
  }

  if (write === 0) {
    throw new Error(
      "selection-empty",
    );
  }

  return {
    mask,
    coverage,
    order,

    orderLength:
      write,

    nearestSource,
    distance,

    boundary:
      boundarySamples(
        mask,
        width,
        height,
      ),

    donorOffsets:
      donorOffsets(
        mask,
        width,
        height,
      ),

    preferredDonor:
      -1,

    width,
    height,
    x,
    y,
  };
}

export async function createInpaintPlan(
  options: {
    mask: ImageBitmap;
    targetWidth: number;
    targetHeight: number;
    analysis: MaskAnalysis;
    maxRegionPixels: number;
    checkCancelled: CheckCancelled;
    yieldControl: YieldControl;
  },
): Promise<InpaintPlan> {
  const bounds =
    options.analysis.bounds;

  if (
    !bounds ||
    options.analysis
      .selectedPixels === 0
  ) {
    throw new Error(
      "selection-empty",
    );
  }

  if (
    options.analysis
      .selectedRatio >
    MAX_INPAINT_SELECTION_RATIO
  ) {
    throw new Error(
      "selection-too-large",
    );
  }

  const region =
    regionForMask(
      bounds,

      options.targetWidth,
      options.targetHeight,
      options.maxRegionPixels,
    );

  const canvas =
    createOffscreenCanvas(
      region.width,
      region.height,
    );

  try {
    const context =
      getOffscreenContext(
        canvas,
        true,
      );

    context.imageSmoothingEnabled =
      true;

    context.imageSmoothingQuality =
      "high";

    context.drawImage(
      options.mask,

      (
        region.x /
        options.targetWidth
      ) *
        options.mask.width,

      (
        region.y /
        options.targetHeight
      ) *
        options.mask.height,

      (
        region.width /
        options.targetWidth
      ) *
        options.mask.width,

      (
        region.height /
        options.targetHeight
      ) *
        options.mask.height,

      0,
      0,
      region.width,
      region.height,
    );

    const rgba =
      context.getImageData(
        0,
        0,
        region.width,
        region.height,
      ).data;

    const maskData =
      await buildMaskData(
        rgba,
        region.width,
        region.height,
        options.checkCancelled,
        options.yieldControl,
      );

    return buildTraversal(
      maskData.mask,
      maskData.coverage,
      region.width,
      region.height,
      region.x,
      region.y,
      options.checkCancelled,
      options.yieldControl,
    );
  } finally {
    releaseCanvas(canvas);
  }
}

function donorPixel(
  pixel: number,
  dx: number,
  dy: number,
  width: number,
  height: number,
): number {
  const x =
    pixel % width;

  const y =
    (
      pixel -
      x
    ) /
    width;

  const donorX =
    x + dx;

  const donorY =
    y + dy;

  return inpaintInside(
    donorX,
    donorY,
    width,
    height,
  )
    ? donorY *
        width +
        donorX
    : -1;
}

function luma(
  pixels: Uint8ClampedArray,
  pixel: number,
): number {
  const index =
    pixel * 4;

  return (
    pixels[index] *
      0.299 +
    pixels[index + 1] *
      0.587 +
    pixels[index + 2] *
      0.114
  );
}

function gradient(
  pixels: Uint8ClampedArray,
  pixel: number,
  width: number,
  height: number,
): {
  x: number;
  y: number;
} {
  const x =
    pixel % width;

  const y =
    (
      pixel -
      x
    ) /
    width;

  const left =
    y * width +
    Math.max(
      0,
      x - 1,
    );

  const right =
    y * width +
    Math.min(
      width - 1,
      x + 1,
    );

  const up =
    Math.max(
      0,
      y - 1,
    ) *
      width +
    x;

  const down =
    Math.min(
      height - 1,
      y + 1,
    ) *
      width +
    x;

  return {
    x:
      luma(
        pixels,
        right,
      ) -
      luma(
        pixels,
        left,
      ),

    y:
      luma(
        pixels,
        down,
      ) -
      luma(
        pixels,
        up,
      ),
  };
}

interface DonorChoice {
  candidate: number;
  score: number;
  redCorrection: number;
  greenCorrection: number;
  blueCorrection: number;
}

function scoreDonor(
  pixels: Uint8ClampedArray,
  plan: InpaintPlan,
  candidate: number,
): DonorChoice | null {
  const dx =
    plan.donorOffsets[
      candidate * 2
    ];

  const dy =
    plan.donorOffsets[
      candidate * 2 + 1
    ];

  let difference = 0;
  let redCorrection = 0;
  let greenCorrection = 0;
  let blueCorrection = 0;
  let count = 0;

  for (
    let index = 0;
    index <
    plan.boundary.length;
    index++
  ) {
    const target =
      plan.boundary[index];

    const donor =
      donorPixel(
        target,
        dx,
        dy,
        plan.width,
        plan.height,
      );

    if (
      donor < 0 ||
      plan.mask[donor]
    ) {
      continue;
    }

    const targetIndex =
      target * 4;

    const donorIndex =
      donor * 4;

    const redDelta =
      pixels[targetIndex] -
      pixels[donorIndex];

    const greenDelta =
      pixels[
        targetIndex + 1
      ] -
      pixels[
        donorIndex + 1
      ];

    const blueDelta =
      pixels[
        targetIndex + 2
      ] -
      pixels[
        donorIndex + 2
      ];

    const targetGradient =
      gradient(
        pixels,
        target,
        plan.width,
        plan.height,
      );

    const donorGradient =
      gradient(
        pixels,
        donor,
        plan.width,
        plan.height,
      );

    difference +=
      Math.abs(redDelta) *
        0.2 +
      Math.abs(
        greenDelta,
      ) *
        0.42 +
      Math.abs(blueDelta) *
        0.2 +
      Math.abs(
        luma(
          pixels,
          target,
        ) -
          luma(
            pixels,
            donor,
          ),
      ) *
        0.35 +
      Math.abs(
        targetGradient.x -
          donorGradient.x,
      ) *
        0.22 +
      Math.abs(
        targetGradient.y -
          donorGradient.y,
      ) *
        0.22;

    redCorrection +=
      redDelta;

    greenCorrection +=
      greenDelta;

    blueCorrection +=
      blueDelta;

    count++;
  }

  if (
    count <
    Math.min(
      12,

      Math.max(
        4,

        plan.boundary
          .length / 4,
      ),
    )
  ) {
    return null;
  }

  return {
    candidate,

    score:
      difference / count +
      Math.hypot(
        dx,
        dy,
      ) *
        0.014,

    redCorrection:
      clamp(
        redCorrection /
          count,

        -28,
        28,
      ),

    greenCorrection:
      clamp(
        greenCorrection /
          count,

        -28,
        28,
      ),

    blueCorrection:
      clamp(
        blueCorrection /
          count,

        -28,
        28,
      ),
  };
}

function chooseDonor(
  pixels: Uint8ClampedArray,
  plan: InpaintPlan,
): DonorChoice | null {
  const count =
    plan.donorOffsets
      .length / 2;

  if (!count) {
    return null;
  }

  if (
    plan.preferredDonor >=
      0 &&
    plan.preferredDonor <
      count
  ) {
    const stable =
      scoreDonor(
        pixels,
        plan,
        plan.preferredDonor,
      );

    if (stable) {
      return stable;
    }
  }

  let best:
    | DonorChoice
    | null = null;

  for (
    let candidate = 0;
    candidate < count;
    candidate++
  ) {
    const scored =
      scoreDonor(
        pixels,
        plan,
        candidate,
      );

    if (
      scored &&
      (
        !best ||
        scored.score <
          best.score
      )
    ) {
      best = scored;
    }
  }

  if (!best) {
    return null;
  }

  plan.preferredDonor =
    best.candidate;

  return best;
}

/**
 * A single translated donor patch is useful for a genuinely large object on
 * repeatable texture, but it is the wrong tool for tiny logos and translucent
 * watermarks. On small or thin selections it can copy a dark nearby edge over
 * the whole mask, producing the obvious circular/rectangular blotch seen in
 * failed results. Those selections are reconstructed by directional boundary
 * interpolation instead.
 */
function shouldUsePatchDonor(
  plan: InpaintPlan,
  choice: DonorChoice,
): boolean {
  if (
    plan.orderLength <
    INPAINT_MIN_PATCH_SELECTION_PIXELS ||
    choice.score >
    INPAINT_MAX_ACCEPTABLE_DONOR_SCORE
  ) {
    return false;
  }

  let maximumDepth =
    0;

  for (
    let index = 0;
    index <
    plan.orderLength;
    index++
  ) {
    maximumDepth =
      Math.max(
        maximumDepth,
        plan.distance[
          plan.order[index]
        ],
      );

    if (
      maximumDepth >=
      INPAINT_MIN_PATCH_DEPTH
    ) {
      return true;
    }
  }

  return false;
}

function fillFromDonor(
  pixels: Uint8ClampedArray,
  original: Uint8ClampedArray,
  plan: InpaintPlan,
  choice: DonorChoice,
): Uint8Array {
  const completed =
    new Uint8Array(
      plan.width *
        plan.height,
    );

  const dx =
    plan.donorOffsets[
      choice.candidate * 2
    ];

  const dy =
    plan.donorOffsets[
      choice.candidate *
        2 +
        1
    ];

  for (
    let orderIndex = 0;
    orderIndex <
    plan.orderLength;
    orderIndex++
  ) {
    const target =
      plan.order[
        orderIndex
      ];

    const donor =
      donorPixel(
        target,
        dx,
        dy,
        plan.width,
        plan.height,
      );

    if (
      donor < 0 ||
      plan.mask[donor]
    ) {
      continue;
    }

    const targetIndex =
      target * 4;

    const donorIndex =
      donor * 4;

    const anchor =
      plan.nearestSource[
        target
      ];

    let redCorrection =
      choice.redCorrection;

    let greenCorrection =
      choice.greenCorrection;

    let blueCorrection =
      choice.blueCorrection;

    if (anchor >= 0) {
      const donorAnchor =
        donorPixel(
          anchor,
          dx,
          dy,
          plan.width,
          plan.height,
        );

      if (
        donorAnchor >= 0 &&
        !plan.mask[
          donorAnchor
        ]
      ) {
        const anchorIndex =
          anchor * 4;

        const donorAnchorIndex =
          donorAnchor * 4;

        redCorrection =
          choice.redCorrection *
            0.4 +
          clamp(
            original[
              anchorIndex
            ] -
              original[
                donorAnchorIndex
              ],

            -34,
            34,
          ) *
            0.6;

        greenCorrection =
          choice.greenCorrection *
            0.4 +
          clamp(
            original[
              anchorIndex + 1
            ] -
              original[
                donorAnchorIndex +
                  1
              ],

            -34,
            34,
          ) *
            0.6;

        blueCorrection =
          choice.blueCorrection *
            0.4 +
          clamp(
            original[
              anchorIndex + 2
            ] -
              original[
                donorAnchorIndex +
                  2
              ],

            -34,
            34,
          ) *
            0.6;
      }
    }

    pixels[targetIndex] =
      clamp(
        original[donorIndex] +
          redCorrection,
      );

    pixels[
      targetIndex + 1
    ] =
      clamp(
        original[
          donorIndex + 1
        ] +
          greenCorrection,
      );

    pixels[
      targetIndex + 2
    ] =
      clamp(
        original[
          donorIndex + 2
        ] +
          blueCorrection,
      );

    pixels[
      targetIndex + 3
    ] =
      original[
        donorIndex + 3
      ];

    completed[target] = 1;
  }

  return completed;
}

function directionalSource(
  targetX: number,
  targetY: number,
  directionX: number,
  directionY: number,
  plan: InpaintPlan,
  completed: Uint8Array,
): {
  pixel: number;
  distance: number;
} | null {
  const maximum =
    Math.min(
      64,

      Math.max(
        plan.width,
        plan.height,
      ),
    );

  for (
    let distance = 1;
    distance <= maximum;
    distance++
  ) {
    const x =
      targetX +
      directionX *
        distance;

    const y =
      targetY +
      directionY *
        distance;

    if (
      !inpaintInside(
        x,
        y,
        plan.width,
        plan.height,
      )
    ) {
      return null;
    }

    const pixel =
      y *
        plan.width +
      x;

    if (
      !plan.mask[pixel] ||
      completed[pixel]
    ) {
      return {
        pixel,
        distance,
      };
    }
  }

  return null;
}

function fallbackFill(
  pixels: Uint8ClampedArray,
  plan: InpaintPlan,
  completed: Uint8Array,
  target: number,
): void {
  const targetX =
    target % plan.width;

  const targetY =
    (
      target -
      targetX
    ) /
    plan.width;

  const referencePixels: number[] = [];

  for (
    const [
      offsetX,
      offsetY,
    ] of INPAINT_DIRECTIONS
  ) {
    const nextX =
      targetX + offsetX;

    const nextY =
      targetY + offsetY;

    if (
      !inpaintInside(
        nextX,
        nextY,
        plan.width,
        plan.height,
      )
    ) {
      continue;
    }

    const next =
      nextY * plan.width +
      nextX;

    if (
      !plan.mask[next] ||
      completed[next]
    ) {
      referencePixels.push(next);
    }
  }

  const nearest =
    plan.nearestSource[target];

  const anchor =
    nearest >= 0
      ? nearest
      : referencePixels[0] ?? -1;

  let bestSource = anchor;
  let bestScore =
    Number.POSITIVE_INFINITY;

  const anchorGradient =
    anchor >= 0
      ? gradient(
          pixels,
          anchor,
          plan.width,
          plan.height,
        )
      : { x: 0, y: 0 };

  const anchorLuma =
    anchor >= 0
      ? luma(pixels, anchor)
      : 0;

  for (
    const [
      directionX,
      directionY,
    ] of INPAINT_DIRECTIONS
  ) {
    const candidate =
      directionalSource(
        targetX,
        targetY,
        directionX,
        directionY,
        plan,
        completed,
      );

    if (!candidate) {
      continue;
    }

    const sourceIndex =
      candidate.pixel * 4;

    const sourceRed =
      pixels[sourceIndex];

    const sourceGreen =
      pixels[sourceIndex + 1];

    const sourceBlue =
      pixels[sourceIndex + 2];

    const sourceLuma =
      luma(
        pixels,
        candidate.pixel,
      );

    const sourceGradient =
      gradient(
        pixels,
        candidate.pixel,
        plan.width,
        plan.height,
      );

    let closestReferenceDifference =
      Number.POSITIVE_INFINITY;

    for (
      const reference of
      referencePixels
    ) {
      const referenceIndex =
        reference * 4;

      const colourDifference =
        (
          Math.abs(
            sourceRed -
            pixels[referenceIndex],
          ) +
          Math.abs(
            sourceGreen -
            pixels[referenceIndex + 1],
          ) +
          Math.abs(
            sourceBlue -
            pixels[referenceIndex + 2],
          )
        ) /
        3;

      const referenceDifference =
        colourDifference +
        Math.abs(
          sourceLuma -
          luma(pixels, reference),
        ) *
          0.55;

      closestReferenceDifference =
        Math.min(
          closestReferenceDifference,
          referenceDifference,
        );
    }

    if (
      !Number.isFinite(
        closestReferenceDifference,
      )
    ) {
      closestReferenceDifference = 0;
    }

    let anchorDifference = 0;

    if (anchor >= 0) {
      const anchorIndex =
        anchor * 4;

      anchorDifference =
        (
          Math.abs(
            sourceRed -
            pixels[anchorIndex],
          ) +
          Math.abs(
            sourceGreen -
            pixels[anchorIndex + 1],
          ) +
          Math.abs(
            sourceBlue -
            pixels[anchorIndex + 2],
          )
        ) /
          3 +
        Math.abs(
          sourceLuma -
          anchorLuma,
        ) *
          0.65;
    }

    const gradientDifference =
      Math.abs(
        sourceGradient.x -
        anchorGradient.x,
      ) +
      Math.abs(
        sourceGradient.y -
        anchorGradient.y,
      );

    /*
     * Follow the nearest structural side of the mask. Comparing each source to
     * the nearest boundary anchor and the closest coherent neighbour avoids the
     * old black-plus-background averaging that created a grey cloudy circle.
     */
    const score =
      anchorDifference * 0.62 +
      closestReferenceDifference * 0.28 +
      gradientDifference * 0.22 +
      candidate.distance * 1.15;

    if (score < bestScore) {
      bestScore = score;
      bestSource = candidate.pixel;
    }
  }

  const targetIndex =
    target * 4;

  if (bestSource >= 0) {
    const sourceIndex =
      bestSource * 4;

    pixels[targetIndex] =
      pixels[sourceIndex];

    pixels[targetIndex + 1] =
      pixels[sourceIndex + 1];

    pixels[targetIndex + 2] =
      pixels[sourceIndex + 2];

    pixels[targetIndex + 3] =
      pixels[sourceIndex + 3] >= 250
        ? 255
        : pixels[sourceIndex + 3];
  }

  completed[target] = 1;
}

function blendEdge(
  pixels: Uint8ClampedArray,
  original: Uint8ClampedArray,
  plan: InpaintPlan,
): void {
  for (
    let orderIndex = 0;
    orderIndex <
    plan.orderLength;
    orderIndex++
  ) {
    const target =
      plan.order[orderIndex];

    const coverage =
      plan.coverage[target];

    // Core pixels remain completely reconstructed. Never blur them and never
    // blend the original watermark back into the selected region.
    if (coverage >= 255) {
      continue;
    }

    const targetIndex =
      target * 4;

    const strength =
      coverage / 255;

    pixels[targetIndex] =
      clamp(
        original[targetIndex] *
          (1 - strength) +
          pixels[targetIndex] *
            strength,
      );

    pixels[targetIndex + 1] =
      clamp(
        original[targetIndex + 1] *
          (1 - strength) +
          pixels[targetIndex + 1] *
            strength,
      );

    pixels[targetIndex + 2] =
      clamp(
        original[targetIndex + 2] *
          (1 - strength) +
          pixels[targetIndex + 2] *
            strength,
      );

    const originalAlpha =
      original[targetIndex + 3];

    const rebuiltAlpha =
      pixels[targetIndex + 3];

    pixels[targetIndex + 3] =
      originalAlpha >= 250 &&
      rebuiltAlpha >= 250
        ? 255
        : clamp(
            originalAlpha *
              (1 - strength) +
              rebuiltAlpha *
                strength,
          );
  }
}

export async function applyInpaintPlan(
  options: {
    context: OffscreenCanvasRenderingContext2D;
    plan: InpaintPlan;
    checkCancelled: CheckCancelled;
    yieldControl?: YieldControl;
    onProgress?: (
      ratio: number,
    ) => void;
  },
): Promise<void> {
  options.checkCancelled();

  const imageData =
    options.context.getImageData(
      options.plan.x,
      options.plan.y,
      options.plan.width,
      options.plan.height,
    );

  const pixels =
    imageData.data;

  const original =
    new Uint8ClampedArray(
      pixels,
    );

  const donorCandidate =
    chooseDonor(
      original,
      options.plan,
    );

  const donor =
    donorCandidate &&
    shouldUsePatchDonor(
      options.plan,
      donorCandidate,
    )
      ? donorCandidate
      : null;

  const completed =
    donor
      ? fillFromDonor(
          pixels,
          original,
          options.plan,
          donor,
        )
      : new Uint8Array(
          options.plan.width *
            options.plan.height,
        );

  for (
    let orderIndex = 0;
    orderIndex <
    options.plan
      .orderLength;
    orderIndex++
  ) {
    const target =
      options.plan.order[
        orderIndex
      ];

    if (
      !completed[target]
    ) {
      fallbackFill(
        pixels,
        options.plan,
        completed,
        target,
      );
    }

    if (
      options.yieldControl &&
      orderIndex > 0 &&
      orderIndex %
        8_000 ===
        0
    ) {
      options.onProgress?.(
        orderIndex /
          Math.max(
            1,

            options.plan
              .orderLength,
          ),
      );

      await options.yieldControl();

      options.checkCancelled();
    }
  }

  blendEdge(
    pixels,
    original,
    options.plan,
  );

  options.checkCancelled();

  options.context.putImageData(
    imageData,
    options.plan.x,
    options.plan.y,
  );

  options.onProgress?.(1);
}