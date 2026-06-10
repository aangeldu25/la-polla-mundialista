"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GoogleButton } from "@/components/ui/GoogleButton";
import {
  loginWithEmail,
  loginWithGoogle,
  ensureUserProfile,
} from "@/lib/auth/actions";

const schema = z.object({
  email: z.email("Correo inválido"),
  password: z.string().min(1, "Requerida"),
});

type FormData = z.infer<typeof schema>;

export default function IngresarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    setInfo(null);
    try {
      await loginWithEmail(data.email, data.password);
      router.push("/dashboard");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError(
        err.code === "auth/invalid-credential"
          ? "Correo o contraseña incorrectos"
          : (err.message ?? "Error al ingresar"),
      );
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const user = await loginWithGoogle();
      // En Safari iOS puede caer a redirect y retornar null — AuthProvider
      // consume el resultado al recargar.
      if (!user) return;
      await ensureUserProfile({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "Mundialista",
        photoURL: user.photoURL,
      });
      router.push("/dashboard");
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Error con Google");
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <Card className="max-w-md">
        <CardHeader title="Ingresar" subtitle="Bienvenido de vuelta." />

        <GoogleButton onClick={handleGoogle} loading={loadingGoogle} />

        <div className="flex items-center gap-3 my-6">
          <span className="h-px flex-1 bg-gray-300" />
          <span className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
            o
          </span>
          <span className="h-px flex-1 bg-gray-300" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Correo"
            type="email"
            autoComplete="email"
            {...register("email")}
            error={errors.email?.message}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            {...register("password")}
            error={errors.password?.message}
          />

          {error && (
            <p className="text-sm font-medium text-[var(--pmfu-magenta)]">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm font-medium text-[var(--pmfu-mint)]">
              {info}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="mt-2">
            Ingresar
          </Button>

          <Link
            href="/recuperar"
            className="text-xs font-medium text-gray-700 hover:text-[var(--pmfu-cobalt)] text-center mt-1"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>

        <p className="mt-6 text-sm text-gray-800 text-center">
          ¿No tienes cuenta?{" "}
          <Link
            href="/registro"
            className="text-[var(--pmfu-cobalt)] font-bold hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </Card>
    </main>
  );
}
