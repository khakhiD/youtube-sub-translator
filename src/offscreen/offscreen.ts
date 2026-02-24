import Tesseract from 'tesseract.js';
import { MSG } from '../shared/messages';
import type { OcrProcessMessage } from '../shared/messages';

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
    worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
      // MV3 CSP는 blob: Worker를 차단하므로 파일 기반 로드 사용
      workerBlobURL: false,
      workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
      corePath: chrome.runtime.getURL('tesseract/core/'),
      // langPath는 기본값(jsdelivr CDN)을 사용 — fetch()는 CSP에 제한 없음
      logger: (m: { status: string; progress: number }) => {
        console.log(`[OCR-Offscreen] ${m.status} (${(m.progress * 100).toFixed(0)}%)`);
      },
    });

    // 자막에 최적화된 파라미터
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      // 영어 자막에 나올 수 있는 문자만 허용 (노이즈 문자 차단)
      tessedit_char_whitelist:
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?\'"-:;()&',
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

/** data URL → tesseract 인식 → 후처리 */
async function recognizeFromDataUrl(imageDataUrl: string): Promise<string> {
  const w = await initWorker();
  if (!w) throw new Error('OCR worker not available');

  const { data } = await w.recognize(imageDataUrl);
  return cleanOcrText(data.text);
}

/** OCR 결과 후처리: 노이즈 라인 제거, 공백 정리 */
function cleanOcrText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length < 2) return false;
      // 알파벳이 전체의 40% 미만이면 노이즈로 판단
      const letters = line.replace(/[^a-zA-Z]/g, '').length;
      return letters / line.length >= 0.4;
    })
    .join('\n')
    .trim();
}

// Background로부터 OCR_PROCESS 메시지 수신 (OCR_REQUEST와 분리하여 라우팅 충돌 방지)
chrome.runtime.onMessage.addListener(
  (message: OcrProcessMessage, _sender, sendResponse) => {
    if (message.type !== MSG.OCR_PROCESS) return false;

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
