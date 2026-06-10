"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, profile, loading, needsOnboarding, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/ingresar");
      return;
    }
    if (needsOnboarding && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [user, profile, loading, needsOnboarding, pathname, router]);

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="pmfu-glass rounded-3xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-[var(--pmfu-magenta)] mb-3">
            Error de configuración
          </h2>
          <p className="text-sm text-gray-800">{error}</p>
          <p className="text-xs text-gray-700 mt-4">
            Si eres el admin: despliega las reglas con{" "}
            <code className="bg-gray-200 px-1 rounded text-gray-900">
              firebase deploy
            </code>
            .
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
