/**
 * 프레임 변화 감지 모듈 — 시간적 안정성(temporal stability) 기반.
 *
 * 핵심 원리:
 * - 배경 영상 변화: 매 프레임 다른 픽셀 패턴 → "안정되지 않음" → OCR 트리거 안 함
 * - 새 자막 등장: 동일 패턴이 여러 프레임 유지 → "안정됨" → OCR 트리거
 *
 * 흐름:
 * 1. 캡처된 프레임을 이진화(밝은 픽셀=텍스트)하여 fingerprint 생성
 * 2. 텍스트 픽셀 비율 체크 → 너무 적으면 "자막 없음"
 * 3. 현재 안정 패턴과 비교 → 같으면 "변화 없음"
 * 4. 다르면 후보(candidate)로 등록, 연속 N프레임 유지 시 "변화 확정"
 */

/** 샘플링 간격 (4px마다 = 전체 1/16) */
const SAMPLE_STEP = 4;

/** 밝기 임계값 — 흰 텍스트만 추출 (200으로 올려 배경 밝은 부분 필터) */
const BRIGHTNESS_THRESHOLD = 200;

/** 두 fingerprint가 "유사"하다고 판단하는 차이 비율 */
const SIMILARITY_THRESHOLD = 0.02;

/** 새 패턴이 확정되려면 연속으로 유지해야 하는 프레임 수 */
const STABILITY_FRAMES = 2;

/** 텍스트 픽셀이 이 비율 미만이면 "자막 없음" */
const MIN_TEXT_RATIO = 0.005;

export type FrameAnalysis = 'unchanged' | 'no-text' | 'changed';

export class FrameDiff {
  private stableFingerprint: Uint8Array | null = null;
  private candidateFingerprint: Uint8Array | null = null;
  private candidateCount = 0;

  /**
   * 프레임 분석 결과:
   * - 'unchanged': 자막 동일 (OCR 스킵)
   * - 'no-text': 자막 없음 (OCR 스킵)
   * - 'changed': 새 자막 감지 (OCR 실행)
   */
  analyze(imageData: ImageData): FrameAnalysis {
    const fp = this.toFingerprint(imageData);

    // 텍스트 픽셀 비율 확인
    const textRatio = this.calcTextRatio(fp);
    if (textRatio < MIN_TEXT_RATIO) {
      this.candidateFingerprint = null;
      this.candidateCount = 0;
      return 'no-text';
    }

    // 최초 프레임
    if (!this.stableFingerprint) {
      this.stableFingerprint = fp;
      return 'changed';
    }

    // 안정 패턴과 비교 — 동일하면 변화 없음
    if (this.isSimilar(fp, this.stableFingerprint)) {
      this.candidateFingerprint = null;
      this.candidateCount = 0;
      return 'unchanged';
    }

    // 안정 패턴과 다름 — 후보 패턴과 비교
    if (this.candidateFingerprint && this.isSimilar(fp, this.candidateFingerprint)) {
      this.candidateCount++;
      if (this.candidateCount >= STABILITY_FRAMES) {
        // 후보가 안정됨 → 새 자막 확정
        this.stableFingerprint = fp;
        this.candidateFingerprint = null;
        this.candidateCount = 0;
        return 'changed';
      }
      return 'unchanged'; // 아직 확인 중
    }

    // 새로운 후보 등록
    this.candidateFingerprint = fp;
    this.candidateCount = 1;
    return 'unchanged'; // 첫 프레임이므로 확인 대기
  }

  reset(): void {
    this.stableFingerprint = null;
    this.candidateFingerprint = null;
    this.candidateCount = 0;
  }

  /** 이진화 fingerprint 생성: 밝은 픽셀 = 1 (텍스트), 나머지 = 0 */
  private toFingerprint(imageData: ImageData): Uint8Array {
    const { width, height, data } = imageData;
    const sampledW = Math.ceil(width / SAMPLE_STEP);
    const sampledH = Math.ceil(height / SAMPLE_STEP);
    const result = new Uint8Array(sampledW * sampledH);

    let idx = 0;
    for (let y = 0; y < height; y += SAMPLE_STEP) {
      for (let x = 0; x < width; x += SAMPLE_STEP) {
        const i = (y * width + x) * 4;
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        result[idx++] = gray >= BRIGHTNESS_THRESHOLD ? 1 : 0;
      }
    }

    return result;
  }

  /** 두 fingerprint가 유사한지 비교 */
  private isSimilar(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff / a.length < SIMILARITY_THRESHOLD;
  }

  /** fingerprint에서 텍스트 픽셀(값=1)의 비율 계산 */
  private calcTextRatio(fp: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < fp.length; i++) {
      if (fp[i] === 1) count++;
    }
    return count / fp.length;
  }
}
