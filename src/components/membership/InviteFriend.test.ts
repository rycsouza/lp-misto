import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InviteFriend } from "./InviteFriend";

describe("InviteFriend", () => {
  it("mostra o título e os botões de compartilhar, WhatsApp e copiar", () => {
    const html = renderToStaticMarkup(createElement(InviteFriend, { programName: "Sócio Carcará", clubName: "Misto" }));
    expect(html).toContain("Indique um amigo");
    expect(html).toContain("Compartilhar");
    expect(html).toContain("Enviar no WhatsApp");
    expect(html).toContain("Copiar link");
  });

  it("não coloca link pronto no HTML (montado no clique, com a origem do site)", () => {
    const html = renderToStaticMarkup(createElement(InviteFriend, { compact: true }));
    expect(html).not.toContain("href=");
    expect(html).not.toContain("wa.me");
  });
});
