const bannerColors = [
  "#A6532D",
  "#8E4B32",
  "#B16542",
  "#925C46",
  "#9F5A3C",
  "#AA6B4E",
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
