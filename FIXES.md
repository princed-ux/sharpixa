# Sharpixa Processing Fixes

## Problems addressed

### 1. Watermark/object removal produced a dark circular patch

The inpainting pipeline could use one translated donor patch for the entire selected area, even when the selection was a small logo or translucent watermark. If the nearest donor area contained a phone edge, shadow, or other dark feature, that feature was cloned across the whole mask.

The fix now:

- rejects donor-patch cloning for small, thin, or poorly matched selections;
- uses directional boundary reconstruction for small watermarks and logos;
- retains donor-patch filling only for larger selections where the donor match is credible;
- reduces the default brush size and warns users to select only the unwanted pixels;
- renames the loose “Circle” action to “Tight area” and explains that every pixel inside it will be rebuilt.

### 2. Automatic background removal stalled or failed around the middle of processing

The neural model previously ran at the same dimensions used for the final export. That can exhaust browser memory during ONNX inference, particularly on phones and ordinary laptops.

The fix now:

- uses the smaller quantized background model by default;
- lets high-memory devices try the FP16 model first and automatically fall back to the quantized model;
- runs inference on an adaptive lower-resolution working image;
- scales only the generated alpha matte back to a higher-resolution copy of the original image, preserving original RGB detail;
- exposes a distinct output-resizing stage so progress no longer appears frozen at the inference percentage;
- retains the real model error in development logs and returns a clearer production error.

## Files changed

- `lib/processingLimits.ts`
- `lib/progress.ts`
- `workers/imageProcessor.worker.ts`
- `workers/pixelProcessing.ts`
- `components/WatermarkBrush.tsx`

## Verification completed

- Syntax-transpiled all TypeScript and TSX source files successfully.
- Exercised the adaptive planning function for low-, default-, and high-memory device profiles.
- Confirmed the worker now separates inference dimensions from final output dimensions.

A complete Next.js build was not possible in the inspection environment because the uploaded dependency directory was incomplete and package installation could not retrieve all dependencies. Run the commands below in the project directory before deployment:

```bash
rm -rf node_modules .next out
npm ci
npm run build
```

On Windows PowerShell:

```powershell
Remove-Item node_modules,.next,out -Recurse -Force -ErrorAction SilentlyContinue
npm ci
npm run build
```

## Manual browser test checklist

1. Open the watermark/object remover and select only the visible star/logo pixels with the brush or a tightly fitted area.
2. Confirm that no dark phone-edge patch is copied into the selection.
3. Test automatic background removal with a small PNG or JPG, then with a 12-megapixel phone image.
4. Confirm progress advances from model analysis into “resizing output” and finishes.
5. Verify transparent hair and edge details at 100% zoom.
6. Test in current Chrome and Edge on both desktop and Android before resubmitting the site.

## AI inpainting reconstruction update

- Replaced the blur-prone directional averaging path with LaMa ONNX inpainting
  as the primary object/watermark reconstruction engine.
- Added lazy model loading, browser Cache Storage reuse, download progress, and
  worker heartbeats.
- Added an edge-aware local fallback for restricted/offline environments.
- Reduced mask dilation to one pixel, made all selected core pixels full
  reconstruction targets, and removed broad internal blur/feathering.
- Preserved source alpha instead of creating transparent holes.

## Fast watermark reconstruction and worker-timeout fix

A compact watermark selection no longer starts the 92 MB LaMa model by default.
The worker now selects the local edge-aware engine for small masks and reserves
LaMa for larger object-removal regions. This removes the long first-run delay for
ordinary image watermarks.

Additional changes:

- enabled ONNX Runtime's proxy worker so neural inference does not block image-worker heartbeats;
- increased the inpainting inactivity window while reducing the overall safety window;
- changed local reconstruction to follow the nearest structural boundary instead of averaging opposite sides of an edge;
- strengthened the one-pixel seam reconstruction so translucent watermark remnants are not blended back into the output;
- increased local progress/cancellation yields from every 40,000 pixels to every 8,000 pixels;
- changed expected processing failures to development warnings so Next.js does not cover the page with a red error overlay.

Files changed for this update:

- `lib/imageWorkerClient.ts`
- `workers/imageProcessor.worker.ts`
- `workers/lamaInpainting.ts`
- `workers/pixelProcessing.ts`
- `components/UploadZone.tsx`
