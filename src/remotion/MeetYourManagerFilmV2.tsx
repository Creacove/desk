import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { FilmFormat } from "./constants";

type FilmProps = { format: FilmFormat };

type Chapter = {
  start: number;
  end: number;
};

const V = "#8b5cf6";
const VS = "#b79cff";
const PAPER = "#f7f5f1";
const INK = "#111318";
const FONT = "Manrope, Inter, ui-sans-serif, system-ui";
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const CHAPTERS = {
  opening: { start: 0, end: 250 },
  goal: { start: 215, end: 575 },
  context: { start: 540, end: 865 },
  work: { start: 830, end: 1290 },
  task: { start: 1255, end: 1620 },
  adapt: { start: 1585, end: 1945 },
  watch: { start: 1910, end: 2215 },
  approval: { start: 2180, end: 2395 },
  end: { start: 2360, end: 2520 },
} satisfies Record<string, Chapter>;

function easeOut(value: number) {
  return Easing.out(Easing.cubic)(value);
}

function progress(frame: number, from: number, to: number) {
  return interpolate(frame, [from, to], [0, 1], clamp);
}

function windowOpacity(frame: number, chapter: Chapter, enter = 24, exit = 30) {
  const a = progress(frame, chapter.start, chapter.start + enter);
  const b = interpolate(frame, [chapter.end - exit, chapter.end], [1, 0], clamp);
  return Math.min(a, b);
}

function headlineOpacity(frame: number, chapter: Chapter) {
  const a = progress(frame, chapter.start + 8, chapter.start + 30);
  const b = interpolate(frame, [chapter.end - 72, chapter.end - 42], [1, 0], clamp);
  return Math.min(a, b);
}

function local(frame: number, chapter: Chapter) {
  return frame - chapter.start;
}

function drift(frame: number, amount: number, speed = 0.04, phase = 0) {
  return Math.sin(frame * speed + phase) * amount;
}

function useScale() {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / 1080, height / 1920);
  return { width, height, scale, px: (n: number) => n * scale };
}

function Layer({ children, opacity = 1, style }: { children: ReactNode; opacity?: number; style?: CSSProperties }) {
  return <AbsoluteFill style={{ overflow: "hidden", opacity, ...style }}>{children}</AbsoluteFill>;
}

function Logo({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        overflow: "hidden",
        background: "#111",
        boxShadow: `0 0 ${size * 1.5}px rgba(139,92,246,.28)`,
      }}
    >
      <Img src={staticFile("logo.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function Ambient({ frame }: { frame: number }) {
  const { width, height } = useVideoConfig();
  const x = interpolate(frame, [0, 2520], [-width * 0.08, width * 0.12], clamp);
  const y = Math.sin(frame / 150) * height * 0.035;
  const gridX = (frame * 0.22) % 96;
  const gridY = (frame * 0.13) % 96;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#0d0d13 0%,#08080c 58%,#050507 100%)" }}>
      <div
        style={{
          position: "absolute",
          width: width * 0.8,
          height: width * 0.8,
          left: width * 0.1 + x,
          top: -width * 0.3 + y,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(139,92,246,.20),rgba(139,92,246,0) 68%)",
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)",
          backgroundSize: "96px 96px",
          backgroundPosition: `${gridX}px ${gridY}px`,
        }}
      />
    </AbsoluteFill>
  );
}

function Opening({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.opening;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 18, 36);
  const hOpacity = headlineOpacity(frame, c);
  const first = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 18, stiffness: 92 } });
  const second = spring({ frame: Math.max(0, f - 66), fps: 60, config: { damping: 18, stiffness: 88 } });
  const collapse = easeOut(progress(f, 132, 230));
  const camera = interpolate(f, [0, 240], [0.95, 1.12], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tags = [
    ["release date", 0.08, 0.16, -7],
    ["content", 0.70, 0.19, 7],
    ["splits", 0.12, 0.74, 6],
    ["pitching", 0.72, 0.76, -5],
    ["press", 0.05, 0.48, -8],
    ["audience", 0.78, 0.49, 8],
  ] as const;

  return (
    <Layer opacity={opacity} style={{ transform: `scale(${camera})` }}>
      {tags.map(([label, x, y, rotation], i) => {
        const p = spring({ frame: Math.max(0, f - i * 6), fps: 60, config: { damping: 20, stiffness: 105 } });
        const targetX = width * x;
        const targetY = height * y;
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const tx = targetX + (centerX - targetX) * collapse;
        const ty = targetY + (centerY - targetY) * collapse;
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: tx,
              top: ty,
              transform: `translate(-50%,-50%) translateY(${drift(f, px(7), 0.035, i)}px) rotate(${rotation * (1 - collapse)}deg) scale(${0.78 + p * 0.22 - collapse * 0.55})`,
              opacity: p * (1 - collapse),
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.04)",
              color: "rgba(255,255,255,.58)",
              padding: `${px(12)}px ${px(19)}px`,
              fontFamily: FONT,
              fontWeight: 680,
              fontSize: px(14),
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.09 : width * 0.08,
          top: portrait ? height * 0.32 : height * 0.25,
          width: portrait ? width * 0.82 : width * 0.55,
          opacity: hOpacity,
          transform: `translateY(${(1 - first) * px(110) - collapse * px(44)}px)`,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{ transform: `translateY(${(1 - first) * 120}%)`, fontFamily: FONT, fontSize: portrait ? px(83) : px(96), lineHeight: 0.92, letterSpacing: "-0.062em", fontWeight: 790, color: "white" }}>
            You make the music.
          </div>
        </div>
        <div style={{ overflow: "hidden", marginTop: px(40) }}>
          <div style={{ transform: `translateY(${(1 - second) * 120}%)`, fontFamily: FONT, fontSize: portrait ? px(53) : px(62), lineHeight: 1, letterSpacing: "-0.052em", fontWeight: 650, color: "rgba(255,255,255,.44)" }}>
            Who runs everything else?
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) scale(${collapse})`,
          opacity: collapse,
        }}
      >
        <Logo size={px(72)} />
      </div>
    </Layer>
  );
}

function Goal({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.goal;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 24, 34);
  const hOpacity = headlineOpacity(frame, c);
  const inP = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 19, stiffness: 88 } });
  const camera = interpolate(f, [0, 350], [0.92, 1.08], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const text = "I want to release Odaeshi next month.";
  const typed = Math.floor(interpolate(f, [50, 164], [0, text.length], clamp));
  const sent = spring({ frame: Math.max(0, f - 168), fps: 60, config: { damping: 15, stiffness: 160 } });
  const reply = spring({ frame: Math.max(0, f - 205), fps: 60, config: { damping: 18, stiffness: 100 } });
  const exitTravel = easeOut(progress(f, 302, 360));

  return (
    <Layer opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.09 : width * 0.07, top: portrait ? height * 0.09 : height * 0.19, opacity: hOpacity, transform: `translateY(${interpolate(inP, [0, 1], [px(34), 0])}px)`, fontFamily: FONT, color: "white", fontSize: portrait ? px(47) : px(57), lineHeight: 0.96, fontWeight: 780, letterSpacing: "-0.055em", maxWidth: portrait ? width * 0.8 : width * 0.28 }}>
        Give Desk the goal.
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.09 : width * 0.34,
          top: portrait ? height * 0.25 : height * 0.12,
          width: portrait ? width * 0.82 : width * 0.58,
          height: portrait ? height * 0.5 : height * 0.73,
          borderRadius: px(34),
          border: "1px solid rgba(255,255,255,.11)",
          background: "rgba(15,15,21,.91)",
          boxShadow: `0 ${px(38)}px ${px(110)}px rgba(0,0,0,.46)`,
          overflow: "hidden",
          transform: `translate(${exitTravel * -width * 0.08}px, ${(1 - inP) * px(180) + drift(f, px(4), 0.02)}px) scale(${camera}) rotate(${(1 - inP) * 1.8 - exitTravel * 1.2}deg)`,
        }}
      >
        <div style={{ height: px(72), display: "flex", alignItems: "center", gap: px(14), padding: `0 ${px(23)}px`, borderBottom: "1px solid rgba(255,255,255,.08)", fontFamily: FONT }}>
          <Logo size={px(36)} />
          <div style={{ color: "white", fontSize: px(14), fontWeight: 730 }}>Manager</div>
          <div style={{ marginLeft: "auto", width: px(8), height: px(8), borderRadius: "50%", background: VS, boxShadow: `0 0 ${px(18)}px rgba(183,156,255,.65)` }} />
        </div>
        <div style={{ padding: px(26), fontFamily: FONT }}>
          <div style={{ marginLeft: "auto", width: "88%", minHeight: px(138), borderRadius: px(24), border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.06)", padding: px(23), position: "relative", color: "white", fontSize: portrait ? px(24) : px(28), lineHeight: 1.28, fontWeight: 650, letterSpacing: "-0.025em" }}>
            {text.slice(0, typed)}{typed < text.length ? <span style={{ color: VS, opacity: f % 24 < 12 ? 1 : 0 }}>|</span> : null}
            <div style={{ position: "absolute", right: px(17), bottom: px(17), width: px(46), height: px(46), borderRadius: "50%", display: "grid", placeItems: "center", background: "white", color: INK, transform: `scale(${0.78 + sent * 0.22}) rotate(${(1 - sent) * -12}deg)`, fontSize: px(20), fontWeight: 900 }}>↗</div>
          </div>
          <div style={{ marginTop: px(22), width: "92%", borderRadius: px(23), border: "1px solid rgba(139,92,246,.24)", background: "rgba(139,92,246,.08)", padding: px(22), color: "white", opacity: reply, transform: `translateY(${(1 - reply) * px(44)}px) scale(${0.96 + reply * 0.04})` }}>
            <div style={{ color: VS, fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".13em" }}>Desk</div>
            <div style={{ marginTop: px(9), fontSize: portrait ? px(23) : px(26), lineHeight: 1.28, fontWeight: 670, letterSpacing: "-0.025em" }}>I’ve got the release. I’m checking what needs to happen first.</div>
          </div>
        </div>
      </div>
    </Layer>
  );
}

function Context({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.context;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 24, 36);
  const hOpacity = headlineOpacity(frame, c);
  const gather = easeOut(progress(f, 70, 205));
  const today = spring({ frame: Math.max(0, f - 135), fps: 60, config: { damping: 18, stiffness: 96 } });
  const exit = easeOut(progress(f, 270, 325));
  const items = [
    ["Song", -0.27, -0.18, 0], ["Audience", 0.25, -0.17, 1], ["Files", -0.29, 0.16, 2], ["Release state", 0.26, 0.16, 3], ["Resources", -0.03, 0.29, 4], ["Artist context", 0.02, -0.31, 5],
  ] as const;
  const cx = portrait ? width * 0.5 : width * 0.57;
  const cy = portrait ? height * 0.46 : height * 0.52;

  return (
    <Layer opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.07, top: portrait ? height * 0.08 : height * 0.13, opacity: hOpacity, fontFamily: FONT }}>
        <div style={{ color: VS, fontSize: px(11), fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Context</div>
        <div style={{ marginTop: px(13), color: "white", fontSize: portrait ? px(49) : px(60), fontWeight: 790, lineHeight: 0.95, letterSpacing: "-0.058em" }}>Desk gets the context.</div>
      </div>

      {items.map(([label, ox, oy, phase], i) => {
        const p = spring({ frame: Math.max(0, f - i * 8), fps: 60, config: { damping: 18, stiffness: 105 } });
        const spread = 1 - gather * 0.52;
        const x = cx + width * ox * spread + drift(f, px(9), 0.025, phase);
        const y = cy + height * oy * spread + drift(f, px(7), 0.03, phase + 1);
        return <div key={label} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${0.8 + p * 0.2 - gather * 0.18}) rotate(${drift(f, 1.2, 0.02, phase)}deg)`, opacity: p * (1 - today * 0.72), border: "1px solid rgba(255,255,255,.11)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.64)", borderRadius: px(16), padding: `${px(14)}px ${px(20)}px`, fontFamily: FONT, fontSize: px(13), fontWeight: 690, whiteSpace: "nowrap" }}>{label}</div>;
      })}

      <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${0.9 + gather * 0.1})`, opacity: 1 - today * 0.78, width: px(142), height: px(142), borderRadius: px(38), border: "1px solid rgba(183,156,255,.24)", background: "rgba(139,92,246,.12)", boxShadow: `0 0 ${px(90)}px rgba(139,92,246,.18)`, display: "grid", placeItems: "center", fontFamily: FONT, color: "white", fontSize: px(18), fontWeight: 800 }}>ODAESHI</div>

      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.43, top: portrait ? height * 0.55 : height * 0.26, width: portrait ? width * 0.84 : width * 0.48, borderRadius: px(33), background: PAPER, color: INK, boxShadow: `0 ${px(38)}px ${px(105)}px rgba(0,0,0,.42)`, overflow: "hidden", opacity: today, transform: `translateY(${(1 - today) * px(170) - exit * px(60) + drift(f, px(3), 0.022)}px) scale(${0.86 + today * 0.14 + exit * 0.08})` }}>
        <div style={{ padding: `${px(20)}px ${px(27)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", fontFamily: FONT, color: "rgba(17,19,24,.38)", fontSize: px(10), fontWeight: 820, textTransform: "uppercase", letterSpacing: ".14em" }}>Today</div>
        <div style={{ padding: px(32), fontFamily: FONT }}>
          <div style={{ fontSize: portrait ? px(32) : px(38), fontWeight: 820, letterSpacing: "-0.047em", lineHeight: 1.02 }}>Odaeshi is the priority.</div>
          <div style={{ marginTop: px(13), maxWidth: "78%", color: "rgba(17,19,24,.54)", fontWeight: 620, fontSize: px(16), lineHeight: 1.36 }}>Record the first launch-week content piece. Desk has already prepared the brief.</div>
          <div style={{ marginTop: px(26), display: "inline-flex", borderRadius: 999, padding: `${px(12)}px ${px(20)}px`, background: INK, color: "white", fontSize: px(13), fontWeight: 770 }}>Start</div>
        </div>
      </div>
    </Layer>
  );
}

function Work({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.work;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 24, 34);
  const hOpacity = headlineOpacity(frame, c);
  const windowIn = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 19, stiffness: 90 } });
  const camera = interpolate(f, [0, 425], [0.92, 1.11], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const collapse = easeOut(progress(f, 330, 440));
  const artifacts = [
    ["EPK", "Press-ready artist package"], ["Press release", "Story, credits and angle"], ["Content plan", "Hooks, formats and posting windows"], ["Playlist pitch", "Fit-based pitch copy"],
  ] as const;

  return (
    <Layer opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.06, top: portrait ? height * 0.08 : height * 0.12, opacity: hOpacity, fontFamily: FONT }}>
        <div style={{ color: VS, fontSize: px(11), fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Manager</div>
        <div style={{ marginTop: px(13), color: "white", fontSize: portrait ? px(49) : px(61), lineHeight: 0.95, letterSpacing: "-0.058em", fontWeight: 790 }}>Desk does the work it can.</div>
      </div>

      <div style={{ position: "absolute", left: portrait ? width * 0.07 : width * 0.35, top: portrait ? height * 0.25 : height * 0.15, width: portrait ? width * 0.86 : width * 0.58, height: portrait ? height * 0.57 : height * 0.73, borderRadius: px(34), border: "1px solid rgba(255,255,255,.11)", background: "rgba(15,15,21,.89)", boxShadow: `0 ${px(40)}px ${px(112)}px rgba(0,0,0,.44)`, overflow: "hidden", transform: `translateY(${(1 - windowIn) * px(160) + drift(f, px(3), 0.018)}px) scale(${camera})` }}>
        <div style={{ height: px(70), borderBottom: "1px solid rgba(255,255,255,.08)", padding: `0 ${px(23)}px`, display: "flex", alignItems: "center", gap: px(13), fontFamily: FONT }}><Logo size={px(35)} /><div style={{ color: "white", fontSize: px(13), fontWeight: 740 }}>Manager</div><div style={{ marginLeft: "auto", color: "rgba(255,255,255,.31)", fontSize: px(10), fontWeight: 670 }}>Creating release work</div></div>
        <div style={{ position: "relative", height: `calc(100% - ${px(70)}px)`, padding: px(26) }}>
          <div style={{ width: portrait ? "88%" : "62%", border: "1px solid rgba(139,92,246,.22)", background: "rgba(139,92,246,.075)", borderRadius: px(22), padding: px(20), color: "white", fontFamily: FONT }}><div style={{ color: VS, fontSize: px(10), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".13em" }}>Desk</div><div style={{ marginTop: px(8), fontSize: px(20), fontWeight: 680, lineHeight: 1.3, letterSpacing: "-0.026em" }}>I’m building the release package now.</div></div>

          {artifacts.map(([title, body], i) => {
            const p = spring({ frame: Math.max(0, f - 60 - i * 50), fps: 60, config: { damping: 17, stiffness: 120 } });
            const baseX = portrait ? px(16 + (i % 2) * 252) : px(400 + (i % 2) * 258);
            const baseY = portrait ? px(175 + Math.floor(i / 2) * 218) : px(90 + Math.floor(i / 2) * 218);
            const stackX = portrait ? px(274) : px(665);
            const stackY = portrait ? px(410) : px(340);
            const x = baseX + (stackX - baseX) * collapse;
            const y = baseY + (stackY - baseY) * collapse;
            return <div key={title} style={{ position: "absolute", left: x, top: y, width: portrait ? px(222) : px(242), minHeight: px(165), borderRadius: px(21), background: PAPER, color: INK, padding: px(20), boxShadow: `0 ${px(22)}px ${px(58)}px rgba(0,0,0,.33)`, transform: `translate(${(1 - p) * px(130)}px, ${(1 - p) * px(58) + drift(f, px(3), 0.03, i)}px) scale(${0.76 + p * 0.24 - collapse * i * 0.02}) rotate(${(i % 2 === 0 ? -2.4 : 2.1) * (1 - collapse)}deg)`, opacity: p, zIndex: 10 + i, fontFamily: FONT }}><div style={{ width: px(28), height: px(28), borderRadius: px(8), display: "grid", placeItems: "center", background: "rgba(139,92,246,.12)", color: V, fontWeight: 900, fontSize: px(14) }}>✓</div><div style={{ marginTop: px(20), fontSize: px(18), fontWeight: 820, letterSpacing: "-0.035em" }}>{title}</div><div style={{ marginTop: px(7), color: "rgba(17,19,24,.5)", fontSize: px(11), fontWeight: 620, lineHeight: 1.35 }}>{body}</div><div style={{ marginTop: px(15), height: px(4), width: `${p * 100}%`, background: V, borderRadius: 999 }} /></div>;
          })}

          <div style={{ position: "absolute", left: portrait ? px(268) : px(645), top: portrait ? px(404) : px(332), zIndex: 50, opacity: collapse, transform: `scale(${0.8 + collapse * 0.2})`, borderRadius: 999, background: "white", color: INK, padding: `${px(12)}px ${px(21)}px`, fontFamily: FONT, fontSize: px(12), fontWeight: 790 }}>Saved to Files</div>
        </div>
      </div>
    </Layer>
  );
}

function Task({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.task;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 24, 34);
  const hOpacity = headlineOpacity(frame, c);
  const panel = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 18, stiffness: 92 } });
  const camera = interpolate(f, [20, 340], [0.94, 1.12], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const rows = [["Hook", "What couldn’t finish us?"], ["Setup", "Front camera. Quiet room. No music for the first line."], ["Shot", "Say the line, hold for one beat, then let Odaeshi enter."], ["Edit", "Keep it under 14 seconds. Cut on the first kick."], ["CTA", "Comment the thing you survived."]] as const;

  return (
    <Layer opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.06, top: portrait ? height * 0.08 : height * 0.12, opacity: hOpacity, fontFamily: FONT }}><div style={{ color: VS, fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em" }}>Mission</div><div style={{ marginTop: px(13), color: "white", fontSize: portrait ? px(47) : px(58), fontWeight: 790, lineHeight: 0.97, letterSpacing: "-0.056em", maxWidth: portrait ? width * 0.82 : width * 0.34 }}>When Desk needs you, you get the exact job.</div></div>
      <div style={{ position: "absolute", left: portrait ? width * 0.07 : width * 0.4, top: portrait ? height * 0.3 : height * 0.12, width: portrait ? width * 0.86 : width * 0.5, borderRadius: px(34), background: PAPER, color: INK, boxShadow: `0 ${px(40)}px ${px(110)}px rgba(0,0,0,.42)`, overflow: "hidden", transform: `translateY(${(1 - panel) * px(160) + drift(f, px(3), 0.018)}px) scale(${camera})` }}>
        <div style={{ padding: `${px(20)}px ${px(27)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", display: "flex", fontFamily: FONT }}><div style={{ color: "rgba(17,19,24,.4)", fontSize: px(10), fontWeight: 820, textTransform: "uppercase", letterSpacing: ".14em" }}>Today’s task</div><div style={{ marginLeft: "auto", color: V, fontSize: px(10), fontWeight: 790 }}>Odaeshi release</div></div>
        <div style={{ padding: px(29), fontFamily: FONT }}><div style={{ fontSize: portrait ? px(28) : px(33), fontWeight: 830, letterSpacing: "-0.046em", lineHeight: 1.04 }}>Record launch-week story video</div><div style={{ marginTop: px(11), color: "rgba(17,19,24,.48)", fontSize: px(13), fontWeight: 630 }}>Desk has already decided the angle, structure and fallback.</div>
          <div style={{ marginTop: px(25), display: "grid", gap: px(10) }}>{rows.map(([label, value], i) => { const p = spring({ frame: Math.max(0, f - 58 - i * 31), fps: 60, config: { damping: 19, stiffness: 110 } }); return <div key={label} style={{ display: "grid", gridTemplateColumns: portrait ? `${px(72)}px 1fr` : `${px(88)}px 1fr`, gap: px(12), borderTop: i ? "1px solid rgba(17,19,24,.08)" : undefined, paddingTop: i ? px(13) : 0, opacity: p, transform: `translateY(${(1 - p) * px(26)}px)` }}><div style={{ color: V, fontSize: px(10), fontWeight: 820, textTransform: "uppercase", letterSpacing: ".1em" }}>{label}</div><div style={{ fontSize: px(13), fontWeight: 650, lineHeight: 1.35 }}>{value}</div></div>; })}</div>
          <div style={{ marginTop: px(24), display: "inline-flex", borderRadius: 999, background: INK, color: "white", padding: `${px(12)}px ${px(21)}px`, fontSize: px(13), fontWeight: 780, transform: `scale(${1 + Math.sin(f / 15) * 0.015})` }}>Start</div>
        </div>
      </div>
    </Layer>
  );
}

function Adapt({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.adapt;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 24, 34);
  const hOpacity = headlineOpacity(frame, c);
  const bubble = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 18, stiffness: 100 } });
  const shift = easeOut(progress(f, 95, 245));
  const camera = interpolate(f, [0, 350], [0.96, 1.07], { ...clamp, easing: Easing.inOut(Easing.cubic) });

  const Timeline = ({ moved }: { moved: boolean }) => <div style={{ width: portrait ? width * 0.86 : width * 0.64, borderRadius: px(32), background: PAPER, color: INK, overflow: "hidden", boxShadow: `0 ${px(34)}px ${px(95)}px rgba(0,0,0,.4)`, fontFamily: FONT }}><div style={{ padding: `${px(19)}px ${px(26)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", color: "rgba(17,19,24,.38)", fontSize: px(10), fontWeight: 820, textTransform: "uppercase", letterSpacing: ".13em" }}>Odaeshi release mission</div><div style={{ padding: px(27) }}><div style={{ display: "flex", gap: px(9) }}>{["Today", "Sat", "Sun", "Mon"].map((day, i) => { const active = moved ? i === 2 : i === 0; return <div key={day} style={{ flex: 1, borderRadius: px(17), padding: px(14), border: `1px solid ${active ? "rgba(139,92,246,.35)" : "rgba(17,19,24,.08)"}`, background: active ? "rgba(139,92,246,.08)" : "transparent" }}><div style={{ fontSize: px(9), fontWeight: 800, color: active ? V : "rgba(17,19,24,.34)", textTransform: "uppercase", letterSpacing: ".08em" }}>{day}</div><div style={{ marginTop: px(10), minHeight: px(56), fontSize: px(11), fontWeight: 660, lineHeight: 1.3, color: active ? INK : "rgba(17,19,24,.38)" }}>{active ? "Record story video" : i === 3 ? "Desk review" : "Release work"}</div></div>; })}</div><div style={{ marginTop: px(20), color: moved ? V : "rgba(17,19,24,.5)", fontSize: px(13), fontWeight: 720 }}>{moved ? "Plan updated. Nothing else needed from you today." : "Today: record launch-week story video."}</div></div></div>;

  return (
    <Layer opacity={opacity} style={{ transform: `scale(${camera})` }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.06, top: portrait ? height * 0.08 : height * 0.12, opacity: hOpacity, fontFamily: FONT }}><div style={{ color: VS, fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em" }}>Reality changes</div><div style={{ marginTop: px(13), color: "white", fontSize: portrait ? px(53) : px(65), fontWeight: 800, lineHeight: 0.94, letterSpacing: "-0.06em" }}>Desk adjusts.</div></div>
      <div style={{ position: "absolute", right: portrait ? width * 0.07 : width * 0.06, top: portrait ? height * 0.25 : height * 0.14, maxWidth: portrait ? width * 0.72 : width * 0.36, borderRadius: px(23), padding: px(21), border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.07)", color: "white", fontFamily: FONT, fontSize: px(18), fontWeight: 660, lineHeight: 1.35, opacity: bubble * (1 - progress(f, 120, 175)), transform: `translateY(${(1 - bubble) * px(50)}px)` }}>I can’t shoot today. Move it to Sunday.</div>
      <div style={{ position: "absolute", left: portrait ? width * 0.07 - shift * width * 0.95 : width * 0.18 - shift * width * 0.95, top: portrait ? height * 0.45 : height * 0.34, transform: `rotate(${-shift * 2}deg)` }}><Timeline moved={false} /></div>
      <div style={{ position: "absolute", left: portrait ? width * 0.07 + (1 - shift) * width * 0.95 : width * 0.18 + (1 - shift) * width * 0.95, top: portrait ? height * 0.45 : height * 0.34, transform: `rotate(${(1 - shift) * 2}deg)` }}><Timeline moved /></div>
      <div style={{ position: "absolute", left: "50%", bottom: portrait ? height * 0.08 : height * 0.07, transform: `translateX(-50%) translateY(${(1 - shift) * px(22)}px)`, opacity: shift, color: "rgba(255,255,255,.46)", fontFamily: FONT, fontSize: px(13), fontWeight: 690 }}>No “what next?” prompt.</div>
    </Layer>
  );
}

function Watch({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.watch;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 24, 34);
  const hOpacity = headlineOpacity(frame, c);
  const post = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 18, stiffness: 98 } });
  const camera = interpolate(f, [0, 300], [0.96, 1.08], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const metrics = ["comments", "shares", "saves", "24h review"];

  return (
    <Layer opacity={opacity} style={{ transform: `scale(${camera})` }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.06, top: portrait ? height * 0.08 : height * 0.12, opacity: hOpacity, fontFamily: FONT }}><div style={{ color: VS, fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em" }}>After you post</div><div style={{ marginTop: px(13), color: "white", fontSize: portrait ? px(54) : px(66), fontWeight: 800, lineHeight: 0.94, letterSpacing: "-0.06em" }}>Desk is watching.</div></div>
      <div style={{ position: "absolute", left: portrait ? width * 0.11 : width * 0.18, top: portrait ? height * 0.35 : height * 0.27, width: portrait ? width * 0.45 : width * 0.28, aspectRatio: "9 / 14", borderRadius: px(31), border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.03))", boxShadow: `0 ${px(34)}px ${px(92)}px rgba(0,0,0,.42)`, transform: `translateY(${(1 - post) * px(100) + drift(f, px(4), 0.02)}px) rotate(${(1 - post) * -4}deg) scale(${0.86 + post * 0.14})`, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%,rgba(139,92,246,.32),transparent 32%)" }} /><div style={{ position: "absolute", left: px(21), right: px(21), bottom: px(23), fontFamily: FONT }}><div style={{ color: "white", fontSize: px(16), fontWeight: 770 }}>What couldn’t finish us?</div><div style={{ marginTop: px(6), color: "rgba(255,255,255,.43)", fontSize: px(10), fontWeight: 630 }}>Odaeshi · posted</div></div></div>
      <div style={{ position: "absolute", left: portrait ? width * 0.67 : width * 0.7, top: portrait ? height * 0.53 : height * 0.53, width: portrait ? width * 0.22 : width * 0.14, aspectRatio: "1", transform: "translate(-50%,-50%)" }}>{[0,1,2].map(i => <div key={i} style={{ position: "absolute", inset: `${i * 13}%`, borderRadius: "50%", border: `${px(2)}px solid rgba(183,156,255,${0.35 - i * 0.07})`, transform: `scale(${1 + Math.sin(f / 17 + i) * 0.035})`, opacity: 0.86 - i * 0.14 }} />)}<div style={{ position: "absolute", inset: "29%", borderRadius: "50%", background: V, boxShadow: `0 0 ${px(80)}px rgba(139,92,246,.42)`, display: "grid", placeItems: "center", color: "white", fontFamily: FONT, fontSize: px(10), fontWeight: 820, textAlign: "center" }}>Desk<br/>watch</div></div>
      {metrics.map((label, i) => { const p = spring({ frame: Math.max(0, f - 65 - i * 27), fps: 60, config: { damping: 18, stiffness: 104 } }); const pts = portrait ? [[.56,.34],[.72,.32],[.73,.72],[.56,.74]] : [[.62,.28],[.79,.32],[.8,.72],[.61,.76]]; const [x,y] = pts[i]; return <div key={label} style={{ position: "absolute", left: width * x, top: height * y, transform: `translate(-50%,-50%) translateY(${(1 - p) * px(26) + drift(f, px(6), .03, i)}px) scale(${.84 + p * .16})`, opacity: p, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.045)", color: "rgba(255,255,255,.62)", padding: `${px(11)}px ${px(17)}px`, fontFamily: FONT, fontSize: px(11), fontWeight: 710, whiteSpace: "nowrap" }}>{label} · collecting</div>; })}
    </Layer>
  );
}

function Approval({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.approval;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 22, 30);
  const hOpacity = headlineOpacity(frame, c);
  const card = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 18, stiffness: 94 } });
  const cursor = spring({ frame: Math.max(0, f - 48), fps: 60, config: { damping: 18, stiffness: 118 } });
  const click = interpolate(f, [105, 114, 124], [0, 1, 0], clamp);
  const done = spring({ frame: Math.max(0, f - 122), fps: 60, config: { damping: 18, stiffness: 96 } });
  const camera = interpolate(f, [0, 205], [0.95, 1.09], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <Layer opacity={opacity} style={{ transform: `scale(${camera})` }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.06, top: portrait ? height * 0.08 : height * 0.13, opacity: hOpacity, fontFamily: FONT }}><div style={{ color: VS, fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em" }}>Authority</div><div style={{ marginTop: px(13), color: "white", fontSize: portrait ? px(53) : px(66), fontWeight: 800, lineHeight: 0.94, letterSpacing: "-0.06em" }}>You stay in control.</div></div>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.4, top: portrait ? height * 0.35 : height * 0.24, width: portrait ? width * 0.84 : width * 0.52, borderRadius: px(33), background: PAPER, color: INK, boxShadow: `0 ${px(42)}px ${px(115)}px rgba(0,0,0,.44)`, overflow: "hidden", transform: `translateY(${(1 - card) * px(150) + drift(f, px(3), 0.02)}px) scale(${.9 + card * .1})` }}><div style={{ padding: `${px(19)}px ${px(27)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", display: "flex", fontFamily: FONT }}><div style={{ color: "rgba(17,19,24,.4)", fontSize: px(10), fontWeight: 820, textTransform: "uppercase", letterSpacing: ".13em" }}>Approval required</div><div style={{ marginLeft: "auto", color: V, fontSize: px(10), fontWeight: 790 }}>{done > .72 ? "Completed" : "Desk can execute"}</div></div><div style={{ padding: px(30), fontFamily: FONT }}><div style={{ fontSize: portrait ? px(27) : px(33), fontWeight: 830, letterSpacing: "-0.045em", lineHeight: 1.05 }}>{done > .72 ? "Split confirmation sent." : "Send the approved split confirmation."}</div><div style={{ marginTop: px(13), color: "rgba(17,19,24,.5)", fontSize: px(13), fontWeight: 630, lineHeight: 1.38 }}>{done > .72 ? "Desk logged the provider outcome and continued the release plan." : "Exact effect: send the approved split details to the listed collaborators and record the outcome."}</div><div style={{ marginTop: px(27), display: "flex", gap: px(10), opacity: 1 - done }}><div style={{ borderRadius: 999, background: INK, color: "white", padding: `${px(13 - click)}px ${px(23 - click * 1.5)}px`, fontSize: px(13), fontWeight: 790, transform: `scale(${1 - click * .05})`, boxShadow: click ? `0 0 0 ${px(8)}px rgba(139,92,246,.11)` : undefined }}>Approve & run</div><div style={{ borderRadius: 999, border: "1px solid rgba(17,19,24,.12)", padding: `${px(13)}px ${px(21)}px`, color: "rgba(17,19,24,.5)", fontSize: px(13), fontWeight: 730 }}>Reject</div></div><div style={{ marginTop: px(24), opacity: done, transform: `translateY(${(1 - done) * px(20)}px)` }}><div style={{ display: "inline-flex", alignItems: "center", gap: px(8), color: V, fontSize: px(12), fontWeight: 800 }}><span style={{ width: px(22), height: px(22), borderRadius: "50%", background: "rgba(139,92,246,.12)", display: "grid", placeItems: "center" }}>✓</span>Provider outcome recorded</div><div style={{ marginTop: px(10), color: "rgba(17,19,24,.48)", fontSize: px(12), fontWeight: 630 }}>Next: release operations continue automatically.</div></div></div></div>
      <div style={{ position: "absolute", left: portrait ? width * 0.62 : width * 0.67, top: portrait ? height * 0.69 : height * 0.64, width: px(32), height: px(44), clipPath: "polygon(0 0,100% 68%,58% 72%,78% 100%,62% 100%,43% 74%,16% 100%)", background: "white", filter: `drop-shadow(0 ${px(6)}px ${px(10)}px rgba(0,0,0,.4))`, opacity: cursor * (1 - done), transform: `translate(${(1 - cursor) * px(120)}px, ${(1 - cursor) * px(-75)}px) scale(${1 - click * .12})`, zIndex: 30 }} />
    </Layer>
  );
}

function End({ frame, format }: FilmProps & { frame: number }) {
  const c = CHAPTERS.end;
  const f = local(frame, c);
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, c, 18, 10);
  const collapse = spring({ frame: Math.max(0, f), fps: 60, config: { damping: 20, stiffness: 86 } });
  const text = spring({ frame: Math.max(0, f - 64), fps: 60, config: { damping: 19, stiffness: 94 } });
  const cards = [[-.29,-.2,-8],[.27,-.17,7],[-.25,.19,6],[.3,.18,-5]] as const;
  return (
    <Layer opacity={opacity}>
      {cards.map(([ox,oy,rot],i) => { const x = width * (.5 + ox * (1 - collapse)); const y = height * (.47 + oy * (1 - collapse)); return <div key={i} style={{ position: "absolute", left: x, top: y, width: portrait ? width * .2 : width * .11, aspectRatio: "1.25", borderRadius: px(20), background: i % 2 ? PAPER : "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", boxShadow: `0 ${px(18)}px ${px(50)}px rgba(0,0,0,.28)`, transform: `translate(-50%,-50%) translateY(${drift(f, px(4), .03, i)}px) rotate(${rot * (1 - collapse)}deg) scale(${1 - collapse * .65})`, opacity: 1 - progress(collapse, .7, 1) }} />; })}
      <div style={{ position: "absolute", left: "50%", top: portrait ? height * .38 : height * .42, transform: `translate(-50%,-50%) scale(${.62 + collapse * .38})`, opacity: collapse }}><Logo size={portrait ? px(94) : px(104)} /></div>
      <div style={{ position: "absolute", left: "50%", top: portrait ? height * .54 : height * .58, width: portrait ? width * .84 : width * .62, transform: `translate(-50%,${(1 - text) * px(58)}px)`, opacity: text, textAlign: "center", fontFamily: FONT }}><div style={{ color: "white", fontSize: portrait ? px(70) : px(90), lineHeight: .94, fontWeight: 810, letterSpacing: "-0.066em" }}>Meet your manager.</div><div style={{ marginTop: px(24), color: "rgba(255,255,255,.4)", fontSize: px(15), fontWeight: 660 }}>Desk by OrderSounds</div></div>
    </Layer>
  );
}

export function MeetYourManagerFilmV2({ format }: FilmProps) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#050507" }}>
      <Ambient frame={frame} />
      <Opening frame={frame} format={format} />
      <Goal frame={frame} format={format} />
      <Context frame={frame} format={format} />
      <Work frame={frame} format={format} />
      <Task frame={frame} format={format} />
      <Adapt frame={frame} format={format} />
      <Watch frame={frame} format={format} />
      <Approval frame={frame} format={format} />
      <End frame={frame} format={format} />
    </AbsoluteFill>
  );
}
