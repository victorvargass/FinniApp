import { useCallback, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import * as db from '@/repositories';
import { logAppError } from '@/lib/logger';
import type { Settings } from '@/lib/types';

type Refresh = () => Promise<void>;

type PeriodActionOptions = {
  settings: Settings;
  refresh: Refresh;
  selectedPeriodIdRef: MutableRefObject<number | null>;
  skipNextSelectedPeriodRefreshRef: MutableRefObject<boolean>;
  setSelectedPeriodId: Dispatch<SetStateAction<number | null>>;
};

export function usePeriodActions({
  settings,
  refresh,
  selectedPeriodIdRef,
  skipNextSelectedPeriodRefreshRef,
  setSelectedPeriodId,
}: PeriodActionOptions) {
  const setPeriodStartDate = useCallback(async (date: string) => {
    const period = settings.currentPeriod;
    if (!period) return;
    await db.setPeriodStartDate(period.id, date);
    await refresh();
  }, [settings.currentPeriod, refresh]);

  const setPeriodEndDate = useCallback(async (date: string) => {
    const period = settings.currentPeriod;
    if (!period) return;
    await db.setPeriodEndDate(period.id, date);
    await refresh();
  }, [settings.currentPeriod, refresh]);

  const setPeriodDates = useCallback(async (startDate: string, endDate: string) => {
    const period = settings.currentPeriod;
    if (!period) return;
    await db.setPeriodDates(period.id, startDate, endDate);
    await refresh();
  }, [settings.currentPeriod, refresh]);

  const closeCurrentPeriod = useCallback(async () => {
    const nextPeriod = await db.closeCurrentPeriod();
    selectedPeriodIdRef.current = nextPeriod.id;
    skipNextSelectedPeriodRefreshRef.current = true;
    setSelectedPeriodId(nextPeriod.id);
    void refresh().catch((error) => {
      logAppError('database.refresh', error);
    });
    return nextPeriod;
  }, [refresh, selectedPeriodIdRef, setSelectedPeriodId, skipNextSelectedPeriodRefreshRef]);

  const selectPeriod = useCallback((periodId: number) => {
    selectedPeriodIdRef.current = periodId;
    setSelectedPeriodId(periodId);
  }, [selectedPeriodIdRef, setSelectedPeriodId]);

  return useMemo(() => ({
    setPeriodStartDate,
    setPeriodEndDate,
    setPeriodDates,
    closeCurrentPeriod,
    selectPeriod,
  }), [closeCurrentPeriod, selectPeriod, setPeriodDates, setPeriodEndDate, setPeriodStartDate]);
}
