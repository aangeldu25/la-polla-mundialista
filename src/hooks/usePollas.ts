"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Polla, PollaMember } from "@/types/domain";

// Las pollas a las que pertenece el usuario (vía memberships → pollas).
export function useMyPollas(uid: string | null | undefined) {
  const [memberships, setMemberships] = useState<PollaMember[]>([]);
  const [pollas, setPollas] = useState<Polla[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "memberships"), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMemberships(snap.docs.map((d) => d.data() as PollaMember));
        setLoading(false);
      },
      (e) => {
        console.error("[useMyPollas]", e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid]);

  const pollaIds = useMemo(
    () => memberships.map((m) => m.pollaId).sort(),
    [memberships],
  );
  const idsKey = pollaIds.join(",");

  useEffect(() => {
    if (pollaIds.length === 0) {
      setPollas([]);
      return;
    }
    // Firestore "in" admite hasta 30 — suficiente (límite 10 pollas/usuario)
    const q = query(
      collection(db, "pollas"),
      where(documentId(), "in", pollaIds.slice(0, 30)),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPollas(snap.docs.map((d) => d.data() as Polla)),
      (e) => console.error("[useMyPollas:pollas]", e),
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { pollas, memberships, loading };
}

// Los UIDs miembros de una polla.
export function usePollaMemberUids(pollaId: string | null) {
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pollaId) {
      setUids([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "memberships"),
      where("pollaId", "==", pollaId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUids(snap.docs.map((d) => (d.data() as PollaMember).uid));
        setLoading(false);
      },
      (e) => {
        console.error("[usePollaMemberUids]", e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [pollaId]);

  return { uids, loading };
}

// Una polla individual por id (para encabezados).
export function usePolla(pollaId: string | null) {
  const [polla, setPolla] = useState<Polla | null>(null);

  useEffect(() => {
    if (!pollaId) {
      setPolla(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "pollas", pollaId),
      (snap) => setPolla(snap.exists() ? (snap.data() as Polla) : null),
      (e) => console.error("[usePolla]", e),
    );
    return () => unsub();
  }, [pollaId]);

  return polla;
}
