/**
 * On 401 (UNAUTHORIZED), try to refresh the Supabase session and sync the app cookie
 * via auth.setSession. If refresh succeeds, invalidate auth.me so the app sees the new user.
 * If refresh fails, redirect to login.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { getLoginUrl } from "@/const";

const REFRESH_COOLDOWN_MS = 15_000;

export function AuthRefreshHandler() {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const setSessionMutation = trpc.auth.setSession.useMutation();
  const lastAttemptRef = useRef<number>(0);
  const setSessionRef = useRef(setSessionMutation.mutateAsync);
  setSessionRef.current = setSessionMutation.mutateAsync;

  useEffect(() => {
    const tryRefreshAndInvalidate = async (): Promise<boolean> => {
      const now = Date.now();
      if (now - lastAttemptRef.current < REFRESH_COOLDOWN_MS) return false;
      lastAttemptRef.current = now;

      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data?.session?.access_token) return false;
        await setSessionRef.current({
          accessToken: data.session.access_token,
          rememberMe: true,
        });
        await utils.auth.me.invalidate();
        return true;
      } catch {
        return false;
      }
    };

    const unsubQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error" || !("query" in event)) return;
      const err = event.query.state.error;
      if (!(err instanceof TRPCClientError) || err.message !== UNAUTHED_ERR_MSG) return;
      tryRefreshAndInvalidate().then((ok) => {
        if (!ok && typeof window !== "undefined") window.location.href = getLoginUrl();
      });
    });

    const unsubMutation = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error" || !("mutation" in event)) return;
      const err = event.mutation.state.error;
      if (!(err instanceof TRPCClientError) || err.message !== UNAUTHED_ERR_MSG) return;
      tryRefreshAndInvalidate().then((ok) => {
        if (!ok && typeof window !== "undefined") window.location.href = getLoginUrl();
      });
    });

    return () => {
      unsubQuery();
      unsubMutation();
    };
  }, [queryClient, utils]);

  return null;
}
