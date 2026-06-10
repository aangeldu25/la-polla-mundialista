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
  registerWithEmail,
  loginWithGoogle,
  ensureUserProfile,
} from "@/lib/auth/actions";

const schema = z.object({
  displayName: z.string().min(2, "Mínimo 2 caracteres").max(40),
  email: z.email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function RegistroPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await registerWithEmail(data.email, data.password, data.displayName);
      // Email de confirmación enviado dentro de registerWithEmail.
      router.push("/onboarding?welcome=1");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError(
        err.code === "auth/email-already-in-use"
          ? "Este correo ya está registrado. Intenta ingresar."
          : (err.message ?? "Error al registrar"),
      );
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      const user = await loginWithGoogle();
      // En Safari iOS, loginWithGoogle puede iniciar un redirect y retornar null.
      // En ese caso la app se recarga y AuthProvider consume el redirect.
      if (!user) return;
      await ensureUserProfile({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "Mundialista",
        photoURL: user.photoURL,
      });
      router.push("/onboarding");
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
        <CardHeader
          title="Crear cuenta"
          subtitle="Únete a la La Polla Mundialista."
        />

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
            label="Nombre"
            placeholder="Tu nombre"
            autoComplete="name"
            {...register("displayName")}
            error={errors.displayName?.message}
          />
          <Input
            label="Correo"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            {...register("email")}
            error={errors.email?.message}
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            {...register("password")}
            error={errors.password?.message}
          />

          {error && (
            <p className="text-sm font-medium text-[var(--pmfu-magenta)]">
              {error}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="mt-2">
            Crear cuenta
          </Button>
        </form>

        <p className="mt-6 text-sm text-gray-800 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/ingresar"
            className="text-[var(--pmfu-cobalt)] font-bold hover:underline"
          >
            Ingresa
          </Link>
        </p>
      </Card>
    </main>
  );
}
