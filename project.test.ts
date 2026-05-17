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

describe("Blog system", () => {
  it("has content collection config", () => {
    expect(existsSync(join(root, "src/content.config.ts"))).toBe(true);
    const config = readFileSync(join(root, "src/content.config.ts"), "utf-8");
    expect(config).toContain("defineCollection");
    expect(config).toContain("blog");
  });

  it("has blog posts in content collection", () => {
    expect(existsSync(join(root, "src/content/blog/hello-world.mdx"))).toBe(true);
    expect(existsSync(join(root, "src/content/blog/how-swarm-handles-bug-fix.mdx"))).toBe(true);
  });

  it("blog posts have required frontmatter fields", () => {
    const post1 = readFileSync(join(root, "src/content/blog/hello-world.mdx"), "utf-8");
    expect(post1).toContain("title:");
    expect(post1).toContain("description:");
    expect(post1).toContain("publishDate:");
    expect(post1).toContain("author:");
    expect(post1).toContain("tags:");
    expect(post1).toContain("featured: true");

    const post2 = readFileSync(join(root, "src/content/blog/how-swarm-handles-bug-fix.mdx"), "utf-8");
    expect(post2).toContain("title:");
    expect(post2).toContain("description:");
    expect(post2).toContain("publishDate:");
  });

  it("has blog listing page", () => {
    expect(existsSync(join(root, "src/pages/blog/index.astro"))).toBe(true);
    const page = readFileSync(join(root, "src/pages/blog/index.astro"), "utf-8");
    expect(page).toContain("getCollection");
    expect(page).toContain("blog");
  });

  it("has blog dynamic route page", () => {
    expect(existsSync(join(root, "src/pages/blog/[...slug].astro"))).toBe(true);
    const page = readFileSync(join(root, "src/pages/blog/[...slug].astro"), "utf-8");
    expect(page).toContain("getStaticPaths");
    expect(page).toContain("getCollection");
    expect(page).toContain("render");
    expect(page).toContain("astro:content");
  });

  it("has BlogPost layout", () => {
    expect(existsSync(join(root, "src/layouts/BlogPost.astro"))).toBe(true);
    const layout = readFileSync(join(root, "src/layouts/BlogPost.astro"), "utf-8");
    expect(layout).toContain("prose");
    expect(layout).toContain("headings");
    expect(layout).toContain("reading-progress");
  });

  it("astro.config.mjs includes MDX integration and Shiki config", () => {
    const config = readFileSync(join(root, "astro.config.mjs"), "utf-8");
    expect(config).toContain("mdx");
    expect(config).toContain("shikiConfig");
    expect(config).toContain("github-dark");
  });

  it("global.css includes typography plugin and prose overrides", () => {
    const css = readFileSync(join(root, "src/styles/global.css"), "utf-8");
    expect(css).toContain("@tailwindcss/typography");
    expect(css).toContain("--tw-prose-body");
    expect(css).toContain("reading-progress");
  });
});
