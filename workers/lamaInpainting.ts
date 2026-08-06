import type { InpaintPlan } from "./pixelProcessing";
import {
  createOffscreenCanvas,
  getOffscreenContext,
  releaseCanvas,
} from "./pixelProcessing";

const MODEL_SIZE = 512;
const EXPECTED_MODEL_BYTES = 92_600_000;
const MODEL_CACHE_NAME = "sharpixa-inpainting-models-v2";
const REMOTE_MODEL_URL =
  "https://huggingface.co/opencv/inpainting_lama/resolve/main/inpainting_lama_2025jan.onnx";

const MODEL_CACHE_KEY =
  REMOTE_MODEL_URL;

const MODEL_SOURCES = [
  REMOTE_MODEL_URL,
] as const;

type OrtModule = typeof import("onnxruntime-web");
type OrtSession = import("onnxruntime-web").InferenceSession;

interface LoadedSession {
  ort: OrtModule;
  session: OrtSession;
}

export interface LamaInpaintOptions {
  context: OffscreenCanvasRenderingContext2D;
  plan: InpaintPlan;
  checkCancelled: () => void;

  onResourceProgress?: (
    current: number,
    total: number,
  ) => void;

  onStageProgress?: (
    stage:
      | "loading-model"
      | "processing-tiles",

    ratio: number,
  ) => void;
}

let sessionPromise:
  | Promise<LoadedSession>
  | null = null;

function clampByte(
  value: number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return value < 0
    ? 0
    : value > 255
      ? 255
      : value;
}

function isHttpSuccess(
  response: Response,
): boolean {
  return (
    response.ok &&
    response.status >= 200 &&
    response.status < 300
  );
}

async function getModelCache(): Promise<
  Cache | null
> {
  if (
    typeof caches ===
    "undefined"
  ) {
    return null;
  }

  try {
    return await caches.open(
      MODEL_CACHE_NAME,
    );
  } catch {
    return null;
  }
}

async function readResponseBytes(
  response: Response,

  options: Pick<
    LamaInpaintOptions,
    | "checkCancelled"
    | "onResourceProgress"
  >,
): Promise<Uint8Array> {
  const headerTotal =
    Number(
      response.headers.get(
        "content-length",
      ),
    );

  const hasKnownTotal =
    Number.isFinite(
      headerTotal,
    ) &&
    headerTotal > 0;

  const total =
    hasKnownTotal
      ? headerTotal
      : EXPECTED_MODEL_BYTES;

  if (
    !response.body
  ) {
    const bytes =
      new Uint8Array(
        await response.arrayBuffer(),
      );

    options.checkCancelled();

    options.onResourceProgress?.(
      bytes.byteLength,

      Math.max(
        total,
        bytes.byteLength,
      ),
    );

    return bytes;
  }

  const reader =
    response.body.getReader();

  const preallocated =
    hasKnownTotal
      ? new Uint8Array(
          headerTotal,
        )
      : null;

  const chunks:
    Uint8Array[] = [];

  let received = 0;

  try {
    while (true) {
      options.checkCancelled();

      const result =
        await reader.read();

      if (
        result.done
      ) {
        break;
      }

      if (
        !result.value
          ?.byteLength
      ) {
        continue;
      }

      if (
        preallocated &&
        received +
          result.value.byteLength <=
          preallocated.byteLength
      ) {
        preallocated.set(
          result.value,
          received,
        );
      } else {
        chunks.push(
          result.value,
        );
      }

      received +=
        result.value.byteLength;

      options.onResourceProgress?.(
        received,

        Math.max(
          total,
          received,
        ),
      );
    }
  } finally {
    reader.releaseLock();
  }

  let bytes:
    Uint8Array;

  if (
    preallocated &&
    chunks.length === 0 &&
    received ===
      preallocated.byteLength
  ) {
    bytes =
      preallocated;
  } else {
    bytes =
      new Uint8Array(
        received,
      );

    let offset = 0;

    if (
      preallocated
    ) {
      const copied =
        Math.min(
          received,
          preallocated.byteLength,
        );

      bytes.set(
        preallocated.subarray(
          0,
          copied,
        ),

        0,
      );

      offset =
        copied;
    }

    for (
      const chunk of
      chunks
    ) {
      bytes.set(
        chunk,
        offset,
      );

      offset +=
        chunk.byteLength;
    }
  }

  options.onResourceProgress?.(
    received,

    Math.max(
      total,
      received,
    ),
  );

  return bytes;
}

async function loadModelBytes(
  options: Pick<
    LamaInpaintOptions,
    | "checkCancelled"
    | "onResourceProgress"
  >,
): Promise<Uint8Array> {
  const cache =
    await getModelCache();

  if (
    cache
  ) {
    try {
      const cached =
        await cache.match(
          MODEL_CACHE_KEY,
        );

      if (
        cached
      ) {
        return await readResponseBytes(
          cached,
          options,
        );
      }
    } catch {
      /*
       * A corrupt or unavailable browser cache
       * must not block a network retry.
       */
    }
  }

  let lastError:
    unknown = null;

  for (
    const source of
    MODEL_SOURCES
  ) {
    options.checkCancelled();

    try {
      const response =
  await fetch(
    source,

    {
      cache:
        "force-cache",

      credentials:
        "omit",

      mode:
        "cors",

      redirect:
        "follow",
    },
  );
      if (
        !isHttpSuccess(
          response,
        )
      ) {
        throw new Error(
          `model-http-${response.status}`,
        );
      }

      const cacheResponse =
        response.clone();

      const bytes =
        await readResponseBytes(
          response,
          options,
        );

      if (
        bytes.byteLength <
        1_000_000
      ) {
        throw new Error(
          "model-response-too-small",
        );
      }

      if (
        cache
      ) {
        void cache
          .put(
            MODEL_CACHE_KEY,
            cacheResponse,
          )
          .catch(
            () =>
              undefined,
          );
      }

      return bytes;
    } catch (
      error
    ) {
      lastError =
        error;
    }
  }

  throw lastError instanceof
    Error
    ? lastError
    : new Error(
        "inpainting-model-load-failed",
      );
}

async function createSession(
  options: Pick<
    LamaInpaintOptions,
    | "checkCancelled"
    | "onResourceProgress"
    | "onStageProgress"
  >,
): Promise<LoadedSession> {
  const ort =
    await import(
      "onnxruntime-web"
    );

  const hardwareConcurrency =
    typeof navigator ===
    "undefined"
      ? 2
      : navigator.hardwareConcurrency ||
        2;

  const canUseWasmThreads =
    typeof crossOriginIsolated !==
      "undefined" &&
    crossOriginIsolated;

  ort.env.wasm.numThreads =
    canUseWasmThreads
      ? Math.max(
          1,

          Math.min(
            4,
            hardwareConcurrency,
          ),
        )
      : 1;

  /*
   * Keep the image worker responsive while WASM inference runs.
   * Without the proxy worker, session.run() may block the worker
   * event loop long enough for the main-thread watchdog to end it.
   */
  ort.env.wasm.proxy =
    true;

  options.onStageProgress?.(
    "loading-model",
    0.04,
  );

  const modelBytes =
    await loadModelBytes(
      options,
    );

  options.checkCancelled();

  options.onStageProgress?.(
    "loading-model",
    0.86,
  );

  const session =
    await ort.InferenceSession.create(
      modelBytes,

      {
        executionProviders:
          [
            "wasm",
          ],

        executionMode:
          "sequential",

        graphOptimizationLevel:
          "all",
      },
    );

  options.checkCancelled();

  options.onStageProgress?.(
    "loading-model",
    1,
  );

  return {
    ort,
    session,
  };
}

function getSession(
  options: Pick<
    LamaInpaintOptions,
    | "checkCancelled"
    | "onResourceProgress"
    | "onStageProgress"
  >,
): Promise<LoadedSession> {
  if (
    !sessionPromise
  ) {
    sessionPromise =
      createSession(
        options,
      ).catch(
        (
          error,
        ) => {
          sessionPromise =
            null;

          throw error;
        },
      );
  } else {
    options.onStageProgress?.(
      "loading-model",
      1,
    );
  }

  return sessionPromise;
}

function createExtendedSquare(
  crop: ImageData,
): {
  canvas:
    OffscreenCanvas;

  offsetX:
    number;

  offsetY:
    number;

  side:
    number;
} {
  const cropCanvas =
    createOffscreenCanvas(
      crop.width,
      crop.height,
    );

  const cropContext =
    getOffscreenContext(
      cropCanvas,
      true,
    );

  cropContext.putImageData(
    crop,
    0,
    0,
  );

  const side =
    Math.max(
      crop.width,
      crop.height,
    );

  const offsetX =
    Math.floor(
      (
        side -
        crop.width
      ) /
        2,
    );

  const offsetY =
    Math.floor(
      (
        side -
        crop.height
      ) /
        2,
    );

  const canvas =
    createOffscreenCanvas(
      side,
      side,
    );

  const context =
    getOffscreenContext(
      canvas,
      true,
    );

  context.clearRect(
    0,
    0,
    side,
    side,
  );

  context.drawImage(
    cropCanvas,
    offsetX,
    offsetY,
  );

  if (
    offsetX > 0
  ) {
    context.drawImage(
      cropCanvas,

      0,
      0,
      1,
      crop.height,

      0,
      offsetY,
      offsetX,
      crop.height,
    );

    context.drawImage(
      cropCanvas,

      crop.width - 1,
      0,
      1,
      crop.height,

      offsetX +
        crop.width,
      offsetY,

      side -
        offsetX -
        crop.width,

      crop.height,
    );
  }

  if (
    offsetY > 0
  ) {
    context.drawImage(
      cropCanvas,

      0,
      0,
      crop.width,
      1,

      offsetX,
      0,
      crop.width,
      offsetY,
    );

    context.drawImage(
      cropCanvas,

      0,
      crop.height - 1,
      crop.width,
      1,

      offsetX,
      offsetY +
        crop.height,

      crop.width,

      side -
        offsetY -
        crop.height,
    );
  }

  if (
    offsetX > 0 &&
    offsetY > 0
  ) {
    context.drawImage(
      cropCanvas,

      0,
      0,
      1,
      1,

      0,
      0,
      offsetX,
      offsetY,
    );

    context.drawImage(
      cropCanvas,

      crop.width - 1,
      0,
      1,
      1,

      offsetX +
        crop.width,

      0,

      side -
        offsetX -
        crop.width,

      offsetY,
    );

    context.drawImage(
      cropCanvas,

      0,
      crop.height - 1,
      1,
      1,

      0,

      offsetY +
        crop.height,

      offsetX,

      side -
        offsetY -
        crop.height,
    );

    context.drawImage(
      cropCanvas,

      crop.width - 1,
      crop.height - 1,
      1,
      1,

      offsetX +
        crop.width,

      offsetY +
        crop.height,

      side -
        offsetX -
        crop.width,

      side -
        offsetY -
        crop.height,
    );
  }

  releaseCanvas(
    cropCanvas,
  );

  return {
    canvas,
    offsetX,
    offsetY,
    side,
  };
}

function createModelImageTensor(
  squareCanvas:
    OffscreenCanvas,
): Float32Array {
  const modelCanvas =
    createOffscreenCanvas(
      MODEL_SIZE,
      MODEL_SIZE,
    );

  const context =
    getOffscreenContext(
      modelCanvas,
      true,
    );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    squareCanvas,
    0,
    0,
    MODEL_SIZE,
    MODEL_SIZE,
  );

  const data =
    context.getImageData(
      0,
      0,
      MODEL_SIZE,
      MODEL_SIZE,
    ).data;

  const plane =
    MODEL_SIZE *
    MODEL_SIZE;

  const tensor =
    new Float32Array(
      plane *
        3,
    );

  for (
    let pixel = 0;
    pixel < plane;
    pixel++
  ) {
    const sourceIndex =
      pixel *
      4;

    tensor[pixel] =
      data[sourceIndex] /
      255;

    tensor[
      plane +
        pixel
    ] =
      data[
        sourceIndex +
          1
      ] /
      255;

    tensor[
      plane *
        2 +
        pixel
    ] =
      data[
        sourceIndex +
          2
      ] /
      255;
  }

  releaseCanvas(
    modelCanvas,
  );

  return tensor;
}

function createModelMaskTensor(
  plan:
    InpaintPlan,

  squareSide:
    number,

  offsetX:
    number,

  offsetY:
    number,
): Float32Array {
  const tensor =
    new Float32Array(
      MODEL_SIZE *
        MODEL_SIZE,
    );

  /*
   * Forward-map every selected source pixel.
   *
   * A nearest-neighbour destination lookup may make a thin text
   * stroke disappear when a large crop is reduced to 512 px.
   * Forward mapping ensures every selected stroke remains present
   * in the binary model mask.
   */
  for (
    let sourceY = 0;
    sourceY <
    plan.height;
    sourceY++
  ) {
    for (
      let sourceX = 0;
      sourceX <
      plan.width;
      sourceX++
    ) {
      const sourcePixel =
        sourceY *
          plan.width +
        sourceX;

      if (
        !plan.mask[
          sourcePixel
        ]
      ) {
        continue;
      }

      const squareX =
        offsetX +
        sourceX;

      const squareY =
        offsetY +
        sourceY;

      const modelStartX =
        Math.max(
          0,

          Math.min(
            MODEL_SIZE -
              1,

            Math.floor(
              (
                squareX *
                MODEL_SIZE
              ) /
                squareSide,
            ),
          ),
        );

      const modelEndX =
        Math.max(
          modelStartX,

          Math.min(
            MODEL_SIZE -
              1,

            Math.ceil(
              (
                (
                  squareX +
                  1
                ) *
                MODEL_SIZE
              ) /
                squareSide,
            ) -
              1,
          ),
        );

      const modelStartY =
        Math.max(
          0,

          Math.min(
            MODEL_SIZE -
              1,

            Math.floor(
              (
                squareY *
                MODEL_SIZE
              ) /
                squareSide,
            ),
          ),
        );

      const modelEndY =
        Math.max(
          modelStartY,

          Math.min(
            MODEL_SIZE -
              1,

            Math.ceil(
              (
                (
                  squareY +
                  1
                ) *
                MODEL_SIZE
              ) /
                squareSide,
            ) -
              1,
          ),
        );

      for (
        let modelY =
          modelStartY;

        modelY <=
        modelEndY;

        modelY++
      ) {
        for (
          let modelX =
            modelStartX;

          modelX <=
          modelEndX;

          modelX++
        ) {
          tensor[
            modelY *
              MODEL_SIZE +
              modelX
          ] = 1;
        }
      }
    }
  }

  return tensor;
}

function tensorOutputToCanvas(
  outputData:
    ArrayLike<number>,
): OffscreenCanvas {
  const plane =
    MODEL_SIZE *
    MODEL_SIZE;

  if (
    outputData.length <
    plane *
      3
  ) {
    throw new Error(
      "inpainting-model-output-invalid",
    );
  }

  const rgba =
    new Uint8ClampedArray(
      plane *
        4,
    );

  for (
    let pixel = 0;
    pixel < plane;
    pixel++
  ) {
    const outputIndex =
      pixel *
      4;

    rgba[
      outputIndex
    ] =
      clampByte(
        outputData[
          pixel
        ],
      );

    rgba[
      outputIndex +
        1
    ] =
      clampByte(
        outputData[
          plane +
            pixel
        ],
      );

    rgba[
      outputIndex +
        2
    ] =
      clampByte(
        outputData[
          plane *
            2 +
            pixel
        ],
      );

    rgba[
      outputIndex +
        3
    ] = 255;
  }

  const canvas =
    createOffscreenCanvas(
      MODEL_SIZE,
      MODEL_SIZE,
    );

  const context =
    getOffscreenContext(
      canvas,
      true,
    );

  context.putImageData(
    new ImageData(
      rgba,
      MODEL_SIZE,
      MODEL_SIZE,
    ),

    0,
    0,
  );

  return canvas;
}

function findBoundaryCorrection(
  generated:
    Uint8ClampedArray,

  original:
    Uint8ClampedArray,

  plan:
    InpaintPlan,
): [
  number,
  number,
  number,
] {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (
    let y = 0;
    y <
    plan.height;
    y++
  ) {
    for (
      let x = 0;
      x <
      plan.width;
      x++
    ) {
      const pixel =
        y *
          plan.width +
        x;

      if (
        plan.mask[
          pixel
        ]
      ) {
        continue;
      }

      let touchesMask =
        false;

      for (
        let offsetY = -1;

        offsetY <=
          1 &&
        !touchesMask;

        offsetY++
      ) {
        const nextY =
          y +
          offsetY;

        if (
          nextY < 0 ||
          nextY >=
            plan.height
        ) {
          continue;
        }

        for (
          let offsetX = -1;

          offsetX <=
          1;

          offsetX++
        ) {
          const nextX =
            x +
            offsetX;

          if (
            nextX < 0 ||
            nextX >=
              plan.width
          ) {
            continue;
          }

          if (
            plan.mask[
              nextY *
                plan.width +
                nextX
            ]
          ) {
            touchesMask =
              true;

            break;
          }
        }
      }

      if (
        !touchesMask
      ) {
        continue;
      }

      const index =
        pixel *
        4;

      red +=
        original[
          index
        ] -
        generated[
          index
        ];

      green +=
        original[
          index +
            1
        ] -
        generated[
          index +
            1
        ];

      blue +=
        original[
          index +
            2
        ] -
        generated[
          index +
            2
        ];

      count++;
    }
  }

  if (
    !count
  ) {
    return [
      0,
      0,
      0,
    ];
  }

  return [
    Math.max(
      -24,

      Math.min(
        24,
        red /
          count,
      ),
    ),

    Math.max(
      -24,

      Math.min(
        24,
        green /
          count,
      ),
    ),

    Math.max(
      -24,

      Math.min(
        24,
        blue /
          count,
      ),
    ),
  ];
}

function compositeGeneratedCrop(
  original:
    ImageData,

  generated:
    ImageData,

  plan:
    InpaintPlan,
): ImageData {
  const correction =
    findBoundaryCorrection(
      generated.data,
      original.data,
      plan,
    );

  const result =
    new ImageData(
      new Uint8ClampedArray(
        original.data,
      ),

      original.width,
      original.height,
    );

  for (
    let pixel = 0;

    pixel <
    plan.mask.length;

    pixel++
  ) {
    if (
      !plan.mask[
        pixel
      ]
    ) {
      continue;
    }

    /*
     * Every pixel in plan.mask is intentional reconstruction territory,
     * including the one-pixel anti-halo ring.
     *
     * Blending the original image back here reintroduced translucent
     * watermark edges and made the circular selection shape visible.
     *
     * Pixels outside plan.mask are never touched.
     */
    const strength =
      1;

    const index =
      pixel *
      4;

    const generatedRed =
      clampByte(
        generated.data[
          index
        ] +
          correction[
            0
          ],
      );

    const generatedGreen =
      clampByte(
        generated.data[
          index +
            1
        ] +
          correction[
            1
          ],
      );

    const generatedBlue =
      clampByte(
        generated.data[
          index +
            2
        ] +
          correction[
            2
          ],
      );

    result.data[
      index
    ] =
      clampByte(
        original.data[
          index
        ] *
          (
            1 -
            strength
          ) +
          generatedRed *
            strength,
      );

    result.data[
      index +
        1
    ] =
      clampByte(
        original.data[
          index +
            1
        ] *
          (
            1 -
            strength
          ) +
          generatedGreen *
            strength,
      );

    result.data[
      index +
        2
    ] =
      clampByte(
        original.data[
          index +
            2
        ] *
          (
            1 -
            strength
          ) +
          generatedBlue *
            strength,
      );

    /*
     * Removal reconstructs hidden RGB pixels.
     * It does not create a transparent hole in an opaque image.
     */
    result.data[
      index +
        3
    ] =
      original.data[
        index +
          3
      ] >= 250
        ? 255
        : original.data[
            index +
              3
          ];
  }

  return result;
}

export async function applyLamaInpaint(
  options:
    LamaInpaintOptions,
): Promise<void> {
  options.checkCancelled();

  options.onStageProgress?.(
    "loading-model",
    0,
  );

  const loaded =
    await getSession(
      options,
    );

  options.checkCancelled();

  options.onStageProgress?.(
    "processing-tiles",
    0.04,
  );

  const crop =
    options.context.getImageData(
      options.plan.x,
      options.plan.y,
      options.plan.width,
      options.plan.height,
    );

  const square =
    createExtendedSquare(
      crop,
    );

  let outputCanvas:
    | OffscreenCanvas
    | null = null;

  let generatedSquare:
    | OffscreenCanvas
    | null = null;

  try {
    const imageData =
      createModelImageTensor(
        square.canvas,
      );

    const maskData =
      createModelMaskTensor(
        options.plan,
        square.side,
        square.offsetX,
        square.offsetY,
      );

    options.checkCancelled();

    options.onStageProgress?.(
      "processing-tiles",
      0.18,
    );

    const imageTensor =
      new loaded.ort.Tensor(
        "float32",

        imageData,

        [
          1,
          3,
          MODEL_SIZE,
          MODEL_SIZE,
        ],
      );

    const maskTensor =
      new loaded.ort.Tensor(
        "float32",

        maskData,

        [
          1,
          1,
          MODEL_SIZE,
          MODEL_SIZE,
        ],
      );

    const imageInput =
      loaded.session.inputNames.find(
        (
          name,
        ) =>
          name
            .toLowerCase()
            .includes(
              "image",
            ),
      ) ??
      loaded.session
        .inputNames[
          0
        ];

    const maskInput =
      loaded.session.inputNames.find(
        (
          name,
        ) =>
          name
            .toLowerCase()
            .includes(
              "mask",
            ),
      ) ??
      loaded.session
        .inputNames[
          1
        ];

    if (
      !imageInput ||
      !maskInput
    ) {
      throw new Error(
        "inpainting-model-input-invalid",
      );
    }

    const output =
      await loaded.session.run(
        {
          [imageInput]:
            imageTensor,

          [maskInput]:
            maskTensor,
        },
      );

    options.checkCancelled();

    options.onStageProgress?.(
      "processing-tiles",
      0.78,
    );

    const outputName =
      loaded.session.outputNames.find(
        (
          name,
        ) =>
          name
            .toLowerCase()
            .includes(
              "output",
            ),
      ) ??
      loaded.session
        .outputNames[
          0
        ];

    const outputTensor =
      outputName
        ? output[
            outputName
          ]
        : undefined;

    if (
      !outputTensor
    ) {
      throw new Error(
        "inpainting-model-output-missing",
      );
    }

    outputCanvas =
      tensorOutputToCanvas(
        outputTensor.data as
          ArrayLike<number>,
      );

    generatedSquare =
      createOffscreenCanvas(
        square.side,
        square.side,
      );

    const generatedContext =
      getOffscreenContext(
        generatedSquare,
        true,
      );

    generatedContext.imageSmoothingEnabled =
      true;

    generatedContext.imageSmoothingQuality =
      "high";

    generatedContext.drawImage(
      outputCanvas,

      0,
      0,

      square.side,
      square.side,
    );

    const generatedCrop =
      generatedContext.getImageData(
        square.offsetX,
        square.offsetY,

        options.plan.width,
        options.plan.height,
      );

    const composited =
      compositeGeneratedCrop(
        crop,
        generatedCrop,
        options.plan,
      );

    options.checkCancelled();

    options.context.putImageData(
      composited,

      options.plan.x,
      options.plan.y,
    );

    options.onStageProgress?.(
      "processing-tiles",
      1,
    );
  } finally {
    releaseCanvas(
      square.canvas,
    );

    releaseCanvas(
      outputCanvas,
    );

    releaseCanvas(
      generatedSquare,
    );
  }
}