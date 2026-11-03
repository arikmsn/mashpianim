// Product categories (pure, unit-tested). One list drives the feed chips, the product form and the API
// validation, so a product's category is always one the feed can filter on.

export const PRODUCT_CATEGORIES = [
  "אופנה",
  "ביוטי",
  "טכנולוגיה",
  "בית וגינה",
  "אוכל",
  "ספורט",
  "ילדים",
  "כללי",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const DEFAULT_CATEGORY: ProductCategory = "כללי";

// Registration offers a longer list (creators and brands pick these); each maps onto a feed category
export const REGISTRATION_TO_FEED: Record<string, ProductCategory> = {
  "אופנה": "אופנה",
  "ביוטי וטיפוח": "ביוטי",
  "ביוטי": "ביוטי",
  "מזון ומשקאות": "אוכל",
  "אוכל": "אוכל",
  "ניקיון ובית": "בית וגינה",
  "בית וגינה": "בית וגינה",
  "ילדים ותינוקות": "ילדים",
  "ילדים": "ילדים",
  "ספורט ובריאות": "ספורט",
  "ספורט": "ספורט",
  "טכנולוגיה": "טכנולוגיה",
  "חיות מחמד": "כללי",
  "אחר": "כללי",
  "כללי": "כללי",
};

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

// A registration/brand category → the feed category it belongs to (null when unknown)
export function toFeedCategory(value: unknown): ProductCategory | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (isProductCategory(trimmed)) return trimmed;
  return REGISTRATION_TO_FEED[trimmed] || null;
}

// The category to store on a product: the one the brand picked when valid, else the brand's first
// category mapped onto the feed list, else the default
export function resolveProductCategory(picked: unknown, brandCategories: unknown[] = []): ProductCategory {
  if (isProductCategory(picked)) return picked;
  for (const c of brandCategories) {
    const mapped = toFeedCategory(c);
    if (mapped) return mapped;
  }
  return DEFAULT_CATEGORY;
}
