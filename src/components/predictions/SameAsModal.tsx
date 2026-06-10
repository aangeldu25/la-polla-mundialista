"use client";

import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import type { UserProfile } from "@/types/domain";

export function SameAsModal({
  open,
  onClose,
  title,
  pickLabel,
  users,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  pickLabel: string;
  users: UserProfile[];
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-xs font-bold text-[var(--pmfu-cobalt)] uppercase tracking-widest">
              {title}
            </p>
            <h3 className="text-xl font-bold text-gray-900 mt-0.5">
              {pickLabel}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          {users.length}{" "}
          {users.length === 1
            ? "familiar tiene la misma elección que tú"
            : "familiares tienen la misma elección que tú"}
          .
        </p>

        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.uid}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50"
            >
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {u.photoURL ? (
                  <Image
                    src={u.photoURL}
                    alt={u.displayName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-gray-700">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="font-semibold text-gray-900 flex-1">
                {u.displayName}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
