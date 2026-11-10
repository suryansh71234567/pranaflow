import { useEffect, useRef } from "react";
import type { Landmark, PoseId } from "../types";
export function PoseArt({
  pose,
  className = "",
}: {
  pose: PoseId;
  className?: string;
}) {
  const kneel = pose === "vajrasana";
  return (
    <svg
      className={"pose-art " + className}
      viewBox="0 0 220 220"
      fill="none"
      role="img"
      aria-label={
        kneel ? "Kneeling posture illustration" : "Seated posture illustration"
      }
    >
      <defs>
        <radialGradient id={"halo-" + pose}>
          <stop stopColor="#D8B16C" stopOpacity=".13" />
          <stop offset="1" stopColor="#D8B16C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="115" r="104" fill={"url(#halo-" + pose + ")"} />
      <g
        stroke="#d8b16c"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx={kneel ? 112 : 110} cy="50" rx="17" ry="22" />
        <path
          d={
            kneel
              ? "M106 72 Q94 90 97 124 L110 151 L157 179 Q172 193 143 192 L82 192 Q65 187 76 175 L108 151"
              : "M100 72 Q80 81 79 104 L72 136 L51 164 M120 72 Q140 81 141 104 L148 136 L169 164 M86 100 L91 148 M134 100 L129 148"
          }
        />
        <path
          d={
            kneel
              ? "M121 78 Q131 102 134 126 L150 166 M130 124 L140 164 M111 151 L86 178 L140 184"
              : "M91 148 Q66 159 39 174 Q17 190 51 195 Q109 204 166 195 Q203 187 177 174 L129 148 M46 182 Q94 173 148 192 M174 182 Q125 170 70 194"
          }
        />
        {pose === "padmasana" && (
          <path d="M60 182 L130 164 L152 176 M159 182 L89 164 L68 176" />
        )}
        {pose === "ardha" && <path d="M57 183 L130 163 L153 175" />}
        <path
          d={kneel ? "M113 80 L111 149" : "M110 79 L110 145"}
          strokeDasharray="3 5"
          opacity=".5"
        />
      </g>
      <ellipse cx="110" cy="201" rx="79" ry="3" fill="#d8b16c" opacity=".08" />
    </svg>
  );
}
export function Skeleton({
  points,
  mirror,
  aspect = 4 / 3,
}: {
  points: Landmark[];
  mirror: boolean;
  aspect?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!points.length) return;
    const valid = (i: number) => (points[i]?.visibility ?? 0) > 0.6;
    ctx.strokeStyle = "#ffe4ab";
    ctx.fillStyle = "#ffedc8";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#e8c784";
    ctx.shadowBlur = 7;
    const connections = [
      [0, 7],
      [0, 8],
      [11, 12],
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
      [11, 23],
      [12, 24],
      [23, 24],
      [23, 25],
      [24, 26],
      [25, 27],
      [26, 28],
      [27, 31],
      [28, 32],
    ];
    for (const [a, b] of connections) {
      if (!valid(a) || !valid(b)) continue;
      ctx.beginPath();
      ctx.moveTo(points[a].x * c.width, points[a].y * c.height);
      ctx.lineTo(points[b].x * c.width, points[b].y * c.height);
      ctx.stroke();
    }
    for (const i of [
      0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32,
    ]) {
      if (!valid(i)) continue;
      ctx.beginPath();
      ctx.arc(points[i].x * c.width, points[i].y * c.height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points]);
  return (
    <canvas
      ref={canvas}
      width="960"
      height="720"
      style={{ aspectRatio: aspect }}
      className={"skeleton " + (mirror ? "mirrored" : "")}
      aria-hidden="true"
    />
  );
}
