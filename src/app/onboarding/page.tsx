"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { TeamSelect } from "@/components/ui/TeamSelect";
import {
  ensureUserProfile,
  uploadAvatar,
  updateUserProfile,
} from "@/lib/auth/actions";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, error: authError } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/ingresar");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(profile?.displayName ?? user.displayName ?? "");
      setPhotoPreview(profile?.photoURL ?? user.photoURL ?? null);
      setFavoriteTeam(profile?.favoriteTeamTla ?? "");
    }
  }, [user, profile]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La foto debe pesar menos de 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await ensureUserProfile({
        uid: user.uid,
        email: user.email ?? "",
        displayName,
        photoURL: user.photoURL,
        favoriteTeamTla: favoriteTeam || null,
      });

      let photoURL: string | null = profile?.photoURL ?? user.photoURL ?? null;
      if (photoFile) photoURL = await uploadAvatar(user.uid, photoFile);

      await updateUserProfile(user.uid, {
        displayName,
        photoURL,
        favoriteTeamTla: favoriteTeam || null,
      });

      router.push("/dashboard");
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Error guardando perfil");
    } finally {
      setSaving(false);
    }
  }

  if (authError) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="pmfu-glass rounded-3xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-[var(--pmfu-magenta)] mb-3">
            Error de configuración
          </h2>
          <p className="text-sm text-gray-700">{authError}</p>
        </div>
      </main>
    );
  }

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <Card className="max-w-lg">
        <CardHeader
          title="Completa tu perfil"
          subtitle="Solo unos datos para personalizar tu polla."
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-2 border-[var(--pmfu-cobalt)]/30">
              {photoPreview ? (
                <Image
                  src={photoPreview}
                  alt="Avatar"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">
                  📷
                </div>
              )}
            </div>
            <label className="cursor-pointer text-sm font-semibold text-[var(--pmfu-cobalt)] hover:underline">
              Subir foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoChange}
              />
            </label>
          </div>

          <Input
            label="Nombre"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <TeamSelect value={favoriteTeam} onChange={setFavoriteTeam} />

          {error && (
            <p className="text-sm text-[var(--pmfu-magenta)]">{error}</p>
          )}

          <Button type="submit" loading={saving} className="mt-2">
            Guardar y continuar
          </Button>
        </form>
      </Card>
    </main>
  );
}
