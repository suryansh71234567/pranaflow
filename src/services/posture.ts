import type { Check, Landmark, PoseId, Settings } from "../types";
export const visible = (p: Landmark[] | undefined, ids: number[]) =>
  !!p && ids.every((i) => p[i] && (p[i].visibility ?? 0) > 0.65);
const midpoint = (a: Landmark, b: Landmark) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
export class PostureCalibration {
  private widths: number[] = [];
  reset() {
    this.widths = [];
  }
  sample(p: Landmark[]) {
    if (visible(p, [11, 12])) {
      const w = Math.abs(p[11].x - p[12].x);
      if (w > 0.08 && w < 0.8) this.widths.push(w);
      this.widths = this.widths.slice(-40);
    }
    // Personal camera scale, not an assertion that the initial posture was correct.
    return this.widths.length >= 20
      ? [...this.widths].sort((a, b) => a - b)[
          Math.floor(this.widths.length / 2)
        ]
      : undefined;
  }
}
export function assess(
  p: Landmark[],
  previous: Landmark[] | null,
  pose: PoseId,
  rigor: Settings["rigor"],
  calibratedWidth?: number,
): Check[] {
  const tol = rigor === "Gentle" ? 0.17 : rigor === "Strict" ? 0.08 : 0.12;
  const check = (
    label: string,
    ids: number[],
    fn: () => boolean,
    detail: string,
  ): Check => ({
    label,
    state: !visible(p, ids) ? "unknown" : fn() ? "good" : "adjust",
    detail: !visible(p, ids)
      ? "Unable to assess — move the relevant joints into view."
      : detail,
  });
  const width =
    calibratedWidth ??
    (visible(p, [11, 12]) ? Math.max(0.08, Math.abs(p[11].x - p[12].x)) : 0.2);
  const shoulder = visible(p, [11, 12])
    ? midpoint(p[11], p[12])
    : { x: 0, y: 0 };
  const hip = visible(p, [23, 24]) ? midpoint(p[23], p[24]) : { x: 0, y: 0 };
  return [
    check(
      "Torso centre-line",
      [11, 12, 23, 24],
      () => Math.abs(shoulder.x - hip.x) / width < tol * 1.7,
      "Gently bring your torso upright.",
    ),
    check(
      "Shoulder symmetry",
      [11, 12],
      () => Math.abs(p[11].y - p[12].y) / width < tol,
      "Try to balance your shoulders.",
    ),
    check(
      "Head alignment",
      [0, 11, 12],
      () => Math.abs(p[0].x - shoulder.x) / width < tol * 1.7,
      "Bring your head gently above your shoulders.",
    ),
    {
      label: "Torso stability",
      state:
        !previous ||
        !visible(p, [11, 12, 23, 24]) ||
        !visible(previous, [11, 12, 23, 24])
          ? "unknown"
          : Math.hypot(
                shoulder.x - (previous[11].x + previous[12].x) / 2,
                shoulder.y - (previous[11].y + previous[12].y) / 2,
              ) /
                width <
              0.045
            ? "good"
            : "adjust",
      detail: "Settle into a comfortable, still seat.",
    },
    check(
      pose === "vajrasana" ? "Knee spacing" : "Hip-level symmetry",
      pose === "vajrasana" ? [25, 26, 23, 24] : [23, 24],
      () =>
        pose === "vajrasana"
          ? Math.abs(p[25].x - p[26].x) / width < 1.1
          : Math.abs(p[23].y - p[24].y) / width < tol,
      "Balance your seated position without forcing the joints.",
    ),
  ];
}
// A deliberately conservative geometric hypothesis, never a trained yoga confidence score.
export function classify(p: Landmark[]): PoseId | null {
  if (!visible(p, [23, 24, 25, 26, 27, 28])) return null;
  const hips = midpoint(p[23], p[24]);
  const w = Math.max(0.08, Math.abs(p[11].x - p[12].x));
  const knees = Math.abs(p[25].x - p[26].x) / w;
  if (
    knees < 0.7 &&
    p[27].y > p[25].y + 0.04 &&
    p[28].y > p[26].y + 0.04 &&
    p[25].y > hips.y + 0.08
  )
    return "vajrasana";
  if (knees < 1.0) return null;
  const leftRaised =
    p[27].y < p[26].y - 0.035 && Math.abs(p[27].x - p[24].x) < w * 0.7;
  const rightRaised =
    p[28].y < p[25].y - 0.035 && Math.abs(p[28].x - p[23].x) < w * 0.7;
  if (leftRaised && rightRaised) return "padmasana";
  if (leftRaised !== rightRaised) return "ardha";
  if (p[27].y > hips.y + 0.12 && p[28].y > hips.y + 0.12 && p[27].x > p[28].x)
    return "sukhasana";
  return null;
}
