import type { InpaintPlan } from "./pixelProcessing";
import {
  createOffscreenCanvas,
  getOffscreenContext,
  releaseCanvas,
} from "./pixelProcessing";

const MODEL_SIZE = 512;
const EXPECTED_MODEL_BYTES = 92_600_000;
const MODEL_CACHE_NAME = "sharpixa-inpainting-models-v3";
const MODEL_URL =
  "https://huggingface.co/opencv/inpainting_lama/resolve/main/inpainting_lama_2025jan.onnx";

type OrtModule = typeof import("onnxruntime-web");
type OrtSession = import("onnxruntime-web").InferenceSession;

type DisposableValue = {
  data?: ArrayLike<number>;
  dispose?: () => void;
};

interface LoadedSession {
  ort: OrtModule;
  session: OrtSession;
}

export interface LamaInpaintOptions {
  context: OffscreenCanvasRenderingContext2D;
  plan: InpaintPlan;
  checkCancelled: () => void;
  onResourceProgress?: (current: number, total: number) => void;
  onStageProgress?: (
    stage: "loading-model" | "processing-tiles",
    ratio: number,
  ) => void;
}

let sessionPromise: Promise<LoadedSession> | null = null;

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.max(
    0,
    Math.min(
      255,
      value,
    ),
  );
}

function disposeValue(value: unknown): void {
  if (
    value &&
    typeof value === "object" &&
    "dispose" in value &&
    typeof (value as { dispose?: unknown }).dispose === "function"
  ) {
    try {
      (value as { dispose: () => void }).dispose();
    } catch {
      /*
       * Cleanup must never replace the actual processing
       * result or error.
       */
    }
  }
}

async function invalidateSession(
  loaded: LoadedSession,
): Promise<void> {
  sessionPromise = null;

  try {
    await loaded.session.release();
  } catch {
    /*
     * A failed runtime may already have released its
     * underlying resources.
     */
  }
}

async function getModelCache(): Promise<Cache | null> {
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
    "checkCancelled" | "onResourceProgress"
  >,
): Promise<Uint8Array> {
  const contentLength =
    Number(
      response.headers.get(
        "content-length",
      ),
    );

  const knownLength =
    Number.isFinite(
      contentLength,
    ) &&
    contentLength > 0
      ? contentLength
      : null;

  const expectedTotal =
    knownLength ??
    EXPECTED_MODEL_BYTES;

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
        expectedTotal,
        bytes.byteLength,
      ),
    );

    return bytes;
  }

  const reader =
    response.body.getReader();

  const chunks:
    Uint8Array[] = [];

  let received =
    0;

  try {
    while (true) {
      options.checkCancelled();

      const {
        done,
        value,
      } =
        await reader.read();

      if (
        done
      ) {
        break;
      }

      if (
        !value?.byteLength
      ) {
        continue;
      }

      chunks.push(
        value,
      );

      received +=
        value.byteLength;

      options.onResourceProgress?.(
        received,

        Math.max(
          expectedTotal,
          received,
        ),
      );
    }
  } finally {
    reader.releaseLock();
  }

  const bytes =
    new Uint8Array(
      received,
    );

  let offset =
    0;

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

  options.onResourceProgress?.(
    received,

    Math.max(
      expectedTotal,
      received,
    ),
  );

  return bytes;
}

async function loadModelBytes(
  options: Pick<
    LamaInpaintOptions,
    "checkCancelled" | "onResourceProgress"
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
          MODEL_URL,
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
       * Ignore a corrupt browser cache and retry from
       * the network.
       */
    }
  }

  options.checkCancelled();

  const response =
    await fetch(
      MODEL_URL,

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
    !response.ok
  ) {
    throw new Error(
      `inpainting-model-http-${response.status}`,
    );
  }

  const cacheCopy =
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
      "inpainting-model-response-too-small",
    );
  }

  if (
    cache
  ) {
    void cache
      .put(
        MODEL_URL,
        cacheCopy,
      )
      .catch(
        () =>
          undefined,
      );
  }

  return bytes;
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

  const cores =
    typeof navigator ===
    "undefined"
      ? 2
      : navigator.hardwareConcurrency ||
        2;

  const canUseThreads =
    typeof crossOriginIsolated !==
      "undefined" &&
    crossOriginIsolated;

  ort.env.debug =
    false;

  /*
   * Suppress harmless model-cleanup warnings such as
   * CleanUnusedInitializersAndNodeArgs.
   */
  ort.env.logLevel =
    "error";

  ort.env.wasm.numThreads =
    canUseThreads
      ? Math.max(
          1,

          Math.min(
            4,
            cores,
          ),
        )
      : 1;

  /*
   * Sharpixa already executes this module inside
   * imageProcessor.worker.ts.
   *
   * Do not enable ONNX Runtime's proxy worker here.
   * That would create a second Blob worker, which can
   * fail or stall after deployment when the production
   * Content Security Policy is active.
   */
  ort.env.wasm.proxy =
    false;

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
  canvas: OffscreenCanvas;
  offsetX: number;
  offsetY: number;
  side: number;
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

      crop.width -
        1,

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

      crop.height -
        1,

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

      crop.width -
        1,

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

      crop.height -
        1,

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

      crop.width -
        1,

      crop.height -
        1,

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
  canvas: OffscreenCanvas,
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
    canvas,

    0,
    0,

    MODEL_SIZE,
    MODEL_SIZE,
  );

  const rgba =
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

    pixel <
    plane;

    pixel++
  ) {
    const source =
      pixel *
      4;

    tensor[
      pixel
    ] =
      rgba[
        source
      ] /
      255;

    tensor[
      plane +
        pixel
    ] =
      rgba[
        source +
          1
      ] /
      255;

    tensor[
      plane *
        2 +
        pixel
    ] =
      rgba[
        source +
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
  plan: InpaintPlan,
  squareSide: number,
  offsetX: number,
  offsetY: number,
): Float32Array {
  const tensor =
    new Float32Array(
      MODEL_SIZE *
        MODEL_SIZE,
    );

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

      const startX =
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

      const endX =
        Math.max(
          startX,

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

      const startY =
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

      const endY =
        Math.max(
          startY,

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
          startY;

        modelY <=
        endY;

        modelY++
      ) {
        for (
          let modelX =
            startX;

          modelX <=
          endX;

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
  output: ArrayLike<number>,
): OffscreenCanvas {
  const plane =
    MODEL_SIZE *
    MODEL_SIZE;

  if (
    output.length <
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

    pixel <
    plane;

    pixel++
  ) {
    const target =
      pixel *
      4;

    rgba[
      target
    ] =
      clampByte(
        output[
          pixel
        ],
      );

    rgba[
      target +
        1
    ] =
      clampByte(
        output[
          plane +
            pixel
        ],
      );

    rgba[
      target +
        2
    ] =
      clampByte(
        output[
          plane *
            2 +
            pixel
        ],
      );

    rgba[
      target +
        3
    ] = 255;
  }

  const canvas =
    createOffscreenCanvas(
      MODEL_SIZE,
      MODEL_SIZE,
    );

  getOffscreenContext(
    canvas,
    true,
  ).putImageData(
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
        let dy = -1;

        dy <= 1 &&
        !touchesMask;

        dy++
      ) {
        const nextY =
          y +
          dy;

        if (
          nextY < 0 ||
          nextY >=
            plan.height
        ) {
          continue;
        }

        for (
          let dx = -1;

          dx <= 1;

          dx++
        ) {
          const nextX =
            x +
            dx;

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

    const index =
      pixel *
      4;

    result.data[
      index
    ] =
      clampByte(
        generated.data[
          index
        ] +
          correction[
            0
          ],
      );

    result.data[
      index +
        1
    ] =
      clampByte(
        generated.data[
          index +
            1
        ] +
          correction[
            1
          ],
      );

    result.data[
      index +
        2
    ] =
      clampByte(
        generated.data[
          index +
            2
        ] +
          correction[
            2
          ],
      );

    /*
     * Reconstruct hidden RGB pixels. Do not create a
     * transparent hole in an otherwise opaque image.
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

  let imageTensor:
    | InstanceType<
        OrtModule[
          "Tensor"
        ]
      >
    | null = null;

  let maskTensor:
    | InstanceType<
        OrtModule[
          "Tensor"
        ]
      >
    | null = null;

  let outputValues:
    | Record<
        string,
        DisposableValue
      >
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

    imageTensor =
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

    maskTensor =
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

    try {
      outputValues =
        (
          await loaded.session.run(
            {
              [imageInput]:
                imageTensor,

              [maskInput]:
                maskTensor,
            },
          )
        ) as Record<
          string,
          DisposableValue
        >;
    } catch (
      error
    ) {
      await invalidateSession(
        loaded,
      );

      const detail =
        error instanceof
          Error &&
        error.message
          ? error.message
          : "unknown-runtime-error";

      throw new Error(
        `inpainting-inference-failed:${detail}`,
      );
    }

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
        ? outputValues[
            outputName
          ]
        : undefined;

    if (
      !outputTensor?.data
    ) {
      throw new Error(
        "inpainting-model-output-missing",
      );
    }

    outputCanvas =
      tensorOutputToCanvas(
        outputTensor.data,
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
    disposeValue(
      imageTensor,
    );

    disposeValue(
      maskTensor,
    );

    if (
      outputValues
    ) {
      for (
        const value of
        Object.values(
          outputValues,
        )
      ) {
        disposeValue(
          value,
        );
      }
    }

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