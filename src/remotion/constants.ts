export const FILM_FPS = 60;
export const FILM_DURATION_FRAMES = 2520;

export type FilmFormat = "vertical" | "feed" | "landscape";

export const FILM_FORMATS: Record<FilmFormat, { width: number; height: number; label: string }> = {
  vertical: { width: 2160, height: 3840, label: "9:16" },
  feed: { width: 2160, height: 2700, label: "4:5" },
  landscape: { width: 3840, height: 2160, label: "16:9" },
};

export const FILM_SECONDS = FILM_DURATION_FRAMES / FILM_FPS;
