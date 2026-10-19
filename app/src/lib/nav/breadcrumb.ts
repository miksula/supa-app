import { NAV_ITEMS } from "./navConfig.ts";

export type BreadcrumbItem = {
  label: string;
  url?: string;
  isCurrent?: boolean;
};

function formatSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  return decoded
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Resolves the breadcrumb trail for a given path.
 * @param path The current URL path.
 * @returns An array of breadcrumb items.
 */
export function resolveBreadcrumbs(path: string): BreadcrumbItem[] {
  const normalized = path.replace(/\/+$/, "") || "/";

  // Root or /my-todos route
  if (normalized === "/" || normalized === "/my-todos") {
    return [{ label: "My todos", isCurrent: true }];
  }

  // Lookup in NAV_ITEMS hierarchy
  for (const group of NAV_ITEMS) {
    if (group.items) {
      const matchedChild = group.items.find(
        (sub) => sub.url === normalized || normalized.startsWith(`${sub.url}/`),
      );

      if (matchedChild) {
        const isExact = matchedChild.url === normalized;
        const crumbs: BreadcrumbItem[] = [
          { label: group.title },
          {
            label: matchedChild.title,
            url: isExact ? undefined : matchedChild.url,
            isCurrent: isExact,
          },
        ];

        // Deep link past child route (e.g. /docs/tutorials/1)
        if (!isExact && normalized.startsWith(`${matchedChild.url}/`)) {
          const remainder = normalized.slice(matchedChild.url.length + 1);
          const trailingParts = remainder.split("/").filter(Boolean);
          trailingParts.forEach((part, idx) => {
            const isLast = idx === trailingParts.length - 1;
            crumbs.push({
              label: formatSegment(part),
              url: isLast
                ? undefined
                : `${matchedChild.url}/${trailingParts.slice(0, idx + 1).join("/")}`,
              isCurrent: isLast,
            });
          });
        }
        return crumbs;
      }

      // Check for parameter routes under the group (e.g. /docs/:id)
      const groupPrefix = group.items[0]?.url.split("/")[1];
      if (groupPrefix && normalized.startsWith(`/${groupPrefix}/`)) {
        const remainder = normalized.slice(`/${groupPrefix}/`.length);
        return [
          { label: group.title },
          { label: formatSegment(remainder), url: normalized, isCurrent: true },
        ];
      }
    } else if (group.url && (group.url === normalized || normalized.startsWith(`${group.url}/`))) {
      return [{ label: group.title, url: group.url, isCurrent: true }];
    }
  }

  // Fallback: parse URL segments
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: "Home", isCurrent: true }];
  }

  let accumulated = "";
  return segments.map((seg, idx) => {
    accumulated += `/${seg}`;
    const isLast = idx === segments.length - 1;
    return {
      label: formatSegment(seg),
      url: isLast ? undefined : accumulated,
      isCurrent: isLast,
    };
  });
}
