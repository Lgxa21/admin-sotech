export const PIECE_UNITS = ["cm", "m", "mm", "px"] as const;
export const MAX_PIECES = 50;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const PIECE_DIRECTIONS = [
  { key: "design", label: "Diseño y distribución", placeholder: "Ej. Adaptar el exhibidor a cuatro niveles" },
  { key: "include", label: "Qué debe llevar", placeholder: "Ej. Logo al frente y nombre en cada nivel" },
  { key: "avoid", label: "Qué evitar", placeholder: "Ej. No tapar los productos con el arte" },
  { key: "production", label: "Fabricación o instalación", placeholder: "Ej. Debe poder desmontarse" },
] as const;

export type PieceDirections = Partial<Record<(typeof PIECE_DIRECTIONS)[number]["key"], string>>;

export type PieceUnit = (typeof PIECE_UNITS)[number];
export type OrderPiece = {
  id: string;
  name: string;
  quantity: number;
  width: string;
  height: string;
  depth: string;
  unit: PieceUnit;
  material: string;
  finish: string;
  instructions: string;
  directions?: PieceDirections;
  copy: string;
  components: string[];
};

export type OrderReference = { id: string; name: string; pieceId: string | null };

export const referenceUrl = (orderId: string, referenceId: string) =>
  `/ordenes/${orderId}/referencias/${referenceId}`;
