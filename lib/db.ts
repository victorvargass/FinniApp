/**
 * Compatibility facade for older internal imports.
 *
 * Product code should use `repositories/*`; database domain modules use the
 * private transactional engine directly so this entry point stays minimal.
 */
export * from './database/engine';
