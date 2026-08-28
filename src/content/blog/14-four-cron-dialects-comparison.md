---
title: "Four Cron Dialects Compared: Linux, EventBridge, Kubernetes CronJob, and GitHub Actions"
slug: four-cron-dialects-linux-eventbridge-kubernetes-github
description: "Linux cron, AWS EventBridge, Kubernetes CronJob, and GitHub Actions schedule all use cron syntax, but the field counts, wildcards, time zones, and reliability guarantees are all different. Full comparison."
tags: [cron, aws, kubernetes, github-actions, scheduling]
date: "2026-08-27"
image: "/blog-images/Blog -14.png"
category: "How-To"
tool:
  name: "Cron Builder"
  url: "/cron-builder"
---

# Four Cron Dialects Compared: Linux, EventBridge, Kubernetes CronJob, and GitHub Actions

The same recurring task, "run this every weekday at 9am," ends up defined in four different places across a typical stack: a crontab entry on a legacy box, a Kubernetes CronJob manifest, an EventBridge rule, and a GitHub Actions workflow. All four use something that looks like cron syntax. None of the four agree on field count, wildcard support, time zone handling, or what happens when the schedule can't fire exactly on time.

Copy-pasting a working expression from one into another is a reasonable instinct, and it's also how you end up with a validation error, a job that silently runs on the wrong day, or a workflow that just never fires because it's checking a branch nobody pushed the file to.

## Linux/Unix cron, the baseline

Five fields, no year, no time zone concept beyond whatever the system clock is set to.

```
┌───────────── minute (0–59)
│ ┌───────────── hour (0–23)
│ │ ┌───────────── day of month (1–31)
│ │ │ ┌───────────── month (1–12)
│ │ │ │ ┌───────────── day of week (0–6, Sunday=0)
│ │ │ │ │
* * * * *
```

`0 9 * * 1-5` means 9am, Monday through Friday, in whatever time zone the machine's clock uses. That's it. No special characters beyond `*`, `,`, `-`, and `/`. This is the dialect everyone learns first, and the other three all deviate from it in different directions.

## AWS EventBridge: six fields, UTC only, letters cron never taught you

EventBridge cron expressions add a mandatory year field, bringing the total to six, and are wrapped in `cron(...)`.

```
cron(0 9 ? * MON-FRI *)
```

Three differences matter beyond the extra field. You can't use `*` in both the day-of-month and day-of-week fields; exactly one has to be `?` instead, since AWS treats "every day" as ambiguous between the two axes otherwise. The syntax also supports `L` (last day of month or week), `W` (nearest weekday), and `#` (nth weekday of the month) in the day fields, none of which Unix cron recognizes. And day-of-week runs 1 to 7 with 1 meaning Sunday, not 0 to 6 with 0 meaning Sunday like Unix cron — the one difference with no error message to catch it, since porting a numeric day value across dialects unchanged just schedules the job a day off.

EventBridge's classic scheduled rules run in UTC exclusively, with no time zone field, one-minute minimum precision, and AWS's own documentation notes there can be a delay of several seconds between when a rule triggers and when the target actually runs. There's a newer, separate service, EventBridge Scheduler, that uses the same six-field cron syntax but does support a configurable IANA time zone per schedule and adjusts for daylight saving automatically. If you're setting up a new schedule and don't need to stay on the older rules-based service for legacy reasons, Scheduler is the one AWS currently recommends.

This particular dialect has enough sharp edges that it deserves its own deep dive; see [our EventBridge cron breakdown](/blog/eventbridge-cron-vs-unix-cron) for the full list of ways a Unix expression breaks when ported over.

## Kubernetes CronJob: same five fields, different failure mode

CronJob specs use standard five-field cron, and Kubernetes treats `?` as equivalent to `*` if you happen to use it, though it isn't required the way EventBridge requires it.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "0 9 * * 1-5"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 120
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: report
              image: my-report-image
          restartPolicy: OnFailure
```

The syntax is familiar. The gotchas live in the fields that don't exist in plain cron. `startingDeadlineSeconds` sets a deadline, in seconds, for starting the Job if it missed its scheduled time for any reason, such as the controller being down; past that deadline, Kubernetes skips the run entirely rather than starting it late. Leave it unset and there's no deadline at all, which can mean a backlog of missed runs firing in a burst once the cluster catches up.

`concurrencyPolicy` controls what happens if a previous run is still going when the next one is due: `Allow` (the default) lets them overlap, `Forbid` skips the new run, and `Replace` kills the running one and starts the new one. A job that occasionally runs long, combined with `Forbid`, produces silent no-runs that look like nothing happened, not a failure you'd get paged for.

`timeZone` has been a stable field since Kubernetes 1.27, letting you set `spec.timeZone` instead of converting everything to UTC by hand. And the controller itself doesn't watch continuously — it polls on an interval commonly cited as around ten seconds, meaning a `startingDeadlineSeconds` set below that interval can cause runs to be missed simply because the controller didn't check in time. Worth confirming that number against your cluster's version before relying on it.

## GitHub Actions: five fields, but "should" not "will"

The `schedule` trigger in a workflow file uses standard five-field cron syntax, same field order and ranges as Unix.

```yaml
on:
  schedule:
    - cron: '0 9 * * 1-5'
```

Three limits are worth knowing before you design around this. GitHub's documentation states the shortest interval you can run scheduled workflows is once every 5 minutes, so `* * * * *` is simply rejected. Scheduled workflows only trigger from the workflow file as it exists on the repository's default branch, so a schedule defined on a feature branch or an unmerged PR will not fire, a common source of "why isn't this running" confusion during setup. And GitHub states directly that the `schedule` event can be delayed during periods of high load, that high load specifically includes the start of every hour, and that queued runs may be dropped entirely if load is high enough. Scheduling something for the top of the hour puts it right in GitHub's own peak load window, on a system documented as best-effort rather than guaranteed.

## Side by side

| | Linux cron | AWS EventBridge (rules) | Kubernetes CronJob | GitHub Actions |
|---|---|---|---|---|
| Fields | 5 | 6 (adds year) | 5 | 5 |
| Day-of-week | 0–6, 0=Sunday | 1–7, 1=Sunday | 0–6, 0=Sunday | 0–6, 0=Sunday |
| Special characters | `* , - /` | `* , - / ? L W #` | `* , - / ?` (no L/W/#) | `* , - /` |
| Time zone | system default | UTC only (Scheduler: configurable) | cluster default; `timeZone` field since v1.27 | UTC only |
| Minimum interval | none enforced | 1 minute | none enforced (controller polls periodically) | 5 minutes, enforced |
| Missed-run behavior | runs whenever cron next fires | few-second delivery delay, documented by AWS | configurable via `startingDeadlineSeconds` | best-effort; can be delayed or dropped under high load |

## The gotcha that ties all four together

The dangerous failures above share one trait: none of them throw an error. A five-field expression pasted into an EventBridge rule at least fails loudly with a validation exception. Everything else, the day-of-week numbering mismatch, GitHub's best-effort scheduling under load, a Kubernetes job silently skipped because `concurrencyPolicy: Forbid` met a run that took slightly too long, succeeds without complaint and just doesn't do what you expected. That's the pattern worth remembering across all four dialects: the loud failures are the easy ones. Budget your review time for the silent ones instead.

## One tool, four outputs

Translating a schedule between these dialects by hand means holding four field orders and two day-of-week numbering schemes in your head at once. The [Cron Builder](/cron-builder) on opsbash builds a schedule visually once, then switches between Linux, AWS EventBridge, GitHub Actions, and Kubernetes CronJob tabs to show the correctly formatted output for each, year field and `?` placement included, without you translating anything by hand.

<div class="tool-cta">
  <p>Try it yourself → <a href="/cron-builder">Cron Builder</a>, which generates Linux, AWS EventBridge, GitHub Actions, and Kubernetes CronJob syntax from a single visual schedule, so you're not translating field counts and day numbering by hand.</p>
</div>
