/** 화면 내 사각형 영역 (ROI 등) */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 오버레이에 표시할 자막 데이터 */
export interface SubtitleEntry {
  originalText: string;
  translatedText: string;
  timestamp: number;
}

/** 확장 전체 상태 */
export interface AppState {
  isActive: boolean;
  roi: Rect | null;
  currentSubtitle: SubtitleEntry | null;
}

/** 파이프라인 각 모듈이 구현하는 인터페이스 */
export interface Disposable {
  dispose(): void;
}
