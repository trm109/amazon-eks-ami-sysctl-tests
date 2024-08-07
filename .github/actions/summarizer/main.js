const github = require('@actions/github');
const token = process.env.GITHUB_TOKEN;
const octokit = new github.getOctokit(token);
const context = github.context;

(async () => {
  const issueContext = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  };

  const { data: issue } = await octokit.rest.issues.get(issueContext);

  const { data: comments } = await octokit.rest.issues.listComments(issueContext);

  let commentLog = "Comment Log:\n";

  commentLog += `${issue.user.login} created the issue:\n "${issue.body}"\n`

  for (const comment of comments) {
    if(
      (comment.user.login != "github-actions[bot]") && 
      (!comment.body.startsWith("/"))
    ){
      commentLog += `${comment.user.login} says:\n"${comment.body}"\n`
    }
  }

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: commentLog
  });
})();
