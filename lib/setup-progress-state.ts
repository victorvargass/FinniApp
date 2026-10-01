export const DEFAULT_CATEGORY_COUNT = 13;

export function hasUserCreatedCategory(categories: ReadonlyArray<{ id: number }>): boolean {
  return categories.some((category) => category.id > DEFAULT_CATEGORY_COUNT);
}
