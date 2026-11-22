export const bannerColor = "#A6532D";
export const bannerIllustrationCount = 6;

export function randomBannerIllustration(): number {
  return Math.floor(Math.random() * bannerIllustrationCount);
}

export function getBannerIllustration(id: string, saved?: number): number {
  if (
    saved !== undefined &&
    Number.isInteger(saved) &&
    saved >= 0 &&
    saved < bannerIllustrationCount
  )
    return saved;
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  return hash % bannerIllustrationCount;
}
