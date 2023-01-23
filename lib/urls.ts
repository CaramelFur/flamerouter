const IDRegex = /#([\w'-]+)\b/g;

// Gets the full URL from a string or the current window location
export function fullURL(
  url?: string,
  base?: string,
): {
  target: string;
  id: string | null;
} {
  const target = new URL(url || window.location.href, base).href;
  return {
    target,
    id: getUrlID(target),
  };
}

function getUrlID(url: string): string | null {
  const match = url.match(IDRegex);
  return match ? match[0] : null;
}
