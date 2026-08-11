export async function getRepository(
  owner: string,
  repo: string
) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
    headers: {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
},
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data = await response.json();

  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    defaultBranch: data.default_branch,
    url: data.html_url,
  };
}
export async function getRepositoryFiles(
  owner: string,
  repo: string
) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "DevGuardian-AI",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  };

  // Get repository information first
  const repositoryResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers,
    }
  );

  if (!repositoryResponse.ok) {
    const errorBody = await repositoryResponse.text();

    console.error("GitHub API error:", {
      status: repositoryResponse.status,
      statusText: repositoryResponse.statusText,
      body: errorBody,
    });

    throw new Error(
      `GitHub repository request failed: ${repositoryResponse.status} ${repositoryResponse.statusText}`
    );
  }

  const repository = await repositoryResponse.json();

  // Get the complete Git tree
  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${repository.default_branch}?recursive=1`,
    {
      headers,
    }
  );

  if (!treeResponse.ok) {
    const errorBody = await treeResponse.text();

    console.error("GitHub tree API error:", {
      status: treeResponse.status,
      statusText: treeResponse.statusText,
      body: errorBody,
    });

    throw new Error(
      `GitHub tree request failed: ${treeResponse.status} ${treeResponse.statusText}`
    );
  }

  const treeData = await treeResponse.json();

  return treeData.tree;
}