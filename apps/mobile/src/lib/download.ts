/** Saves a file in the browser by following a temporary download link. Web only. */
export function downloadOnWeb(href: string, filename: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}
