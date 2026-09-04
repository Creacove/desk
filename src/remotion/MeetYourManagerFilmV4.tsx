import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { FilmFormat } from "./constants";
import {
  ApprovalMotion,
  ManagerComposerMotion,
  ManagerCreatesWorkMotion,
  MediaAtmosphere,
  MotionCursor,
  MotionWindow,
  RevealLine,
  TaskBriefMotion,
  TypewriterText,
} from "./MotionProductKitV4";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const paper = "#f8f5ef";
const ink = "#141216";
const purple = "#6f43dc";
const line = "rgba(20,18,22,.09)";
const muted = "rgba(20,18,22,.46)";

export function MeetYourManagerFilmV4({ format }: { format: FilmFormat }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: paper, color: ink, fontFamily: '"Bricolage Grotesque", Manrope, system-ui, sans-serif' }}>
      <FilmCanvas frame={frame} />
      <Opening frame={frame} format={format} />
      <GoalScene frame={frame} format={format} />
      <CreatedWorkScene frame={frame} format={format} />
      <PriorityScene frame={frame} format={format} />
      <TaskScene frame={frame} format={format} />
      <ChangeScene frame={frame} format={format} />
      <WatchScene frame={frame} format={format} />
      <ApprovalScene frame={frame} format={format} />
      <EndScene frame={frame} format={format} />
    </AbsoluteFill>
  );
}

function FilmCanvas({ frame }: { frame: number }) {
  const { width, height } = useVideoConfig();
  const drift = interpolate(frame, [0, 2520], [-0.05, 0.05], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#fbfaf7 0%,#f8f5ef 58%,#f3eee6 100%)" }} />
      <div style={{ position: "absolute", width: width * .90, height: width * .90, left: width * (.48 - .45 + drift), top: -width * .50, borderRadius: 999, background: "radial-gradient(circle,rgba(111,67,220,.11),rgba(111,67,220,0) 69%)", filter: "blur(52px)" }} />
      <div style={{ position: "absolute", width: width * 1.14, height: height * .44, left: -width * .34, bottom: -height * .17, borderRadius: 999, background: "radial-gradient(ellipse,rgba(204,154,95,.09),rgba(204,154,95,0) 70%)", filter: "blur(64px)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: .028, backgroundImage: "linear-gradient(115deg,rgba(20,18,22,.13) 0 1px,transparent 1px 100%)", backgroundSize: "23px 23px", mixBlendMode: "multiply" }} />
    </AbsoluteFill>
  );
}

function Opening({ frame, format }: SceneProps) {
  if (frame > 300) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const scene = windowOpacity(frame, 0, 22, 250, 300);
  const imageIn = spring({ frame, fps: 60, config: { damping: 18, stiffness: 82, mass: .95 } });
  const textIn = spring({ frame: Math.max(0, frame - 18), fps: 60, config: { damping: 19, stiffness: 100 } });
  const second = spring({ frame: Math.max(0, frame - 72), fps: 60, config: { damping: 20, stiffness: 92 } });

  return (
    <AbsoluteFill style={{ opacity: scene }}>
      <MediaAtmosphere
        src="launch-assets/lagos-artist.jpg"
        focusX={portrait ? 56 : 64}
        focusY={46}
        overlay="linear-gradient(90deg,rgba(248,245,239,.97) 0%,rgba(248,245,239,.82) 39%,rgba(248,245,239,.08) 76%,rgba(248,245,239,.02) 100%)"
        style={{ position: "absolute", right: portrait ? -width * .22 : -width * .04, top: portrait ? height * .16 : height * .05, width: portrait ? width * 1.03 : width * .67, height: portrait ? height * .70 : height * .90, opacity: imageIn, transform: `translateX(${(1 - imageIn) * 110}px) scale(${1.06 - imageIn * .06})`, borderRadius: portrait ? 0 : 46 }}
      />

      <div style={{ position: "absolute", left: portrait ? width * .075 : width * .07, top: portrait ? height * .16 : height * .24, width: portrait ? width * .73 : width * .46, zIndex: 4 }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: portrait ? width * .082 : height * .105, lineHeight: .91, fontWeight: 820, letterSpacing: "-.072em", transform: `translateY(${(1 - textIn) * 96}px)`, opacity: textIn }}>
            You make<br />the music.
          </div>
        </div>
        <div style={{ marginTop: portrait ? 44 : 34, width: portrait ? width * .61 : width * .36, fontSize: portrait ? width * .039 : height * .048, lineHeight: 1.08, fontWeight: 650, letterSpacing: "-.042em", color: muted, opacity: second, transform: `translateY(${(1 - second) * 44}px)` }}>
          Desk runs the release around you.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function GoalScene({ frame, format }: SceneProps) {
  if (frame < 220 || frame > 720) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 220;
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 220, 260, 650, 720);
  const inP = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 82 } });
  const scale = portrait ? width / 1120 * .96 : width / 1120 * .78;
  const camera = interpolate(local, [0, 410], [.99, 1.015], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <MediaAtmosphere src="launch-assets/lagos-artist-shoot.jpg" focusX={62} focusY={46} overlay="rgba(248,245,239,.52)" style={{ position: "absolute", left: portrait ? -width * .40 : width * .57, top: portrait ? height * .05 : height * .08, width: portrait ? width * .95 : width * .50, height: portrait ? height * .90 : height * .84, opacity: .34 }} />
      <div style={{ position: "absolute", left: portrait ? width * .07 : width * .065, top: portrait ? height * .08 : height * .12, zIndex: 5 }}>
        <RevealLine start={260}><div style={{ fontSize: portrait ? width * .027 : height * .04, color: muted, fontWeight: 720 }}>Start with the outcome.</div></RevealLine>
      </div>
      <div style={{ position: "absolute", left: portrait ? width * .50 : width * .36, top: portrait ? height * .51 : height * .55, transform: `translate(-50%,-50%) translateY(${(1 - inP) * 140}px) scale(${scale * camera})`, transformOrigin: "50% 72%" }}>
        <ManagerComposerMotion start={270} />
      </div>
      <MotionCursor start={355} clickAt={445} leaveAt={470} fromX={portrait ? .67 : .40} fromY={portrait ? .67 : .74} x={portrait ? .91 : .46} y={portrait ? .56 : .67} />
    </AbsoluteFill>
  );
}

function CreatedWorkScene({ frame, format }: SceneProps) {
  if (frame < 610 || frame > 1110) return null;
  const { width, height } = useVideoConfig();
  const local = frame - 610;
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 610, 650, 1040, 1110);
  const stageIn = spring({ frame: local, fps: 60, config: { damping: 20, stiffness: 84 } });
  const scale = portrait ? width / 1180 * .98 : width / 1180 * .74;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * .07 : width * .065, top: portrait ? height * .07 : height * .10 }}>
        <RevealLine start={648}><div style={{ fontSize: portrait ? width * .028 : height * .043, fontWeight: 770, letterSpacing: "-.038em" }}>Desk doesn’t stop at a plan.</div></RevealLine>
      </div>

      <div style={{ position: "absolute", right: portrait ? -width * .28 : -width * .02, top: portrait ? height * .08 : height * .10, width: portrait ? width * .74 : width * .40, height: portrait ? height * .55 : height * .76, opacity: .30 }}>
        <MediaAtmosphere src="launch-assets/lagos-artist.jpg" focusX={55} focusY={48} style={{ width: "100%", height: "100%" }} overlay="rgba(248,245,239,.28)" />
      </div>

      <div style={{ position: "absolute", left: portrait ? width * .50 : width * .37, top: portrait ? height * .55 : height * .57, transform: `translate(-50%,-50%) translateY(${(1 - stageIn) * 120}px) scale(${scale})`, transformOrigin: "50% 55%" }}>
        <ManagerCreatesWorkMotion start={680} />
      </div>
    </AbsoluteFill>
  );
}

function PriorityScene({ frame, format }: SceneProps) {
  if (frame < 1020 || frame > 1370) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 1020, 1060, 1310, 1370);
  const panelIn = spring({ frame: Math.max(0, frame - 1045), fps: 60, config: { damping: 19, stiffness: 100 } });
  const buttonIn = spring({ frame: Math.max(0, frame - 1160), fps: 60, config: { damping: 18, stiffness: 120 } });
  const scale = portrait ? width / 1080 * .98 : height / 700 * .73;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * .07 : width * .07, top: portrait ? height * .09 : height * .13 }}>
        <RevealLine start={1060}><div style={{ fontSize: portrait ? width * .028 : height * .043, color: muted, fontWeight: 700 }}>Then Desk narrows the day.</div></RevealLine>
      </div>
      <div style={{ position: "absolute", left: width * .5, top: height * (portrait ? .53 : .55), transform: `translate(-50%,-50%) translateY(${(1 - panelIn) * 120}px) scale(${scale})`, opacity: panelIn }}>
        <MotionWindow chrome={false} style={{ width: 1080, minHeight: 650, padding: "54px 58px" }}>
          <RevealLine start={1080}><div style={{ fontSize: 17, color: muted, fontWeight: 700 }}>Today · Odaeshi</div></RevealLine>
          <RevealLine start={1094}><div style={{ marginTop: 14, fontSize: 52, fontWeight: 800, letterSpacing: "-.058em" }}>One thing matters now.</div></RevealLine>
          <RevealLine start={1112}>
            <div style={{ marginTop: 52, border: `1px solid ${line}`, borderRadius: 20, background: "rgba(255,255,255,.92)", padding: "26px 28px", display: "grid", gridTemplateColumns: "1fr 180px", gap: 26, alignItems: "center", boxShadow: "0 12px 32px rgba(29,24,21,.05)" }}>
              <div>
                <div style={{ fontSize: 30, fontWeight: 760, letterSpacing: "-.033em" }}>Record: What couldn’t finish us?</div>
                <div style={{ marginTop: 7, color: muted, fontSize: 17, lineHeight: 1.4, fontWeight: 590 }}>Current human dependency · release story</div>
              </div>
              <div style={{ height: 52, borderRadius: 14, background: ink, color: "white", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 760, opacity: buttonIn, transform: `scale(${.90 + buttonIn * .10})` }}>Start</div>
            </div>
          </RevealLine>
          <RevealLine start={1192}><div style={{ marginTop: 38, color: muted, fontSize: 15, fontWeight: 610 }}>Everything else can wait.</div></RevealLine>
        </MotionWindow>
      </div>
      <MotionCursor start={1180} clickAt={1258} leaveAt={1280} fromX={portrait ? .54 : .48} fromY={portrait ? .53 : .67} x={portrait ? .69 : .61} y={portrait ? .435 : .60} />
    </AbsoluteFill>
  );
}

function TaskScene({ frame, format }: SceneProps) {
  if (frame < 1280 || frame > 1740) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 1280, 1320, 1675, 1740);
  const scale = portrait ? width / 1040 * .99 : height / 900 * .70;
  const mediaIn = spring({ frame: Math.max(0, frame - 1430), fps: 60, config: { damping: 20, stiffness: 84 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", right: portrait ? -width * .30 : -width * .01, top: portrait ? height * .18 : height * .06, width: portrait ? width * .76 : width * .42, height: portrait ? height * .67 : height * .88, opacity: .26 + mediaIn * .32, transform: `translateX(${(1 - mediaIn) * 130}px)` }}>
        <MediaAtmosphere src="launch-assets/lagos-artist-shoot.jpg" focusX={56} focusY={50} style={{ width: "100%", height: "100%" }} overlay="rgba(248,245,239,.25)" />
      </div>
      <div style={{ position: "absolute", left: portrait ? width * .50 : width * .36, top: height * .53, transform: `translate(-50%,-50%) scale(${scale})` }}>
        <TaskBriefMotion start={1325} />
      </div>
      <MotionCursor start={1510} clickAt={1610} leaveAt={1632} fromX={portrait ? .56 : .42} fromY={portrait ? .67 : .86} x={portrait ? .76 : .52} y={portrait ? .55 : .79} />
    </AbsoluteFill>
  );
}

function ChangeScene({ frame, format }: SceneProps) {
  if (frame < 1660 || frame > 2070) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 1660, 1700, 2005, 2070);
  const scale = portrait ? width / 1080 * .98 : height / 720 * .74;
  const move = spring({ frame: Math.max(0, frame - 1860), fps: 60, config: { damping: 20, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * .07 : width * .07, top: portrait ? height * .08 : height * .12 }}>
        <RevealLine start={1700}><div style={{ fontSize: portrait ? width * .028 : height * .043, fontWeight: 780, letterSpacing: "-.04em" }}>Reality changes. The manager should too.</div></RevealLine>
      </div>
      <div style={{ position: "absolute", left: width * .5, top: height * .50, transform: `translate(-50%,-50%) scale(${scale})` }}>
        <MotionWindow chrome={false} style={{ width: 1080, minHeight: 710, padding: "48px 54px" }}>
          <RevealLine start={1720}><div style={{ color: muted, fontSize: 15, fontWeight: 700 }}>Manager · Odaeshi</div></RevealLine>
          <RevealLine start={1735}>
            <div style={{ marginTop: 30, marginLeft: 250, borderRadius: "18px 18px 5px 18px", background: ink, color: "white", padding: "20px 24px", fontSize: 20, lineHeight: 1.45, fontWeight: 600 }}>
              <TypewriterText text="I can’t shoot today. Move it to Sunday." start={1742} duration={50} />
            </div>
          </RevealLine>
          <RevealLine start={1812}>
            <div style={{ marginTop: 26, width: 760, borderRadius: "5px 18px 18px 18px", background: "rgba(111,67,220,.075)", border: "1px solid rgba(111,67,220,.10)", padding: "22px 24px", fontSize: 19, lineHeight: 1.48, fontWeight: 610 }}>
              Moved. I’ve protected the rest of the plan and Sunday is now the next human dependency.
            </div>
          </RevealLine>
          <div style={{ marginTop: 46, display: "grid", position: "relative", gridTemplateColumns: "repeat(3,1fr)", border: `1px solid ${line}`, borderRadius: 18, overflow: "hidden" }}>
            {["Friday", "Saturday", "Sunday"].map((day, index) => (
              <RevealLine key={day} start={1834 + index * 8} blur={5}>
                <div style={{ minHeight: 124, padding: "22px 24px", borderLeft: index ? `1px solid ${line}` : undefined, background: index === 2 ? "rgba(111,67,220,.05)" : "transparent" }}>
                  <div style={{ color: muted, fontSize: 16, fontWeight: 690 }}>{day}</div>
                  <div style={{ marginTop: 20, fontSize: 22, fontWeight: 730, color: index === 2 ? purple : ink, opacity: index === 2 ? move : 1 }}>{index === 2 ? "Shoot story" : ""}</div>
                </div>
              </RevealLine>
            ))}
            <div style={{ position: "absolute", marginTop: 19, marginLeft: interpolate(move, [0, 1], [130, 815], clamp), width: 18, height: 18, borderRadius: 99, background: purple, boxShadow: "0 6px 18px rgba(111,67,220,.28)" }} />
          </div>
        </MotionWindow>
      </div>
    </AbsoluteFill>
  );
}

function WatchScene({ frame, format }: SceneProps) {
  if (frame < 1980 || frame > 2285) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 1980, 2020, 2225, 2285);
  const mediaIn = spring({ frame: Math.max(0, frame - 1990), fps: 60, config: { damping: 19, stiffness: 86 } });
  const metrics = [["Saves", "+18"], ["Profile visits", "+31"], ["Comments", "12"]] as const;

  return (
    <AbsoluteFill style={{ opacity }}>
      <MediaAtmosphere src="launch-assets/lagos-creator-team.jpg" focusX={50} focusY={49} overlay="linear-gradient(90deg,rgba(248,245,239,.18),rgba(248,245,239,.78) 64%,rgba(248,245,239,.96))" style={{ position: "absolute", left: portrait ? -width * .30 : -width * .02, top: portrait ? height * .10 : height * .06, width: portrait ? width * 1.02 : width * .62, height: portrait ? height * .72 : height * .88, opacity: mediaIn, transform: `translateX(${(1 - mediaIn) * -120}px)` }} />

      <div style={{ position: "absolute", right: portrait ? width * .065 : width * .07, top: portrait ? height * .13 : height * .16, width: portrait ? width * .62 : width * .38 }}>
        <RevealLine start={2020}><div style={{ color: purple, fontSize: portrait ? width * .018 : height * .024, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Desk is watching</div></RevealLine>
        <RevealLine start={2034}><div style={{ marginTop: 18, fontSize: portrait ? width * .052 : height * .07, fontWeight: 810, lineHeight: .98, letterSpacing: "-.06em" }}>The post is live.<br />No new prompt needed.</div></RevealLine>
        <RevealLine start={2060}><div style={{ marginTop: 24, color: muted, fontSize: portrait ? width * .021 : height * .029, lineHeight: 1.45, fontWeight: 600 }}>Desk holds until there is enough response to make the next call.</div></RevealLine>

        <div style={{ marginTop: 46, display: "grid", gap: 12 }}>
          {metrics.map(([label, value], index) => (
            <RevealLine key={label} start={2082 + index * 16} fromY={18} blur={8}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `1px solid ${line}`, padding: "0 0 17px" }}>
                <span style={{ color: muted, fontSize: portrait ? width * .017 : height * .023, fontWeight: 650 }}>{label}</span>
                <span style={{ fontSize: portrait ? width * .032 : height * .044, fontWeight: 800, letterSpacing: "-.04em" }}>{value}</span>
              </div>
            </RevealLine>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ApprovalScene({ frame, format }: SceneProps) {
  if (frame < 2190 || frame > 2470) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const opacity = windowOpacity(frame, 2190, 2228, 2415, 2470);
  const scale = portrait ? width / 1030 * .96 : height / 670 * .78;
  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: portrait ? width * .07 : width * .07, top: portrait ? height * .07 : height * .11 }}>
        <RevealLine start={2225}><div style={{ fontSize: portrait ? width * .027 : height * .042, color: muted, fontWeight: 720 }}>Desk can act. You keep authority.</div></RevealLine>
      </div>
      <div style={{ position: "absolute", left: width * .5, top: height * .54, transform: `translate(-50%,-50%) scale(${scale})` }}>
        <ApprovalMotion start={2240} />
      </div>
      <MotionCursor start={2325} clickAt={2378} leaveAt={2405} fromX={portrait ? .58 : .52} fromY={portrait ? .66 : .80} x={portrait ? .742 : .62} y={portrait ? .532 : .72} />
    </AbsoluteFill>
  );
}

function EndScene({ frame, format }: SceneProps) {
  if (frame < 2390) return null;
  const { width, height } = useVideoConfig();
  const portrait = format !== "landscape";
  const local = frame - 2390;
  const wash = interpolate(local, [0, 65], [0, 1], clamp);
  const logo = spring({ frame: Math.max(0, local - 55), fps: 60, config: { damping: 18, stiffness: 95 } });
  return (
    <AbsoluteFill style={{ background: `rgba(248,245,239,${wash})` }}>
      <div style={{ position: "absolute", left: width * .5, top: height * (portrait ? .44 : .47), transform: `translate(-50%,-50%) scale(${.76 + logo * .24})`, opacity: logo }}>
        <Img src={staticFile("logo.png")} style={{ width: portrait ? width * .12 : height * .16, height: portrait ? width * .12 : height * .16, borderRadius: 24 }} />
      </div>
      <div style={{ position: "absolute", left: width * .5, top: height * (portrait ? .54 : .60), transform: `translateX(-50%) translateY(${(1 - logo) * 38}px)`, opacity: logo, textAlign: "center", whiteSpace: "nowrap" }}>
        <div style={{ fontSize: portrait ? width * .068 : height * .09, fontWeight: 830, letterSpacing: "-.07em", lineHeight: .94 }}>Meet your manager.</div>
        <div style={{ marginTop: 25, fontSize: portrait ? width * .018 : height * .024, color: muted, fontWeight: 690 }}>Desk by OrderSounds</div>
      </div>
    </AbsoluteFill>
  );
}

type SceneProps = { frame: number; format: FilmFormat };

function windowOpacity(frame: number, inStart: number, inEnd: number, outStart: number, outEnd: number) {
  return interpolate(frame, [inStart, inEnd, outStart, outEnd], [0, 1, 1, 0], clamp);
}
