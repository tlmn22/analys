const PATTERNS = [/(?:v=|\/videos\/|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/];

export function extractVideoId(url: string): string | null {
  for (const pattern of PATTERNS) {
    const m = url.match(pattern);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}
