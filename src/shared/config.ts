export const CONFIG = {
  /** OCR 캡처 주기 (ms) - 약 1fps */
  captureIntervalMs: 1000,

  /** 오버레이 기본 위치 (화면 하단 중앙) */
  overlay: {
    bottom: 80,
    fontSize: 20,
    maxWidth: 700,
  },

  /** 중복 제거 - 이전 텍스트와의 유사도 임계값 (0~1) */
  dedupThreshold: 0.85,

  /** 로그 접두사 */
  logPrefix: '[YT-SubTranslator]',
} as const;
