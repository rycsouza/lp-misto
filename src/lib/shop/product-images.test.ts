import { describe, it, expect } from "vitest";
import { productListImages } from "./product-images";

describe("productListImages", () => {
  it("a imagem principal é a capa, mesmo com imagens por cor", () => {
    expect(productListImages("nova.jpg", [{ colorImageUrl: "preta.jpg" }, { colorImageUrl: "branca.jpg" }])).toEqual([
      "nova.jpg",
      "preta.jpg",
      "branca.jpg",
    ]);
  });

  it("sem imagem principal: só as de cor; sem nada: vazio", () => {
    expect(productListImages(null, [{ colorImageUrl: "preta.jpg" }, { colorImageUrl: null }])).toEqual(["preta.jpg"]);
    expect(productListImages(undefined, [])).toEqual([]);
  });

  it("não repete a mesma URL (principal igual à de uma cor)", () => {
    expect(productListImages("preta.jpg", [{ colorImageUrl: "preta.jpg" }, { colorImageUrl: "branca.jpg" }])).toEqual([
      "preta.jpg",
      "branca.jpg",
    ]);
  });
});
