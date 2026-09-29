import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendHomeAttentionDismissal,
  normalizeHomeAttentionDismissals,
  removeHomeAttentionDismissal,
} from './home-attention-state';

const STORAGE_KEY = '@finniapp/home-attention-dismissals-v1';

function parseDismissals(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return normalizeHomeAttentionDismissals(parsed);
  } catch {
    return [];
  }
}

export async function getHomeAttentionDismissals(): Promise<string[]> {
  return parseDismissals(await AsyncStorage.getItem(STORAGE_KEY));
}

export async function dismissHomeAttention(id: string): Promise<string[]> {
  const current = await getHomeAttentionDismissals();
  const next = appendHomeAttentionDismissal(current, id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function restoreHomeAttention(id: string): Promise<string[]> {
  const current = await getHomeAttentionDismissals();
  const next = removeHomeAttentionDismissal(current, id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function resetHomeAttentionDismissals(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
