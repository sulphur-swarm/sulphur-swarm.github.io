import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const root = import.meta.dir;

describe("Project structure", () => {
  it("has astro.config.mjs", () => {
    expect(existsSync(join(root, "astro.config.mjs"))).toBe(true);
  });

  it("has package.json with correct name", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    expect(pkg.name).toBe("swarm-website");
    expect(pkg.type).toBe("module");
  });

  it("has required source files", () => {
    expect(existsSync(join(root, "src/layouts/BaseLayout.astro"))).toBe(true);
    expect(existsSync(join(root, "src/pages/index.astro"))).toBe(true);
    expect(existsSync(join(root, "src/styles/global.css"))).toBe(true);
  });

  it("has favicon.svg in public/", () => {
    expect(existsSync(join(root, "public/favicon.svg"))).toBe(true);
  });

  it("has GitHub Actions deploy workflow", () => {
    expect(existsSync(join(root, ".github/workflows/deploy.yml"))).toBe(true);
  });

  it("astro.config.mjs uses static output and correct site URL", () => {
    const config = readFileSync(join(root, "astro.config.mjs"), "utf-8");
    expect(config).toContain("output: 'static'");
    expect(config).toContain("https://sulphur-swarm.github.io");
    expect(config).toContain("tailwindcss");
  });

  it("global.css imports tailwindcss and geist fonts", () => {
    const css = readFileSync(join(root, "src/styles/global.css"), "utf-8");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain("@fontsource/geist");
    expect(css).toContain("--color-bg");
  });

  it("BaseLayout.astro uses frontmatter CSS import", () => {
    const layout = readFileSync(
      join(root, "src/layouts/BaseLayout.astro"),
      "utf-8"
    );
    expect(layout).toContain("import '../styles/global.css'");
    expect(layout).toContain("og:title");
    expect(layout).toContain("twitter:card");
    expect(layout).toContain("canonicalURL");
  });
});
