/**
 * On 401 (UNAUTHORIZED), redirect to login for re-authentication.
 * Clerk session tokens are sent per-request via Authorization header.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { getLoginUrl } from "@/const";

const REFRESH_COOLDOWN_MS = 15_000;

export function AuthRefreshHandler() {
  const queryClient = useQueryClient();
  const lastAttemptRef = useRef<number>(0);

  useEffect(() => {
    const shouldRedirect = (): boolean => {
      const now = Date.now();
      if (now - lastAttemptRef.current < REFRESH_COOLDOWN_MS) return false;
      lastAttemptRef.current = now;
      return true;
    };

    const unsubQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error" || !("query" in event)) return;
      const err = event.query.state.error;
      if (!(err instanceof TRPCClientError) || err.message !== UNAUTHED_ERR_MSG) return;
      if (shouldRedirect() && typeof window !== "undefined") window.location.href = getLoginUrl();
    });

    const unsubMutation = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error" || !("mutation" in event)) return;
      const err = event.mutation.state.error;
      if (!(err instanceof TRPCClientError) || err.message !== UNAUTHED_ERR_MSG) return;
      if (shouldRedirect() && typeof window !== "undefined") window.location.href = getLoginUrl();
    });

    return () => {
      unsubQuery();
      unsubMutation();
    };
  }, [queryClient]);

  return null;
}
