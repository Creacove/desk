import { Composition } from "remotion";
import { FILM_DURATION_FRAMES, FILM_FORMATS, FILM_FPS } from "./constants";
import { MeetYourManagerFilm } from "./MeetYourManagerFilm";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="MeetYourManagerVertical"
        component={MeetYourManagerFilm}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={FILM_FORMATS.vertical.width}
        height={FILM_FORMATS.vertical.height}
        defaultProps={{ format: "vertical" as const }}
      />
      <Composition
        id="MeetYourManagerFeed"
        component={MeetYourManagerFilm}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={FILM_FORMATS.feed.width}
        height={FILM_FORMATS.feed.height}
        defaultProps={{ format: "feed" as const }}
      />
      <Composition
        id="MeetYourManagerLandscape"
        component={MeetYourManagerFilm}
        durationInFrames={FILM_DURATION_FRAMES}
        fps={FILM_FPS}
        width={FILM_FORMATS.landscape.width}
        height={FILM_FORMATS.landscape.height}
        defaultProps={{ format: "landscape" as const }}
      />
    </>
  );
}
