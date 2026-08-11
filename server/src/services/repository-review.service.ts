import { getRepositoryFiles } from "./github.service";
import { getFileContent } from "./github-content.service";
import { analyzeCode } from "./code-analyzer.service";

interface GitHubFile {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

const MAX_FILES = 20;
const MAX_FILE_SIZE = 1_000_000; // 1 MB

/**
 * Directories we don't want to analyze.
 */
const ignoredPatterns = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  ".nuxt/",
  "out/",
  "target/",
  "vendor/",
  "generated/",
  "__snapshots__/",
];

/**
 * Files that usually don't provide useful source analysis.
 */
const ignoredFiles = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Gemfile.lock",
];

/**
 * Source/code extensions DevGuardian understands.
 */
const supportedExtensions = [
  // JavaScript / TypeScript
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",

  // Python
  ".py",

  // Java / JVM
  ".java",
  ".kt",
  ".kts",

  // C family
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".cs",

  // Go
  ".go",

  // Rust
  ".rs",

  // PHP
  ".php",

  // Ruby
  ".rb",

  // Swift
  ".swift",

  // Shell
  ".sh",
  ".bash",
  ".zsh",

  // Windows scripting
  ".cmd",
  ".bat",
  ".ps1",

  // Dart
  ".dart",

  // Other
  ".scala",
  ".sql",
];

/**
 * Files that should receive higher priority.
 */
const highPriorityPatterns = [
  "src/",
  "/src/",
  "app.",
  "main.",
  "index.",
  "server.",
  "server/",
  "api/",
  "routes/",
  "controllers/",
  "services/",
  "security/",
  "auth/",
  "middleware/",
  "config/",
];

/**
 * Files that are usually less important for the first scan.
 */
const lowPriorityPatterns = [
  ".test.",
  ".spec.",
  "__tests__/",
  "tests/",
  "test/",
  ".stories.",
  ".snap",
  "fixtures/",
  "examples/",
  "mock/",
  "mocks/",
];

/**
 * Determine whether a GitHub file is supported by DevGuardian.
 */
function isSupportedSourceFile(file: GitHubFile): boolean {
  if (file.type !== "blob") {
    return false;
  }

  const path = file.path.toLowerCase();

  // Ignore very large files.
  if (file.size && file.size > MAX_FILE_SIZE) {
    return false;
  }

  // Ignore unwanted files.
  if (ignoredFiles.includes(path)) {
    return false;
  }

  // Ignore unwanted directories.
  if (
    ignoredPatterns.some((pattern) =>
      path.includes(pattern.toLowerCase())
    )
  ) {
    return false;
  }

  // Check extension.
  return supportedExtensions.some((extension) =>
    path.endsWith(extension)
  );
}

/**
 * Give each file a priority score.
 *
 * Higher score = more useful to analyze.
 */
function getFilePriority(file: GitHubFile): number {
  const path = file.path.toLowerCase();

  let score = 0;

  // Source directories
  if (path.startsWith("src/")) {
    score += 40;
  }

  if (path.includes("/src/")) {
    score += 30;
  }

  // Important entry points
  if (
    path.includes("app.") ||
    path.includes("main.") ||
    path.includes("index.")
  ) {
    score += 20;
  }

  // Backend / architecture
  if (
    path.includes("server") ||
    path.includes("api") ||
    path.includes("route") ||
    path.includes("controller")
  ) {
    score += 20;
  }

  // Security-related files
  if (
    path.includes("auth") ||
    path.includes("security") ||
    path.includes("middleware")
  ) {
    score += 20;
  }

  // Services / business logic
  if (
    path.includes("service") ||
    path.includes("repository") ||
    path.includes("database")
  ) {
    score += 15;
  }

  // Configuration
  if (
    path.includes("config") ||
    path.includes("env")
  ) {
    score += 10;
  }

  // Deprioritize tests and examples.
  if (
    lowPriorityPatterns.some((pattern) =>
      path.includes(pattern)
    )
  ) {
    score -= 30;
  }

  // Slight preference for common application languages.
  if (
    path.endsWith(".ts") ||
    path.endsWith(".tsx")
  ) {
    score += 10;
  }

  return score;
}

/**
 * Select the most useful files from a GitHub repository.
 */
function selectFiles(files: GitHubFile[]): GitHubFile[] {
  const candidates = files.filter(isSupportedSourceFile);

  return candidates
    .sort(
      (a, b) =>
        getFilePriority(b) - getFilePriority(a)
    )
    .slice(0, MAX_FILES);
}

/**
 * Review an entire GitHub repository.
 */
export async function reviewRepository(
  owner: string,
  repo: string
) {
  console.log("");
  console.log("🛡️ ========================================");
  console.log("🔍 DEVGUARDIAN REPOSITORY REVIEW");
  console.log("🛡️ ========================================");
  console.log("");

  console.log(
    `🔍 Repository: ${owner}/${repo}`
  );

  // ----------------------------------------
  // GET ALL FILES
  // ----------------------------------------

  const allFiles = await getRepositoryFiles(
    owner,
    repo
  );

  console.log(
    `📁 GitHub returned ${allFiles.length} files`
  );

  // ----------------------------------------
  // SELECT SOURCE FILES
  // ----------------------------------------

  const selectedFiles = selectFiles(
    allFiles
  );

  console.log(
    `🎯 Selected ${selectedFiles.length} source files`
  );

  console.log(
    "📄 Selected files:",
    selectedFiles.map((file) => file.path)
  );

  // ----------------------------------------
  // ANALYZE FILES
  // ----------------------------------------

  const results: any[] = [];

  for (const file of selectedFiles) {
    console.log("");
    console.log(
      `🔎 Analyzing: ${file.path}`
    );

    try {
      const source = await getFileContent(
        owner,
        repo,
        file.path
      );

      console.log(
        `📄 Loaded ${file.path} (${source.code.length} bytes)`
      );

      const analysis = analyzeCode(
        source.path,
        source.code
      );

      console.log(
        `✅ ${file.path}: score ${analysis.score}, ${analysis.findings.length} findings`
      );

      results.push(analysis);
    } catch (error) {
      console.error(
        `❌ Failed to analyze ${file.path}:`,
        error instanceof Error
          ? error.message
          : error
      );
    }
  }

  // ----------------------------------------
  // COMBINE FINDINGS
  // ----------------------------------------

  const findings = results.flatMap(
    (result) => result.findings ?? []
  );

  // ----------------------------------------
  // SEVERITY COUNTS
  // ----------------------------------------

  const critical = findings.filter(
    (finding) =>
      finding.severity === "critical"
  ).length;

  const high = findings.filter(
    (finding) =>
      finding.severity === "high"
  ).length;

  const medium = findings.filter(
    (finding) =>
      finding.severity === "medium"
  ).length;

  const low = findings.filter(
    (finding) =>
      finding.severity === "low"
  ).length;

  // ----------------------------------------
  // HEALTH SCORE
  // ----------------------------------------

  const averageScore =
    results.length > 0
      ? Math.round(
          results.reduce(
            (total, result) =>
              total + result.score,
            0
          ) / results.length
        )
      : 0;

  // ----------------------------------------
  // FINAL REPORT
  // ----------------------------------------

  const report = {
    repository: `${owner}/${repo}`,

    score: averageScore,

    filesAnalyzed: results.length,

    summary: {
      critical,
      high,
      medium,
      low,
    },

    findings,
  };

  console.log("");
  console.log(
    "📊 ========================================"
  );
  console.log("📊 REVIEW COMPLETE");
  console.log(
    "📊 ========================================"
  );

  console.log(
    `📁 Files analyzed: ${report.filesAnalyzed}`
  );

  console.log(
    `💯 Score: ${report.score}/100`
  );

  console.log(
    `🚨 Critical: ${critical}`
  );

  console.log(
    `🔴 High: ${high}`
  );

  console.log(
    `🟡 Medium: ${medium}`
  );

  console.log(
    `🔵 Low: ${low}`
  );

  console.log(
    `🔎 Findings: ${findings.length}`
  );

  return report;
}