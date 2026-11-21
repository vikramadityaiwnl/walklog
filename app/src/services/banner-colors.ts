const bannerColors = [
  "#586B5E",
  "#756555",
  "#536775",
  "#725A5D",
  "#746B4D",
  "#5D6279",
];

export function randomBannerColor(): string {
  return bannerColors[Math.floor(Math.random() * bannerColors.length)];
}

export function getBannerColor(id: string, savedColor?: string): string {
  if (savedColor) return savedColor;

  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  return bannerColors[hash % bannerColors.length];
}
