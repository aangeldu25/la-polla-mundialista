"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { resetPassword } from "@/lib/auth/actions";

const schema = z.object({
  email: z.email("Correo inválido"),
});

type FormData = z.infer<typeof schema>;

export default function RecuperarPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await resetPassword(data.email);
      setSentTo(data.email);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError(
        err.code === "auth/user-not-found"
          ? "No encontramos una cuenta con ese correo."
          : (err.message ?? "Error enviando el correo"),
      );
    }
  }

  if (sentTo) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <Card className="max-w-md">
          <CardHeader
            title="Revisa tu correo"
            subtitle={`Te enviamos las instrucciones a ${sentTo}.`}
          />
          <ol className="text-sm text-gray-900 space-y-3 list-decimal pl-5 mt-4">
            <li>
              Abre el correo de <strong>Firebase Auth</strong> (revisa también
              la carpeta de Spam si no lo ves en la bandeja principal).
            </li>
            <li>
              Click en el botón <strong>&quot;Restablecer contraseña&quot;</strong>{" "}
              del correo.
            </li>
            <li>Escribe tu nueva contraseña en la página que se abre.</li>
            <li>
              Vuelve aquí e{" "}
              <Link
                href="/ingresar"
                className="text-[var(--pmfu-cobalt)] font-bold underline"
              >
                inicia sesión
              </Link>{" "}
              con la nueva contraseña.
            </li>
          </ol>
          <p className="text-xs text-gray-700 mt-6">
            ¿No te llegó el correo en 2-3 minutos?{" "}
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="text-[var(--pmfu-cobalt)] font-bold underline"
            >
              Intentar de nuevo
            </button>
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <Card className="max-w-md">
        <CardHeader
          title="Recuperar contraseña"
          subtitle="Te enviamos un correo con un link para crear una nueva."
        />

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Tu correo de la cuenta"
            type="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            {...register("email")}
            error={errors.email?.message}
          />

          {error && (
            <p className="text-sm font-medium text-[var(--pmfu-magenta)]">
              {error}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="mt-2">
            Enviar correo de recuperación
          </Button>
        </form>

        <p className="mt-6 text-sm text-gray-800 text-center">
          <Link
            href="/ingresar"
            className="text-[var(--pmfu-cobalt)] font-bold hover:underline"
          >
            ← Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    </main>
  );
}
