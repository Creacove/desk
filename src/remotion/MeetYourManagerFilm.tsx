import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { FilmFormat } from "./constants";

type FilmProps = { format: FilmFormat };

type StageProps = {
  children: ReactNode;
  opacity?: number;
  style?: CSSProperties;
};

const violet = "#8b5cf6";
const violetSoft = "#b79cff";
const ink = "#111318";
const paper = "#f7f5f1";
const muted = "rgba(255,255,255,0.48)";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

function useScale() {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / 1080, height / 1920);
  return {
    width,
    height,
    scale,
    px: (value: number) => value * scale,
  };
}

function sceneOpacity(frame: number, duration: number, enter = 28, exit = 50) {
  const intro = interpolate(frame, [0, enter], [0, 1], clamp);
  const outro = interpolate(frame, [duration - exit, duration], [1, 0], clamp);
  return Math.min(intro, outro);
}

function float(frame: number, amplitude: number, speed = 0.04, phase = 0) {
  return Math.sin(frame * speed + phase) * amplitude;
}

function Stage({ children, opacity = 1, style }: StageProps) {
  return (
    <AbsoluteFill
      style={{
        opacity,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function BrandIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        overflow: "hidden",
        background: "#111",
        boxShadow: `0 0 ${size * 1.4}px rgba(139,92,246,.28)`,
        flex: "0 0 auto",
      }}
    >
      <Img src={staticFile("logo.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

function AmbientField() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const driftX = interpolate(frame, [0, 2760], [-width * 0.08, width * 0.08]);
  const driftY = Math.sin(frame / 180) * height * 0.035;
  const gridX = (frame * 0.18) % 96;
  const gridY = (frame * 0.12) % 96;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 8%, rgba(139,92,246,.14), transparent 30%), linear-gradient(180deg,#0d0d13 0%,#08080c 58%,#050507 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: width * 0.7,
          height: width * 0.7,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,.18), rgba(139,92,246,0) 66%)",
          left: width * 0.15 + driftX,
          top: -width * 0.22 + driftY,
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.045,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)",
          backgroundSize: "96px 96px",
          backgroundPosition: `${gridX}px ${gridY}px`,
        }}
      />
    </AbsoluteFill>
  );
}

function OpeningScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const opacity = sceneOpacity(frame, 260, 18, 56);
  const first = spring({ frame, fps: 60, config: { damping: 18, stiffness: 90, mass: 0.9 } });
  const second = spring({ frame: Math.max(0, frame - 76), fps: 60, config: { damping: 18, stiffness: 85 } });
  const zoom = interpolate(frame, [0, 230], [0.96, 1.08], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tasks = [
    ["release date", 0.08, 0.14, -7],
    ["content", 0.69, 0.18, 6],
    ["splits", 0.15, 0.72, 5],
    ["pitching", 0.73, 0.76, -4],
    ["press", 0.05, 0.47, -8],
    ["audience", 0.78, 0.48, 7],
  ] as const;

  return (
    <Stage opacity={opacity} style={{ transform: `scale(${zoom})` }}>
      {tasks.map(([label, x, y, rotate], index) => {
        const arrival = spring({
          frame: Math.max(0, frame - index * 7),
          fps: 60,
          config: { damping: 20, stiffness: 100 },
        });
        const scatter = interpolate(frame, [120, 235], [1, 0], clamp);
        const tx = interpolate(arrival, [0, 1], [(x < 0.5 ? -1 : 1) * width * 0.09, 0]);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: width * x,
              top: height * y,
              transform: `translate(${tx}px, ${float(frame, px(7), 0.035, index)}px) rotate(${rotate * scatter}deg) scale(${0.82 + arrival * 0.18})`,
              opacity: arrival * scatter * 0.66,
              padding: `${px(12)}px ${px(18)}px`,
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: px(999),
              color: "rgba(255,255,255,.58)",
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontSize: px(15),
              fontWeight: 650,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              background: "rgba(255,255,255,.035)",
              backdropFilter: "blur(10px)",
            }}
          >
            {label}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.09 : width * 0.085,
          top: portrait ? height * 0.32 : height * 0.25,
          width: portrait ? width * 0.82 : width * 0.56,
          transform: `translateY(${(1 - first) * px(110)}px)`,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              transform: `translateY(${(1 - first) * 115}%)`,
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontSize: portrait ? px(84) : px(96),
              lineHeight: 0.92,
              letterSpacing: "-0.06em",
              fontWeight: 760,
              color: "white",
            }}
          >
            You make the music.
          </div>
        </div>
        <div style={{ overflow: "hidden", marginTop: px(42) }}>
          <div
            style={{
              transform: `translateY(${(1 - second) * 120}%)`,
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontSize: portrait ? px(54) : px(62),
              lineHeight: 1.02,
              letterSpacing: "-0.05em",
              fontWeight: 640,
              color: "rgba(255,255,255,.45)",
              maxWidth: portrait ? width * 0.75 : width * 0.48,
            }}
          >
            Who runs everything else?
          </div>
        </div>
      </div>
    </Stage>
  );
}

function GoalScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 450;
  const opacity = sceneOpacity(frame, duration, 30, 70);
  const cardIn = spring({ frame, fps: 60, config: { damping: 19, stiffness: 85, mass: 0.95 } });
  const camera = interpolate(frame, [0, 360], [0.91, 1.075], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const text = "I want to release Odaeshi next month.";
  const typedCount = Math.floor(interpolate(frame, [62, 188], [0, text.length], clamp));
  const sendProgress = spring({ frame: Math.max(0, frame - 196), fps: 60, config: { damping: 16, stiffness: 150 } });
  const replyProgress = spring({ frame: Math.max(0, frame - 255), fps: 60, config: { damping: 18, stiffness: 95 } });
  const cardW = portrait ? width * 0.82 : width * 0.58;
  const cardH = portrait ? height * 0.49 : height * 0.72;

  return (
    <Stage opacity={opacity}>
      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.09 : width * 0.34,
          top: portrait ? height * 0.24 : height * 0.13,
          width: cardW,
          height: cardH,
          borderRadius: px(34),
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(15,15,21,.90)",
          boxShadow: `0 ${px(36)}px ${px(100)}px rgba(0,0,0,.45)`,
          overflow: "hidden",
          transform: `translateY(${(1 - cardIn) * px(210)}px) scale(${camera}) rotate(${(1 - cardIn) * 1.6}deg)`,
          transformOrigin: portrait ? "50% 62%" : "50% 50%",
        }}
      >
        <div
          style={{
            height: px(76),
            display: "flex",
            alignItems: "center",
            gap: px(16),
            padding: `0 ${px(24)}px`,
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <BrandIcon size={px(38)} />
          <div style={{ fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: px(15) }}>Manager</div>
            <div style={{ color: "rgba(255,255,255,.34)", fontWeight: 600, fontSize: px(11), marginTop: px(2) }}>Odaeshi</div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              width: px(8),
              height: px(8),
              borderRadius: "50%",
              background: violetSoft,
              boxShadow: `0 0 ${px(18)}px rgba(183,156,255,.7)`,
            }}
          />
        </div>

        <div style={{ padding: px(26) }}>
          <div
            style={{
              marginLeft: "auto",
              width: "88%",
              minHeight: px(140),
              borderRadius: px(24),
              background: "rgba(255,255,255,.065)",
              border: "1px solid rgba(255,255,255,.09)",
              padding: px(24),
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontSize: portrait ? px(25) : px(29),
              lineHeight: 1.26,
              letterSpacing: "-0.025em",
              color: "white",
              position: "relative",
            }}
          >
            {text.slice(0, typedCount)}
            {typedCount < text.length ? (
              <span style={{ opacity: frame % 28 < 14 ? 1 : 0, color: violetSoft }}>|</span>
            ) : null}
            <div
              style={{
                position: "absolute",
                right: px(18),
                bottom: px(18),
                width: px(48),
                height: px(48),
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "white",
                color: ink,
                transform: `scale(${0.78 + sendProgress * 0.22}) rotate(${(1 - sendProgress) * -12}deg)`,
                boxShadow: `0 ${px(10)}px ${px(30)}px rgba(0,0,0,.26)`,
              }}
            >
              <span style={{ fontSize: px(22), transform: "translateX(1px)" }}>↗</span>
            </div>
          </div>

          <div
            style={{
              marginTop: px(24),
              width: "92%",
              borderRadius: px(24),
              padding: px(24),
              border: "1px solid rgba(139,92,246,.24)",
              background: "rgba(139,92,246,.08)",
              transform: `translateY(${(1 - replyProgress) * px(46)}px) scale(${0.96 + replyProgress * 0.04})`,
              opacity: replyProgress,
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
            }}
          >
            <div style={{ color: violetSoft, fontWeight: 750, fontSize: px(12), textTransform: "uppercase", letterSpacing: ".12em" }}>Desk</div>
            <div style={{ marginTop: px(11), color: "white", fontWeight: 650, fontSize: portrait ? px(24) : px(27), lineHeight: 1.28, letterSpacing: "-0.025em" }}>
              I’ve got the release. I’m checking what needs to happen first.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.09 : width * 0.075,
          top: portrait ? height * 0.09 : height * 0.24,
          opacity: interpolate(frame, [10, 80], [0, 1], clamp),
          transform: `translateY(${interpolate(frame, [10, 90], [px(30), 0], clamp)}px)`,
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
          color: "white",
          fontSize: portrait ? px(46) : px(54),
          lineHeight: 1,
          fontWeight: 730,
          letterSpacing: "-0.05em",
          maxWidth: portrait ? width * 0.8 : width * 0.22,
        }}
      >
        Give Desk the goal.
      </div>
    </Stage>
  );
}

function ContextScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 430;
  const opacity = sceneOpacity(frame, duration, 28, 64);
  const centerX = portrait ? width * 0.5 : width * 0.57;
  const centerY = portrait ? height * 0.48 : height * 0.52;
  const contextItems = [
    ["Song", -0.25, -0.19, 0],
    ["Audience", 0.22, -0.18, 0.8],
    ["Files", -0.28, 0.15, 1.7],
    ["Release state", 0.24, 0.16, 2.5],
    ["Resources", -0.06, 0.28, 3.1],
    ["Artist context", 0.02, -0.31, 4],
  ] as const;
  const gather = interpolate(frame, [40, 245], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const todayIn = spring({ frame: Math.max(0, frame - 220), fps: 60, config: { damping: 18, stiffness: 95 } });
  const contextFade = interpolate(frame, [240, 360], [1, 0.13], clamp);

  return (
    <Stage opacity={opacity}>
      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.09 : width * 0.075,
          top: portrait ? height * 0.09 : height * 0.14,
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
          color: "white",
        }}
      >
        <div style={{ color: violetSoft, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 760, fontSize: px(12) }}>Context</div>
        <div style={{ marginTop: px(14), fontSize: portrait ? px(48) : px(58), lineHeight: 0.96, letterSpacing: "-0.055em", fontWeight: 760 }}>
          Desk gets the context.
        </div>
      </div>

      {contextItems.map(([label, ox, oy, phase], index) => {
        const itemIn = spring({ frame: Math.max(0, frame - 20 - index * 9), fps: 60, config: { damping: 17, stiffness: 105 } });
        const spread = 1 - gather * 0.45;
        const x = centerX + width * ox * spread + float(frame, px(10), 0.025, phase);
        const y = centerY + height * oy * spread + float(frame, px(8), 0.03, phase + 1);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%,-50%) scale(${0.76 + itemIn * 0.24}) rotate(${float(frame, 1.4, 0.02, phase)}deg)`,
              opacity: itemIn * contextFade,
              borderRadius: px(18),
              border: "1px solid rgba(255,255,255,.11)",
              background: "rgba(255,255,255,.045)",
              padding: `${px(15)}px ${px(21)}px`,
              color: "rgba(255,255,255,.68)",
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontWeight: 680,
              fontSize: px(14),
              boxShadow: `0 ${px(12)}px ${px(32)}px rgba(0,0,0,.18)`,
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
          left: centerX,
          top: centerY,
          width: px(154),
          height: px(154),
          transform: `translate(-50%,-50%) scale(${0.92 + gather * 0.08})`,
          borderRadius: px(42),
          background: "rgba(139,92,246,.12)",
          border: "1px solid rgba(183,156,255,.25)",
          display: "grid",
          placeItems: "center",
          boxShadow: `0 0 ${px(100)}px rgba(139,92,246,.18)`,
          opacity: contextFade,
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "white", fontWeight: 760, fontSize: px(19) }}>ODAESHI</div>
          <div style={{ marginTop: px(7), color: "rgba(255,255,255,.38)", fontWeight: 650, fontSize: px(11) }}>release world</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.08 : width * 0.43,
          top: portrait ? height * 0.56 : height * 0.26,
          width: portrait ? width * 0.84 : width * 0.48,
          borderRadius: px(34),
          background: paper,
          color: ink,
          boxShadow: `0 ${px(36)}px ${px(100)}px rgba(0,0,0,.4)`,
          transform: `translateY(${(1 - todayIn) * px(210)}px) scale(${0.82 + todayIn * 0.18})`,
          opacity: todayIn,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: `${px(22)}px ${px(28)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", fontFamily: "Manrope, Inter, ui-sans-serif, system-ui", fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", color: "rgba(17,19,24,.38)" }}>Today</div>
        <div style={{ padding: px(34), fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <div style={{ fontSize: portrait ? px(33) : px(38), fontWeight: 780, letterSpacing: "-0.045em", lineHeight: 1.04 }}>Odaeshi is the priority.</div>
          <div style={{ marginTop: px(15), maxWidth: "78%", color: "rgba(17,19,24,.55)", fontWeight: 600, fontSize: px(17), lineHeight: 1.35 }}>Record the first launch-week content piece. Desk has already prepared the brief.</div>
          <div style={{ marginTop: px(28), display: "inline-flex", borderRadius: px(999), background: ink, color: "white", padding: `${px(13)}px ${px(21)}px`, fontWeight: 730, fontSize: px(14) }}>Start</div>
        </div>
      </div>
    </Stage>
  );
}

function WorkScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 700;
  const opacity = sceneOpacity(frame, duration, 28, 70);
  const cameraScale = interpolate(frame, [0, 520], [0.9, 1.08], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const artifacts = [
    ["EPK", "Press-ready artist package"],
    ["Press release", "Story, credits and angle"],
    ["Content plan", "Hooks, formats and posting windows"],
    ["Playlist pitch", "Fit-based pitch copy"],
  ] as const;
  const collapse = interpolate(frame, [500, 650], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });

  return (
    <Stage opacity={opacity}>
      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.08 : width * 0.06,
          top: portrait ? height * 0.08 : height * 0.11,
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
        }}
      >
        <div style={{ color: violetSoft, fontWeight: 780, fontSize: px(12), letterSpacing: ".14em", textTransform: "uppercase" }}>Manager</div>
        <div style={{ marginTop: px(13), color: "white", fontWeight: 780, fontSize: portrait ? px(50) : px(62), lineHeight: 0.96, letterSpacing: "-0.055em" }}>Desk does the work it can.</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.07 : width * 0.35,
          top: portrait ? height * 0.25 : height * 0.16,
          width: portrait ? width * 0.86 : width * 0.58,
          height: portrait ? height * 0.56 : height * 0.72,
          borderRadius: px(34),
          background: "rgba(15,15,21,.86)",
          border: "1px solid rgba(255,255,255,.11)",
          boxShadow: `0 ${px(38)}px ${px(110)}px rgba(0,0,0,.43)`,
          transform: `scale(${cameraScale})`,
          overflow: "hidden",
        }}
      >
        <div style={{ height: px(72), borderBottom: "1px solid rgba(255,255,255,.08)", padding: `0 ${px(24)}px`, display: "flex", alignItems: "center", gap: px(14), fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <BrandIcon size={px(36)} />
          <div style={{ color: "white", fontWeight: 720, fontSize: px(14) }}>Manager</div>
          <div style={{ marginLeft: "auto", color: "rgba(255,255,255,.32)", fontSize: px(11), fontWeight: 650 }}>Creating release work</div>
        </div>

        <div style={{ position: "relative", height: `calc(100% - ${px(72)}px)`, padding: px(28) }}>
          <div
            style={{
              width: portrait ? "88%" : "62%",
              borderRadius: px(22),
              border: "1px solid rgba(139,92,246,.22)",
              background: "rgba(139,92,246,.075)",
              padding: px(22),
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              color: "white",
            }}
          >
            <div style={{ color: violetSoft, fontSize: px(11), fontWeight: 760, textTransform: "uppercase", letterSpacing: ".13em" }}>Desk</div>
            <div style={{ marginTop: px(9), fontSize: px(21), fontWeight: 670, lineHeight: 1.3, letterSpacing: "-0.025em" }}>I’m building the release package now.</div>
          </div>

          {artifacts.map(([title, body], index) => {
            const start = 78 + index * 74;
            const p = spring({ frame: Math.max(0, frame - start), fps: 60, config: { damping: 17, stiffness: 115, mass: 0.85 } });
            const targetX = portrait ? px(20 + (index % 2) * 250) : px(420 + (index % 2) * 260);
            const targetY = portrait ? px(190 + Math.floor(index / 2) * 230) : px(96 + Math.floor(index / 2) * 235);
            const collapsedX = portrait ? px(280) : px(680);
            const collapsedY = portrait ? px(430) : px(360);
            const x = targetX + (collapsedX - targetX) * collapse;
            const y = targetY + (collapsedY - targetY) * collapse;
            const rotate = (index % 2 === 0 ? -2.3 : 2.1) * (1 - collapse) + float(frame, 0.7, 0.025, index);
            return (
              <div
                key={title}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: portrait ? px(225) : px(245),
                  minHeight: px(176),
                  borderRadius: px(22),
                  background: paper,
                  color: ink,
                  padding: px(21),
                  boxShadow: `0 ${px(22)}px ${px(56)}px rgba(0,0,0,.32)`,
                  transform: `translate(${(1 - p) * px(150)}px, ${(1 - p) * px(60)}px) scale(${0.74 + p * 0.26 - collapse * index * 0.018}) rotate(${rotate}deg)`,
                  opacity: p,
                  zIndex: 10 + index,
                  fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
                }}
              >
                <div style={{ width: px(30), height: px(30), borderRadius: px(9), background: "rgba(139,92,246,.12)", display: "grid", placeItems: "center", color: violet, fontWeight: 900, fontSize: px(15), transform: `scale(${0.7 + p * 0.3})` }}>✓</div>
                <div style={{ marginTop: px(24), fontSize: px(19), fontWeight: 790, letterSpacing: "-0.035em" }}>{title}</div>
                <div style={{ marginTop: px(8), color: "rgba(17,19,24,.52)", fontSize: px(12), fontWeight: 610, lineHeight: 1.35 }}>{body}</div>
                <div style={{ marginTop: px(18), height: px(4), width: `${interpolate(p, [0, 1], [0, 100])}%`, borderRadius: px(999), background: violet }} />
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: portrait ? px(270) : px(650),
              top: portrait ? px(420) : px(350),
              borderRadius: px(999),
              padding: `${px(13)}px ${px(22)}px`,
              background: "white",
              color: ink,
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontSize: px(13),
              fontWeight: 760,
              opacity: collapse,
              transform: `scale(${0.8 + collapse * 0.2})`,
              zIndex: 50,
            }}
          >
            Saved to Files
          </div>
        </div>
      </div>
    </Stage>
  );
}

function HumanWorkScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 520;
  const opacity = sceneOpacity(frame, duration, 28, 64);
  const panelIn = spring({ frame, fps: 60, config: { damping: 18, stiffness: 85 } });
  const camera = interpolate(frame, [40, 440], [0.93, 1.13], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const rows = [
    ["Hook", "What couldn’t finish us?"],
    ["Setup", "Front camera. Quiet room. No music for the first line."],
    ["Shot", "Say the line, hold for one beat, then let Odaeshi enter."],
    ["Edit", "Keep it under 14 seconds. Cut on the first kick."],
    ["CTA", "Comment the thing you survived."],
  ] as const;

  return (
    <Stage opacity={opacity}>
      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.08 : width * 0.06,
          top: portrait ? height * 0.08 : height * 0.13,
          color: "white",
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
        }}
      >
        <div style={{ color: violetSoft, fontSize: px(12), fontWeight: 780, textTransform: "uppercase", letterSpacing: ".14em" }}>Mission</div>
        <div style={{ marginTop: px(14), fontWeight: 780, fontSize: portrait ? px(48) : px(58), letterSpacing: "-0.055em", lineHeight: 0.98, maxWidth: portrait ? width * 0.78 : width * 0.31 }}>
          When Desk needs you, you get the exact job.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.07 : width * 0.4,
          top: portrait ? height * 0.31 : height * 0.12,
          width: portrait ? width * 0.86 : width * 0.5,
          borderRadius: px(34),
          background: paper,
          color: ink,
          boxShadow: `0 ${px(40)}px ${px(110)}px rgba(0,0,0,.42)`,
          overflow: "hidden",
          transform: `translateY(${(1 - panelIn) * px(180)}px) scale(${camera})`,
          transformOrigin: portrait ? "50% 38%" : "50% 50%",
        }}
      >
        <div style={{ padding: `${px(22)}px ${px(28)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", display: "flex", alignItems: "center", fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <div style={{ fontWeight: 800, fontSize: px(12), textTransform: "uppercase", letterSpacing: ".14em", color: "rgba(17,19,24,.4)" }}>Today’s task</div>
          <div style={{ marginLeft: "auto", color: violet, fontWeight: 750, fontSize: px(12) }}>Odaeshi release</div>
        </div>
        <div style={{ padding: px(30), fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <div style={{ fontSize: portrait ? px(29) : px(34), fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.04 }}>Record launch-week story video</div>
          <div style={{ marginTop: px(12), color: "rgba(17,19,24,.48)", fontSize: px(14), fontWeight: 620 }}>Desk has already decided the angle, structure and fallback.</div>
          <div style={{ marginTop: px(28), display: "grid", gap: px(11) }}>
            {rows.map(([label, value], index) => {
              const p = spring({ frame: Math.max(0, frame - 76 - index * 44), fps: 60, config: { damping: 19, stiffness: 105 } });
              return (
                <div
                  key={label}
                  style={{
                    borderTop: index ? "1px solid rgba(17,19,24,.08)" : undefined,
                    paddingTop: index ? px(14) : 0,
                    display: "grid",
                    gridTemplateColumns: portrait ? `${px(74)}px 1fr` : `${px(88)}px 1fr`,
                    gap: px(12),
                    opacity: p,
                    transform: `translateY(${(1 - p) * px(28)}px)`,
                  }}
                >
                  <div style={{ color: violet, fontWeight: 800, fontSize: px(11), textTransform: "uppercase", letterSpacing: ".1em" }}>{label}</div>
                  <div style={{ color: ink, fontWeight: 650, fontSize: px(14), lineHeight: 1.35 }}>{value}</div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: px(26),
              display: "inline-flex",
              borderRadius: px(999),
              background: ink,
              color: "white",
              padding: `${px(13)}px ${px(22)}px`,
              fontSize: px(14),
              fontWeight: 760,
              transform: `scale(${1 + Math.sin(frame / 18) * 0.012})`,
            }}
          >
            Start
          </div>
        </div>
      </div>
    </Stage>
  );
}

function ReplanScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 430;
  const opacity = sceneOpacity(frame, duration, 26, 62);
  const chatIn = spring({ frame, fps: 60, config: { damping: 18, stiffness: 95 } });
  const shift = interpolate(frame, [120, 300], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const oldX = interpolate(shift, [0, 1], [0, -width * 0.92]);
  const newX = interpolate(shift, [0, 1], [width * 0.92, 0]);

  const Timeline = ({ moved }: { moved: boolean }) => (
    <div
      style={{
        width: portrait ? width * 0.86 : width * 0.64,
        borderRadius: px(32),
        background: paper,
        color: ink,
        overflow: "hidden",
        boxShadow: `0 ${px(34)}px ${px(95)}px rgba(0,0,0,.38)`,
        fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
      }}
    >
      <div style={{ padding: `${px(20)}px ${px(27)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", fontSize: px(11), fontWeight: 800, textTransform: "uppercase", letterSpacing: ".13em", color: "rgba(17,19,24,.38)" }}>Odaeshi release mission</div>
      <div style={{ padding: px(28) }}>
        <div style={{ display: "flex", gap: px(10) }}>
          {["Today", "Sat", "Sun", "Mon"].map((day, index) => {
            const active = moved ? index === 2 : index === 0;
            return (
              <div key={day} style={{ flex: 1, borderRadius: px(18), padding: px(15), border: `1px solid ${active ? "rgba(139,92,246,.35)" : "rgba(17,19,24,.08)"}`, background: active ? "rgba(139,92,246,.08)" : "transparent" }}>
                <div style={{ fontSize: px(10), fontWeight: 780, color: active ? violet : "rgba(17,19,24,.34)", textTransform: "uppercase", letterSpacing: ".08em" }}>{day}</div>
                <div style={{ marginTop: px(12), minHeight: px(58), fontSize: px(12), lineHeight: 1.3, fontWeight: 650, color: active ? ink : "rgba(17,19,24,.38)" }}>{active ? "Record story video" : index === 3 ? "Desk review" : "Release work"}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: px(22), color: moved ? violet : "rgba(17,19,24,.5)", fontWeight: 700, fontSize: px(14) }}>{moved ? "Plan updated. Nothing else needed from you today." : "Today: record launch-week story video."}</div>
      </div>
    </div>
  );

  return (
    <Stage opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.065, top: portrait ? height * 0.08 : height * 0.12, fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
        <div style={{ color: violetSoft, fontSize: px(12), fontWeight: 780, textTransform: "uppercase", letterSpacing: ".14em" }}>Reality changes</div>
        <div style={{ marginTop: px(14), color: "white", fontWeight: 780, fontSize: portrait ? px(52) : px(64), letterSpacing: "-0.055em", lineHeight: 0.96 }}>Desk adjusts.</div>
      </div>

      <div
        style={{
          position: "absolute",
          right: portrait ? width * 0.07 : width * 0.065,
          top: portrait ? height * 0.25 : height * 0.14,
          maxWidth: portrait ? width * 0.72 : width * 0.36,
          borderRadius: px(24),
          padding: px(22),
          background: "rgba(255,255,255,.07)",
          border: "1px solid rgba(255,255,255,.1)",
          color: "white",
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
          fontSize: px(19),
          fontWeight: 650,
          lineHeight: 1.35,
          opacity: chatIn * (1 - interpolate(frame, [175, 250], [0, 1], clamp)),
          transform: `translateY(${(1 - chatIn) * px(55)}px)`,
        }}
      >
        I can’t shoot today. Move it to Sunday.
      </div>

      <div style={{ position: "absolute", left: portrait ? width * 0.07 + oldX : width * 0.18 + oldX, top: portrait ? height * 0.45 : height * 0.34, transform: `rotate(${shift * -2}deg)` }}>
        <Timeline moved={false} />
      </div>
      <div style={{ position: "absolute", left: portrait ? width * 0.07 + newX : width * 0.18 + newX, top: portrait ? height * 0.45 : height * 0.34, transform: `rotate(${(1 - shift) * 2}deg)` }}>
        <Timeline moved />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: portrait ? height * 0.08 : height * 0.08,
          transform: `translateX(-50%) translateY(${(1 - shift) * px(24)}px)`,
          opacity: shift,
          color: "rgba(255,255,255,.5)",
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
          fontWeight: 670,
          fontSize: px(14),
        }}
      >
        No “what next?” prompt.
      </div>
    </Stage>
  );
}

function WatchScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 380;
  const opacity = sceneOpacity(frame, duration, 24, 56);
  const ring = spring({ frame, fps: 60, config: { damping: 16, stiffness: 80 } });
  const postIn = spring({ frame: Math.max(0, frame - 30), fps: 60, config: { damping: 18, stiffness: 95 } });
  const metricItems = ["comments", "shares", "saves", "24h review"];

  return (
    <Stage opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.065, top: portrait ? height * 0.08 : height * 0.13, fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
        <div style={{ color: violetSoft, fontSize: px(12), fontWeight: 780, textTransform: "uppercase", letterSpacing: ".14em" }}>After you post</div>
        <div style={{ marginTop: px(14), color: "white", fontWeight: 790, fontSize: portrait ? px(54) : px(66), letterSpacing: "-0.06em", lineHeight: 0.94 }}>Desk is watching.</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.11 : width * 0.18,
          top: portrait ? height * 0.35 : height * 0.28,
          width: portrait ? width * 0.45 : width * 0.28,
          aspectRatio: "9 / 14",
          borderRadius: px(32),
          border: "1px solid rgba(255,255,255,.12)",
          background: "linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.03))",
          boxShadow: `0 ${px(34)}px ${px(90)}px rgba(0,0,0,.4)`,
          transform: `translateY(${(1 - postIn) * px(110)}px) rotate(${(1 - postIn) * -4}deg) scale(${0.86 + postIn * 0.14})`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%,rgba(139,92,246,.32),transparent 32%)" }} />
        <div style={{ position: "absolute", left: px(22), right: px(22), bottom: px(24), fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <div style={{ color: "white", fontSize: px(17), fontWeight: 750 }}>What couldn’t finish us?</div>
          <div style={{ marginTop: px(7), color: "rgba(255,255,255,.45)", fontSize: px(11), fontWeight: 620 }}>Odaeshi · posted</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.67 : width * 0.69,
          top: portrait ? height * 0.52 : height * 0.53,
          width: portrait ? width * 0.22 : width * 0.14,
          aspectRatio: "1",
          transform: "translate(-50%,-50%)",
        }}
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              inset: `${index * 13}%`,
              borderRadius: "50%",
              border: `${px(2)}px solid rgba(183,156,255,${0.34 - index * 0.07})`,
              transform: `scale(${0.72 + ring * 0.28 + Math.sin(frame / 18 + index) * 0.025})`,
              opacity: 0.8 - index * 0.14,
            }}
          />
        ))}
        <div style={{ position: "absolute", inset: "29%", borderRadius: "50%", background: violet, boxShadow: `0 0 ${px(80)}px rgba(139,92,246,.42)`, display: "grid", placeItems: "center", color: "white", fontFamily: "Manrope, Inter, ui-sans-serif, system-ui", fontWeight: 800, fontSize: px(11), textAlign: "center" }}>Desk<br />watch</div>
      </div>

      {metricItems.map((label, index) => {
        const p = spring({ frame: Math.max(0, frame - 90 - index * 34), fps: 60, config: { damping: 18, stiffness: 100 } });
        const portraitPositions = [
          [0.56, 0.34],
          [0.72, 0.32],
          [0.73, 0.72],
          [0.56, 0.74],
        ];
        const landscapePositions = [
          [0.62, 0.28],
          [0.78, 0.32],
          [0.79, 0.72],
          [0.61, 0.76],
        ];
        const [x, y] = (portrait ? portraitPositions : landscapePositions)[index];
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: width * x,
              top: height * y,
              transform: `translate(-50%,-50%) translateY(${(1 - p) * px(30) + float(frame, px(6), 0.03, index)}px) scale(${0.82 + p * 0.18})`,
              opacity: p,
              borderRadius: px(999),
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.045)",
              color: "rgba(255,255,255,.62)",
              padding: `${px(12)}px ${px(18)}px`,
              fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
              fontWeight: 700,
              fontSize: px(12),
              whiteSpace: "nowrap",
            }}
          >
            {label} · collecting
          </div>
        );
      })}
    </Stage>
  );
}

function ApprovalScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 390;
  const opacity = sceneOpacity(frame, duration, 24, 54);
  const cardIn = spring({ frame, fps: 60, config: { damping: 18, stiffness: 90 } });
  const cursorIn = spring({ frame: Math.max(0, frame - 105), fps: 60, config: { damping: 18, stiffness: 110 } });
  const click = interpolate(frame, [165, 176, 188], [0, 1, 0], clamp);
  const complete = spring({ frame: Math.max(0, frame - 190), fps: 60, config: { damping: 18, stiffness: 90 } });
  const cardW = portrait ? width * 0.84 : width * 0.52;

  return (
    <Stage opacity={opacity}>
      <div style={{ position: "absolute", left: portrait ? width * 0.08 : width * 0.065, top: portrait ? height * 0.08 : height * 0.14, fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
        <div style={{ color: violetSoft, fontSize: px(12), fontWeight: 780, textTransform: "uppercase", letterSpacing: ".14em" }}>Authority</div>
        <div style={{ marginTop: px(14), color: "white", fontWeight: 790, fontSize: portrait ? px(54) : px(66), letterSpacing: "-0.06em", lineHeight: 0.94 }}>You stay in control.</div>
      </div>

      <div
        style={{
          position: "absolute",
          width: cardW,
          left: portrait ? width * 0.08 : width * 0.4,
          top: portrait ? height * 0.35 : height * 0.24,
          borderRadius: px(34),
          background: paper,
          color: ink,
          boxShadow: `0 ${px(42)}px ${px(115)}px rgba(0,0,0,.44)`,
          transform: `translateY(${(1 - cardIn) * px(160)}px) scale(${0.9 + cardIn * 0.1})`,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: `${px(20)}px ${px(28)}px`, borderBottom: "1px solid rgba(17,19,24,.08)", display: "flex", alignItems: "center", fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <div style={{ fontWeight: 800, fontSize: px(11), textTransform: "uppercase", letterSpacing: ".13em", color: "rgba(17,19,24,.4)" }}>Approval required</div>
          <div style={{ marginLeft: "auto", color: violet, fontWeight: 760, fontSize: px(11) }}>{complete > 0.7 ? "Completed" : "Desk can execute"}</div>
        </div>
        <div style={{ padding: px(31), fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
          <div style={{ fontSize: portrait ? px(28) : px(34), fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.06 }}>
            {complete > 0.7 ? "Split confirmation sent." : "Send the approved split confirmation."}
          </div>
          <div style={{ marginTop: px(14), color: "rgba(17,19,24,.5)", fontSize: px(14), fontWeight: 620, lineHeight: 1.38 }}>
            {complete > 0.7 ? "Desk logged the provider outcome and continued the release plan." : "Exact effect: send the approved split details to the listed collaborators and record the outcome."}
          </div>

          <div style={{ marginTop: px(29), display: "flex", gap: px(11), opacity: 1 - complete }}>
            <div
              style={{
                borderRadius: px(999),
                background: ink,
                color: "white",
                padding: `${px(14 - click * 1.5)}px ${px(24 - click * 2)}px`,
                fontWeight: 770,
                fontSize: px(14),
                transform: `scale(${1 - click * 0.05})`,
                boxShadow: click ? `0 0 0 ${px(8)}px rgba(139,92,246,.11)` : undefined,
              }}
            >
              Approve & run
            </div>
            <div style={{ borderRadius: px(999), border: "1px solid rgba(17,19,24,.12)", padding: `${px(14)}px ${px(22)}px`, color: "rgba(17,19,24,.5)", fontWeight: 720, fontSize: px(14) }}>Reject</div>
          </div>

          <div style={{ marginTop: px(26), opacity: complete, transform: `translateY(${(1 - complete) * px(22)}px)` }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: px(9), color: violet, fontWeight: 790, fontSize: px(13) }}><span style={{ width: px(24), height: px(24), borderRadius: "50%", background: "rgba(139,92,246,.12)", display: "grid", placeItems: "center" }}>✓</span> Provider outcome recorded</div>
            <div style={{ marginTop: px(12), color: "rgba(17,19,24,.48)", fontWeight: 620, fontSize: px(13) }}>Next: release operations continue automatically.</div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.62 : width * 0.67,
          top: portrait ? height * 0.69 : height * 0.64,
          width: px(34),
          height: px(46),
          clipPath: "polygon(0 0, 100% 68%, 58% 72%, 78% 100%, 62% 100%, 43% 74%, 16% 100%)",
          background: "white",
          filter: `drop-shadow(0 ${px(6)}px ${px(10)}px rgba(0,0,0,.4))`,
          opacity: cursorIn * (1 - complete),
          transform: `translate(${(1 - cursorIn) * px(130)}px, ${(1 - cursorIn) * px(-80)}px) scale(${1 - click * 0.12})`,
          zIndex: 30,
        }}
      />
    </Stage>
  );
}

function EndScene({ format }: FilmProps) {
  const frame = useCurrentFrame();
  const { width, height, px } = useScale();
  const portrait = format !== "landscape";
  const duration = 330;
  const opacity = sceneOpacity(frame, duration, 16, 16);
  const collapse = spring({ frame, fps: 60, config: { damping: 20, stiffness: 80, mass: 1.05 } });
  const textIn = spring({ frame: Math.max(0, frame - 118), fps: 60, config: { damping: 19, stiffness: 88 } });
  const cards = [
    [-0.29, -0.2, -8],
    [0.27, -0.17, 7],
    [-0.25, 0.19, 6],
    [0.3, 0.18, -5],
  ] as const;

  return (
    <Stage opacity={opacity}>
      {cards.map(([ox, oy, rotate], index) => {
        const x = width * (0.5 + ox * (1 - collapse));
        const y = height * (0.48 + oy * (1 - collapse));
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: portrait ? width * 0.2 : width * 0.11,
              aspectRatio: "1.25",
              borderRadius: px(20),
              background: index % 2 ? paper : "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.1)",
              boxShadow: `0 ${px(18)}px ${px(50)}px rgba(0,0,0,.28)`,
              transform: `translate(-50%,-50%) rotate(${rotate * (1 - collapse)}deg) scale(${1 - collapse * 0.65})`,
              opacity: 1 - interpolate(collapse, [0.7, 1], [0, 1], clamp),
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: portrait ? height * 0.38 : height * 0.42,
          transform: `translate(-50%,-50%) scale(${0.62 + collapse * 0.38})`,
          opacity: collapse,
        }}
      >
        <BrandIcon size={portrait ? px(96) : px(106)} />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: portrait ? height * 0.54 : height * 0.58,
          width: portrait ? width * 0.84 : width * 0.62,
          transform: `translate(-50%, ${interpolate(textIn, [0, 1], [px(60), 0])}px)`,
          opacity: textIn,
          textAlign: "center",
          fontFamily: "Manrope, Inter, ui-sans-serif, system-ui",
        }}
      >
        <div style={{ color: "white", fontWeight: 790, fontSize: portrait ? px(72) : px(92), lineHeight: 0.94, letterSpacing: "-0.065em" }}>Meet your manager.</div>
        <div style={{ marginTop: px(26), color: "rgba(255,255,255,.42)", fontWeight: 650, fontSize: px(16), letterSpacing: "-0.01em" }}>Desk by OrderSounds</div>
      </div>
    </Stage>
  );
}

export function MeetYourManagerFilm({ format }: FilmProps) {
  return (
    <AbsoluteFill style={{ background: "#050507" }}>
      <AmbientField />

      <Sequence from={0} durationInFrames={260} name="01 · Question">
        <OpeningScene format={format} />
      </Sequence>

      <Sequence from={170} durationInFrames={450} name="02 · Give Desk the goal">
        <GoalScene format={format} />
      </Sequence>

      <Sequence from={520} durationInFrames={430} name="03 · Desk understands and decides">
        <ContextScene format={format} />
      </Sequence>

      <Sequence from={840} durationInFrames={700} name="04 · Desk does the work">
        <WorkScene format={format} />
      </Sequence>

      <Sequence from={1370} durationInFrames={520} name="05 · Exact human work">
        <HumanWorkScene format={format} />
      </Sequence>

      <Sequence from={1780} durationInFrames={430} name="06 · Reality changes">
        <ReplanScene format={format} />
      </Sequence>

      <Sequence from={2100} durationInFrames={380} name="07 · Desk watches">
        <WatchScene format={format} />
      </Sequence>

      <Sequence from={2350} durationInFrames={390} name="08 · Approve and run">
        <ApprovalScene format={format} />
      </Sequence>

      <Sequence from={2430} durationInFrames={330} name="09 · Meet your manager">
        <EndScene format={format} />
      </Sequence>
    </AbsoluteFill>
  );
}
