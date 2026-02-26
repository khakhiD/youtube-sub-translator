import { CONFIG } from '../shared/config';
import { loadSettings } from '../shared/settings';
import type { Settings } from '../shared/settings';
import type { AppState, Rect } from '../shared/types';
import { SubtitleOverlay } from './overlay';
import { RoiSelector } from './roi-selector';
import { FrameCapture } from './capture';
import { FrameDiff } from './frame-diff';
import { OcrEngine } from './ocr';
import { translate } from './translator';
import { isNewSubtitle, resetDedup } from './dedup';
import '../styles/content.css';

/**
 * Content Script 진입점.
 * 파이프라인: 캡처 → 프레임 변화 감지 → OCR → 중복제거 → 번역 → 오버레이
 * 프레임 변화가 없으면 OCR을 스킵하여 리소스 절약.
 */

class SubtitleTranslatorApp {
  private overlay: SubtitleOverlay;
  private roiSelector: RoiSelector;
  private capture: FrameCapture;
  private frameDiff: FrameDiff;
  private ocr: OcrEngine;
  private state: AppState;
  private settings!: Settings;

  constructor() {
    this.overlay = new SubtitleOverlay();
    this.roiSelector = new RoiSelector();
    this.capture = new FrameCapture();
    this.frameDiff = new FrameDiff();
    this.ocr = new OcrEngine();
    this.state = {
      isActive: false,
      roi: null,
      currentSubtitle: null,
    };
  }

  async start(): Promise<void> {
    console.log(CONFIG.logPrefix, 'Extension loaded on YouTube');

    // 설정 로드
    this.settings = await loadSettings();

    await this.waitForVideoPlayer();

    this.overlay.init({
      onSelectRoi: () => this.handleSelectRoi(),
      onClearRoi: () => this.handleClearRoi(),
    });
    this.overlay.applySettings(this.settings);
    this.state.isActive = true;

    // 설정 변경 감지 (popup에서 변경 시 실시간 반영)
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings) {
        const newSettings = changes.settings.newValue as Settings;
        const oldSettings = changes.settings.oldValue as Settings | undefined;
        this.settings = newSettings;
        this.overlay.applySettings(this.settings);

        // 캡처 간격이 변경되면 캡처 재시작
        if (
          this.state.roi &&
          this.capture.isRunning() &&
          oldSettings?.captureIntervalMs !== newSettings.captureIntervalMs
        ) {
          this.startCapture(this.state.roi);
        }
      }
    });

    console.log(CONFIG.logPrefix, 'App initialized successfully');
  }

  private handleSelectRoi(): void {
    if (this.roiSelector.isInSelectionMode()) return;

    console.log(CONFIG.logPrefix, 'Entering ROI selection mode...');
    this.overlay.setSelecting(true);

    this.roiSelector.enterSelectionMode(
      (roi: Rect) => {
        this.overlay.setSelecting(false);
        this.state.roi = roi;
        this.overlay.setRoiSelected(true);
        this.overlay.update({
          originalText: '',
          translatedText: `[ROI 선택됨] ${roi.width.toFixed(0)}x${roi.height.toFixed(0)}`,
          timestamp: Date.now(),
        });
        console.log(CONFIG.logPrefix, 'ROI saved to state:', roi);
        this.startCapture(roi);
      },
      () => {
        this.overlay.setSelecting(false);
        console.log(CONFIG.logPrefix, 'ROI selection cancelled');
      },
    );
  }

  private handleClearRoi(): void {
    this.capture.stop();
    this.state.roi = null;
    this.roiSelector.clearExistingRoi();
    this.overlay.setRoiSelected(false);
    this.overlay.update(null);
    this.frameDiff.reset();
    resetDedup();
    console.log(CONFIG.logPrefix, 'ROI cleared, capture stopped');
  }

  /** 캡처 → 프레임 변화 감지 → OCR → 중복제거 → 번역 → 오버레이 */
  private startCapture(roi: Rect): void {
    this.frameDiff.reset();

    this.overlay.update({
      originalText: '',
      translatedText: '[OCR 초기화 중...]',
      timestamp: Date.now(),
    });

    this.capture.start(roi, (imageData: ImageData) => {
      const result = this.frameDiff.analyze(imageData);

      // 변화 없음 또는 자막 없음 → OCR 스킵
      if (result !== 'changed') return;

      this.ocr.recognize(imageData, async (text: string) => {
        if (!isNewSubtitle(text)) return;

        if (this.settings.translateEnabled) {
          const translated = await translate(text);
          this.overlay.update({
            originalText: text,
            translatedText: translated,
            timestamp: Date.now(),
          });
        } else {
          this.overlay.update({
            originalText: '',
            translatedText: text,
            timestamp: Date.now(),
          });
        }
      });
    });
  }

  private waitForVideoPlayer(): Promise<void> {
    return new Promise((resolve) => {
      const player = document.querySelector('#movie_player');
      if (player) { resolve(); return; }

      const observer = new MutationObserver((_mutations, obs) => {
        if (document.querySelector('#movie_player')) {
          obs.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(); }, 10_000);
    });
  }
}

const app = new SubtitleTranslatorApp();
app.start().catch((err) => {
  console.error(CONFIG.logPrefix, 'Failed to start:', err);
});
