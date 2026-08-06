# Third-party AI models

## LaMa image inpainting

Sharpixa uses the OpenCV quantized LaMa ONNX model for browser-side object and
authorized-watermark reconstruction.

- Runtime file: `inpainting_lama_2025jan.onnx`
- Upstream model repository: `opencv/inpainting_lama` on Hugging Face
- Original research implementation: `advimman/lama`
- License: Apache License 2.0, according to the upstream model repository and
  the original LaMa repository
- Model input: 512 × 512 RGB image and binary mask

The binary is downloaded lazily on first use unless the deployer places a local
copy in `public/models/`. Source images remain in the browser; only the model
weights are downloaded.
