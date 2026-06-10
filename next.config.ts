import type { NextConfig } from "next";

const FIREBASE_PROJECT = "polla-mundialista-d2f73";

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
  // (todo se queda en polla-mundialista-familia-unida.vercel.app), evitando
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
