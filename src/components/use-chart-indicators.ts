'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/utils';
import type { ChartIndicatorData, TechnicalHorizon } from '@/lib/finance/chart-indicators';

export function useChartIndicatorData(instrumentId: string, horizon: TechnicalHorizon = 'short') {
  return useQuery({
    queryKey: ['chart-indicators', 'v3', instrumentId, horizon],
    queryFn: () =>
      api<ChartIndicatorData>(
        `chart-indicators?id=${encodeURIComponent(instrumentId)}&horizon=${horizon}`,
      ),
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
