import { t, type TranslationKey } from './i18n';
import { showToast } from './toast';
import { isTechnicalErrorMessage } from './user-facing-error';

export function errorMessage(error: unknown, fallback: TranslationKey = 'common.tryAgain'): string {
  if (!(error instanceof Error) || !error.message) return t(fallback);
  return isTechnicalErrorMessage(error.message) ? t('errors.technical') : error.message;
}

export function showFeedback(message: string, _title: TranslationKey = 'common.done'): void {
  showToast(message);
}
