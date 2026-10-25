// A little golden chihuahua with floppy ears, drawn by hand on a 24x20 grid.
// Each row is the left half of the sprite; it's mirrored to get the right half.

export type DogMood = "happy" | "antsy" | "needs" | "sleepy";

const PALETTE: Record<string, string> = {
  O: "#3a2210", // outline
  G: "#e2a94e", // gold coat
  D: "#b9782f", // ears and shading
  L: "#f6d9a0", // cream muzzle and chest
  E: "#1a0f07", // eyes
  W: "#ffffff", // eye shine
  N: "#24150b", // nose
  P: "#ec8a8f", // tongue
};

const LEFT_HALF = [
  "........OOOO",
  "......OOGGGG",
  ".....OGGGGGG",
  "...OOOGGGGGG",
  "..ODDOGGGGGG",
  ".ODDDOGGWEGG",
  ".ODDDOGGEEGG",
  ".ODDOGGGGGGL",
  ".ODDOGGGGLLL",
  "..OOOGGGLLLN",
  ".....OGGLLLL",
  "......OGGLLL",
  ".......OOOOO",
  "........OGGL",
  ".......OGGLL",
  ".......OGGLL",
  "......OGGGOL",
  "......OGGGOL",
  "......OLLLOL",
  "......OOOOOO",
];

const BASE = LEFT_HALF.map((half) => half + [...half].reverse().join(""));

// Per-mood pixel overrides as [row, col, color], given for the left half and mirrored.
type Pixel = [number, number, string];

const mirror = (pixels: Pixel[]): Pixel[] => pixels.flatMap(([r, c, k]) => [[r, c, k], [r, 23 - c, k]] as Pixel[]);

const FACES: Record<DogMood, Pixel[]> = {
  // Smile with the tongue out.
  happy: mirror([[10, 10, "O"], [11, 11, "P"]]),
  // Flat little mouth.
  antsy: mirror([[11, 11, "O"]]),
  // Worried brows, raised in the middle.
  needs: mirror([[3, 9, "O"], [4, 8, "O"], [11, 11, "O"]]),
  // Eyes shut.
  sleepy: mirror([[5, 8, "G"], [5, 9, "G"], [6, 8, "O"], [6, 9, "O"], [11, 11, "O"]]),
};

// Two tail positions, swapped by CSS for a wag. Outlines are added automatically.
const TAIL_UP = withOutline([[15, 17], [14, 18], [13, 18], [12, 19]]);
const TAIL_DOWN = withOutline([[15, 17], [15, 18], [16, 19], [16, 20]]);

/** Gold pixels plus a dark outline on any empty neighbor, so loose bits don't float. */
function withOutline(coords: [number, number][]): Pixel[] {
  const filled = new Set(coords.map(([r, c]) => `${r},${c}`));
  const outline = new Map<string, Pixel>();
  for (const [r, c] of coords) {
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const key = `${nr},${nc}`;
      if (!filled.has(key) && BASE[nr]?.[nc] === ".") outline.set(key, [nr, nc, "O"]);
    }
  }
  return [...coords.map(([r, c]): Pixel => [r, c, "G"]), ...outline.values()];
}

function toRects(grid: string[], keyPrefix: string) {
  const rects = [];
  for (let y = 0; y < grid.length; y++) {
    let x = 0;
    while (x < grid[y].length) {
      const color = grid[y][x];
      let run = 1;
      while (grid[y][x + run] === color) run++;
      if (color !== ".") {
        rects.push(<rect key={`${keyPrefix}${y}-${x}`} x={x} y={y} width={run} height={1} fill={PALETTE[color]} />);
      }
      x += run;
    }
  }
  return rects;
}

function applyPixels(grid: string[], pixels: Pixel[]): string[] {
  const rows = grid.map((row) => [...row]);
  for (const [r, c, color] of pixels) rows[r][c] = color;
  return rows.map((row) => row.join(""));
}

function pixelsOnly(pixels: Pixel[]): string[] {
  return applyPixels(BASE.map((row) => ".".repeat(row.length)), pixels);
}

export function PixelDog({ mood, className }: { mood: DogMood; className?: string }) {
  const body = applyPixels(BASE, FACES[mood]);
  const wagging = mood === "happy";

  return (
    <svg viewBox="0 -5 24 25" shapeRendering="crispEdges" className={className} aria-hidden>
      <g className={mood === "needs" ? "animate-[dog-hop_0.6s_steps(1)_infinite]" : undefined}>
        {toRects(body, "b")}
        <g className={wagging ? "animate-[tail-a_0.4s_steps(1)_infinite]" : undefined}>{toRects(pixelsOnly(TAIL_UP), "u")}</g>
        {wagging && <g className="animate-[tail-b_0.4s_steps(1)_infinite]">{toRects(pixelsOnly(TAIL_DOWN), "d")}</g>}
      </g>
      {mood === "sleepy" && (
        <g fill="currentColor" className="animate-[dog-snooze_2s_steps(4)_infinite] text-muted">
          <rect x={18} y={-5} width={5} height={1} />
          <rect x={21} y={-4} width={1} height={1} />
          <rect x={20} y={-3} width={1} height={1} />
          <rect x={19} y={-2} width={1} height={1} />
          <rect x={18} y={-1} width={5} height={1} />
        </g>
      )}
    </svg>
  );
}
