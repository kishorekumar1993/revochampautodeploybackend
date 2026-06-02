const axios = require('axios');

async function createRepo(githubToken, repoName) {
  const response = await axios.post('https://api.github.com/user/repos', {
    name: repoName,
    private: false,
    auto_init: true,
  }, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return response.data;
}

async function getDefaultBranch(githubToken, repoFullName) {
  const branches = await axios.get(`https://api.github.com/repos/${repoFullName}/branches`, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return branches.data[0].name;
}

async function getCommitSha(githubToken, repoFullName, branch) {
  const ref = await axios.get(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return ref.data.object.sha;
}

async function getTreeSha(githubToken, repoFullName, commitSha) {
  const commit = await axios.get(`https://api.github.com/repos/${repoFullName}/git/commits/${commitSha}`, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return commit.data.tree.sha;
}

async function createBlob(githubToken, repoFullName, content) {
  const blob = await axios.post(`https://api.github.com/repos/${repoFullName}/git/blobs`, {
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64'
  }, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return blob.data.sha;
}

async function createTree(githubToken, repoFullName, baseTreeSha, fileSha, filePath) {
  const tree = await axios.post(`https://api.github.com/repos/${repoFullName}/git/trees`, {
    base_tree: baseTreeSha,
    tree: [{ path: filePath, mode: '100644', type: 'blob', sha: fileSha }]
  }, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return tree.data.sha;
}

async function createCommit(githubToken, repoFullName, message, treeSha, parentCommitSha) {
  const commit = await axios.post(`https://api.github.com/repos/${repoFullName}/git/commits`, {
    message,
    tree: treeSha,
    parents: [parentCommitSha]
  }, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  return commit.data.sha;
}

async function updateBranch(githubToken, repoFullName, branch, commitSha) {
  await axios.patch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`, {
    sha: commitSha,
    force: false
  }, {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
}

async function pushWebsite(githubToken, repoFullName, websiteHtml) {
  const branch = await getDefaultBranch(githubToken, repoFullName);
  const commitSha = await getCommitSha(githubToken, repoFullName, branch);
  const treeSha = await getTreeSha(githubToken, repoFullName, commitSha);
  const fileSha = await createBlob(githubToken, repoFullName, websiteHtml);
  const newTreeSha = await createTree(githubToken, repoFullName, treeSha, fileSha, 'index.html');
  const newCommitSha = await createCommit(githubToken, repoFullName, 'Add website files', newTreeSha, commitSha);
  await updateBranch(githubToken, repoFullName, branch, newCommitSha);
  return true;
}

module.exports = { createRepo, pushWebsite };