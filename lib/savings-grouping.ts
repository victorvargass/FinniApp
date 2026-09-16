import type { SavingsGroup } from './types';

export type SavingsSection<T> = {
  key: string;
  name: string;
  color: string;
  items: T[];
};

export function groupSavingsItems<T>(
  items: T[],
  groups: SavingsGroup[],
  getGroupId: (item: T) => number | null,
  unassignedName: string
): SavingsSection<T>[] {
  const sections = new Map<number | null, SavingsSection<T>>();
  for (const item of items) {
    const groupId = getGroupId(item);
    const group = groups.find((candidate) => candidate.id === groupId);
    const key = group?.id ?? null;
    const section = sections.get(key) ?? {
      key: key == null ? 'unassigned' : String(key),
      name: group?.name ?? unassignedName,
      color: group?.color ?? '#60758E',
      items: [],
    };
    section.items.push(item);
    sections.set(key, section);
  }
  return [...sections.values()].sort((a, b) =>
    a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : a.name.localeCompare(b.name, 'es')
  );
}
