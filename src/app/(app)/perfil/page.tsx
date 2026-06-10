"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { TeamSelect } from "@/components/ui/TeamSelect";
import { uploadAvatar, updateUserProfile } from "@/lib/auth/actions";

export default function PerfilPage() {
  const { user, profile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setFavoriteTeam(profile.favoriteTeamTla ?? "");
      setPhotoPreview(profile.photoURL);
    }
  }, [profile]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: "err", text: "La foto debe pesar menos de 5MB" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setMsg(null);
    setSaving(true);
    try {
      let photoURL: string | null = profile?.photoURL ?? null;
      if (photoFile) photoURL = await uploadAvatar(user.uid, photoFile);
      await updateUserProfile(user.uid, {
        displayName,
        photoURL,
        favoriteTeamTla: favoriteTeam || null,
      });
      setMsg({ type: "ok", text: "Perfil actualizado" });
      setPhotoFile(null);
    } catch (e) {
      const err = e as { message?: string };
      setMsg({ type: "err", text: err.message ?? "Error guardando" });
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <main className="px-6 py-10 max-w-2xl mx-auto w-full">
      <Card>
        <CardHeader title="Mi perfil" subtitle="Edita tu información." />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-[var(--pmfu-cobalt)]/30">
              {photoPreview ? (
                <Image
                  src={photoPreview}
                  alt="Avatar"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-gray-700 font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <label className="cursor-pointer text-sm font-semibold text-[var(--pmfu-cobalt)] hover:underline">
              Cambiar foto
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

          <Input
            label="Correo"
            value={profile.email}
            disabled
            className="opacity-70 cursor-not-allowed"
          />

          {msg && (
            <p
              className={
                msg.type === "ok"
                  ? "text-sm font-medium text-[var(--pmfu-mint)]"
                  : "text-sm font-medium text-[var(--pmfu-magenta)]"
              }
            >
              {msg.text}
            </p>
          )}

          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </form>
      </Card>

    </main>
  );
}
