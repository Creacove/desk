import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import type { FilmFormat } from "./constants";
import { MeetYourManagerFilmV4 } from "./MeetYourManagerFilmV4";

export function RemotionStyledFilm({ format }: { format: FilmFormat }) {
  const [fontHandle] = useState(() => delayRender("Load launch film display type"));

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) continueRender(fontHandle);
    };

    Promise.race([
      document.fonts.load('800 72px "Bricolage Grotesque"'),
      new Promise((resolve) => window.setTimeout(resolve, 3500)),
    ]).then(finish, finish);

    return () => {
      cancelled = true;
    };
  }, [fontHandle]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap"
      />
      <link rel="stylesheet" href={staticFile("remotion-app.css")} />
      <MeetYourManagerFilmV4 format={format} />
    </>
  );
}
