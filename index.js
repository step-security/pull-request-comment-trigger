#!/usr/bin/env node

const core = require("@actions/core");
const { context, GitHub } = require("@actions/github");

/**
 * Main execution function for the pull request comment trigger action
 */
async function execute() {
    try {
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
    const octokit = new GitHub(token);
    const eventType = context.eventName;
    
    if (eventType === "issue_comment") {
        await octokit.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: context.payload.comment.id,
            content: reaction
        });
    } else {
        await octokit.reactions.createForIssue({
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
