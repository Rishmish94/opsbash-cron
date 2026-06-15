---
title: "How Cron Expressions Work: A Visual Guide for DevOps Engineers"
description: "Learn cron expressions visually. Understand the 5 fields, special characters, and common patterns every DevOps engineer must know."
pubDate: 2026-06-09
heroImage: "/images/blog/cron-guide.png"
heroImageAlt: "Cron expression format diagram showing minute, hour, day, month, weekday fields"
category: "How-To"
tags: ["cron", "scheduling", "devops", "automation"]
draft: false
author: "Rishabh"
---

## What is a Cron Expression?

A cron expression is a string that defines when a task should run. It's the backbone of automation in Linux and DevOps — from database backups to CI/CD pipelines.

At first glance, cron expressions look like random numbers and symbols. But once you understand the structure, they become incredibly powerful.

## The 5 Fields

Every cron expression has 5 fields (some systems add a 6th for seconds):

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

**Field by field:**

| Field | Range | Special Chars |
|-------|-------|--------------|
| Minute | 0-59 | `* , - /` |
| Hour | 0-23 | `* , - /` |
| Day of Month | 1-31 | `* , - / ?` |
| Month | 1-12 | `* , - /` |
| Day of Week | 0-6 (Sun=0) | `* , - / ?` |

## Special Characters

### `*` — Every
`* * * * *` = Every minute, every hour, every day...

### `,` — List
`0,15,30,45 * * * *` = At minutes 0, 15, 30, and 45

### `-` — Range
`0 9-17 * * *` = Every hour from 9 AM to 5 PM

### `/` — Step
`*/5 * * * *` = Every 5 minutes. `0 */2 * * *` = Every 2 hours.

### `?` — No Specific Value
Use in day-of-month OR day-of-week when the other is specified.

## Common Patterns

| Expression | Meaning |
|-----------|---------|
| `0 0 * * *` | Daily at midnight |
| `*/15 * * * *` | Every 15 minutes |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `0 0 1 * *` | First of every month |
| `0 */6 * * *` | Every 6 hours |
| `30 2 * * 0` | Sunday at 2:30 AM |
| `0 0-23/2 * * *` | Every 2 hours |

## Pro Tips for DevOps

1. **Always add logging**: Redirect output to a log file:
   `0 2 * * * /backup.sh >> /var/log/backup.log 2>&1`

2. **Use full paths**: Cron has a minimal PATH. Always use `/usr/bin/python3` not just `python3`.

3. **Set MAILTO**: Get notified of errors:
   `MAILTO=you@email.com` at the top of your crontab.

4. **Test first**: Use `crontab -e` to add, `crontab -l` to list, `crontab -r` to remove.

5. **For complex schedules**: Use our [Cron Builder](/cron-builder/) tool to generate expressions visually.

## Cron vs Systemd Timers

Modern Linux systems use systemd timers as an alternative to cron:

| Feature | Cron | Systemd Timer |
|---------|------|--------------|
| Syntax | 5-field expression | INI-style unit files |
| Logging | Manual redirect | Built-in journal |
| Dependencies | None | Can depend on other services |
| Missed runs | Skipped | Can catch up |
| Complexity | Simple | More setup |

For simple schedules, cron is fine. For production services, systemd timers offer better reliability.

## What's Next?

Now that you understand cron, try these related topics:
- Setting up cron jobs in Docker containers
- Using Kubernetes CronJobs for containerized tasks
- GitHub Actions scheduled workflows (cloud-based cron)
