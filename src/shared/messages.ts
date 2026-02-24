/** Content script ↔ Background 간 메시지 타입 */

export const MSG = {
  TOGGLE_ACTIVE: 'TOGGLE_ACTIVE',
  GET_STATE: 'GET_STATE',
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}
