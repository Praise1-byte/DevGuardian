export async function getFileContent(
  owner: string,
  repo: string,
  path: string
) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "DevGuardian-AI",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `GitHub content request failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error("Requested path is not a file");
  }

  const code = Buffer.from(data.content, "base64").toString("utf-8");

  return {
    path: data.path,
    size: data.size,
    code,
  };
}