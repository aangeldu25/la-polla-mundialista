import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ADMIN_EMAIL = "aangeldu@gmail.com";

export function isAdmin(email: string | null | undefined): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL;
}
