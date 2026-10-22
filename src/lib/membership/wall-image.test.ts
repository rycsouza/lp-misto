import { describe, it, expect } from "vitest";
import { wallSocioImage } from "./wall-image";

const CLOUD = "misto-test";
const LOGO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_pad,w_512,h_512,b_transparent,q_auto,f_auto/clube-a/socios/logos/abc123`;
const PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/abc123`;

/** Imagem do círculo do mural: logo (pj) > foto > iniciais. Só URL de entrega do projeto. */
describe("wallSocioImage", () => {
  it("logo válido tem prioridade sobre a foto (sócio pj)", () => {
    expect(wallSocioImage({ logoUrl: LOGO, photoUrl: PHOTO })).toEqual({ kind: "logo", src: LOGO });
  });

  it("sem logo: usa a foto (sócio pf ou pj sem logo)", () => {
    expect(wallSocioImage({ logoUrl: null, photoUrl: PHOTO })).toEqual({ kind: "photo", src: PHOTO });
    expect(wallSocioImage({ photoUrl: PHOTO })).toEqual({ kind: "photo", src: PHOTO });
  });

  it("sem logo nem foto: iniciais", () => {
    expect(wallSocioImage({ logoUrl: null, photoUrl: null })).toEqual({ kind: "initials" });
    expect(wallSocioImage({})).toEqual({ kind: "initials" });
  });

  it("URLs que não são de entrega do projeto nunca viram imagem", () => {
    expect(wallSocioImage({ logoUrl: "https://evil.test/x.png", photoUrl: "https://evil.test/y.png" })).toEqual({ kind: "initials" });
    // Foto no campo de logo não é logo; a foto válida segue.
    expect(wallSocioImage({ logoUrl: PHOTO, photoUrl: null })).toEqual({ kind: "initials" });
    // Na tela só o FORMATO é checado (o cloud é conferido no servidor, em safeMemberLogoUrl).
    expect(wallSocioImage({ logoUrl: LOGO.replace("socios/logos", "socios/fotos"), photoUrl: PHOTO })).toEqual({ kind: "photo", src: PHOTO });
  });
});
