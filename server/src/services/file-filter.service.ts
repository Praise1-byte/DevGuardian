interface GitHubFile {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

const ignoredDirectories = [
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
];

const ignoredFiles = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "Gemfile.lock",
];

const sourceExtensions = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
];

export function filterSourceFiles(files: GitHubFile[]) {
  return files.filter((file) => {
    // Only actual files, not directories
    if (file.type !== "blob") {
      return false;
    }

    // Ignore directories
    if (
      ignoredDirectories.some((directory) =>
        file.path.startsWith(directory)
      )
    ) {
      return false;
    }

    // Ignore specific files
    if (ignoredFiles.includes(file.path)) {
      return false;
    }

    // Only source-code extensions
    return sourceExtensions.some((extension) =>
      file.path.toLowerCase().endsWith(extension)
    );
  });
}