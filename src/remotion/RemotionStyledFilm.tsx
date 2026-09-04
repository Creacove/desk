import { staticFile } from "remotion";
import type { FilmFormat } from "./constants";
import { MeetYourManagerFilmV4 } from "./MeetYourManagerFilmV4";

export function RemotionStyledFilm({ format }: { format: FilmFormat }) {
  return (
    <>
      <link rel="stylesheet" href={staticFile("remotion-app.css")} />
      <MeetYourManagerFilmV4 format={format} />
    </>
  );
}
