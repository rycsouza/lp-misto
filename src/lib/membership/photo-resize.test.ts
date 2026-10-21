import { describe, it, expect } from "vitest";
import { scaledSize, PHOTO_MAX_SIDE } from "./photo-resize";

describe("scaledSize", () => {
  it("reduz o lado maior para o teto mantendo a proporção", () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: PHOTO_MAX_SIDE, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: PHOTO_MAX_SIDE });
  });
  it("não aumenta foto pequena", () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
