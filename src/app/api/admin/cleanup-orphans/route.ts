import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ADMIN_EMAIL } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/cleanup-orphans
// Borra predicciones y quinielas especiales cuyo uid ya no existe en /users
// (residuos de cuentas duplicadas borradas durante pruebas iniciales).
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 401 });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if ((decoded.email ?? "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const usersSnap = await adminDb.collection("users").get();
    const validUids = new Set(usersSnap.docs.map((d) => d.id));

    let deletedPredictions = 0;
    let deletedSpecials = 0;
    const orphanUids = new Set<string>();

    // Borrar predicciones huérfanas
    const predsSnap = await adminDb.collection("predictions").get();
    const batch1 = adminDb.batch();
    let batchCount = 0;
    for (const doc of predsSnap.docs) {
      const data = doc.data() as { uid?: string };
      if (data.uid && !validUids.has(data.uid)) {
        batch1.delete(doc.ref);
        orphanUids.add(data.uid);
        deletedPredictions++;
        batchCount++;
        // Firestore batch max 500 ops
        if (batchCount === 400) {
          await batch1.commit();
          batchCount = 0;
        }
      }
    }
    if (batchCount > 0) await batch1.commit();

    // Borrar quinielas especiales huérfanas
    const specialsSnap = await adminDb.collection("specialPredictions").get();
    const batch2 = adminDb.batch();
    let batchCount2 = 0;
    for (const doc of specialsSnap.docs) {
      if (!validUids.has(doc.id)) {
        batch2.delete(doc.ref);
        orphanUids.add(doc.id);
        deletedSpecials++;
        batchCount2++;
        if (batchCount2 === 400) {
          await batch2.commit();
          batchCount2 = 0;
        }
      }
    }
    if (batchCount2 > 0) await batch2.commit();

    return NextResponse.json({
      ok: true,
      deletedPredictions,
      deletedSpecials,
      uniqueOrphanUids: orphanUids.size,
      orphanUidsSample: [...orphanUids].slice(0, 5),
    });
  } catch (e) {
    const err = e as Error;
    console.error("[cleanup-orphans]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
