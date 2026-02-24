import Tesseract from 'tesseract.js';
import { CONFIG } from '../shared/config';
import type { Disposable } from '../shared/types';

/** OCR 결과를 전달하는 콜백 */
export type OcrCallback = (text: string) => void;

/**
 * Tesseract.js를 래핑하는 OCR 모듈.
 *
 * - Worker 초기화는 비동기 (첫 OCR 요청 시 lazy init)
 * - 이전 OCR이 진행 중이면 새 요청을 스킵 (큐잉 방지)
 * - TODO: 전처리(grayscale, upscale) 확장 포인트
 */
export class OcrEngine implements Disposable {
  private worker: Tesseract.Worker | null = null;
  private initializing = false;
  private busy = false;

  /**
   * ImageData를 OCR 처리하여 텍스트를 추출.
   * Worker가 아직 없으면 초기화 후 실행.
   */
  async recognize(imageData: ImageData, onResult: OcrCallback): Promise<void> {
    // 이전 OCR이 아직 처리 중이면 스킵 (프레임 드롭)
    if (this.busy) return;

    if (!this.worker) {
      await this.initWorker();
    }
    if (!this.worker) return;

    this.busy = true;
    try {
      // ImageData → canvas → blob으로 변환 (tesseract.js 입력)
      const canvas = this.imageDataToCanvas(imageData);

      const { data } = await this.worker.recognize(canvas);
      const text = data.text.trim();

      if (text) {
        onResult(text);
      }
    } catch (err) {
      console.error(CONFIG.logPrefix, 'OCR failed:', err);
    } finally {
      this.busy = false;
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    console.log(CONFIG.logPrefix, 'OCR engine disposed');
  }

  /** Tesseract worker 초기화 (lazy, 1회) */
  private async initWorker(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;

    try {
      console.log(CONFIG.logPrefix, 'Initializing OCR worker...');

      // MV3 content script에서 worker 파일은 web_accessible_resources로 접근
      const workerPath = chrome.runtime.getURL('tesseract-worker.min.js');

      this.worker = await Tesseract.createWorker('eng', Tesseract.OEM.DEFAULT, {
        workerPath,
        // 언어 데이터는 CDN에서 로드 (번들 크기 절약, ~4MB)
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        gzip: false,
      });

      console.log(CONFIG.logPrefix, 'OCR worker ready');
    } catch (err) {
      console.error(CONFIG.logPrefix, 'OCR worker init failed:', err);
      this.worker = null;
    } finally {
      this.initializing = false;
    }
  }

  /** ImageData → HTMLCanvasElement 변환 (tesseract.js 입력용) */
  private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    // TODO: 여기에 전처리(grayscale, contrast, upscale) 삽입 가능
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }
}
