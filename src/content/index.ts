import { CONFIG } from '../shared/config';
import type { AppState, SubtitleEntry } from '../shared/types';
import { SubtitleOverlay } from './overlay';
import '../styles/content.css';

/**
 * Content Script 진입점.
 * 각 모듈을 초기화하고 파이프라인을 조율하는 역할.
 *
 * Step 1: 오버레이 초기화 + 데모 자막 표시
 * TODO: Step 2에서 ROI 선택, Step 3에서 캡처 파이프라인 연결
 */

class SubtitleTranslatorApp {
  private overlay: SubtitleOverlay;
  private state: AppState;

  constructor() {
    this.overlay = new SubtitleOverlay();
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

    this.overlay.init();
    this.state.isActive = true;

    // TODO: 실제 파이프라인 연결 시 제거
    this.showDemoSubtitle();

    console.log(CONFIG.logPrefix, 'App initialized successfully');
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

  /**
   * 데모 자막 표시 (Step 1 동작 확인용)
   * TODO: Step 4 완료 후 제거 - 실제 OCR → 번역 파이프라인으로 교체
   */
  private showDemoSubtitle(): void {
    const demo: SubtitleEntry = {
      originalText: 'This is a demo subtitle from OCR',
      translatedText: '[번역] OCR에서 추출한 데모 자막입니다',
      timestamp: Date.now(),
    };

    this.overlay.update(demo);
    console.log(CONFIG.logPrefix, 'Demo subtitle displayed');
  }
}

// 즉시 실행
const app = new SubtitleTranslatorApp();
app.start().catch((err) => {
  console.error(CONFIG.logPrefix, 'Failed to start:', err);
});
