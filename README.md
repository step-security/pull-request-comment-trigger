# Pull Request Comment Trigger

A GitHub Action that monitors pull request descriptions and comments for specific trigger phrases, enabling conditional workflow execution based on comment content.

## Description

This action scans pull request descriptions and comments for designated trigger words or phrases. When a trigger is detected, it sets output variables that can be used by subsequent workflow steps to conditionally execute tasks. This is particularly useful for:

- Triggering deployments via PR comments (e.g., `@deploy staging`)
- Running specific test suites when requested (e.g., `#run-integration-tests`)
- Enabling manual approval workflows through comment triggers
- Creating interactive PR workflows that respond to team member commands

The action supports both exact matching and prefix-only matching modes, and can optionally add emoji reactions to comments when triggers are detected.

## Inputs

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `trigger` | Yes | - | The trigger phrase to search for in PR descriptions and comments (e.g., `"@deploy"`, `"#build-android"`) |
| `prefix_only` | No | `false` | When set to `true`, the trigger must appear at the beginning of the comment. When `false`, it can appear anywhere in the text |
| `reaction` | No | - | Optional emoji reaction to add when trigger is found (e.g., `"rocket"`, `"eyes"`, `"thumbs_up"`) |

## Outputs

| Parameter | Description |
|-----------|-------------|
| `triggered` | String value `"true"` if the trigger phrase was found, `"false"` otherwise |
| `comment_body` | The full text content of the comment or PR description that was analyzed |

## Example Workflow

```yaml
name: Conditional Deployment
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  check-trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Check for deployment trigger
        id: trigger-check
        uses: step-security/pull-request-comment-trigger@v1
        with:
          trigger: '@deploy staging'
          reaction: 'rocket'
          prefix_only: 'false'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: 'echo Triggered'
        if: steps.trigger-check.outputs.triggered == 'true'
```

## Usage Notes

- **Event Configuration**: Your workflow must listen to both `pull_request` and `issue_comment` events to capture triggers from both PR descriptions and comments
- **Permissions**: When using the `reaction` parameter, the `GITHUB_TOKEN` environment variable is required
- **Reaction Types**: Reaction must be one of the reactions here: https://developer.github.com/v3/reactions/#reaction-types 
- **Trigger Matching**: The action performs case-sensitive matching. Use `prefix_only: true` for commands that should only be recognized at the start of comments
