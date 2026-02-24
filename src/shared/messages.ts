/** Content script ↔ Background ↔ Offscreen 간 메시지 타입 */

export const MSG = {
  TOGGLE_ACTIVE: 'TOGGLE_ACTIVE',
  GET_STATE: 'GET_STATE',
  OCR_REQUEST: 'OCR_REQUEST',
  OCR_RESULT: 'OCR_RESULT',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

/** OCR 요청: content → background → offscreen */
export interface OcrRequestMessage {
  type: typeof MSG.OCR_REQUEST;
  payload: {
    imageDataUrl: string;
  };
}

/** OCR 결과: offscreen → background → content */
export interface OcrResultMessage {
  type: typeof MSG.OCR_RESULT;
  payload: {
    text: string;
    error?: string;
  };
}
