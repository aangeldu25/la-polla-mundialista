import type { NextConfig } from "next";

const FIREBASE_PROJECT = "polla-mundial-4f951";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
  // Reverse proxy de los endpoints internos de Firebase Auth.
  // Esto hace que el OAuth de Google complete su flujo SIN cambiar de dominio
  // (todo se queda en la-polla-mundialista-2026-seven.vercel.app), evitando
  // que Safari iOS borre el sessionStorage por storage partitioning.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${FIREBASE_PROJECT}.firebaseapp.com/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${FIREBASE_PROJECT}.firebaseapp.com/__/firebase/:path*`,
      },
    ];
  },
};

export default nextConfig;
