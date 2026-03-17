import { QueryClient } from "@tanstack/react-query";

export function optimisticDelete<T extends { id: number }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  id: number
) {
  const previous = queryClient.getQueryData<T[]>(queryKey);
  if (previous) {
    queryClient.setQueryData<T[]>(queryKey, previous.filter((item) => item.id !== id));
  }
  return { previous };
}

export function optimisticUpdate<T extends { id: number }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  id: number,
  updates: Partial<T>
) {
  const previous = queryClient.getQueryData<T[]>(queryKey);
  if (previous) {
    queryClient.setQueryData<T[]>(
      queryKey,
      previous.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }
  return { previous };
}
