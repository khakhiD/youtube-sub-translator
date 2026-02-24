/**
 * OCR 전처리 모듈 — 흰색 텍스트 + 검은 border 자막에 최적화.
 *
 * 파이프라인:
 * 1. Grayscale 변환
 * 2. 이진화 (밝은 픽셀 = 흰 텍스트만 추출)
 * 3. 반전 (검은 글씨 on 흰 배경 — tesseract 최적 입력)
 * 4. 1px 팽창(dilation) — anti-aliasing 갭 보정
 * 5. 2x Upscale + padding
 */

const UPSCALE_FACTOR = 2;
const PADDING = 20; // px (upscale 후 기준)

/** 흰 텍스트 추출 임계값 (0~255). 이 값 이상인 픽셀을 텍스트로 간주. */
const WHITE_TEXT_THRESHOLD = 180;

/**
 * OCR 전 이미지 전처리.
 * 자막 특성(흰 텍스트 + 검은 border)을 활용하여 깨끗한 이진 이미지 생성.
 */
export function preprocessForOcr(
  imageData: ImageData,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): ImageData {
  const { width, height, data } = imageData;

  // 1. Grayscale 변환
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i >> 2] = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
  }

  // 2. 이진화 + 반전: 밝은 픽셀(흰 텍스트) → 검은색(0), 나머지 → 흰색(255)
  //    tesseract는 "dark text on light background"에서 최적 동작
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    binary[i] = gray[i] >= WHITE_TEXT_THRESHOLD ? 0 : 255;
  }

  // 3. 1px 팽창(dilation) — 텍스트 획을 약간 두껍게 하여 anti-aliasing 갭 보정
  //    검은 픽셀(텍스트, 0)이 상하좌우에 하나라도 있으면 검은색으로
  const dilated = new Uint8Array(binary);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0) continue; // 이미 텍스트
      // 4방향 이웃에 텍스트 픽셀이 있으면 확장
      if (
        binary[idx - 1] === 0 ||
        binary[idx + 1] === 0 ||
        binary[idx - width] === 0 ||
        binary[idx + width] === 0
      ) {
        dilated[idx] = 0;
      }
    }
  }

  // 4. 이진 이미지를 RGBA ImageData로 변환
  const binaryRgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < dilated.length; i++) {
    const idx = i * 4;
    binaryRgba[idx] = dilated[i];
    binaryRgba[idx + 1] = dilated[i];
    binaryRgba[idx + 2] = dilated[i];
    binaryRgba[idx + 3] = 255;
  }

  // 5. Upscale 2x + padding (흰색 여백)
  const upW = width * UPSCALE_FACTOR;
  const upH = height * UPSCALE_FACTOR;
  const outW = upW + PADDING * 2;
  const outH = upH + PADDING * 2;

  canvas.width = outW;
  canvas.height = outH;

  // 흰색 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  // 이진 이미지를 임시 canvas에 그린 후 upscale
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = width;
  tmpCanvas.height = height;
  const tmpCtx = tmpCanvas.getContext('2d')!;
  tmpCtx.putImageData(new ImageData(binaryRgba, width, height), 0, 0);

  // 이진 이미지는 nearest-neighbor가 아닌 bilinear로 부드럽게 upscale
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmpCanvas, 0, 0, width, height, PADDING, PADDING, upW, upH);

  return ctx.getImageData(0, 0, outW, outH);
}
