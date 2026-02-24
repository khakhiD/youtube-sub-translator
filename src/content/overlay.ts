import { CONFIG } from '../shared/config';
import type { SubtitleEntry, Disposable } from '../shared/types';

const OVERLAY_ID = 'yt-sub-translator-overlay';
const CONTROL_ID = 'yt-sub-translator-control';

/**
 * 번역 자막을 유튜브 비디오 위에 오버레이로 표시하는 모듈.
 * Shadow DOM을 사용해 유튜브 페이지 스타일과 격리.
 */
export class SubtitleOverlay implements Disposable {
  private container: HTMLDivElement | null = null;
  private controlBar: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private textEl: HTMLDivElement | null = null;
  private selectRoiBtn: HTMLButtonElement | null = null;
  private onSelectRoi: (() => void) | null = null;

  /** 오버레이 DOM을 비디오 플레이어 위에 생성 */
  init(onSelectRoi?: () => void): void {
    this.onSelectRoi = onSelectRoi ?? null;
    // 중복 생성 방지
    if (document.getElementById(OVERLAY_ID)) {
      console.warn(CONFIG.logPrefix, 'Overlay already exists');
      return;
    }

    const player = this.findVideoPlayer();
    if (!player) {
      console.warn(CONFIG.logPrefix, 'Video player not found, retrying...');
      return;
    }

    // 컨테이너 생성 (Shadow DOM으로 스타일 격리)
    this.container = document.createElement('div');
    this.container.id = OVERLAY_ID;

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Shadow DOM 내부 스타일
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        bottom: ${CONFIG.overlay.bottom}px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        pointer-events: none;
      }
      .subtitle-text {
        font-size: ${CONFIG.overlay.fontSize}px;
        max-width: ${CONFIG.overlay.maxWidth}px;
        color: #fff;
        text-align: center;
        text-shadow:
          -1px -1px 0 #000,
           1px -1px 0 #000,
          -1px  1px 0 #000,
           1px  1px 0 #000;
        font-family: 'Arial', sans-serif;
        line-height: 1.4;
        padding: 4px 12px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        white-space: pre-wrap;
        word-break: keep-all;
      }
      .subtitle-text:empty {
        display: none;
      }
    `;

    this.textEl = document.createElement('div');
    this.textEl.className = 'subtitle-text';

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(this.textEl);

    // 비디오 플레이어는 position:relative이므로 absolute 배치 가능
    player.style.position = 'relative';
    player.appendChild(this.container);

    // 컨트롤 바 (ROI 선택 버튼 등)
    this.controlBar = document.createElement('div');
    this.controlBar.id = CONTROL_ID;
    this.controlBar.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10001;
      display: flex;
      gap: 6px;
    `;

    this.selectRoiBtn = document.createElement('button');
    this.selectRoiBtn.textContent = 'ROI 선택';
    this.selectRoiBtn.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.7);
      color: #00ff88;
      border: 1px solid #00ff88;
      border-radius: 4px;
      cursor: pointer;
      font-family: Arial, sans-serif;
    `;
    this.selectRoiBtn.addEventListener('click', () => {
      this.onSelectRoi?.();
    });

    this.controlBar.appendChild(this.selectRoiBtn);
    player.appendChild(this.controlBar);

    console.log(CONFIG.logPrefix, 'Overlay initialized');
  }

  /** 자막 텍스트 업데이트 */
  update(subtitle: SubtitleEntry | null): void {
    if (!this.textEl) return;

    if (subtitle && subtitle.translatedText.trim()) {
      this.textEl.textContent = subtitle.translatedText;
    } else {
      this.textEl.textContent = '';
    }
  }

  /** 오버레이 표시/숨김 토글 */
  setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }

  /** ROI 선택 완료 시 버튼 상태 업데이트 */
  setRoiSelected(selected: boolean): void {
    if (this.selectRoiBtn) {
      this.selectRoiBtn.textContent = selected ? 'ROI 재선택' : 'ROI 선택';
    }
  }

  dispose(): void {
    this.container?.remove();
    this.controlBar?.remove();
    this.container = null;
    this.controlBar = null;
    this.shadowRoot = null;
    this.textEl = null;
    this.selectRoiBtn = null;
    console.log(CONFIG.logPrefix, 'Overlay disposed');
  }

  /** 유튜브 비디오 플레이어 요소 탐색 */
  private findVideoPlayer(): HTMLElement | null {
    // #movie_player는 유튜브의 비디오 플레이어 컨테이너
    return document.querySelector('#movie_player');
  }
}
