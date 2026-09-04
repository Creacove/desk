import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { FilmFormat } from "./constants";
import {
  ApprovalReviewFilmAdapter,
  RealManagerStage,
  RealTaskStage,
  RealTodayStage,
} from "./ProductStagesV3";
import { odaeshiChangedConversation } from "./filmChangedConversationV3";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const paper = "#f7f4ef";
const ink = "#17161a";
const purple = "#6f43dc";
const softPurple = "#eee8ff";
const line = "rgba(23,22,26,.10)";

export function MeetYourManagerFilmV3({ format }: { format: FilmFormat }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: paper, color: ink, overflow: "hidden", fontFamily: "Manrope, Inter, ui-sans-serif, system-ui" }}>
      <LightCanvas frame={frame} />
      <OpeningArtistWorld frame={frame} format={format} />
      <ManagerGoal frame={frame} format={format} />
      <ContextAssembly frame={frame} format={format} />
      <TodayFocus frame={frame} format={format} />
      <DeskCreatesWork frame={frame} format={format} />
      <ExactHumanWork frame={frame} format={format} />
      <RealityChanges frame={frame} format={format} />
      <WatchReality frame={frame} format={format} />
      <ApprovalMoment frame={frame} format={format} />
      <EndResolve frame={frame} format={format} />
    </AbsoluteFill>
  );
}

function LightCanvas({ frame }: { frame: number }) {
  const { width, height } = useVideoConfig();
  const drift = interpolate(frame, [0, 2520], [-0.04, 0.04], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#fbfaf7 0%,#f7f4ef 62%,#f5f1ec 100%)" }} />
      <div
        style={{
          position: "absolute",
          width: width * 0.72,
          height: width * 0.72,
          left: width * (0.5 - 0.36 + drift),
          top: -width * 0.36,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(111,67,220,.10) 0%,rgba(111,67,220,0) 68%)",
          filter: "blur(12px)",
        }}
      />
      <div style={{ position: "absolute", left: width * 0.06, right: width * 0.06, top: height * 0.055, height: 1, background: line, opacity: 0.55 }} />
    </AbsoluteFill>
  );
}

function OpeningArtistWorld({ frame, format }: SceneProps) {
  if (frame > 310) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const enter = spring({ frame, fps: 60, config: { damping: 18, stiffness: 90, mass: 0.95 } });
  const question = spring({ frame: Math.max(0, frame - 58), fps: 60, config: { damping: 20, stiffness: 90 } });
  const mediaMove = spring({ frame: Math.max(0, frame - 125), fps: 60, config: { damping: 22, stiffness: 75, mass: 1.05 } });
  const fullW = portrait ? width * 0.86 : width * 0.58;
  const fullH = portrait ? height * 0.36 : height * 0.68;
  const smallW = portrait ? width * 0.28 : width * 0.20;
  const smallH = portrait ? height * 0.13 : height * 0.34;
  const w = interpolate(mediaMove, [0, 1], [fullW, smallW]);
  const h = interpolate(mediaMove, [0, 1], [fullH, smallH]);
  const x = interpolate(mediaMove, [0, 1], [width * (portrait ? 0.07 : 0.37), width * (portrait ? 0.66 : 0.73)]);
  const y = interpolate(mediaMove, [0, 1], [height * (portrait ? 0.31 : 0.16), height * (portrait ? 0.075 : 0.12)]);
  const radius = interpolate(mediaMove, [0, 1], [34, 22]);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: width * (portrait ? 0.07 : 0.07),
          top: height * (portrait ? 0.10 : 0.20),
          width: portrait ? width * 0.78 : width * 0.42,
          opacity: interpolate(frame, [0, 18, 210, 280], [0, 1, 1, 0], clamp),
          transform: `translateY(${(1 - enter) * 70}px)`,
        }}
      >
        <div style={{ fontSize: portrait ? width * 0.072 : height * 0.085, lineHeight: 0.96, letterSpacing: "-0.06em", fontWeight: 720 }}>
          You make the music.
        </div>
        <div
          style={{
            marginTop: portrait ? 34 : 24,
            fontSize: portrait ? width * 0.043 : height * 0.05,
            lineHeight: 1.04,
            letterSpacing: "-0.045em",
            fontWeight: 610,
            color: "rgba(23,22,26,.42)",
            transform: `translateY(${(1 - question) * 50}px)`,
            opacity: question,
          }}
        >
          Who runs everything else?
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: radius,
          overflow: "hidden",
          boxShadow: "0 24px 70px rgba(42,33,28,.14)",
          border: "1px solid rgba(23,22,26,.08)",
          background: "#ddd",
          zIndex: 8,
        }}
      >
        <OffthreadVideo
          src={staticFile("launch-assets/artist-studio.mp4")}
          muted
          startFrom={30}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + Math.sin(frame / 90) * 0.015})` }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 62%,rgba(0,0,0,.25))" }} />
        <div style={{ position: "absolute", left: 18, bottom: 14, color: "white", fontSize: Math.max(14, width * 0.008), fontWeight: 680, opacity: interpolate(mediaMove, [0.55, 1], [0, 1], clamp) }}>
          Odaeshi · artist context
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ManagerGoal({ frame, format }: SceneProps) {
  if (frame < 205 || frame > 675) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 205;
  const portrait = format !== "landscape";
  const inSpring = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 82, mass: 0.95 } });
  const opacity = sceneWindow(frame, 205, 255, 610, 675);
  const baseScale = format === "vertical" ? width / 2160 * 1.45 : format === "feed" ? width / 2160 * 1.25 : width / 3840 * 2.2;
  const camera = interpolate(local, [0, 410], [0.93, 1.11], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const x = portrait ? width * 0.5 : width * 0.44;
  const y = portrait ? height * 0.42 : height * 0.52;
  const introLabel = interpolate(local, [40, 110, 330, 410], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.075 : width * 0.07, top: portrait ? height * 0.145 : height * 0.20, opacity: introLabel }}>
        <FilmLabel>Give Desk the goal.</FilmLabel>
      </div>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%,-50%) translateY(${(1 - inSpring) * 150}px) scale(${baseScale * camera})`,
          transformOrigin: "50% 48%",
        }}
      >
        <RealManagerStage />
      </div>
      <FocusShade opacity={interpolate(local, [330, 430], [0, 0.14], clamp)} />
    </AbsoluteFill>
  );
}

function ContextAssembly({ frame, format }: SceneProps) {
  if (frame < 560 || frame > 900) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 560;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 560, 600, 840, 900);
  const chips = [
    { label: "Spotify", sub: "artist + track", icon: "spotify.svg", x: 0.15, y: 0.31 },
    { label: "TikTok", sub: "audience signals", icon: "tiktok.svg", x: 0.72, y: 0.30 },
    { label: "Instagram", sub: "content history", icon: "instagram.svg", x: 0.12, y: 0.62 },
    { label: "YouTube", sub: "video response", icon: "youtube.svg", x: 0.72, y: 0.64 },
  ];
  const converge = interpolate(local, [165, 315], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const centerX = width * 0.5;
  const centerY = height * (portrait ? 0.48 : 0.52);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.075 : width * 0.07, top: portrait ? height * 0.10 : height * 0.14 }}>
        <FilmLabel muted>Desk builds the release picture.</FilmLabel>
      </div>

      <div
        style={{
          position: "absolute",
          left: centerX,
          top: centerY,
          width: portrait ? width * 0.36 : width * 0.22,
          aspectRatio: "1 / 1",
          transform: `translate(-50%,-50%) scale(${1 - converge * 0.26})`,
          borderRadius: interpolate(converge, [0, 1], [38, 22]),
          overflow: "hidden",
          border: `1px solid ${line}`,
          boxShadow: "0 24px 80px rgba(42,33,28,.12)",
        }}
      >
        <OffthreadVideo src={staticFile("launch-assets/artist-studio.mp4")} muted startFrom={80} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 45%,rgba(0,0,0,.52))" }} />
        <div style={{ position: "absolute", left: 26, bottom: 25, color: "white" }}>
          <div style={{ fontSize: portrait ? width * 0.025 : height * 0.035, fontWeight: 740, letterSpacing: "-0.035em" }}>Odaeshi</div>
          <div style={{ marginTop: 5, fontSize: portrait ? width * 0.012 : height * 0.017, fontWeight: 620, opacity: 0.76 }}>pre-release</div>
        </div>
      </div>

      {chips.map((chip, index) => {
        const arrival = spring({ frame: Math.max(0, local - index * 12), fps: 60, config: { damping: 19, stiffness: 95 } });
        const startX = width * chip.x;
        const startY = height * chip.y;
        const endX = centerX + (index % 2 === 0 ? -1 : 1) * width * 0.13;
        const endY = centerY + (index < 2 ? -1 : 1) * height * (portrait ? 0.095 : 0.13);
        return (
          <PlatformChip
            key={chip.label}
            label={chip.label}
            sub={chip.sub}
            icon={chip.icon}
            style={{
              position: "absolute",
              left: interpolate(converge, [0, 1], [startX, endX]),
              top: interpolate(converge, [0, 1], [startY + (1 - arrival) * 90, endY]),
              transform: `translate(-50%,-50%) scale(${0.86 + arrival * 0.14 - converge * 0.09})`,
              opacity: arrival * (1 - converge * 0.2),
            }}
          />
        );
      })}

      <SignalPill text="Final master" x={portrait ? 0.26 : 0.36} y={portrait ? 0.78 : 0.78} progress={spring({ frame: Math.max(0, local - 42), fps: 60, config: { damping: 19, stiffness: 90 } })} converge={converge} />
      <SignalPill text="Release · October" x={portrait ? 0.60 : 0.57} y={portrait ? 0.80 : 0.81} progress={spring({ frame: Math.max(0, local - 62), fps: 60, config: { damping: 19, stiffness: 90 } })} converge={converge} />
    </AbsoluteFill>
  );
}

function TodayFocus({ frame, format }: SceneProps) {
  if (frame < 820 || frame > 1110) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 820;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 820, 855, 1050, 1110);
  const stageScale = format === "vertical" ? width / 2160 * 1.48 : format === "feed" ? width / 2160 * 1.28 : width / 3840 * 2.1;
  const camera = interpolate(local, [0, 250], [0.94, 1.17], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const yMove = interpolate(local, [0, 250], [portrait ? 85 : 30, portrait ? -55 : -20]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.075 : width * 0.07, top: portrait ? height * 0.11 : height * 0.15, opacity: interpolate(local, [0, 65, 170, 240], [0, 1, 1, 0], clamp) }}>
        <FilmLabel>One thing matters now.</FilmLabel>
      </div>
      <div
        style={{
          position: "absolute",
          left: width * 0.5,
          top: height * (portrait ? 0.53 : 0.56),
          transform: `translate(-50%,-50%) translateY(${yMove}px) scale(${stageScale * camera})`,
          transformOrigin: "50% 46%",
        }}
      >
        <RealTodayStage />
      </div>
    </AbsoluteFill>
  );
}

function DeskCreatesWork({ frame, format }: SceneProps) {
  if (frame < 1020 || frame > 1420) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 1020;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 1020, 1060, 1360, 1420);
  const stageScale = format === "vertical" ? width / 2160 * 1.36 : format === "feed" ? width / 2160 * 1.18 : width / 3840 * 2.0;
  const cameraY = interpolate(local, [0, 250], [0, -120], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const lift = interpolate(local, [120, 300], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: width * 0.5, top: height * (portrait ? 0.50 : 0.52), transform: `translate(-50%,-50%) translateY(${cameraY}px) scale(${stageScale})` }}>
        <RealManagerStage />
      </div>

      <div style={{ position: "absolute", left: portrait ? width * 0.075 : width * 0.07, top: portrait ? height * 0.105 : height * 0.14, opacity: interpolate(local, [20, 80, 170, 240], [0, 1, 1, 0], clamp) }}>
        <FilmLabel muted>Desk does the desk work.</FilmLabel>
      </div>

      <ArtifactPaper
        title="EPK"
        meta="artist story · press image · links"
        image="launch-assets/artist-studio-poster.jpg"
        progress={spring({ frame: Math.max(0, local - 145), fps: 60, config: { damping: 17, stiffness: 90 } }) * lift}
        x={portrait ? 0.14 : 0.58}
        y={portrait ? 0.64 : 0.18}
        rotate={-4}
      />
      <ArtifactPaper title="Press release" meta="release-ready draft" progress={spring({ frame: Math.max(0, local - 170), fps: 60, config: { damping: 17, stiffness: 90 } }) * lift} x={portrait ? 0.44 : 0.66} y={portrait ? 0.68 : 0.35} rotate={2.5} />
      <ArtifactPaper title="Content plan" meta="3 stories · sequence · CTA" progress={spring({ frame: Math.max(0, local - 195), fps: 60, config: { damping: 17, stiffness: 90 } }) * lift} x={portrait ? 0.20 : 0.76} y={portrait ? 0.79 : 0.55} rotate={3.5} />
      <ArtifactPaper title="Editorial pitch" meta="why Odaeshi matters now" progress={spring({ frame: Math.max(0, local - 220), fps: 60, config: { damping: 17, stiffness: 90 } }) * lift} x={portrait ? 0.52 : 0.63} y={portrait ? 0.82 : 0.73} rotate={-2} />
    </AbsoluteFill>
  );
}

function ExactHumanWork({ frame, format }: SceneProps) {
  if (frame < 1340 || frame > 1780) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 1340;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 1340, 1380, 1720, 1780);
  const stageScale = format === "vertical" ? width / 2160 * 1.32 : format === "feed" ? width / 2160 * 1.14 : width / 3840 * 1.9;
  const camera = interpolate(local, [0, 220], [0.96, 1.16], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const shiftX = interpolate(local, [190, 390], [0, portrait ? -width * 0.12 : -width * 0.17], clamp);
  const phoneIn = spring({ frame: Math.max(0, local - 190), fps: 60, config: { damping: 18, stiffness: 92, mass: 0.95 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: width * 0.5 + shiftX, top: height * (portrait ? 0.51 : 0.52), transform: `translate(-50%,-50%) scale(${stageScale * camera})`, transformOrigin: "50% 54%" }}>
        <RealTaskStage />
      </div>

      <div style={{ position: "absolute", left: portrait ? width * 0.075 : width * 0.07, top: portrait ? height * 0.085 : height * 0.12, opacity: interpolate(local, [10, 75, 150, 215], [0, 1, 1, 0], clamp) }}>
        <FilmLabel>When Desk needs you, the job is exact.</FilmLabel>
      </div>

      <PhoneVideo
        src="launch-assets/live-performance.mp4"
        label="Story video"
        sub="25–35 sec · vertical"
        style={{
          position: "absolute",
          right: portrait ? width * 0.055 : width * 0.065,
          bottom: portrait ? height * 0.075 : height * 0.08,
          width: portrait ? width * 0.32 : height * 0.40,
          transform: `translateY(${(1 - phoneIn) * 240}px) rotate(${(1 - phoneIn) * 5}deg) scale(${0.9 + phoneIn * 0.1})`,
          opacity: phoneIn,
        }}
      />
    </AbsoluteFill>
  );
}

function RealityChanges({ frame, format }: SceneProps) {
  if (frame < 1710 || frame > 2035) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 1710;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 1710, 1750, 1970, 2035);
  const stageScale = format === "vertical" ? width / 2160 * 1.44 : format === "feed" ? width / 2160 * 1.24 : width / 3840 * 2.05;
  const slide = interpolate(local, [95, 260], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: width * 0.5, top: height * (portrait ? 0.48 : 0.53), transform: `translate(-50%,-50%) translateY(${interpolate(local, [0, 260], [60, -90], clamp)}px) scale(${stageScale})` }}>
        <RealManagerStage conversation={odaeshiChangedConversation} />
      </div>

      <div
        style={{
          position: "absolute",
          left: portrait ? width * 0.08 : width * 0.08,
          right: portrait ? width * 0.08 : width * 0.08,
          bottom: portrait ? height * 0.09 : height * 0.07,
          height: portrait ? height * 0.105 : height * 0.16,
          borderRadius: 28,
          background: "rgba(255,255,255,.92)",
          border: `1px solid ${line}`,
          boxShadow: "0 18px 65px rgba(42,33,28,.10)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {["Friday", "Saturday", "Sunday"].map((day, index) => (
            <div key={day} style={{ borderLeft: index ? `1px solid ${line}` : undefined, padding: portrait ? "28px 30px" : "26px 34px" }}>
              <div style={{ fontSize: portrait ? width * 0.014 : height * 0.021, color: "rgba(23,22,26,.42)", fontWeight: 650 }}>{day}</div>
              <div style={{ marginTop: 10, fontSize: portrait ? width * 0.023 : height * 0.035, fontWeight: 720, letterSpacing: "-0.035em" }}>{index === 2 ? "Shoot story" : ""}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            width: portrait ? width * 0.035 : height * 0.05,
            height: portrait ? width * 0.035 : height * 0.05,
            borderRadius: "50%",
            background: purple,
            left: `calc(${interpolate(slide, [0, 1], [16.5, 83.5])}% - ${portrait ? width * 0.0175 : height * 0.025}px)`,
            top: portrait ? 28 : 24,
            boxShadow: "0 8px 24px rgba(111,67,220,.25)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function WatchReality({ frame, format }: SceneProps) {
  if (frame < 1970 || frame > 2260) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 1970;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 1970, 2010, 2200, 2260);
  const phoneIn = spring({ frame: local, fps: 60, config: { damping: 18, stiffness: 88 } });
  const stageScale = format === "vertical" ? width / 2160 * 1.34 : format === "feed" ? width / 2160 * 1.15 : width / 3840 * 1.9;
  const watchIn = spring({ frame: Math.max(0, local - 90), fps: 60, config: { damping: 20, stiffness: 82 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.06 : width * 0.055, top: portrait ? height * 0.08 : height * 0.10, width: portrait ? width * 0.88 : width * 0.48, height: portrait ? height * 0.24 : height * 0.68, borderRadius: 34, overflow: "hidden", border: `1px solid ${line}`, boxShadow: "0 20px 65px rgba(42,33,28,.10)" }}>
        <OffthreadVideo src={staticFile("launch-assets/crowd-phones.mp4")} muted startFrom={90} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + local * 0.00012})` }} />
      </div>

      <PhoneVideo
        src="launch-assets/live-performance.mp4"
        label="Posted"
        sub="Odaeshi story"
        style={{
          position: "absolute",
          right: portrait ? width * 0.075 : width * 0.075,
          top: portrait ? height * 0.25 : height * 0.17,
          width: portrait ? width * 0.34 : height * 0.45,
          transform: `translateY(${(1 - phoneIn) * 180}px) rotate(${interpolate(phoneIn, [0, 1], [5, -2])}deg)`,
          opacity: phoneIn,
        }}
      />

      {[
        ["Saves", "+18", 0],
        ["Profile visits", "+31", 18],
        ["Comments", "12", 36],
      ].map(([label, value, delay], index) => {
        const p = spring({ frame: Math.max(0, local - 82 - Number(delay)), fps: 60, config: { damping: 18, stiffness: 92 } });
        return (
          <div key={String(label)} style={{ position: "absolute", left: portrait ? width * (0.08 + index * 0.28) : width * (0.12 + index * 0.15), top: portrait ? height * 0.40 : height * (0.15 + index * 0.18), minWidth: portrait ? width * 0.22 : width * 0.12, padding: portrait ? "25px 28px" : "20px 24px", borderRadius: 22, background: "rgba(255,255,255,.94)", border: `1px solid ${line}`, boxShadow: "0 15px 42px rgba(42,33,28,.08)", transform: `translateY(${(1 - p) * 55}px) scale(${0.92 + p * 0.08})`, opacity: p }}>
            <div style={{ fontSize: portrait ? width * 0.013 : height * 0.019, color: "rgba(23,22,26,.43)", fontWeight: 650 }}>{label}</div>
            <div style={{ marginTop: 7, fontSize: portrait ? width * 0.028 : height * 0.042, fontWeight: 740, letterSpacing: "-0.04em" }}>{value}</div>
          </div>
        );
      })}

      <div style={{ position: "absolute", left: width * 0.5, bottom: portrait ? height * 0.065 : height * 0.06, transform: `translate(-50%,${(1 - watchIn) * 90}px) scale(${stageScale})`, opacity: watchIn }}>
        <RealTodayStage mode="watch" />
      </div>
    </AbsoluteFill>
  );
}

function ApprovalMoment({ frame, format }: SceneProps) {
  if (frame < 2190 || frame > 2460) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 2190;
  const portrait = format !== "landscape";
  const opacity = sceneWindow(frame, 2190, 2225, 2405, 2460);
  const stageScale = format === "vertical" ? width / 2160 * 1.42 : format === "feed" ? width / 2160 * 1.22 : width / 3840 * 2.0;
  const inSpring = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 86 } });
  const cursor = spring({ frame: Math.max(0, local - 75), fps: 60, config: { damping: 18, stiffness: 105 } });
  const click = interpolate(local, [144, 154, 168], [1, 0.95, 1], clamp);
  const approved = local > 168;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * 0.075 : width * 0.07, top: portrait ? height * 0.10 : height * 0.13, opacity: interpolate(local, [0, 55, 115, 165], [0, 1, 1, 0], clamp) }}>
        <FilmLabel>You keep authority.</FilmLabel>
      </div>
      <div style={{ position: "absolute", left: width * 0.5, top: height * (portrait ? 0.54 : 0.55), transform: `translate(-50%,-50%) translateY(${(1 - inSpring) * 100}px) scale(${stageScale * click})` }}>
        <ApprovalReviewFilmAdapter approved={approved} />
      </div>
      {!approved ? (
        <div
          style={{
            position: "absolute",
            left: interpolate(cursor, [0, 1], [width * 0.80, width * (portrait ? 0.47 : 0.49)]),
            top: interpolate(cursor, [0, 1], [height * 0.84, height * (portrait ? 0.64 : 0.68)]),
            width: portrait ? width * 0.032 : height * 0.045,
            height: portrait ? width * 0.032 : height * 0.045,
            transform: `rotate(-18deg) scale(${0.92 + cursor * 0.08})`,
            opacity: cursor,
            zIndex: 20,
          }}
        >
          <Cursor />
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function EndResolve({ frame, format }: SceneProps) {
  if (frame < 2380) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 2380;
  const portrait = format !== "landscape";
  const p = interpolate(local, [0, 105], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const logoIn = spring({ frame: Math.max(0, local - 55), fps: 60, config: { damping: 17, stiffness: 90 } });
  const tiles = [
    { x: 0.10, y: 0.16, w: 0.31, h: 0.20, src: "launch-assets/artist-studio-poster.jpg" },
    { x: 0.58, y: 0.14, w: 0.29, h: 0.22, src: "launch-assets/crowd-phones-poster.jpg" },
    { x: 0.12, y: 0.63, w: 0.26, h: 0.22, src: "launch-assets/live-performance-poster.jpg" },
  ];

  return (
    <AbsoluteFill style={{ background: interpolate(p, [0, 1], ["rgba(247,244,239,0)", "rgba(247,244,239,1)"]) }}>
      {tiles.map((tile, index) => {
        const centerX = width * 0.5;
        const centerY = height * (portrait ? 0.46 : 0.48);
        const startX = width * tile.x;
        const startY = height * tile.y;
        const startW = width * tile.w;
        const startH = height * tile.h;
        const collapse = interpolate(p, [0, 0.72], [0, 1], clamp);
        return (
          <div key={tile.src} style={{ position: "absolute", left: interpolate(collapse, [0, 1], [startX, centerX - 22]), top: interpolate(collapse, [0, 1], [startY, centerY - 22]), width: interpolate(collapse, [0, 1], [startW, 44]), height: interpolate(collapse, [0, 1], [startH, 44]), borderRadius: interpolate(collapse, [0, 1], [28, 12]), overflow: "hidden", opacity: interpolate(collapse, [0.72, 1], [1, 0], clamp), transform: `rotate(${(index - 1) * (1 - collapse) * 4}deg)`, border: `1px solid ${line}` }}>
            <Img src={staticFile(tile.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}

      <div style={{ position: "absolute", left: width * 0.5, top: height * (portrait ? 0.44 : 0.46), transform: `translate(-50%,-50%) scale(${0.72 + logoIn * 0.28})`, opacity: logoIn }}>
        <Img src={staticFile("logo.png")} style={{ width: portrait ? width * 0.13 : height * 0.18, height: portrait ? width * 0.13 : height * 0.18, objectFit: "contain", borderRadius: 24 }} />
      </div>
      <div style={{ position: "absolute", left: width * 0.5, top: height * (portrait ? 0.55 : 0.60), transform: `translateX(-50%) translateY(${(1 - logoIn) * 45}px)`, opacity: logoIn, textAlign: "center" }}>
        <div style={{ fontSize: portrait ? width * 0.064 : height * 0.09, fontWeight: 740, letterSpacing: "-0.06em", lineHeight: 0.95, whiteSpace: "nowrap" }}>Meet your manager.</div>
        <div style={{ marginTop: portrait ? 30 : 20, fontSize: portrait ? width * 0.018 : height * 0.025, fontWeight: 660, color: "rgba(23,22,26,.42)", letterSpacing: "-0.02em" }}>Desk by OrderSounds</div>
      </div>
    </AbsoluteFill>
  );
}

function ArtifactPaper({ title, meta, image, progress, x, y, rotate }: { title: string; meta: string; image?: string; progress: number; x: number; y: number; rotate: number }) {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const w = portrait ? width * 0.31 : width * 0.20;
  const h = portrait ? height * 0.18 : height * 0.36;
  return (
    <div style={{ position: "absolute", left: width * x, top: height * y, width: w, height: h, transform: `translate(-50%,-50%) translateY(${(1 - progress) * 130}px) rotate(${rotate * progress}deg) scale(${0.82 + progress * 0.18})`, opacity: progress, borderRadius: 24, background: "white", border: `1px solid ${line}`, boxShadow: "0 22px 65px rgba(42,33,28,.13)", overflow: "hidden" }}>
      {image ? <Img src={staticFile(image)} style={{ width: "100%", height: "48%", objectFit: "cover" }} /> : <div style={{ height: "42%", background: softPurple, display: "grid", placeItems: "center", color: purple, fontSize: portrait ? width * 0.045 : height * 0.07, fontWeight: 760, letterSpacing: "-0.05em" }}>{title.slice(0, 1)}</div>}
      <div style={{ padding: portrait ? 24 : 22 }}>
        <div style={{ fontSize: portrait ? width * 0.020 : height * 0.030, fontWeight: 735, letterSpacing: "-0.035em" }}>{title}</div>
        <div style={{ marginTop: 9, fontSize: portrait ? width * 0.011 : height * 0.017, lineHeight: 1.35, fontWeight: 580, color: "rgba(23,22,26,.46)" }}>{meta}</div>
      </div>
    </div>
  );
}

function PhoneVideo({ src, label, sub, style }: { src: string; label: string; sub: string; style?: CSSProperties }) {
  return (
    <div style={{ ...style, aspectRatio: "9 / 16", borderRadius: 36, padding: 8, background: ink, boxShadow: "0 25px 80px rgba(42,33,28,.20)", zIndex: 12 }}>
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 29, background: "#ddd" }}>
        <OffthreadVideo src={staticFile(src)} muted startFrom={35} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.10),transparent 50%,rgba(0,0,0,.56))" }} />
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 26, color: "white" }}>
          <div style={{ fontSize: 24, fontWeight: 720, letterSpacing: "-0.03em" }}>{label}</div>
          <div style={{ marginTop: 5, fontSize: 14, fontWeight: 590, opacity: 0.75 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

function PlatformChip({ label, sub, icon, style }: { label: string; sub: string; icon: string; style?: CSSProperties }) {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <div style={{ ...style, minWidth: portrait ? width * 0.23 : width * 0.14, padding: portrait ? "22px 26px" : "18px 22px", borderRadius: 22, background: "rgba(255,255,255,.94)", border: `1px solid ${line}`, boxShadow: "0 15px 45px rgba(42,33,28,.08)", display: "flex", alignItems: "center", gap: 16 }}>
      <Img src={staticFile(`launch-assets/logos/${icon}`)} style={{ width: portrait ? 33 : 27, height: portrait ? 33 : 27, opacity: 0.82 }} />
      <div>
        <div style={{ fontSize: portrait ? width * 0.014 : height * 0.020, fontWeight: 720, letterSpacing: "-0.025em" }}>{label}</div>
        <div style={{ marginTop: 3, fontSize: portrait ? width * 0.0105 : height * 0.015, fontWeight: 570, color: "rgba(23,22,26,.44)" }}>{sub}</div>
      </div>
    </div>
  );
}

function SignalPill({ text, x, y, progress, converge }: { text: string; x: number; y: number; progress: number; converge: number }) {
  const { width, height } = useVideoConfig();
  const centerX = width * 0.5;
  const centerY = height * 0.62;
  return (
    <div style={{ position: "absolute", left: interpolate(converge, [0, 1], [width * x, centerX]), top: interpolate(converge, [0, 1], [height * y, centerY]), transform: `translate(-50%,-50%) translateY(${(1 - progress) * 40}px) scale(${1 - converge * 0.12})`, opacity: progress * (1 - converge * 0.15), padding: "16px 22px", borderRadius: 999, background: softPurple, color: purple, border: "1px solid rgba(111,67,220,.12)", fontSize: height > width ? width * 0.012 : height * 0.018, fontWeight: 680, whiteSpace: "nowrap" }}>{text}</div>
  );
}

function FilmLabel({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return <div style={{ fontSize: portrait ? width * 0.036 : height * 0.052, lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 690, color: muted ? "rgba(23,22,26,.48)" : ink, maxWidth: portrait ? width * 0.72 : width * 0.38 }}>{children}</div>;
}

function FocusShade({ opacity }: { opacity: number }) {
  return <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 180px rgba(247,244,239,${opacity})` }} />;
}

function Cursor() {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
      <path d="M5 3.5L25.5 17.2l-8.6 2.1 4.5 7.5-4.2 2.5-4.5-7.7-6.5 6.2L5 3.5Z" fill="white" stroke="#17161a" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function sceneWindow(frame: number, start: number, enterEnd: number, exitStart: number, end: number) {
  return Math.min(interpolate(frame, [start, enterEnd], [0, 1], clamp), interpolate(frame, [exitStart, end], [1, 0], clamp));
}

type SceneProps = { frame: number; format: FilmFormat };
