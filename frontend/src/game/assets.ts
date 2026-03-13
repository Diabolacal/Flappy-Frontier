import type { GameAssets } from './types';

async function loadSVGToBitmap(
  url: string,
  width: number,
  height: number,
): Promise<ImageBitmap | null> {
  try {
    // Use Image element for broader compatibility
    const img = new Image();
    img.width = width;
    img.height = height;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    });

    return await createImageBitmap(img, {
      resizeWidth: width,
      resizeHeight: height,
    });
  } catch {
    console.warn(`Failed to load asset: ${url}, using fallback`);
    return null;
  }
}

export async function loadAssets(): Promise<GameAssets> {
  const [shipBitmap, pipeBitmap, pipeCapBitmap, groundBitmap] = await Promise.all([
    loadSVGToBitmap('/assets/ship-hull.svg', 72, 36),
    loadSVGToBitmap('/assets/pipe-body.svg', 70, 600),
    loadSVGToBitmap('/assets/pipe-cap.svg', 78, 20),
    loadSVGToBitmap('/assets/ground-tile.svg', 128, 40),
  ]);

  return { shipBitmap, pipeBitmap, pipeCapBitmap, groundBitmap };
}
