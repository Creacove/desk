import { staticFile } from "remotion";
import type { FilmFormat } from "./constants";
import { MeetYourManagerFilmV3 } from "./MeetYourManagerFilmV3";

export function RemotionStyledFilm({ format }: { format: FilmFormat }) {
  return (
    <>
      <link rel="stylesheet" href={staticFile("remotion-app.css")} />
      <MeetYourManagerFilmV3 format={format} />
    </>
  );
}
