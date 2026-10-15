import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Arquivos "use server" só podem exportar FUNÇÕES ASSÍNCRONAS (o build do Next
 * falha com constantes, classes, funções síncronas ou re-exports). Tipos e
 * interfaces somem na compilação e são permitidos. tsc e vitest não pegam isso —
 * este teste pega antes do deploy.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

const FORBIDDEN = /^export\s+(const|let|var|class|enum|default|\{|\*)|^export\s+function\s/m;

describe('arquivos "use server"', () => {
  const files = walk(join(process.cwd(), "src")).filter((f) =>
    /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(readFileSync(f, "utf8"))
  );

  it("existem (sanidade do scanner)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("exportam só funções assíncronas (e tipos)", () => {
    const offenders = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => FORBIDDEN.test(line))
        .map(({ line, i }) => `${f.replace(process.cwd() + "/", "")}:${i + 1}: ${line.trim()}`)
    );
    expect(offenders).toEqual([]);
  });
});
