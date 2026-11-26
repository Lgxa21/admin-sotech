export const STUDIO_SHAPES = {
  none: "Sin figura automática",
  rounded: "Rectángulos redondeados",
  square: "Rectángulos de esquinas rectas",
  circles: "Círculos",
  diagonal: "Diagonales",
} as const;

export const STUDIO_BRAND_ASSETS = {
  logo: { label: "Logo principal", font: false },
  "logo-dark": { label: "Logo para fondo oscuro", font: false },
  symbol: { label: "Símbolo o figura de marca", font: false },
  "title-font": { label: "Fuente para títulos", font: true },
  "body-font": { label: "Fuente para textos", font: true },
} as const;

export type StudioShape = keyof typeof STUDIO_SHAPES;
export type StudioBrandAsset = keyof typeof STUDIO_BRAND_ASSETS;

export function isStudioBrandAsset(value: string): value is StudioBrandAsset {
  return Object.hasOwn(STUDIO_BRAND_ASSETS, value);
}
