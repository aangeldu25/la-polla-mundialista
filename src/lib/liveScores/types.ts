// Tipos compartidos del overlay de marcadores en vivo.
// La fuente base del fixture sigue siendo Football-Data; estos proveedores
// solo aportan marcador/estado/minuto más frescos durante los partidos.

export interface LiveScore {
  // Claves para matchear contra nuestros docs de Firestore
  utcDate: string; // kickoff ISO (coincide entre proveedores)
  homeTla: string | null;
  awayTla: string | null;
  homeName: string;
  awayName: string;
  // Datos en vivo
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "UNKNOWN";
  minute: string | null; // ej. "67'" o "45'+2"
  // Penales (eliminatorias)
  homePenalties: number | null;
  awayPenalties: number | null;
}

export interface LiveProviderResult {
  provider: string;
  ok: boolean;
  scores: LiveScore[];
  error?: string;
}
