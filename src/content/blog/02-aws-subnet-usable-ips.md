---
title: "Why Your /24 Subnet Only Has 251 Usable IPs (Not 254)"
slug: aws-subnet-usable-ips-not-254
description: "AWS reserves 5 IPs per subnet, not 2. Here's the math everyone learned wrong, why it matters for EKS, and a full prefix to usable IP reference table."
tags: [aws, vpc, networking, cidr, kubernetes]
date: "2026-06-15"
image: "/blog-images/Blog -2.png"
category: "AWS"
tool:
  name: "CIDR Calculator"
  url: "/cidr-calculator"
---

# Why Your /24 Subnet Only Has 251 Usable IPs (Not 254)

Every networking course teaches the same formula. Take the total addresses in a block, subtract two (one for the network address, one for broadcast), and that's your usable count. A /24 has 256 addresses, so it has 254 usable. Simple, correct, and exactly the answer your interviewer wants to hear.

It's also wrong for every subnet you create inside an AWS VPC.

## AWS takes five, not two

In an AWS VPC, every subnet loses five addresses, regardless of size, not two.

AWS reserves 5 IPs in every subnet, so the usable count actually works out to 251 for a /24 (instead of 254) and 11 for a /28 (instead of 14).

The five reserved addresses are:

- The network address, which is the first address in the range
- The address reserved for the VPC router
- The address reserved for the AWS DNS server
- One address held back for future use
- The broadcast address, which is the last address, even though AWS VPCs don't actually support broadcast traffic

That's the first and last addresses you already knew about, plus three more addresses pulled from the range before you've launched a single instance.

## The gap that turns a /28 into 11

This isn't a rounding error you can wave off at small scale. It's proportionally worst when the block is already small.

A /28 is the smallest subnet AWS will let you create. Textbook math says 16 total addresses minus 2 leaves 14 usable. AWS math says 16 total minus 5 leaves 11. You've lost over 30 percent of the block before deploying anything, and if you sized that /28 for a NAT gateway, a couple of EC2 instances, and an ENI for a Lambda function, you might already be three addresses short.

## The full reference table

Here's the corrected math across the AWS allowed range, from /16 to /28:

| Prefix | Total IPs | Textbook usable (minus 2) | AWS actual usable (minus 5) | Difference |
|---|---|---|---|---|
| /16 | 65,536 | 65,534 | 65,531 | 3 fewer |
| /20 | 4,096 | 4,094 | 4,091 | 3 fewer |
| /24 | 256 | 254 | 251 | 3 fewer |
| /26 | 64 | 62 | 59 | 3 fewer |
| /28 | 16 | 14 | 11 | 3 fewer |

The absolute gap is always 3, since AWS reserves 5 and the textbook reserves 2. But the relative impact scales inversely with subnet size. Losing 3 out of 65,531 is noise. Losing 3 out of 14 is a planning failure.

## Where this actually bites: EKS and pod IP exhaustion

The AWS reserves five rule stays mostly academic until you hit a workload where every unit of compute consumes its own IP address, which is exactly how EKS behaves by default.

In EKS and ECS, every pod or task gets its own IP address by default, which makes small subnets fill up fast.

Each pod gets an IP from the subnet's available pool through the AWS VPC CNI. If you sized your worker node subnets assuming "textbook minus 2" math, every subnet starts out three IPs short of what you planned. At the scale of a /24 with dozens of nodes each requesting ENI attached IPs for pods, that gap compounds quickly. Teams have hit "no available IP addresses in subnet" errors during scale up events specifically because the subnet was sized against the wrong baseline from the start.

The practical mitigation, beyond sizing subnets generously, is to use prefix delegation for the VPC CNI. Each ENI gets a /28 prefix instead of individual IPs, which dramatically increases pod density per node. Either way, treat the AWS actual usable count, not the textbook count, as your real budget during capacity planning.

## What about IPv6?

If you're planning dual stack or IPv6 only subnets, this entire reservation model doesn't carry over in the same way.

Unlike IPv4, the first and last addresses in an IPv6 subnet are typically usable host addresses, since there's no concept of reserving addresses for a network ID or broadcast.

AWS still reserves the first four and last one address of an IPv6 subnet for its own use, but the underlying reason is different. Broadcast doesn't exist in IPv6, and the address space is so vast that "running out" isn't a planning concern the way it is in IPv4. Don't carry your IPv4 minus 5 mental model over directly. The constraints that make it matter, namely small blocks and broadcast or network reservation, mostly don't apply here.

## Plan against the real number

The fix is simple once you know about it. When sizing a subnet, use total minus 5, not minus 2, as your usable IP budget. For anything running EKS or ECS with per task networking, size generously and consider prefix delegation from the start rather than retrofitting it after a scaling incident.

The [CIDR Calculator](/cidr-calculator) on opsbash has an AWS reserved IPs toggle that shows both numbers side by side: the textbook usable count you learned in school, and the AWS actual usable count you'll actually get. It's a useful sanity check for a subnet plan before you commit to a CIDR allocation that's much harder to change later than to get right the first time.
