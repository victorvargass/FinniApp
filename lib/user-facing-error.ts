const TECHNICAL_ERROR_PATTERNS = [
  /Call to function ['"]?(?:NativeStatement|NativeDatabase)\./i,
  /\b(?:UNIQUE|FOREIGN KEY|CHECK|NOT NULL) constraint failed\b/i,
  /\bSQLITE_[A-Z_]+\b/,
  /\bno such (?:table|column)\b/i,
  /\bdatabase is locked\b/i,
  /\b(?:prepareAsync|finalizeAsync)\b/i,
];

export function isTechnicalErrorMessage(message: string): boolean {
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
