import { toQR } from "toqr";

export interface QrCode {
  /** Modules per side. */
  size: number;
  /** One SVG path, in module units, covering every dark module as one run per row segment. */
  path: string;
}

/** Row-major modules of the QR code for `text`: `size * size` entries, 1 is dark. */
export function qrModules(text: string): { size: number; modules: Uint8Array } {
  const modules = toQR(text);
  return { size: Math.round(Math.sqrt(modules.length)), modules };
}

export function qrCode(text: string): QrCode {
  const { size, modules } = qrModules(text);
  const runs: string[] = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!modules[y * size + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && modules[y * size + x]) x++;
      runs.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  }
  return { size, path: runs.join("") };
}
