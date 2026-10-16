import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "super_admin" | "admin" | "supervisor" | "agent";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const uid = session?.user.id;
  const roles = useQuery({
    queryKey: ["roles", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid!);
      const r = (data ?? []).map((x) => x.role as Role);
      if (typeof window !== "undefined") localStorage.setItem("bfp-roles", JSON.stringify(r));
      return r;
    },
    placeholderData: () => {
      try { return JSON.parse(localStorage.getItem("bfp-roles") || "[]") as Role[]; } catch { return []; }
    },
  });
  const r = roles.data ?? [];
  return {
    ready,
    session,
    user: session?.user ?? null,
    roles: r,
    isStaff: r.some((x) => x === "super_admin" || x === "admin" || x === "supervisor"),
    isAdmin: r.some((x) => x === "super_admin" || x === "admin"),
  };
}
