import { CONFIG } from '../shared/config';
import type { SubtitleEntry, Disposable } from '../shared/types';

const OVERLAY_ID = 'yt-sub-translator-overlay';
const CONTROL_ID = 'yt-sub-translator-control';

/**
 * 번역 자막을 유튜브 비디오 위에 오버레이로 표시하는 모듈.
 * Shadow DOM으로 유튜브 스타일과 격리. 드래그로 위치 이동 가능.
 */
export class SubtitleOverlay implements Disposable {
  private container: HTMLDivElement | null = null;
  private controlBar: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private textEl: HTMLDivElement | null = null;
  private selectRoiBtn: HTMLButtonElement | null = null;
  private clearRoiBtn: HTMLButtonElement | null = null;
  private onSelectRoi: (() => void) | null = null;
  private onClearRoi: (() => void) | null = null;

  // 드래그 상태
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private posX = 0; // 플레이어 중앙 기준 오프셋
  private posY = 0;
  private player: HTMLElement | null = null;

  private boundDragMove = this.handleDragMove.bind(this);
  private boundDragEnd = this.handleDragEnd.bind(this);

  /** 오버레이 DOM을 비디오 플레이어 위에 생성 */
  init(callbacks?: { onSelectRoi?: () => void; onClearRoi?: () => void }): void {
    this.onSelectRoi = callbacks?.onSelectRoi ?? null;
    this.onClearRoi = callbacks?.onClearRoi ?? null;

    if (document.getElementById(OVERLAY_ID)) {
      console.warn(CONFIG.logPrefix, 'Overlay already exists');
      return;
    }

    this.player = this.findVideoPlayer();
    if (!this.player) {
      console.warn(CONFIG.logPrefix, 'Video player not found, retrying...');
      return;
    }

    // 컨테이너 (Shadow DOM)
    this.container = document.createElement('div');
    this.container.id = OVERLAY_ID;

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

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
        pointer-events: auto;
        cursor: grab;
        user-select: none;
      }
      .subtitle-text:active {
        cursor: grabbing;
      }
      .subtitle-text:empty {
        display: none;
      }
    `;

    this.textEl = document.createElement('div');
    this.textEl.className = 'subtitle-text';

    // 드래그 이벤트
    this.textEl.addEventListener('mousedown', (e) => this.handleDragStart(e));

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(this.textEl);

    this.player.style.position = 'relative';
    this.player.appendChild(this.container);

    // 컨트롤 바
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
    this.selectRoiBtn.addEventListener('click', () => this.onSelectRoi?.());

    this.clearRoiBtn = document.createElement('button');
    this.clearRoiBtn.textContent = 'ROI 초기화';
    this.clearRoiBtn.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.7);
      color: #ff6b6b;
      border: 1px solid #ff6b6b;
      border-radius: 4px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      display: none;
    `;
    this.clearRoiBtn.addEventListener('click', () => this.onClearRoi?.());

    this.controlBar.appendChild(this.selectRoiBtn);
    this.controlBar.appendChild(this.clearRoiBtn);
    this.player.appendChild(this.controlBar);

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

  setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }

  setRoiSelected(selected: boolean): void {
    if (this.selectRoiBtn) {
      this.selectRoiBtn.textContent = selected ? 'ROI 재선택' : 'ROI 선택';
    }
    if (this.clearRoiBtn) {
      this.clearRoiBtn.style.display = selected ? 'block' : 'none';
    }
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
    this.container?.remove();
    this.controlBar?.remove();
    this.container = null;
    this.controlBar = null;
    this.shadowRoot = null;
    this.textEl = null;
    this.selectRoiBtn = null;
    this.clearRoiBtn = null;
    console.log(CONFIG.logPrefix, 'Overlay disposed');
  }

  // --- 드래그 로직 ---

  private handleDragStart(e: MouseEvent): void {
    if (!this.container) return;
    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    const containerRect = this.container.getBoundingClientRect();
    this.dragOffsetX = e.clientX - containerRect.left;
    this.dragOffsetY = e.clientY - containerRect.top;

    document.addEventListener('mousemove', this.boundDragMove);
    document.addEventListener('mouseup', this.boundDragEnd);
  }

  private handleDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.container || !this.player) return;
    e.preventDefault();

    const playerRect = this.player.getBoundingClientRect();
    const newLeft = e.clientX - playerRect.left - this.dragOffsetX;
    const newTop = e.clientY - playerRect.top - this.dragOffsetY;

    // bottom/transform 기반 → top/left 기반으로 전환
    this.container.style.bottom = 'auto';
    this.container.style.transform = 'none';
    this.container.style.left = `${newLeft}px`;
    this.container.style.top = `${newTop}px`;

    this.posX = newLeft;
    this.posY = newTop;
  }

  private handleDragEnd(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
  }

  private findVideoPlayer(): HTMLElement | null {
    return document.querySelector('#movie_player');
  }
}
