/** N'accepte que les URL http(s) ou les images data: pour logo et sceau. */
export function isSafeImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_000_000) return false;
  if (trimmed.startsWith('data:image/')) {
    return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(trimmed);
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 180;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
