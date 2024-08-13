const github  = require('@actions/github');
const core    = require('@actions/core');
const token   = process.env.GITHUB_TOKEN;
const octokit = new github.getOctokit(token);
const context = github.context;
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

(async () => {
  //const issueContext = {
  //  owner: context.repo.owner,
  //  repo: context.repo.repo,
  //  issue_number: context.issue.number,
  //};
  // Testing issue:
  const issueContext = {
    owner: "awslabs",
    repo: "amazon-eks-ami",
    issue_number: 1002,
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
    \n\nHuman: Give me a short summary of this GitHub Issue reply chain. Include details on what the issue is, and what was the conclusion. The full comment history is below: ${commentLog}
    \n\nAssistant:
  `;

  const messages = [
    {
      role: "user",
      content: []
    }
  ];
  messages[0].content.push({
    type: "text",
    text: `
      Human: ${prompt}
      Assistant:
    `
  });
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 16384, // Adjust this if issue comment chain is long.
    messages: messages
  };

  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId: process.env.MODEL_ID,
  });

  try {
    const response = await client.send(command);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const generation = responseBody.content[0].text;
    //const generation = JSON.parse(responseBody).generation;

    console.log(`Raw response:\n${JSON.stringify(response)}`);
    console.log(`parsed response:\n${generation}`);

    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: generation,
    });
    console.log("Finished!");
  } catch (error) {
    console.log(error)
    throw error;
  }
})();
