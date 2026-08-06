# Optional local LaMa model

Sharpixa's object-removal worker first checks this directory for:

`inpainting_lama_2025jan.onnx`

The model binary is intentionally not committed to this project ZIP because it
is approximately 92.6 MB. When the local file is absent, the app downloads the
same Apache-licensed OpenCV LaMa model from its Hugging Face repository on first
use and stores it in browser Cache Storage when available.

To self-host the model, download `inpainting_lama_2025jan.onnx` from the
`opencv/inpainting_lama` model repository and place it in this directory before
building the static site.

Model/project attribution:

- LaMa: Resolution-robust Large Mask Inpainting with Fourier Convolutions.
- Original LaMa project: Apache License 2.0.
- OpenCV quantized ONNX model repository: all files licensed under Apache
  License 2.0.
- Training dataset attribution: Places2 authors, CC BY 4.0, as stated by the
  corresponding model documentation.
