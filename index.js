#!/usr/bin/env node

const fs = require("fs");
const core = require("@actions/core");
const { context, getOctokit} = require("@actions/github");
const axios = require("axios")

async function validateSubscription() {
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = "Khan/pull-request-comment-trigger";
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl =
    "https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions";

  core.info("");
  core.info("\u001b[1;36mStepSecurity Maintained Action\u001b[0m");
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false)
    core.info("\u001b[32m\u2713 Free for public repositories\u001b[0m");
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info("");

  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const body = { action: action || "" };

  if (serverUrl !== "https://github.com") body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body,
      { timeout: 3000 },
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(
        `\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`,
      );
      core.error(
        `\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`,
      );
      process.exit(1);
    }
    core.info("Timeout or API not reachable. Continuing to next step.");
  }
}

/**
 * Main execution function for the pull request comment trigger action
 */
async function execute() {
    try {
        await validateSubscription();
        const triggerWord = core.getInput("trigger", { required: true });
        const reactionType = core.getInput("reaction");
        const strictPrefixMode = core.getInput("prefix_only") === 'true';
        
        const githubToken = process.env.GITHUB_TOKEN;
        
        if (reactionType && !githubToken) {
            core.setFailed('GitHub token is required when reaction parameter is provided');
            return;
        }

        const commentText = extractCommentBody();
        core.setOutput('comment_body', commentText);

        if (shouldSkipProcessing()) {
            setTriggeredOutput(false);
            return;
        }

        const { owner, repo } = context.repo;
        const isTriggered = checkTriggerMatch(commentText, triggerWord, strictPrefixMode);
        
        setTriggeredOutput(isTriggered);

        if (isTriggered && reactionType) {
            await addReactionToComment(githubToken, owner, repo, reactionType);
        }
    } catch (error) {
        handleError(error);
    }
}

/**
 * Extracts comment body from the GitHub event context
 */
function extractCommentBody() {
    const eventType = context.eventName;
    let bodyContent = '';
    
    if (eventType === "issue_comment") {
        bodyContent = context.payload.comment?.body || '';
    } else {
        bodyContent = context.payload.pull_request?.body || '';
    }
    
    return bodyContent;
}

/**
 * Determines if processing should be skipped based on event context
 */
function shouldSkipProcessing() {
    const isIssueComment = context.eventName === "issue_comment";
    const isPullRequestComment = context.payload.issue?.pull_request;
    
    return isIssueComment && !isPullRequestComment;
}

/**
 * Checks if the trigger word matches in the comment body
 */
function checkTriggerMatch(text, trigger, prefixOnly) {
    if (prefixOnly) {
        return text.startsWith(trigger);
    }
    return text.includes(trigger);
}

/**
 * Sets the triggered output value
 */
function setTriggeredOutput(isTriggered) {
    core.setOutput("triggered", isTriggered ? "true" : "false");
}

/**
 * Adds a reaction to the comment or pull request
 */
async function addReactionToComment(token, owner, repo, reaction) {
    const octokit = getOctokit(token);
    const eventType = context.eventName;
    
    if (eventType === "issue_comment") {
        await octokit.rest.reactions.createForIssueComment({    
            owner,
            repo,
            comment_id: context.payload.comment.id,
            content: reaction
        });
    } else {
        await octokit.rest.reactions.createForIssue({
            owner,
            repo,
            issue_number: context.payload.pull_request.number,
            content: reaction
        });
    }
}

/**
 * Handles and logs errors appropriately
 */
function handleError(error) {
    console.error('Action execution failed:', error);
    core.setFailed("An unexpected error occurred during execution");
}

execute();
