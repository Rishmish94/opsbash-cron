---
title: "AWS Credential Chain Resolution Order: Why Your --profile Flag Doesn't Always Win"
slug: aws-credential-chain-resolution-order
description: "The AWS CLI checks credentials in a specific order, and a stray environment variable can silently outrank the --profile flag you just passed. Here's the real resolution order, verified against AWS's docs."
tags: [aws, iam, credentials, security, cli]
date: "2026-08-27"
image: "/blog-images/Blog -13.png"
category: "AWS"
tool:
  name: "AWS Credential Chain Debugger"
  url: "/aws-credential-chain"
---

# AWS Credential Chain Resolution Order: Why Your --profile Flag Doesn't Always Win

You run `aws s3 ls --profile prod` and get back a bucket listing that looks suspiciously like the dev account. Or you get `AccessDenied` on a resource you know the prod role can reach. You passed `--profile` explicitly, so it should be authoritative. It's the first thing listed in AWS's own precedence order. And yet something else is clearly winning.

Somewhere in your shell history is an `export AWS_ACCESS_KEY_ID=...` from a debugging session three hours ago that you never unset. That's the actual problem, and it's a direct consequence of how the credential chain is ordered, not a bug in the CLI.

## The order AWS actually documents

AWS's current CLI documentation lists ten sources, checked in this order, with the first match winning:

| Order | Source | What it is |
|---|---|---|
| 1 | Command line options | `--profile`, `--region`, and similar flags passed directly |
| 2 | Environment variables | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE` |
| 3 | Assume role | `role_arn` + `source_profile` configured for the active profile, or the `sts assume-role` command |
| 4 | Assume role with web identity | OIDC federation, `role_arn` + `web_identity_token_file` |
| 5 | AWS IAM Identity Center (SSO) | Cached token from `aws sso login`, configured via `aws configure sso` |
| 6 | Credentials file | `~/.aws/credentials`, written by `aws configure` |
| 7 | Custom process | An external command that returns credentials as JSON |
| 8 | Configuration file | `~/.aws/config` |
| 9 | Container credentials | ECS task role, served through a metadata endpoint |
| 10 | EC2 instance profile credentials | IMDS, the EC2 metadata service |

That's a lot of steps, and most engineers never touch half of them directly. Custom process providers and pure web-identity federation are edge cases. For day to day debugging, this collapses to four checkpoints that actually matter: what's on the command line, what's in your environment variables, however your active profile resolves (SSO login, static keys, or an assumed role), and instance or container metadata as the fallback of last resort.

The important detail buried in that list: **environment variables rank above every profile based mechanism.** `--profile` doesn't inject credentials directly, it tells the CLI which profile to resolve through steps 3 through 8. If step 2 already found valid credentials sitting in your environment, the CLI stops there and never gets to your profile at all.

## Gotcha 1: the stray environment variable that outranks your profile

This is the scenario from the intro, and it's the single most common cause of "wrong account" confusion in practice.

The usual origin story: you run `aws sts assume-role` to grab temporary credentials for some one-off task, copy the `AccessKeyId`, `SecretAccessKey`, and `SessionToken` from the JSON output, and `export` all three into your shell. That works fine for the task at hand. The problem shows up later, in a different terminal tab or the next day in the same one, when you run a completely unrelated command with `--profile some-other-account` and it silently uses the exported credentials instead, because they're still sitting in your environment and environment variables outrank the profile you just asked for by name.

There's no error. The command usually succeeds, just against the wrong account or role, which is worse than a hard failure because nothing tells you to look.

The fix is to check before you assume: `aws configure list` prints a source column showing exactly where each credential value is coming from, whether that's `env`, a named profile, or a config file. If it says `env` and you didn't mean to be using an exported key, `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN` and try again.

## Gotcha 2: the SSO session that expired without telling you

If your organization uses IAM Identity Center, `aws configure sso` sets up the profile and `aws sso login` populates a cached token under `~/.aws/sso/cache/`. That token expires, typically over the course of a working day, and when it does, the CLI's failure mode isn't a clear "please log in again." It's usually a generic authentication or expired token error that doesn't obviously point at the SSO session as the cause, especially if you're used to permanent IAM user keys that don't expire on their own.

The fix is almost always `aws sso login --profile yourprofile`, but recognizing that this is the actual problem, rather than assuming your permissions changed or a role was revoked, is the part that costs people time.

## Gotcha 3: the same code behaves differently depending on where it runs

This one catches people moving an application from a local machine or an EC2 instance to a different compute environment, because the underlying credential delivery mechanism actually changes, not just the account.

**On an EC2 instance**, credentials come from the instance metadata service at `169.254.169.254`. Modern instances default to requiring IMDSv2, which means fetching a session token with a `PUT` request before you can read the credentials, rather than a plain unauthenticated `GET`. Tools and SDKs that were only ever tested against IMDSv1 can fail here.

**Inside a Docker container running directly on that EC2 instance** via a plain `docker run`, the same metadata endpoint is reachable in principle, but by default the token response has a hop limit of 1 at the network level. A request that has to cross the Docker bridge network to reach the container counts as an extra hop, so the token response never arrives and the credential lookup fails silently from inside the container even though it works fine on the host. The fix is raising the instance's metadata hop limit, but you have to know to look for it, since the container-vs-host distinction isn't obvious from the error alone.

**On ECS**, IMDS generally isn't the mechanism at all. A configured task IAM role sets the `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` environment variable, and the SDK fetches credentials from a container specific endpoint using that path instead of touching `169.254.169.254` directly.

**On Lambda**, there's no metadata endpoint call at all. The execution environment pre-populates `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` as environment variables directly, refreshed automatically as needed. Code that tries to reach an IMDS-style endpoint from inside a Lambda function, because that's how it worked on EC2, won't find one.

Four different mechanisms, four different failure modes, and the code that resolves credentials often doesn't change at all when you move between them. The SDK is supposed to abstract this away, and it mostly does, right up until a hop limit or a missing endpoint gets in the way.

## Tracing this by hand gets old fast

`aws sts get-caller-identity` tells you who you currently are. `aws configure list` tells you where each setting came from. Between those two commands you can usually work backward to which of the ten sources actually won, but doing that from scratch every time you hit an unexpected identity is tedious, and it's easy to skip a step, especially under the kind of time pressure that comes with a production incident.

<div class="tool-cta">
  <p>Try it yourself → <a href="/aws-credential-chain">AWS Credential Chain Debugger</a>, an interactive walkthrough that asks what you're seeing and narrows down which credential source is actually winning, without you having to trace the precedence order by hand.</p>
</div>

## The short version

Command line flags matter, but they don't override environment variables, and environment variables don't expire on their own the way an SSO session does. If a command is authenticating as the wrong identity, check `aws configure list` before you check anything else, and remember that EC2, containers on EC2, ECS, and Lambda all source credentials through genuinely different mechanisms, not just different accounts.
