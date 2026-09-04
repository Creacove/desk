import { Composition } from "remotion";
import { FILM_DURATION_FRAMES, FILM_FORMATS, FILM_FPS } from "./constants";
import { MeetYourManagerFilmV2 } from "./MeetYourManagerFilmV2";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="MeetYourManagerVertical"
        component={MeetYourManagerFilmV2}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={FILM_FORMATS.vertical.width}
        height={FILM_FORMATS.vertical.height}
        defaultProps={{ format: "vertical" as const }}
      />
      <Composition
        id="MeetYourManagerFeed"
        component={MeetYourManagerFilmV2}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={FILM_FORMATS.feed.width}
        height={FILM_FORMATS.feed.height}
        defaultProps={{ format: "feed" as const }}
      />
      <Composition
        id="MeetYourManagerLandscape"
        component={MeetYourManagerFilmV2}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={FILM_FORMATS.landscape.width}
        height={FILM_FORMATS.landscape.height}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="MeetYourManagerPreview"
        component={MeetYourManagerFilmV2}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />
      <Composition
        id="MeetYourManagerMotionProof"
        component={MeetYourManagerFilmV2}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={540}
        height={960}
        defaultProps={{ format: "vertical" as const }}
      />
    </>
  );
}
