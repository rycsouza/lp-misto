/** Returns true when running on a Vercel Preview deployment (lp-misto.vercel.app, etc.) */
export function isPreviewEnv(): boolean {
  return process.env.VERCEL_ENV === "preview";
}
