interface GitHubFile {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

const ignoredPatterns = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  "vendor/",
  "generated/",
  "__snapshots__/",
];

const testPatterns = [
  ".test.",
  ".spec.",
  "__tests__/",
  "tests/",
];

const configFiles = [
  ".eslintrc.js",
  ".eslintrc.json",
  "webpack.config.js",
  "vite.config.js",
  "jest.config.js",
];

export function rankFiles(files: GitHubFile[]) {
  return files
    .filter((file) => {
      if (file.type !== "blob") return false;

      if (
        ignoredPatterns.some((pattern) =>
          file.path.includes(pattern)
        )
      ) {
        return false;
      }

      return true;
    })
    .map((file) => {
      let score = 0;

      const path = file.path.toLowerCase();

      // Application source directories
      if (
        path.startsWith("src/") ||
        path.includes("/src/")
      ) {
        score += 30;
      }

      // Important application files
      if (
        path.includes("app.") ||
        path.includes("main.") ||
        path.includes("index.")
      ) {
        score += 20;
      }

      // Components
      if (path.includes("component")) {
        score += 10;
      }

      // Services / API
      if (
        path.includes("service") ||
        path.includes("api")
      ) {
        score += 15;
      }

      // Authentication / security
      if (
        path.includes("auth") ||
        path.includes("security")
      ) {
        score += 20;
      }

      // Tests get lower priority
      if (
        testPatterns.some((pattern) =>
          path.includes(pattern)
        )
      ) {
        score -= 20;
      }

      // Configuration gets lower priority
      if (configFiles.includes(path)) {
        score -= 30;
      }

      return {
        ...file,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}