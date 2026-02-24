import { CONFIG } from '../shared/config';
import type { SubtitleEntry, Disposable } from '../shared/types';
import type { Settings } from '../shared/settings';

const OVERLAY_ID = 'yt-sub-translator-overlay';
const CONTROL_ID = 'yt-sub-translator-control';

/**
 * 번역 자막을 유튜브 비디오 위에 오버레이로 표시하는 모듈.
 * Shadow DOM으로 스타일 격리. 드래그로 위치 이동 가능.
 * Settings 변경에 실시간 반응.
 */
export class SubtitleOverlay implements Disposable {
  private container: HTMLDivElement | null = null;
  private controlBar: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private originalEl: HTMLDivElement | null = null;
  private translatedEl: HTMLDivElement | null = null;
  private selectRoiBtn: HTMLButtonElement | null = null;
  private clearRoiBtn: HTMLButtonElement | null = null;
  private onSelectRoi: (() => void) | null = null;
  private onClearRoi: (() => void) | null = null;
  private player: HTMLElement | null = null;

  // 드래그 상태
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private positioned = false; // 사용자가 드래그로 위치를 잡았는지

  // 자동 숨김
  private hideTimer: number | null = null;

  private boundDragMove = this.handleDragMove.bind(this);
  private boundDragEnd = this.handleDragEnd.bind(this);

  /** 오버레이 DOM을 비디오 플레이어 위에 생성 */
  init(callbacks?: { onSelectRoi?: () => void; onClearRoi?: () => void }): void {
    this.onSelectRoi = callbacks?.onSelectRoi ?? null;
    this.onClearRoi = callbacks?.onClearRoi ?? null;

    if (document.getElementById(OVERLAY_ID)) return;

    this.player = document.querySelector('#movie_player');
    if (!this.player) return;

    // --- 자막 오버레이 (Shadow DOM) ---
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
      .subtitle-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        pointer-events: auto;
        cursor: grab;
        user-select: none;
        padding: 6px 14px;
        border-radius: 6px;
        max-width: ${CONFIG.overlay.maxWidth}px;
      }
      .subtitle-box:active { cursor: grabbing; }
      .original {
        font-size: 13px;
        color: #ccc;
        text-align: center;
        line-height: 1.3;
        white-space: pre-wrap;
        word-break: keep-all;
      }
      .original:empty { display: none; }
      .translated {
        font-size: 20px;
        color: #fff;
        text-align: center;
        text-shadow:
          -1px -1px 0 #000,
           1px -1px 0 #000,
          -1px  1px 0 #000,
           1px  1px 0 #000;
        font-family: 'Arial', sans-serif;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: keep-all;
      }
      .translated:empty { display: none; }
    `;

    const box = document.createElement('div');
    box.className = 'subtitle-box';

    this.originalEl = document.createElement('div');
    this.originalEl.className = 'original';

    this.translatedEl = document.createElement('div');
    this.translatedEl.className = 'translated';

    box.appendChild(this.originalEl);
    box.appendChild(this.translatedEl);
    box.addEventListener('mousedown', (e) => this.handleDragStart(e));

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(box);

    this.player.style.position = 'relative';
    this.player.appendChild(this.container);

    // --- 컨트롤 바 ---
    this.controlBar = document.createElement('div');
    this.controlBar.id = CONTROL_ID;
    this.controlBar.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10001;
      display: flex;
      gap: 6px;
      transition: opacity 0.3s;
    `;

    this.selectRoiBtn = this.createBtn('ROI 선택', '#00ff88');
    this.selectRoiBtn.addEventListener('click', () => this.onSelectRoi?.());

    this.clearRoiBtn = this.createBtn('ROI 초기화', '#ff6b6b');
    this.clearRoiBtn.style.display = 'none';
    this.clearRoiBtn.addEventListener('click', () => this.onClearRoi?.());

    this.controlBar.appendChild(this.selectRoiBtn);
    this.controlBar.appendChild(this.clearRoiBtn);
    this.player.appendChild(this.controlBar);

    console.log(CONFIG.logPrefix, 'Overlay initialized');
  }

  /** 자막 텍스트 업데이트 */
  update(subtitle: SubtitleEntry | null): void {
    if (!this.translatedEl || !this.originalEl) return;

    if (subtitle && subtitle.translatedText.trim()) {
      this.originalEl.textContent = subtitle.originalText || '';
      this.translatedEl.textContent = subtitle.translatedText;
    } else {
      this.originalEl.textContent = '';
      this.translatedEl.textContent = '';
    }
  }

  /** 설정 변경 시 오버레이 스타일 즉시 반영 */
  applySettings(s: Settings): void {
    if (!this.shadowRoot) return;

    const box = this.shadowRoot.querySelector('.subtitle-box') as HTMLElement;
    if (box) {
      box.style.background = `rgba(0, 0, 0, ${s.bgOpacity / 100})`;
    }

    if (this.translatedEl) {
      this.translatedEl.style.fontSize = `${s.fontSize}px`;
    }
    if (this.originalEl) {
      this.originalEl.style.display = s.showOriginal ? '' : 'none';
      this.originalEl.style.fontSize = `${Math.max(s.fontSize - 4, 12)}px`;
    }

    // 컨트롤 자동 숨김
    if (this.controlBar && this.player) {
      if (s.autoHideControls) {
        this.controlBar.style.opacity = '0';
        // 플레이어 호버 시 표시
        this.player.onmouseenter = () => {
          if (this.controlBar) this.controlBar.style.opacity = '1';
          if (this.hideTimer) clearTimeout(this.hideTimer);
        };
        this.player.onmouseleave = () => {
          this.hideTimer = window.setTimeout(() => {
            if (this.controlBar) this.controlBar.style.opacity = '0';
          }, 1500);
        };
      } else {
        this.controlBar.style.opacity = '1';
        this.player.onmouseenter = null;
        this.player.onmouseleave = null;
      }
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

  /** 선택 모드 진입/종료 시 컨트롤 바 활성화 상태 변경 */
  setSelecting(selecting: boolean): void {
    if (this.controlBar) {
      this.controlBar.style.display = selecting ? 'none' : 'flex';
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
    this.originalEl = null;
    this.translatedEl = null;
    this.selectRoiBtn = null;
    this.clearRoiBtn = null;
  }

  // --- 드래그 ---

  private handleDragStart(e: MouseEvent): void {
    if (!this.container) return;
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;

    const rect = this.container.getBoundingClientRect();
    this.dragOffsetX = e.clientX - rect.left;
    this.dragOffsetY = e.clientY - rect.top;

    document.addEventListener('mousemove', this.boundDragMove);
    document.addEventListener('mouseup', this.boundDragEnd);
  }

  private handleDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.container || !this.player) return;
    e.preventDefault();

    const pr = this.player.getBoundingClientRect();
    this.container.style.bottom = 'auto';
    this.container.style.transform = 'none';
    this.container.style.left = `${e.clientX - pr.left - this.dragOffsetX}px`;
    this.container.style.top = `${e.clientY - pr.top - this.dragOffsetY}px`;
    this.positioned = true;
  }

  private handleDragEnd(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
  }

  private createBtn(text: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      background: rgba(0,0,0,0.7);
      color: ${color};
      border: 1px solid ${color};
      border-radius: 4px;
      cursor: pointer;
      font-family: Arial, sans-serif;
    `;
    return btn;
  }

  private findVideoPlayer(): HTMLElement | null {
    return document.querySelector('#movie_player');
  }
}
