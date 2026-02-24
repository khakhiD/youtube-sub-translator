import Tesseract from 'tesseract.js';
import { MSG } from '../shared/messages';
import type { OcrRequestMessage } from '../shared/messages';

/**
 * Offscreen Document - OCR 전용 실행 컨텍스트.
 *
 * 유튜브 페이지의 CSP가 blob: Worker를 차단하기 때문에,
 * tesseract.js Worker는 이 offscreen document에서 실행.
 * Background service worker를 통해 content script와 통신.
 */

let worker: Tesseract.Worker | null = null;
let initializing = false;

async function initWorker(): Promise<Tesseract.Worker | null> {
  if (worker) return worker;
  if (initializing) return null;

  initializing = true;
  try {
    console.log('[OCR-Offscreen] Initializing tesseract worker...');
    worker = await Tesseract.createWorker('eng', Tesseract.OEM.DEFAULT, {
      logger: (m: { status: string; progress: number }) => {
        console.log(`[OCR-Offscreen] ${m.status} (${(m.progress * 100).toFixed(0)}%)`);
      },
    });
    console.log('[OCR-Offscreen] Worker ready');
    return worker;
  } catch (err) {
    console.error('[OCR-Offscreen] Worker init failed:', err);
    return null;
  } finally {
    initializing = false;
  }
}

/** data URL → canvas → tesseract 인식 */
async function recognizeFromDataUrl(imageDataUrl: string): Promise<string> {
  const w = await initWorker();
  if (!w) throw new Error('OCR worker not available');

  const { data } = await w.recognize(imageDataUrl);
  return data.text.trim();
}

// Background로부터 메시지 수신
chrome.runtime.onMessage.addListener(
  (message: OcrRequestMessage, _sender, sendResponse) => {
    if (message.type !== MSG.OCR_REQUEST) return false;

    // async 응답을 위해 true 반환
    recognizeFromDataUrl(message.payload.imageDataUrl)
      .then((text) => {
        sendResponse({ type: MSG.OCR_RESULT, payload: { text } });
      })
      .catch((err) => {
        sendResponse({
          type: MSG.OCR_RESULT,
          payload: { text: '', error: String(err) },
        });
      });

    return true; // sendResponse를 비동기로 사용
  },
);

// 준비 완료 알림
console.log('[OCR-Offscreen] Document loaded');
