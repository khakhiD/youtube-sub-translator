/** 사용자 설정 타입 */
export interface Settings {
  translateEnabled: boolean;
  showOriginal: boolean;
  autoHideControls: boolean;
  fontSize: number;       // 14–32
  bgOpacity: number;      // 0–100
  captureIntervalMs: number; // 500–3000
}

export const DEFAULT_SETTINGS: Settings = {
  translateEnabled: true,
  showOriginal: false,
  autoHideControls: false,
  fontSize: 20,
  bgOpacity: 50,
  captureIntervalMs: 1000,
};

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}
