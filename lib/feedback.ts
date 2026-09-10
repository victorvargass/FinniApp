import { t, type TranslationKey } from './i18n';
import { showToast } from './toast';

export function errorMessage(error: unknown, fallback: TranslationKey = 'common.tryAgain'): string {
  return error instanceof Error && error.message ? error.message : t(fallback);
}

export function showFeedback(message: string, _title: TranslationKey = 'common.done'): void {
  showToast(message);
}
