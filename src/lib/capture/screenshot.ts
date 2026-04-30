// Screenshot capture + downsample. Service-worker-only: depends on
// `chrome.tabs.captureVisibleTab`, `OffscreenCanvas`, `createImageBitmap`,
// and `FileReader` — all available in MV3 service workers. No DOM access.
//
// Downsampling caps the image at `DEFAULT_MAX_WIDTH` to control LLM token
// cost: most vision models charge per pixel tile, and 1280px is a common
// sweet spot between detail and cost.

const DEFAULT_MAX_WIDTH = 1280;

export async function captureAndDownsample(
  windowId?: number,
  maxWidth: number = DEFAULT_MAX_WIDTH,
): Promise<string> {
  const opts = { format: 'png' as const };
  const raw =
    windowId !== undefined
      ? await chrome.tabs.captureVisibleTab(windowId, opts)
      : await chrome.tabs.captureVisibleTab(opts);
  return await downsamplePngDataUrl(raw, maxWidth);
}

export async function downsamplePngDataUrl(
  dataUrl: string,
  maxWidth: number = DEFAULT_MAX_WIDTH,
): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width <= maxWidth) {
    bitmap.close();
    return dataUrl;
  }
  const scale = maxWidth / bitmap.width;
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(maxWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('OffscreenCanvas 2D context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, maxWidth, targetHeight);
  bitmap.close();
  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return await blobToDataUrl(outBlob);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('FileReader returned non-string'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
