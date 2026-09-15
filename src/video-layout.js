// Size the media itself, not a fixed black stage around it.
export function fitVideoLayout(width, height, viewportWidth, viewportHeight) {
  const ratio = width > 0 && height > 0 ? width / height : 16 / 9;
  const portrait = ratio < .85;
  const available = Math.max(1, viewportWidth * .94 - 2);
  const maxHeight = Math.max(1, viewportHeight - 150);
  if (portrait && viewportWidth >= 780) {
    const mediaWidth = Math.min(420, maxHeight * ratio, available * .48);
    return { orientation: 'portrait', mediaWidth, dialogWidth: Math.min(available, mediaWidth + 470) };
  }
  const dialogWidth = portrait ? Math.min(available, 560) : Math.min(available, 1100, viewportHeight * .62 * ratio);
  const mediaWidth = Math.min(dialogWidth, maxHeight * ratio);
  return { orientation: portrait ? 'portrait' : 'landscape', mediaWidth, dialogWidth };
}
