import sharp from "sharp";
export async function validateFaceCapture(buffer) {
  let image;
  try { image = sharp(buffer, { failOn: "error", limitInputPixels: 16000000 }); }
  catch { return "The captured image is invalid. Retake the photo."; }
  try {
    const metadata = await image.metadata();
    if (!["jpeg", "png"].includes(metadata.format)) return "Only JPEG or PNG camera images are accepted.";
    if (metadata.width < 320 || metadata.height < 320) return "Image resolution is too low. Use a camera with at least 320 × 320 resolution.";
    const { data, info } = await sharp(buffer).rotate().resize(128, 128, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let total = 0, totalSq = 0, edges = 0;
    const w = info.width, h = info.height;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, v = data[i];
      total += v; totalSq += v * v;
      edges += Math.abs(4 * v - data[i - 1] - data[i + 1] - data[i - w] - data[i + w]);
    }
    const n = (w - 2) * (h - 2), mean = total / n, variance = totalSq / n - mean * mean;
    if (mean < 55) return "Face photo is too dark. Move into brighter, even lighting.";
    if (mean > 225) return "Face photo is overexposed. Avoid direct bright light.";
    if (variance < 260 || edges / n < 12) return "Face photo is blurry or lacks detail. Hold the camera steady and retake.";
    return null;
  } catch { return "Could not read the captured image. Retake the photo."; }
}
