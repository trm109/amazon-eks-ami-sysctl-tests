// this script cannot require/import, because it's called by actions/github-script.
// any dependencies must be passed in the inline script in action.yaml

async function bot(core, github, context, uuid) {
    const payload = context.payload;

    if (!payload.comment) {
        console.log("No comment found in payload");
        return;
    }
    console.log("Comment found in payload");

    // user's org membership must be public for the author_association to be MEMBER
    // go to the org's member page, find yourself, and set the visibility to public
    const author = payload.comment.user.login;
    const authorized = ["OWNER", "MEMBER"].includes(payload.comment.author_association);
    //if (!authorized) { TODO undo this
    //    console.log(`Comment author is not authorized: ${author}`);
    //    return;
    //}
    console.log(`Comment author is authorized: ${author}`);

    let commands;
    try {
        commands = parseCommands(uuid, payload, payload.comment.body);
    } catch (error) {
        console.log(error);
        const reply = `@${author} I didn't understand [that](${payload.comment.html_url})! 🤔\n\nTake a look at my [logs](${getBotWorkflowURL(payload, context)}).`
        replyToCommand(github, payload, reply);
        return;
    }
    if (commands.length === 0) {
        console.log("No commands found in comment body");
        return;
    }
    const uniqueCommands = [...new Set(commands.map(command => typeof command))];
    if (uniqueCommands.length != commands.length) {
        replyToCommand(github, payload, `@${author} you can't use the same command more than once! 🙅`);
        return;
    }
    console.log(commands.length + " command(s) found in comment body");

    for (const command of commands) {
        const reply = await command.run(author, github);
        if (typeof reply === 'string') {
            replyToCommand(github, payload, reply);
        } else if (reply) {
            console.log(`Command returned: ${reply}`);
        } else {
            console.log("Command did not return a reply");
        }
    }
}

// replyToCommand creates a comment on the same PR that triggered this workflow
function replyToCommand(github, payload, reply) {
    github.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body: reply
    });
}

// getBotWorkflowURL returns an HTML URL for this workflow execution of the bot
function getBotWorkflowURL(payload, context) {
    return `https://github.com/${payload.repository.owner.login}/${payload.repository.name}/actions/runs/${context.runId}`;
}

// parseCommands splits the comment body into lines and parses each line as a command or named arguments to the previous command.
function parseCommands(uuid, payload, commentBody) {
    const commands = [];
    if (!commentBody) {
        return commands;
    }
    const lines = commentBody.split(/\r?\n/);
    for (const line of lines) {
        console.log(`Parsing line: ${line}`);
        const command = parseCommand(uuid, payload, line);
        if (command) {
            commands.push(command);
        } else {
            const namedArguments = parseNamedArguments(line);
            if (namedArguments) {
                const previousCommand = commands.at(-1);
                if (previousCommand) {
                    if (typeof previousCommand.addNamedArguments === 'function') {
                        previousCommand.addNamedArguments(namedArguments.name, namedArguments.args);
                    } else {
                        throw new Error(`Parsed named arguments but previous command (${previousCommand.constructor.name}) does not support arguments: ${JSON.stringify(namedArguments)}`);
                    }
                } else {
                    // don't treat this as an error, because the named argument syntax might just be someone '+1'-ing.
                    console.log(`Parsed named arguments with no previous command: ${JSON.stringify(namedArguments)}`);
                }
            }
        }
    }
    return commands
}

// parseCommand parses a line as a command.
// The format of a command is `/NAME ARGS...`.
// Leading and trailing spaces are ignored.
function parseCommand(uuid, payload, line) {
    const command = line.trim().match(/^\/([a-z\-]+)(?:\s+(.+))?$/);
    if (command) {
        return buildCommand(uuid, payload, command[1], command[2]);
    }
    return null;
}

// buildCommand builds a command from a name and arguments.
function buildCommand(uuid, payload, name, args) {
    switch (name) {
        case "echo":
            return new EchoCommand(uuid, payload, args);
        case "ci":
            return new CICommand(uuid, payload, args);
        case "summarize":
            return new SummarizeCommand(uuid, payload, args);
        default:
            console.log(`Unknown command: ${name}`);
            return null;
    }
}

// parseNamedArgument parses a line as named arguments.
// The format of a command is `+NAME ARGS...`.
// Leading and trailing spaces are ignored.
function parseNamedArguments(line) {
    const parsed = line.trim().match(/^\+([a-z\-]+(?::[a-z\-\d_]+)?)(?:\s+(.+))?$/);
    if (parsed) {
        return {
            name: parsed[1],
            args: parsed[2]
        }
    }
    return null;
}

class EchoCommand {
    constructor(uuid, payload, args) {
        this.phrase = args ? args : "echo";
    }

    run(author) {
        return `@${author} *${this.phrase}*`;
    }
}

// payload
/*
{
  "action": "created",
  "comment": {
    "author_association": "OWNER",
    "body": "/summarize abc=1 xyz 120",
    "created_at": "2024-08-26T15:08:27Z",
    "html_url": "https://github.com/trm109/amazon-eks-ami-sysctl-tests/issues/6#issuecomment-2310446798",
    "id": 2310446798,
    "issue_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6",
    "node_id": "IC_kwDOMVN46c6Jtp7O",
    "performed_via_github_app": null,
    "reactions": {
      "+1": 0,
      "-1": 0,
      "confused": 0,
      "eyes": 0,
      "heart": 0,
      "hooray": 0,
      "laugh": 0,
      "rocket": 0,
      "total_count": 0,
      "url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/comments/2310446798/reactions"
    },
    "updated_at": "2024-08-26T15:08:27Z",
    "url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/comments/2310446798",
    "user": {
      "avatar_url": "https://avatars.githubusercontent.com/u/99270795?v=4",
      "events_url": "https://api.github.com/users/trm109/events{/privacy}",
      "followers_url": "https://api.github.com/users/trm109/followers",
      "following_url": "https://api.github.com/users/trm109/following{/other_user}",
      "gists_url": "https://api.github.com/users/trm109/gists{/gist_id}",
      "gravatar_id": "",
      "html_url": "https://github.com/trm109",
      "id": 99270795,
      "login": "trm109",
      "node_id": "U_kgDOBerAiw",
      "organizations_url": "https://api.github.com/users/trm109/orgs",
      "received_events_url": "https://api.github.com/users/trm109/received_events",
      "repos_url": "https://api.github.com/users/trm109/repos",
      "site_admin": false,
      "starred_url": "https://api.github.com/users/trm109/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/trm109/subscriptions",
      "type": "User",
      "url": "https://api.github.com/users/trm109"
    }
  },
  "issue": {
    "active_lock_reason": null,
    "assignee": null,
    "assignees": [],
    "author_association": "OWNER",
    "body": "<!-- Please use this template while reporting a bug and provide as much info as possible. Please also search for existing open and closed issues that may answer your question. Thanks!-->\r\n\r\n**What happened**:\r\n\r\n**What you expected to happen**:\r\n\r\n**How to reproduce it (as minimally and precisely as possible)**:\r\n\r\n**Anything else we need to know?**:\r\n\r\n**Environment**:\r\n- AWS Region:\r\n- Instance Type(s):\r\n- EKS Platform version (use `aws eks describe-cluster --name <name> --query cluster.platformVersion`):\r\n- Kubernetes version (use `aws eks describe-cluster --name <name> --query cluster.version`):\r\n- AMI Version:\r\n- Kernel (e.g. `uname -a`):\r\n- Release information (run `cat /etc/eks/release` on a node):\r\n<!-- Put release info in the triple backticks below-->\r\n```\r\n```\r\n\r\n<!-- If this is a security issue, please do not discuss on GitHub. Please report any suspected or confirmed security issues to AWS Security https://aws.amazon.com/security/vulnerability-reporting/ -->\r\n",
    "closed_at": null,
    "comments": 6,
    "comments_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6/comments",
    "created_at": "2024-08-19T18:58:23Z",
    "events_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6/events",
    "html_url": "https://github.com/trm109/amazon-eks-ami-sysctl-tests/issues/6",
    "id": 2473996511,
    "labels": [],
    "labels_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6/labels{/name}",
    "locked": false,
    "milestone": null,
    "node_id": "I_kwDOMVN46c6TdjDf",
    "number": 6,
    "performed_via_github_app": null,
    "reactions": {
      "+1": 0,
      "-1": 0,
      "confused": 0,
      "eyes": 0,
      "heart": 0,
      "hooray": 0,
      "laugh": 0,
      "rocket": 0,
      "total_count": 0,
      "url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6/reactions"
    },
    "repository_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests",
    "state": "open",
    "state_reason": null,
    "timeline_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6/timeline",
    "title": "Testing!",
    "updated_at": "2024-08-26T15:08:28Z",
    "url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/6",
    "user": {
      "avatar_url": "https://avatars.githubusercontent.com/u/99270795?v=4",
      "events_url": "https://api.github.com/users/trm109/events{/privacy}",
      "followers_url": "https://api.github.com/users/trm109/followers",
      "following_url": "https://api.github.com/users/trm109/following{/other_user}",
      "gists_url": "https://api.github.com/users/trm109/gists{/gist_id}",
      "gravatar_id": "",
      "html_url": "https://github.com/trm109",
      "id": 99270795,
      "login": "trm109",
      "node_id": "U_kgDOBerAiw",
      "organizations_url": "https://api.github.com/users/trm109/orgs",
      "received_events_url": "https://api.github.com/users/trm109/received_events",
      "repos_url": "https://api.github.com/users/trm109/repos",
      "site_admin": false,
      "starred_url": "https://api.github.com/users/trm109/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/trm109/subscriptions",
      "type": "User",
      "url": "https://api.github.com/users/trm109"
    }
  },
  "repository": {
    "allow_forking": true,
    "archive_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/{archive_format}{/ref}",
    "archived": false,
    "assignees_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/assignees{/user}",
    "blobs_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/git/blobs{/sha}",
    "branches_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/branches{/branch}",
    "clone_url": "https://github.com/trm109/amazon-eks-ami-sysctl-tests.git",
    "collaborators_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/collaborators{/collaborator}",
    "comments_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/comments{/number}",
    "commits_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/commits{/sha}",
    "compare_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/compare/{base}...{head}",
    "contents_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/contents/{+path}",
    "contributors_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/contributors",
    "created_at": "2024-07-11T22:10:38Z",
    "default_branch": "main",
    "deployments_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/deployments",
    "description": "Packer configuration for building a custom EKS AMI",
    "disabled": false,
    "downloads_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/downloads",
    "events_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/events",
    "fork": true,
    "forks": 0,
    "forks_count": 0,
    "forks_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/forks",
    "full_name": "trm109/amazon-eks-ami-sysctl-tests",
    "git_commits_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/git/commits{/sha}",
    "git_refs_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/git/refs{/sha}",
    "git_tags_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/git/tags{/sha}",
    "git_url": "git://github.com/trm109/amazon-eks-ami-sysctl-tests.git",
    "has_discussions": false,
    "has_downloads": true,
    "has_issues": true,
    "has_pages": false,
    "has_projects": true,
    "has_wiki": false,
    "homepage": "https://awslabs.github.io/amazon-eks-ami/",
    "hooks_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/hooks",
    "html_url": "https://github.com/trm109/amazon-eks-ami-sysctl-tests",
    "id": 827554025,
    "is_template": false,
    "issue_comment_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/comments{/number}",
    "issue_events_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues/events{/number}",
    "issues_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/issues{/number}",
    "keys_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/keys{/key_id}",
    "labels_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/labels{/name}",
    "language": "Shell",
    "languages_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/languages",
    "license": {
      "key": "mit-0",
      "name": "MIT No Attribution",
      "node_id": "MDc6TGljZW5zZTQx",
      "spdx_id": "MIT-0",
      "url": "https://api.github.com/licenses/mit-0"
    },
    "merges_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/merges",
    "milestones_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/milestones{/number}",
    "mirror_url": null,
    "name": "amazon-eks-ami-sysctl-tests",
    "node_id": "R_kgDOMVN46Q",
    "notifications_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/notifications{?since,all,participating}",
    "open_issues": 1,
    "open_issues_count": 1,
    "owner": {
      "avatar_url": "https://avatars.githubusercontent.com/u/99270795?v=4",
      "events_url": "https://api.github.com/users/trm109/events{/privacy}",
      "followers_url": "https://api.github.com/users/trm109/followers",
      "following_url": "https://api.github.com/users/trm109/following{/other_user}",
      "gists_url": "https://api.github.com/users/trm109/gists{/gist_id}",
      "gravatar_id": "",
      "html_url": "https://github.com/trm109",
      "id": 99270795,
      "login": "trm109",
      "node_id": "U_kgDOBerAiw",
      "organizations_url": "https://api.github.com/users/trm109/orgs",
      "received_events_url": "https://api.github.com/users/trm109/received_events",
      "repos_url": "https://api.github.com/users/trm109/repos",
      "site_admin": false,
      "starred_url": "https://api.github.com/users/trm109/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/trm109/subscriptions",
      "type": "User",
      "url": "https://api.github.com/users/trm109"
    },
    "private": false,
    "pulls_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/pulls{/number}",
    "pushed_at": "2024-08-26T15:07:38Z",
    "releases_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/releases{/id}",
    "size": 10426,
    "ssh_url": "git@github.com:trm109/amazon-eks-ami-sysctl-tests.git",
    "stargazers_count": 0,
    "stargazers_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/stargazers",
    "statuses_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/statuses/{sha}",
    "subscribers_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/subscribers",
    "subscription_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/subscription",
    "svn_url": "https://github.com/trm109/amazon-eks-ami-sysctl-tests",
    "tags_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/tags",
    "teams_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/teams",
    "topics": [],
    "trees_url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests/git/trees{/sha}",
    "updated_at": "2024-08-26T15:07:42Z",
    "url": "https://api.github.com/repos/trm109/amazon-eks-ami-sysctl-tests",
    "visibility": "public",
    "watchers": 0,
    "watchers_count": 0,
    "web_commit_signoff_required": false
  },
  "sender": {
    "avatar_url": "https://avatars.githubusercontent.com/u/99270795?v=4",
    "events_url": "https://api.github.com/users/trm109/events{/privacy}",
    "followers_url": "https://api.github.com/users/trm109/followers",
    "following_url": "https://api.github.com/users/trm109/following{/other_user}",
    "gists_url": "https://api.github.com/users/trm109/gists{/gist_id}",
    "gravatar_id": "",
    "html_url": "https://github.com/trm109",
    "id": 99270795,
    "login": "trm109",
    "node_id": "U_kgDOBerAiw",
    "organizations_url": "https://api.github.com/users/trm109/orgs",
    "received_events_url": "https://api.github.com/users/trm109/received_events",
    "repos_url": "https://api.github.com/users/trm109/repos",
    "site_admin": false,
    "starred_url": "https://api.github.com/users/trm109/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/trm109/subscriptions",
    "type": "User",
    "url": "https://api.github.com/users/trm109"
  }
}
*/
// args
/*
"abc=1 xyz 120"
*/
class SummarizeCommand {
    constructor(uuid, payload, args){ 
        this.repository_owner = payload.repository.owner.login;
        this.repository_name = payload.repository.name;
        this.issue_number = payload.issue.number;
        this.args = args;
    }

    async run(author, github) {
        console.log("Run!");
        //author "trm109"
        console.log(JSON.stringify(github));

        const parts = this.args.trim().split(' ');

        // Commands can take three forms:
        // /summarize owner repo issue_no (length 4)
        // /summarize issue_no (length 2) (defaults owner & repo to context based)
        // /summarize (default) (defaults owner, repo, & issue_no to context based)
        let issueContext = {
            owner: parts.length == 4 ? parts[1] : this.repository_owner,
            repo: parts.length == 4 ? parts[2] : this.repository_name,
            issue_number: parts.length == 4 ? parts[3] : ( parts.length == 2 ? parts[1] : this.issue_number),
        };

        console.log("Issue Context:\n" + JSON.stringify(issueContext));

        const { data: issue } = await github.rest.issues.get(issueContext);

        const { data: comments } = await github.rest.issues.listComments(issueContext);

        const commentLog = "Comment Log:\n" + 
            `${issue.user.login} created the issue:\n ${issue.body}\n` + 
            comments.filter(c => c.user.login != "github-actions[bot]")
            .filter(c => !c.body.startsWith("/"))
            .map(c => `${c.user.login} says:\n "${c.body}"`)
            .join('\n');

        //const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

        // There can be a lot more prompt engineering done for the perfect summarizations, this one works really well however.
        const prompt = `Give me a short summary of this GitHub Issue reply chain. Include details on what the issue is, and what was the conclusion. The full comment history is below: ${commentLog}`;

        const content = [
            {
                type: "text",
                text: `Human: ${prompt}\nAssistant:`
            }
        ];

        const messages = [
            {
                role: "user",
                content,
            }
        ];

        const modelInput = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 16384, // Adjust this if issue comment chain is long.
            messages: messages
        };

        const command = new InvokeModelCommand({
            contentType: "application/json",
            body: JSON.stringify(modelInput),
            modelId: process.env.MODEL_ID,
        });

        console.log("Prompting LLM with:\n" + JSON.stringify(modelInput));

        //try {
        //    const response = await client.send(command);
        //} catch (error) {
        //    console.log("Failure: Unable to access Bedrock. Either invalid credentials or a service outage!");
        //    throw error;
        //}

        //const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        //const generation = responseBody.content[0].text;

        //console.log(`Raw response:\n${JSON.stringify(response)}`);
        //console.log(`parsed response:\n${generation}`);

        //await octokit.rest.issues.createComment({
        //    owner: context.repo.owner,
        //    repo: context.repo.repo,
        //    issue_number: context.issue.number,
        //    body: generation,
        //});

    }
}
class CICommand {
    workflow_goal_prefix = "workflow:";
    constructor(uuid, payload, args) {
        this.repository_owner = payload.repository.owner.login;
        this.repository_name = payload.repository.name;
        this.pr_number = payload.issue.number;
        this.comment_url = payload.comment.html_url;
        this.comment_created_at = payload.comment.created_at;
        this.uuid = uuid;
        this.goal = "test";
        // "test" goal, which executes all CI stages, is the default when no goal is specified
        if (args != null && args !== "") {
            this.goal = args;
        }
        this.goal_args = {};
    }

    addNamedArguments(goal, args) {
        this.goal_args[goal] = args;
    }

    // a map of file path prefixes to OS distros that are associated with the file paths
    // a value of "*" implies multiple OS distros are associated with the path, and we should just rely on the workflow's default
    osDistroPathPrefixHints = {
        "templates/al2/": "al2",
        "templates/al2023/": "al2023",
        "templates/shared/": "*",
        "nodeadm/": "al2023",
    };

    async guessOsDistrosForChangedFiles(github) {
        const files = await github.rest.pulls.listFiles({
            owner: this.repository_owner,
            repo: this.repository_name,
            pull_number: this.pr_number
        });
        const osDistros = new Set();
        for (const file of files.data) {
            for (const [prefix, osDistro] of Object.entries(this.osDistroPathPrefixHints)) {
                if (file.filename.startsWith(prefix)) {
                    osDistros.add(osDistro);
                }
            }
        }
        if (osDistros.has('*')) {
            console.log("changed files matched a prefix mapped to the wildcard, not attempting to guess os_distros!");
            return null;
        }
        if (osDistros.size == 0) {
            return null;
        }
        return Array.from(osDistros).join(',');
    }

    async run(author, github) {
        const pr = await github.rest.pulls.get({
            owner: this.repository_owner,
            repo: this.repository_name,
            pull_number: this.pr_number
        });
        const mergeable = pr.data.mergeable;
        switch (mergeable) {
            case true:
                break;
            case false:
            case null:
                return `@${author} this PR is not currently mergeable, you'll need to rebase it first.`;
            default:
                throw new Error(`Unknown mergeable value: ${mergeable}`);
        }
        const merge_commit = await github.rest.repos.getCommit({
            owner: this.repository_owner,
            repo: this.repository_name,
            ref: pr.data.merge_commit_sha
        });
        if (new Date(this.comment_created_at) < new Date(merge_commit.data.commit.committer.date)) {
            return `@${author} this PR has been updated since your request, you'll need to review the changes.`;
        }
        const inputs = {
            uuid: this.uuid,
            pr_number: this.pr_number.toString(),
            git_sha: pr.data.merge_commit_sha,
            goal: this.goal,
            requester: author,
            comment_url: this.comment_url
        };
        for (const [goal, args] of Object.entries(this.goal_args)) {
            if (goal.startsWith(this.workflow_goal_prefix)) {
                inputs[goal.substring(this.workflow_goal_prefix.length)] = args;
            } else {
                inputs[`${goal}_arguments`] = args;
            }
        }
        if (!inputs.hasOwnProperty('os_distros')) {
            const osDistros = await this.guessOsDistrosForChangedFiles(github);
            if (osDistros != null) {
                inputs['os_distros'] = osDistros;
            }
        }
        console.log(`Dispatching workflow with inputs: ${JSON.stringify(inputs)}`);
        await github.rest.actions.createWorkflowDispatch({
            owner: this.repository_owner,
            repo: this.repository_name,
            workflow_id: 'ci-manual.yaml',
            ref: 'main',
            inputs: inputs
        });
        return null;
    }
}


module.exports = async (core, github, context, uuid) => {
    bot(core, github, context, uuid).catch((error) => {
        core.setFailed(error);
    });
}
