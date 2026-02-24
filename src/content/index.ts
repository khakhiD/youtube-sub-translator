import { CONFIG } from '../shared/config';
import type { AppState, Rect } from '../shared/types';
import { SubtitleOverlay } from './overlay';
import { RoiSelector } from './roi-selector';
import { FrameCapture } from './capture';
import '../styles/content.css';

/**
 * Content Script 진입점.
 * 각 모듈을 초기화하고 파이프라인을 조율하는 역할.
 *
 * Step 3: 오버레이 + ROI 선택 + 프레임 캡처
 * TODO: Step 4에서 OCR 연동
 */

class SubtitleTranslatorApp {
  private overlay: SubtitleOverlay;
  private roiSelector: RoiSelector;
  private capture: FrameCapture;
  private state: AppState;
  private captureCount = 0;

  constructor() {
    this.overlay = new SubtitleOverlay();
    this.roiSelector = new RoiSelector();
    this.capture = new FrameCapture();
    this.state = {
      isActive: false,
      roi: null,
      currentSubtitle: null,
    };
  }

  /** 앱 시작 - 유튜브 비디오 플레이어가 로드될 때까지 대기 후 초기화 */
  async start(): Promise<void> {
    console.log(CONFIG.logPrefix, 'Extension loaded on YouTube');

    // 유튜브는 SPA이므로 비디오 플레이어가 즉시 있지 않을 수 있음
    await this.waitForVideoPlayer();

    this.overlay.init({
      onSelectRoi: () => this.handleSelectRoi(),
      onClearRoi: () => this.handleClearRoi(),
    });
    this.state.isActive = true;

    console.log(CONFIG.logPrefix, 'App initialized successfully');
  }

  /** ROI 선택 버튼 클릭 핸들러 */
  private handleSelectRoi(): void {
    console.log(CONFIG.logPrefix, 'Entering ROI selection mode...');
    this.roiSelector.enterSelectionMode(
      (roi: Rect) => {
        this.state.roi = roi;
        this.overlay.setRoiSelected(true);
        this.overlay.update({
          originalText: '',
          translatedText: `[ROI 선택됨] ${roi.width.toFixed(0)}x${roi.height.toFixed(0)} @ (${roi.x.toFixed(0)}, ${roi.y.toFixed(0)})`,
          timestamp: Date.now(),
        });
        console.log(CONFIG.logPrefix, 'ROI saved to state:', roi);
        this.startCapture(roi);
      },
      () => {
        // 선택 취소 시 - 기존 ROI 유지
        console.log(CONFIG.logPrefix, 'ROI selection cancelled');
      },
    );
  }

  /** ROI 초기화 버튼 클릭 핸들러 */
  private handleClearRoi(): void {
    this.capture.stop();
    this.captureCount = 0;
    this.state.roi = null;
    this.roiSelector.clearExistingRoi();
    this.overlay.setRoiSelected(false);
    this.overlay.update(null);
    console.log(CONFIG.logPrefix, 'ROI cleared, capture stopped');
  }

  /** ROI 기반 주기적 캡처 시작 */
  private startCapture(roi: Rect): void {
    this.captureCount = 0;
    this.capture.start(roi, (imageData: ImageData) => {
      this.captureCount++;
      // TODO: Step 4에서 imageData를 OCR 모듈로 전달
      // 확인용: 캡처 횟수와 이미지 크기를 오버레이에 표시
      this.overlay.update({
        originalText: '',
        translatedText: `[캡처 #${this.captureCount}] ${imageData.width}x${imageData.height}px`,
        timestamp: Date.now(),
      });
    });
  }

  /** 비디오 플레이어 DOM이 나타날 때까지 대기 */
  private waitForVideoPlayer(): Promise<void> {
    return new Promise((resolve) => {
      const player = document.querySelector('#movie_player');
      if (player) {
        resolve();
        return;
      }

      const observer = new MutationObserver((_mutations, obs) => {
        if (document.querySelector('#movie_player')) {
          obs.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // 안전장치: 10초 후 타임아웃
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 10_000);
    });
  }
}

// 즉시 실행
const app = new SubtitleTranslatorApp();
app.start().catch((err) => {
  console.error(CONFIG.logPrefix, 'Failed to start:', err);
});
