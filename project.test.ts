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

describe("Header component", () => {
  it("exists at src/components/layout/Header.astro", () => {
    expect(existsSync(join(root, "src/components/layout/Header.astro"))).toBe(true);
  });

  it("contains all required navigation links", () => {
    const header = readFileSync(
      join(root, "src/components/layout/Header.astro"),
      "utf-8"
    );
    expect(header).toContain("Home");
    expect(header).toContain("About");
    expect(header).toContain("Services");
    expect(header).toContain("SwarmFix");
    expect(header).toContain("Blog");
    expect(header).toContain("Contact");
  });

  it("has fixed positioning and backdrop-filter", () => {
    const header = readFileSync(
      join(root, "src/components/layout/Header.astro"),
      "utf-8"
    );
    expect(header).toContain("fixed");
    expect(header).toContain("backdrop-filter");
  });

  it("has mobile hamburger toggle with aria attributes", () => {
    const header = readFileSync(
      join(root, "src/components/layout/Header.astro"),
      "utf-8"
    );
    expect(header).toContain("mobile-menu-toggle");
    expect(header).toContain('aria-expanded="false"');
    expect(header).toContain('aria-controls="mobile-menu"');
    expect(header).toContain("Toggle mobile menu");
  });

  it("has mobile menu overlay with aria-hidden", () => {
    const header = readFileSync(
      join(root, "src/components/layout/Header.astro"),
      "utf-8"
    );
    expect(header).toContain('id="mobile-menu"');
    expect(header).toContain('aria-hidden="true"');
  });

  it("implements click-outside-to-dismiss", () => {
    const header = readFileSync(
      join(root, "src/components/layout/Header.astro"),
      "utf-8"
    );
    // The click-outside check: e.target === menu
    expect(header).toContain("e.target === menu");
  });

  it("implements scroll-based background change", () => {
    const header = readFileSync(
      join(root, "src/components/layout/Header.astro"),
      "utf-8"
    );
    expect(header).toContain("scrollY");
  });

  it("is imported into BaseLayout.astro", () => {
    const layout = readFileSync(
      join(root, "src/layouts/BaseLayout.astro"),
      "utf-8"
    );
    expect(layout).toContain("import Header from '../components/layout/Header.astro'");
    expect(layout).toContain("<Header");
  });
});

describe("Footer component", () => {
  it("exists at src/components/layout/Footer.astro", () => {
    expect(existsSync(join(root, "src/components/layout/Footer.astro"))).toBe(true);
  });

  it("contains contact email", () => {
    const footer = readFileSync(
      join(root, "src/components/layout/Footer.astro"),
      "utf-8"
    );
    expect(footer).toContain("sulphur@hamilton.garden");
  });

  it("contains navigation links", () => {
    const footer = readFileSync(
      join(root, "src/components/layout/Footer.astro"),
      "utf-8"
    );
    expect(footer).toContain("Home");
    expect(footer).toContain("About");
    expect(footer).toContain("Services");
    expect(footer).toContain("SwarmFix");
    expect(footer).toContain("Blog");
    expect(footer).toContain("Contact");
  });

  it("contains copyright notice", () => {
    const footer = readFileSync(
      join(root, "src/components/layout/Footer.astro"),
      "utf-8"
    );
    expect(footer).toContain("Sulphur. All rights reserved.");
    expect(footer).toContain("currentYear");
  });

  it("is imported into BaseLayout.astro", () => {
    const layout = readFileSync(
      join(root, "src/layouts/BaseLayout.astro"),
      "utf-8"
    );
    expect(layout).toContain("import Footer from '../components/layout/Footer.astro'");
    expect(layout).toContain("<Footer");
  });
});

describe("BaseLayout integration", () => {
  it("has pt-16 on main to clear fixed header", () => {
    const layout = readFileSync(
      join(root, "src/layouts/BaseLayout.astro"),
      "utf-8"
    );
    expect(layout).toContain("pt-16");
  });

  it("has flex flex-col on body for footer anchoring", () => {
    const layout = readFileSync(
      join(root, "src/layouts/BaseLayout.astro"),
      "utf-8"
    );
    expect(layout).toContain("flex flex-col");
    expect(layout).toContain("min-h-screen");
  });

  it("main has flex-1 to push footer down", () => {
    const layout = readFileSync(
      join(root, "src/layouts/BaseLayout.astro"),
      "utf-8"
    );
    expect(layout).toContain("flex-1");
  });
});
