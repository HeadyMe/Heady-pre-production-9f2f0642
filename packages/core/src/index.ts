export const HEADY_VERSION = '3.2.0';

export interface HeadyConfig {
  userId: string;
  domain: string;
  vectorDimension: number;
}

export class HeadyError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'HeadyError';
  }
}

export function validateUserId(userId: string): boolean {
  return userId.length > 0 && /^[a-zA-Z0-9_-]+$/.test(userId);
}
