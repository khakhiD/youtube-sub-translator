import { CONFIG } from '../shared/config';
import type { Rect, Disposable } from '../shared/types';

const ROI_CONTAINER_ID = 'yt-sub-translator-roi';

export type RoiCallback = (roi: Rect) => void;

/**
 * 비디오 플레이어 위에서 드래그로 ROI(관심 영역)를 선택하는 UI.
 *
 * 동작 흐름:
 * 1. enterSelectionMode() 호출 → 비디오 위에 반투명 오버레이 + crosshair 커서
 * 2. 마우스 드래그로 사각형 영역 그리기
 * 3. mouseup → ROI 확정, 콜백 호출
 * 4. 선택된 영역을 점선 테두리로 표시
 */
export class RoiSelector implements Disposable {
  private player: HTMLElement | null = null;
  private selectionOverlay: HTMLDivElement | null = null;
  private roiBox: HTMLDivElement | null = null;
  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private onRoiSelected: RoiCallback | null = null;

  private onCancel: (() => void) | null = null;

  // 바운드 핸들러 (removeEventListener를 위해 참조 보관)
  private boundMouseDown = this.handleMouseDown.bind(this);
  private boundMouseMove = this.handleMouseMove.bind(this);
  private boundMouseUp = this.handleMouseUp.bind(this);

  /** ROI 선택 모드 진입 */
  enterSelectionMode(onSelected: RoiCallback, onCancel?: () => void): void {
    this.player = document.querySelector('#movie_player');
    if (!this.player) {
      console.warn(CONFIG.logPrefix, 'Cannot enter ROI selection: player not found');
      return;
    }

    this.onRoiSelected = onSelected;
    this.onCancel = onCancel ?? null;
    this.clearExistingRoi();
    this.createSelectionOverlay();

    console.log(CONFIG.logPrefix, 'ROI selection mode entered');
  }

  /** 현재 ROI 표시 제거 */
  clearExistingRoi(): void {
    this.roiBox?.remove();
    this.roiBox = null;
  }

  dispose(): void {
    this.exitSelectionMode();
    this.clearExistingRoi();
    console.log(CONFIG.logPrefix, 'ROI selector disposed');
  }

  /** 선택 모드용 반투명 오버레이 생성 */
  private createSelectionOverlay(): void {
    if (!this.player) return;

    this.selectionOverlay = document.createElement('div');
    this.selectionOverlay.id = ROI_CONTAINER_ID;
    this.selectionOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      cursor: crosshair;
      z-index: 10000;
    `;

    // 상단 바: 안내 텍스트 + 취소 버튼
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(0,0,0,0.7);
      padding: 6px 16px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      z-index: 1;
    `;

    const hint = document.createElement('span');
    hint.style.cssText = `color: #fff; font-size: 14px; pointer-events: none;`;
    hint.textContent = '자막 영역을 드래그로 선택하세요';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.style.cssText = `
      padding: 3px 10px;
      font-size: 12px;
      background: rgba(255,255,255,0.15);
      color: #ff6b6b;
      border: 1px solid #ff6b6b;
      border-radius: 3px;
      cursor: pointer;
      font-family: Arial, sans-serif;
    `;
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log(CONFIG.logPrefix, 'ROI selection cancelled');
      this.exitSelectionMode();
      this.onCancel?.();
    });

    topBar.appendChild(hint);
    topBar.appendChild(cancelBtn);
    this.selectionOverlay.appendChild(topBar);

    this.player.style.position = 'relative';
    this.player.appendChild(this.selectionOverlay);

    // 이벤트 바인딩
    this.selectionOverlay.addEventListener('mousedown', this.boundMouseDown);
  }

  private handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    if (!this.selectionOverlay) return;

    const rect = this.selectionOverlay.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;
    this.isSelecting = true;

    // 드래그 중 그려질 박스
    this.roiBox = document.createElement('div');
    this.roiBox.style.cssText = `
      position: absolute;
      border: 2px solid #00ff88;
      background: rgba(0, 255, 136, 0.15);
      pointer-events: none;
    `;
    this.selectionOverlay.appendChild(this.roiBox);

    // mousemove/mouseup은 document에 걸어야 overlay 밖으로 나가도 동작
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isSelecting || !this.selectionOverlay || !this.roiBox) return;

    const rect = this.selectionOverlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // 음수 방향 드래그도 지원
    const x = Math.min(this.startX, currentX);
    const y = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    this.roiBox.style.left = `${x}px`;
    this.roiBox.style.top = `${y}px`;
    this.roiBox.style.width = `${width}px`;
    this.roiBox.style.height = `${height}px`;
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isSelecting || !this.selectionOverlay || !this.roiBox) return;

    this.isSelecting = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);

    const rect = this.selectionOverlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const roi: Rect = {
      x: Math.min(this.startX, currentX),
      y: Math.min(this.startY, currentY),
      width: Math.abs(currentX - this.startX),
      height: Math.abs(currentY - this.startY),
    };

    // 너무 작은 영역은 무시 (실수 클릭 방지)
    if (roi.width < 20 || roi.height < 10) {
      console.log(CONFIG.logPrefix, 'ROI too small, ignoring');
      this.roiBox.remove();
      this.roiBox = null;
      return;
    }

    console.log(CONFIG.logPrefix, 'ROI selected:', roi);

    // 선택 오버레이 제거, ROI 표시 박스는 플레이어에 이동
    this.exitSelectionMode();
    this.showRoiIndicator(roi);
    this.onRoiSelected?.(roi);
  }

  /** 선택 모드 종료 (오버레이 제거, 이벤트 해제) */
  private exitSelectionMode(): void {
    this.isSelecting = false;
    this.selectionOverlay?.remove();
    this.selectionOverlay = null;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  /** 확정된 ROI를 잠깐 표시 후 fade out */
  private showRoiIndicator(roi: Rect): void {
    if (!this.player) return;

    this.roiBox = document.createElement('div');
    this.roiBox.style.cssText = `
      position: absolute;
      left: ${roi.x}px;
      top: ${roi.y}px;
      width: ${roi.width}px;
      height: ${roi.height}px;
      border: 1px solid rgba(0, 255, 136, 0.6);
      background: transparent;
      pointer-events: none;
      z-index: 9998;
      transition: opacity 0.8s ease-out;
    `;
    this.player.appendChild(this.roiBox);

    // 1.5초 후 fade out, 완전히 사라지면 DOM에서 제거
    setTimeout(() => {
      if (this.roiBox) {
        this.roiBox.style.opacity = '0';
        setTimeout(() => {
          this.roiBox?.remove();
          this.roiBox = null;
        }, 800);
      }
    }, 1500);
  }
}
