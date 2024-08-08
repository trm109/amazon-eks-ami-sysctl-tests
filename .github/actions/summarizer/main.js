const github  = require('@actions/github');
const core    = require('@actions/core');
const token   = process.env.GITHUB_TOKEN;
const octokit = new github.getOctokit(token);
const context = github.context;
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

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

  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

  const prompt = `
    Give me a short summary of this GitHub Issue reply chain. Include details on what the issue is, and what was the conclusion. The full comment history is below:
    
    ${commentLog}
  `;

  const payload = {
    prompt,
    max_gen_len: 512,
    temperature: 0.5,
    top_p: 0.9
  };

  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId: process.env.MODEL_ID,
  });

  const apiResponse = await client.send(command);

  // Decode and parse the response body.
  const decodedResponseBody = new TextDecoder().decode(apiResponse.body);
  const responseBody = JSON.parse(decodedResponseBody);

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: responseBody.completions[0].data.text,
  });
})();
