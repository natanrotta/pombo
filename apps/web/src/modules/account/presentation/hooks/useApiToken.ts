import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositories } from "@/core/di/repositories";
import { queryKeys } from "@/core/query/queryKeys";
import { useErrorHandler } from "@/core/query/useErrorHandler";

/** The account's active API-token metadata (null = never generated). */
export function useApiToken() {
  return useQuery({
    queryKey: queryKeys.account.apiToken(),
    queryFn: ({ signal }) => repositories.account.getApiToken(signal),
  });
}

/** Generates a new API token (revokes the previous). Returns the clear token
 *  once via the mutation result — the caller shows it exactly one time. */
export function useGenerateApiToken() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: () => repositories.account.generateApiToken(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.account.apiToken() }),
    onError: (error) => handleError(error),
  });
}
