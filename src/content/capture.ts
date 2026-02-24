import { CONFIG } from '../shared/config';
import type { Rect, Disposable } from '../shared/types';

/** 캡처 결과를 전달하는 콜백 */
export type CaptureCallback = (imageData: ImageData) => void;

/**
 * 비디오 프레임에서 ROI 영역을 주기적으로 캡처하는 모듈.
 *
 * <video> → offscreen <canvas> drawImage로 ROI 크롭 후 ImageData 추출.
 * 설정된 주기(CONFIG.captureIntervalMs)로 반복.
 *
 * TODO: Step 4+ 에서 전처리(grayscale, upscale 등) 확장 포인트 활용
 */
export class FrameCapture implements Disposable {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timerId: number | null = null;
  private video: HTMLVideoElement | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get canvas 2d context');
    }
    this.ctx = ctx;
  }

  /**
   * 주기적 캡처 시작.
   * @param roi - 캡처할 영역 (비디오 플레이어 기준 좌표)
   * @param onCapture - 캡처된 ImageData를 받는 콜백
   */
  start(roi: Rect, onCapture: CaptureCallback): void {
    this.stop();

    this.video = document.querySelector('video');
    if (!this.video) {
      console.warn(CONFIG.logPrefix, 'Capture: <video> element not found');
      return;
    }

    // canvas 크기를 ROI에 맞춤
    this.canvas.width = roi.width;
    this.canvas.height = roi.height;

    console.log(CONFIG.logPrefix, `Capture started (${CONFIG.captureIntervalMs}ms interval)`);

    // 즉시 첫 캡처 + 주기 반복
    this.captureFrame(roi, onCapture);
    this.timerId = window.setInterval(() => {
      this.captureFrame(roi, onCapture);
    }, CONFIG.captureIntervalMs);
  }

  /** 캡처 중지 */
  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
      console.log(CONFIG.logPrefix, 'Capture stopped');
    }
  }

  isRunning(): boolean {
    return this.timerId !== null;
  }

  dispose(): void {
    this.stop();
    this.video = null;
  }

  /** 단일 프레임 캡처 (비디오 네이티브 해상도 유지) */
  private captureFrame(roi: Rect, onCapture: CaptureCallback): void {
    if (!this.video || this.video.paused || this.video.ended) return;

    // ROI는 플레이어(DOM) 기준 좌표 → 비디오 실제 해상도로 변환
    const scaleX = this.video.videoWidth / this.video.clientWidth;
    const scaleY = this.video.videoHeight / this.video.clientHeight;

    const srcX = roi.x * scaleX;
    const srcY = roi.y * scaleY;
    const srcW = roi.width * scaleX;
    const srcH = roi.height * scaleY;

    // canvas를 비디오 네이티브 해상도로 설정 (DOM 크기로 축소하지 않음)
    const nativeW = Math.round(srcW);
    const nativeH = Math.round(srcH);
    if (this.canvas.width !== nativeW || this.canvas.height !== nativeH) {
      this.canvas.width = nativeW;
      this.canvas.height = nativeH;
    }

    try {
      // 비디오 → canvas: 네이티브 해상도 1:1 복사
      this.ctx.drawImage(
        this.video,
        srcX, srcY, srcW, srcH,
        0, 0, nativeW, nativeH,
      );

      const imageData = this.ctx.getImageData(0, 0, nativeW, nativeH);
      onCapture(imageData);
    } catch (err) {
      console.error(CONFIG.logPrefix, 'Capture failed:', err);
    }
  }
}
