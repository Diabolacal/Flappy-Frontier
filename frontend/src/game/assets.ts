import type { GameAssets } from './types';

async function loadImageToBitmap(
  url: string,
  width: number,
  height: number,
): Promise<ImageBitmap | null> {
  try {
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    });

    const bitmap = await createImageBitmap(img, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });

    // Verify the bitmap has visible content
    const testCanvas = new OffscreenCanvas(width, height);
    const testCtx = testCanvas.getContext('2d');
    if (testCtx) {
      testCtx.drawImage(bitmap, 0, 0);
      const sample = testCtx.getImageData(
        Math.floor(width / 4), Math.floor(height / 4),
        Math.floor(width / 2), Math.floor(height / 2),
      );
      let hasContent = false;
      for (let i = 3; i < sample.data.length; i += 4) {
        if (sample.data[i]! > 10) { hasContent = true; break; }
      }
      if (!hasContent) {
        console.warn(`Asset bitmap is blank: ${url}, using fallback`);
        return null;
      }
    }

    return bitmap;
  } catch {
    console.warn(`Failed to load asset: ${url}, using fallback`);
    return null;
  }
}

export async function loadAssets(): Promise<GameAssets> {
  const [shipBitmap, pipeBitmap, pipeCapBitmap, groundBitmap] = await Promise.all([
    loadImageToBitmap('/assets/frontier-ship.png', 264, 60),
    loadImageToBitmap('/assets/pipe-body.svg', 70, 600),
    loadImageToBitmap('/assets/pipe-cap.svg', 78, 20),
    loadImageToBitmap('/assets/ground-tile.svg', 128, 40),
  ]);

  return { shipBitmap, pipeBitmap, pipeCapBitmap, groundBitmap };
}
