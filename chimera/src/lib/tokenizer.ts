/**
 * URL Tokenizer for Symbiote Router
 * 
 * Extracts semantic tokens from URL paths for fuzzy matching.
 * Splits on common separators (/, -, _) and normalizes tokens.
 * 
 * @module tokenizer
 */

/**
 * Characters used to split URL paths into tokens
 */
const SEPARATORS = /[\/\-_]+/;

// URL-encoded character pattern available if needed: /%[0-9A-Fa-f]{2}/g

/**
 * Decodes URL-encoded characters in a string
 */
function decodeUrlComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    // If decoding fails, return original string
    return str;
  }
}

/**
 * Normalizes a single token:
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes empty strings
 */
function normalizeToken(token: string): string {
  return token.toLowerCase().trim();
}

/**
 * Tokenizes a URL path into semantic tokens.
 * 
 * @param path - The URL path to tokenize (e.g., "/products/iphone-15")
 * @returns Array of normalized tokens (e.g., ["products", "iphone", "15"])
 * 
 * @example
 * tokenizePath("/products/iphone-15") // ["products", "iphone", "15"]
 * tokenizePath("/shop/apple_products") // ["shop", "apple", "products"]
 * tokenizePath("") // []
 * tokenizePath("/") // []
 */
export function tokenizePath(path: string): string[] {
  // Handle empty or null paths
  if (!path || path.trim() === '') {
    return [];
  }

  // Decode URL-encoded characters first
  const decodedPath = decodeUrlComponent(path);

  // Remove leading/trailing slashes and split
  const cleanPath = decodedPath.replace(/^\/+|\/+$/g, '');
  
  // Handle root path
  if (cleanPath === '') {
    return [];
  }

  // Split on separators and normalize
  const tokens = cleanPath
    .split(SEPARATORS)
    .map(normalizeToken)
    .filter(token => token.length > 0);

  return tokens;
}

/**
 * Joins tokens back into a URL path.
 * Useful for testing round-trip consistency.
 * 
 * @param tokens - Array of tokens to join
 * @param separator - Separator to use (default: "/")
 * @returns URL path string
 * 
 * @example
 * joinTokens(["products", "iphone", "15"]) // "/products/iphone/15"
 */
export function joinTokens(tokens: string[], separator: string = '/'): string {
  if (tokens.length === 0) {
    return '/';
  }
  return '/' + tokens.join(separator);
}

/**
 * Extracts the semantic meaning from a path by tokenizing
 * and returning unique tokens in sorted order.
 * 
 * This is useful for comparing paths regardless of token order.
 * 
 * @param path - The URL path
 * @returns Sorted unique tokens
 */
export function extractSemanticTokens(path: string): string[] {
  const tokens = tokenizePath(path);
  const unique = Array.from(new Set(tokens));
  return unique.sort();
}

/**
 * Checks if two paths have the same semantic tokens
 * (regardless of order or separators used).
 * 
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths have same semantic content
 */
export function haveSameSemantics(path1: string, path2: string): boolean {
  const tokens1 = extractSemanticTokens(path1);
  const tokens2 = extractSemanticTokens(path2);
  
  if (tokens1.length !== tokens2.length) {
    return false;
  }
  
  return tokens1.every((token, index) => token === tokens2[index]);
}

/**
 * Calculates the token overlap between two paths.
 * Returns a value between 0 and 1.
 * 
 * @param path1 - First path
 * @param path2 - Second path
 * @returns Overlap ratio (intersection / union)
 */
export function calculateTokenOverlap(path1: string, path2: string): number {
  const tokens1 = new Set(tokenizePath(path1));
  const tokens2 = new Set(tokenizePath(path2));
  
  if (tokens1.size === 0 && tokens2.size === 0) {
    return 1; // Both empty = perfect match
  }
  
  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0; // One empty = no match
  }
  
  const tokens1Array = Array.from(tokens1);
  const intersection = new Set(tokens1Array.filter(t => tokens2.has(t)));
  const unionArray = tokens1Array.concat(Array.from(tokens2));
  const union = new Set(unionArray);
  
  return intersection.size / union.size;
}
