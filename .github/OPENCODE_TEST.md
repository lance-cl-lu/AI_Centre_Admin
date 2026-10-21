# OpenCode Branch Test

This is a configuration smoke test on `test/opencode`. It uses the supported
`pull_request` event so the workflow can run before being merged into `main`.
The PR's base branch is `main`; its head must be `test/opencode` in this same
repository. Fork PRs, other head branches, and GitHub Actions bot runs are skipped.

## Files to Publish

- `.github/workflows/opencode-test.yml`
- `.github/OPENCODE_TEST.md`

Publish only these files on `test/opencode` after approval. Open a PR from that
branch to `main` and leave it unmerged while testing. The `branches: [main]`
filter selects the PR's base branch, while the job's `if` selects its head branch.

## Setup and Trigger

1. Add the Actions repository secret `OPENAI_API_KEY` with an OpenAI API key that
   has access to the configured model. No key value belongs in the files or PR.
2. Push the approved test branch and open its PR to `main`. A draft PR is fine.
3. Open the **OpenCode Branch Test** run in the PR checks or the Actions tab.

Opening, updating, reopening, or marking the test PR ready for review starts a
run. A push before a PR exists does not trigger this workflow. After the PR
exists, a push triggers its `synchronize` event. The workflow cancels an older
run when a newer event arrives for the same PR.

## Expected Result

The job checks for `OPENAI_API_KEY`, checks out the test head commit, and runs
OpenCode using `openai/gpt-5.4`. The optional Actions variable `OPENCODE_MODEL`
can override the model using `openai/<model-id>` format.

OpenCode reads the two test files and posts a brief configuration review in
Traditional Chinese on the PR. Verify both a successful workflow run and a PR
reply. Configuration review is the test output; it is not a test of making code
changes through PR comments. OpenAI API usage is billed to the API project.

The token has `contents: read`, `pull-requests: write`, and `issues: write` so
OpenCode can read the repository and post its reply. It cannot push code with
this token. The agent's tool permissions allow reading and searching, and deny
all other tools. Session sharing is disabled, credentials are not persisted by
checkout, and each run times out after 15 minutes.

This test uses `GITHUB_TOKEN` directly. No OpenCode GitHub App installation,
personal access token, or Actions permission to create PRs is needed for it.

## Troubleshooting

- A skipped job usually means the PR has the wrong base/head branch, comes from
  a fork, or was triggered by the GitHub Actions bot. Also check that Actions is
  enabled for the repository and that third-party actions are allowed.
- A missing-key error means the repository secret is unavailable. Authentication
  or model-access errors require checking the API key, model access, and quota.
- A permission error while posting the reply requires checking the granted token
  permissions and repository or organization policies.
- Normal PR conversation comments such as `/opencode ...` do not trigger this
  test. That separate `issue_comment` integration requires its workflow on the
  default branch. This test needs no merge into `main`.

## Stop or Roll Back

Close the test PR and cancel any active run. Delete the test branch when it is
no longer needed. No application deployment or change to `main` is part of this
test. Future uploads or changes require approval.

## References

- [GitHub pull request events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)
- [OpenCode GitHub integration](https://opencode.ai/docs/github/)
- [OpenCode permissions](https://opencode.ai/docs/permissions/)
