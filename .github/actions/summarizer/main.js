const github = require('@actions/github');
const token = process.env.GITHUB_TOKEN;
const octokit = new github.getOctokit(token);
const context = github.context;

(async () => {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });

  let commentLog = "Comment Log:\n";

  for (const comment of comments) {
    commentLog += comment.user.login + " says:\n" + comment.body + "\n"
  }

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: commentLog
  });
})();
