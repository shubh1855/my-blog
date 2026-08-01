---
title: "Empty Chairs"
description: "Detailed writeup for Empty Chairs from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-29
categories:
  - [Writeups, "HTB Cyber Apocalypse CTF 2026: The Salt Crown"]
tags:
  - HTB Cyber Apocalypse 2026
  - DFIR
  - AWS
  - CloudTrail
  - CTF
---

# Empty Chairs – AWS CloudTrail Forensics Writeup

## Challenge Overview

This challenge provides CloudTrail logs from an AWS environment. Rather than immediately searching for challenge answers, the goal is to reconstruct what happened chronologically using only the supplied logs. CloudTrail records every management API call, making it possible to identify newly created credentials, authentication attempts, privilege discovery, and administrative actions.

---

# Initial Enumeration

I first examined the overall structure of the logs.

```bash
jq '.[0]' events.json
```

Then listed every API call recorded:

```bash
jq -r '.[].eventName' events.json | sort | uniq -c
```

Useful filters used throughout the investigation:

```bash
jq '.[] | select(.eventSource=="iam.amazonaws.com")' events.json
jq '.[] | select(.eventSource=="sts.amazonaws.com")' events.json
jq '.[] | select(.eventSource=="cloudtrail.amazonaws.com")' events.json
jq '.[] | select(.eventSource=="s3.amazonaws.com")' events.json
jq 'sort_by(.eventTime)' events.json
```

Sorting by timestamp makes it much easier to reconstruct the sequence of events.

---

# Timeline Reconstruction

The first notable activity originates from the AWS Root account. Shortly afterwards a new access key is created for an IAM user named `eastreach-investigator`. The new credentials are then used to authenticate with STS before attempting reconnaissance against IAM, CloudTrail and S3 APIs.

---

## IAM Investigation

The first service inspected was IAM.

```bash
jq '.[] | select(.eventSource=="iam.amazonaws.com")' events.json
```

The logs show the Root user listing existing access keys before deleting one belonging to `eastreach-dispatcher`.

### Question 1 — Which access key operation removed old credentials?

```bash
jq '.[] | select(.eventName=="DeleteAccessKey")'
```

**Answer**

```text
DeleteAccessKey
```

Immediately afterwards the Root account provisions new credentials.

### Question 2 — Which user received a new access key?

```bash
jq '.[] | select(.eventName=="CreateAccessKey") | .requestParameters.userName'
```

**Answer**

```text
eastreach-investigator
```

### Question 3 — What was the new Access Key ID?

```bash
jq '.[] | select(.eventName=="CreateAccessKey") | .responseElements.accessKey.accessKeyId'
```

**Answer**

```text
AKIANFIQIBUYJRM4Z2NF
```

---

## Authentication

The next step was determining whether the new credentials were actually used.

```bash
jq '.[] | select(.eventName=="GetCallerIdentity")'
```

The investigator account successfully authenticated with STS.

### Question 4 — Which API verified the credentials?

**Answer**

```text
GetCallerIdentity
```

---

## CloudTrail Reconnaissance

Attackers frequently enumerate CloudTrail to determine whether their actions are being logged.

```bash
jq '.[] | select(.eventName=="DescribeTrails")'
```

### Question 5 — Which CloudTrail API was attempted?

**Answer**

```text
DescribeTrails
```

The request returned **AccessDenied**, indicating the account lacked permission.

---

## IAM Enumeration

The attacker then attempted to discover permissions.

```bash
jq '.[] | select(.eventSource=="iam.amazonaws.com") | .eventName'
```

### Question 6 — Which IAM APIs were attempted?

**Answer**

```text
GetUser
ListAttachedUserPolicies
ListUserPolicies
```

### Question 7 — What was the result?

```text
AccessDenied
```

---

## S3 Enumeration

Next I searched for S3 activity.

```bash
jq '.[] | select(.eventSource=="s3.amazonaws.com")'
```

### Question 8 — Which bucket enumeration API was used?

**Answer**

```text
ListAllMyBuckets
```

Every request failed because the IAM user had insufficient privileges.

---

## Additional Investigation

A complete AWS compromise often includes services such as Secrets Manager, STS role assumption, SQS, KMS, SNS or DynamoDB. I checked each service even though the supplied logs may not contain those events.

### Secrets Manager

```bash
jq '.[] | select(.eventSource=="secretsmanager.amazonaws.com")'
```

No Secrets Manager events were present.

### AssumeRole

```bash
jq '.[] | select(.eventName=="AssumeRole")'
```

No role assumption events were present.

### SQS

```bash
jq '.[] | select(.eventSource=="sqs.amazonaws.com")'
```

No SQS activity was recorded.

### KMS

```bash
jq '.[] | select(.eventSource=="kms.amazonaws.com")'
```

No KMS operations were present.

### SNS

```bash
jq '.[] | select(.eventSource=="sns.amazonaws.com")'
```

No SNS events were recorded.

### DynamoDB

```bash
jq '.[] | select(.eventSource=="dynamodb.amazonaws.com")'
```

No DynamoDB operations were found.

These checks are useful during an investigation because they confirm that the supplied dataset contains only IAM, STS, CloudTrail and S3 management activity.

---

# Timeline

| Time (UTC) | Event                                               |
| ---------- | --------------------------------------------------- |
| 09:52      | Root lists existing access keys                     |
| 09:52      | Old dispatcher access key deleted                   |
| 09:52      | New access key created for `eastreach-investigator` |
| 09:52      | Credentials verified using STS                      |
| 10:03      | CloudTrail enumeration attempted                    |
| 10:03      | IAM reconnaissance begins                           |
| 10:05      | S3 bucket enumeration attempted                     |

---

# Final Answers

| Question                     | Answer                                              |
| ---------------------------- | --------------------------------------------------- |
| Deleted credential operation | DeleteAccessKey                                     |
| New IAM user                 | eastreach-investigator                              |
| New Access Key ID            | AKIANFIQIBUYJRM4Z2NF                                |
| Authentication API           | GetCallerIdentity                                   |
| CloudTrail API               | DescribeTrails                                      |
| IAM APIs                     | GetUser, ListAttachedUserPolicies, ListUserPolicies |
| IAM result                   | AccessDenied                                        |
| S3 enumeration API           | ListAllMyBuckets                                    |

---

# Conclusion

Although the supplied logs represent only a subset of CloudTrail activity, they are sufficient to reconstruct a clear administrative timeline. The Root account rotates IAM credentials by removing an existing key and creating a new access key for `eastreach-investigator`. The new credentials are immediately validated using STS before the account attempts to enumerate CloudTrail, inspect IAM permissions and list S3 buckets. Every reconnaissance attempt ultimately fails with AccessDenied responses, demonstrating that the newly created account was intentionally restricted. Throughout the investigation, additional checks for Secrets Manager, STS role assumptions, SQS, KMS, SNS and DynamoDB confirmed that no corresponding events exist in the supplied dataset.
