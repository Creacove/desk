import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { FilmFormat } from "./constants";
import { MeetYourManagerFilmV4 } from "./MeetYourManagerFilmV4";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const purple = "#6f43dc";
const ink = "#141216";
const paper = "#f8f5ef";

export function MeetYourManagerFilmV5({ format }: { format: FilmFormat }) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: paper }}>
      <style>{`
        img[src*="launch-assets/lagos-artist"],
        img[src*="launch-assets/lagos-creator-team"] {
          opacity: 0 !important;
          visibility: hidden !important;
        }
      `}</style>
      <MeetYourManagerFilmV4 format={format} />
      <ReleaseWorld frame={frame} format={format} />
    </AbsoluteFill>
  );
}

function ReleaseWorld({ frame, format }: { frame: number; format: FilmFormat }) {
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <OpeningMotif frame={frame} width={width} height={height} portrait={portrait} />
      <GoalMotif frame={frame} width={width} height={height} portrait={portrait} />
      <WorkMotif frame={frame} width={width} height={height} portrait={portrait} />
      <TaskMotif frame={frame} width={width} height={height} portrait={portrait} />
      <WatchMotif frame={frame} width={width} height={height} portrait={portrait} />
    </AbsoluteFill>
  );
}

function OpeningMotif({ frame, width, height, portrait }: MotifProps) {
  if (frame > 300) return null;
  const p = spring({ frame, fps: 60, config: { damping: 18, stiffness: 72, mass: 1.05 } });
  const drift = interpolate(frame, [0, 300], [26, -18], clamp);

  return (
    <div style={{ position: "absolute", right: portrait ? -width * .11 : width * .03, top: portrait ? height * .14 : height * .07, width: portrait ? width * .62 : width * .43, height: portrait ? height * .62 : height * .84, opacity: p * .93, transform: `translateX(${(1 - p) * 120 + drift}px)` }}>
      <div style={{ position: "absolute", inset: "6% 0 10% 8%", borderRadius: 999, background: "radial-gradient(circle at 48% 42%,rgba(111,67,220,.34),rgba(111,67,220,.09) 42%,transparent 72%)", filter: "blur(42px)" }} />
      <div style={{ position: "absolute", right: "4%", top: "4%", fontFamily: '"Bricolage Grotesque", Manrope, system-ui, sans-serif', fontSize: portrait ? width * .165 : height * .22, fontWeight: 820, lineHeight: .72, letterSpacing: "-.095em", color: "rgba(111,67,220,.095)", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>ODAESHI</div>
      <div style={{ position: "absolute", left: "11%", bottom: "15%", width: "70%", display: "flex", alignItems: "end", gap: portrait ? 8 : 10 }}>
        {Array.from({ length: 22 }).map((_, index) => {
          const h = 18 + ((index * 37) % 78);
          const pulse = 1 + Math.sin((frame + index * 4) / 13) * .13;
          return <span key={index} style={{ flex: 1, height: h * pulse, borderRadius: 999, background: index % 4 === 0 ? "rgba(111,67,220,.38)" : "rgba(20,18,22,.12)" }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: "9%", top: "20%", width: "44%", aspectRatio: "1 / 1", borderRadius: 44, border: "1px solid rgba(20,18,22,.08)", background: "linear-gradient(145deg,rgba(255,255,255,.88),rgba(237,230,255,.82))", boxShadow: "0 34px 90px rgba(44,28,88,.10)", transform: `rotate(${-7 + p * 5}deg)` }}>
        <div style={{ position: "absolute", inset: "13%", borderRadius: 999, border: "1px solid rgba(111,67,220,.22)" }} />
        <div style={{ position: "absolute", inset: "28%", borderRadius: 999, background: purple, boxShadow: "0 0 0 22px rgba(111,67,220,.08)" }} />
        <div style={{ position: "absolute", left: "12%", bottom: "10%", fontSize: portrait ? width * .022 : height * .027, fontWeight: 790, letterSpacing: "-.04em", color: ink }}>ODAESHI</div>
      </div>
    </div>
  );
}

function GoalMotif({ frame, width, height, portrait }: MotifProps) {
  if (frame < 220 || frame > 720) return null;
  const local = frame - 220;
  const p = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 76 } });
  return (
    <div style={{ position: "absolute", right: portrait ? -width * .23 : width * .01, top: portrait ? height * .15 : height * .10, width: portrait ? width * .52 : width * .28, height: portrait ? height * .62 : height * .76, opacity: p * .55 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "radial-gradient(circle,rgba(111,67,220,.18),rgba(204,154,95,.08) 48%,transparent 72%)", filter: "blur(52px)" }} />
      <div style={{ position: "absolute", left: "16%", top: "27%", fontSize: portrait ? width * .12 : height * .16, fontWeight: 820, letterSpacing: "-.09em", color: "rgba(20,18,22,.065)", transform: `rotate(${-12 + local * .012}deg)` }}>O</div>
    </div>
  );
}

function WorkMotif({ frame, width, height, portrait }: MotifProps) {
  if (frame < 610 || frame > 1110) return null;
  const local = frame - 610;
  const p = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 82 } });
  const x = portrait ? width * .74 : width * .80;
  const y = portrait ? height * .26 : height * .30;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: p * .62 }}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ position: "absolute", width: portrait ? width * .26 : width * .15, height: portrait ? height * .19 : height * .27, borderRadius: 24, background: index === 0 ? "rgba(237,230,255,.90)" : "rgba(255,255,255,.86)", border: "1px solid rgba(20,18,22,.07)", boxShadow: "0 24px 70px rgba(35,28,23,.08)", transform: `translate(${index * 26}px,${index * 20}px) rotate(${(-8 + index * 7) * p}deg)` }}>
          <div style={{ position: "absolute", left: "12%", top: "13%", width: "42%", height: 8, borderRadius: 999, background: index === 0 ? "rgba(111,67,220,.48)" : "rgba(20,18,22,.16)" }} />
          <div style={{ position: "absolute", left: "12%", top: "28%", width: "72%", height: 5, borderRadius: 999, background: "rgba(20,18,22,.10)" }} />
          <div style={{ position: "absolute", left: "12%", top: "38%", width: "58%", height: 5, borderRadius: 999, background: "rgba(20,18,22,.08)" }} />
        </div>
      ))}
    </div>
  );
}

function TaskMotif({ frame, width, height, portrait }: MotifProps) {
  if (frame < 1280 || frame > 1740) return null;
  const local = frame - 1280;
  const p = spring({ frame: local, fps: 60, config: { damping: 21, stiffness: 80 } });
  return (
    <div style={{ position: "absolute", right: portrait ? -width * .12 : width * .03, top: portrait ? height * .24 : height * .10, width: portrait ? width * .38 : width * .22, height: portrait ? height * .50 : height * .74, opacity: p * .48 }}>
      <div style={{ position: "absolute", inset: "6%", borderRadius: 42, background: "linear-gradient(160deg,rgba(111,67,220,.12),rgba(204,154,95,.08),rgba(255,255,255,.32))", filter: "blur(1px)", border: "1px solid rgba(20,18,22,.06)" }} />
      <div style={{ position: "absolute", left: "12%", top: "14%", fontSize: portrait ? width * .026 : height * .034, fontWeight: 800, color: "rgba(20,18,22,.34)" }}>9:16</div>
      <div style={{ position: "absolute", left: "12%", right: "12%", bottom: "15%", display: "flex", alignItems: "end", gap: 6 }}>
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} style={{ flex: 1, height: 14 + ((index * 23 + frame) % 68), maxHeight: 78, borderRadius: 999, background: index % 3 === 0 ? "rgba(111,67,220,.30)" : "rgba(20,18,22,.10)" }} />
        ))}
      </div>
    </div>
  );
}

function WatchMotif({ frame, width, height, portrait }: MotifProps) {
  if (frame < 1980 || frame > 2285) return null;
  const local = frame - 1980;
  const p = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 86 } });
  return (
    <div style={{ position: "absolute", left: portrait ? -width * .10 : width * .07, top: portrait ? height * .18 : height * .12, width: portrait ? width * .48 : width * .30, height: portrait ? height * .54 : height * .76, opacity: p }}>
      <div style={{ position: "absolute", inset: "4%", borderRadius: portrait ? 56 : 44, background: "linear-gradient(180deg,#19151f,#0f0c13)", boxShadow: "0 38px 120px rgba(26,18,35,.22)", transform: `translateY(${(1 - p) * 70}px) rotate(${-3 + p * 3}deg)` }}>
        <div style={{ position: "absolute", left: "9%", top: "8%", fontSize: portrait ? width * .020 : height * .026, color: "rgba(255,255,255,.58)", fontWeight: 720 }}>POST LIVE</div>
        <div style={{ position: "absolute", left: "9%", top: "18%", fontSize: portrait ? width * .055 : height * .07, lineHeight: .92, color: "white", fontWeight: 820, letterSpacing: "-.065em" }}>ODAESHI</div>
        <div style={{ position: "absolute", left: "9%", right: "9%", bottom: "15%", display: "flex", alignItems: "end", gap: 7 }}>
          {Array.from({ length: 18 }).map((_, index) => {
            const pulse = 1 + Math.sin((frame + index * 5) / 12) * .14;
            return <span key={index} style={{ flex: 1, height: (18 + ((index * 31) % 86)) * pulse, maxHeight: 112, borderRadius: 999, background: index % 4 === 0 ? "rgba(149,111,255,.92)" : "rgba(255,255,255,.22)" }} />;
          })}
        </div>
      </div>
    </div>
  );
}

type MotifProps = { frame: number; width: number; height: number; portrait: boolean };
