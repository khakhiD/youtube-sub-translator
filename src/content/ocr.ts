import { CONFIG } from '../shared/config';
import { MSG } from '../shared/messages';
import type { OcrRequestMessage, OcrResultMessage } from '../shared/messages';
import type { Disposable } from '../shared/types';

/** OCR 결과를 전달하는 콜백 */
export type OcrCallback = (text: string) => void;

/**
 * OCR 모듈 - Background → Offscreen 메시징을 통해 tesseract.js 실행.
 *
 * 유튜브 CSP가 content script에서 blob: Worker 생성을 차단하므로,
 * 실제 OCR은 offscreen document에서 수행.
 * 이 모듈은 ImageData → dataURL 변환 + 메시지 송수신만 담당.
 *
 * - 이전 OCR이 진행 중이면 새 요청을 스킵 (큐잉 방지)
 * - TODO: 전처리(grayscale, upscale) 확장 포인트
 */
export class OcrEngine implements Disposable {
  private busy = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * ImageData를 OCR 처리하여 텍스트를 추출.
   * Background → Offscreen으로 메시지를 보내 처리.
   */
  async recognize(imageData: ImageData, onResult: OcrCallback): Promise<void> {
    if (this.busy) return;

    this.busy = true;
    try {
      // TODO: 여기에 전처리(grayscale, contrast, upscale) 삽입 가능
      const dataUrl = this.imageDataToDataUrl(imageData);

      const message: OcrRequestMessage = {
        type: MSG.OCR_REQUEST,
        payload: { imageDataUrl: dataUrl },
      };

      const response: OcrResultMessage = await chrome.runtime.sendMessage(message);

      if (response?.payload?.error) {
        console.error(CONFIG.logPrefix, 'OCR error:', response.payload.error);
        return;
      }

      const text = response?.payload?.text;
      if (text) {
        onResult(text);
      }
    } catch (err) {
      console.error(CONFIG.logPrefix, 'OCR request failed:', err);
    } finally {
      this.busy = false;
    }
  }

  dispose(): void {
    console.log(CONFIG.logPrefix, 'OCR engine disposed');
  }

  /** ImageData → data URL (PNG base64) */
  private imageDataToDataUrl(imageData: ImageData): string {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.ctx.putImageData(imageData, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}
