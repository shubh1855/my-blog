---
title: "False Order"
description: "Detailed writeup for False Order from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-29
categories:
  - [Writeups, HTB Cyber Apocalypse CTF 2026: The Salt Crown]
tags:
  - HTB Cyber Apocalypse 2026
  - DFIR
  - AWS
  - CloudTrail
  - IAM
  - STS
  - S3
  - Cloud Forensics
  - CTF
---

# AWS Cloud Forensics Writeup – Investigating a Forged Ledger

## Challenge Overview

False Order is a cloud forensics challenge centered around AWS CloudTrail. Instead of exploiting a vulnerable service, we are given investigator credentials for an AWS account and tasked with reconstructing an attack against an S3 bucket. Every answer comes from carefully correlating CloudTrail events, IAM identities, STS role assumptions, S3 operations, timestamps, and source IP addresses.

The objective is to determine how an attacker escalated privileges, tampered with an S3 object, and identify every important artifact left behind in the audit logs.

---

# Initial Access

The challenge provides AWS credentials for an investigator account.

Export the supplied credentials:

```bash
export AWS_ACCESS_KEY_ID=<provided>
export AWS_SECRET_ACCESS_KEY=<provided>
export AWS_DEFAULT_REGION=us-east-1
```

Verify the identity:

```bash
aws sts get-caller-identity
```

Output:

```json
{
  "Account": "638291047582",
  "Arn": "arn:aws:iam::638291047582:user/gate-investigator"
}
```

The credentials belong to **gate-investigator**, indicating that our task is to investigate previous activity rather than perform it.

---

# Enumerating the Environment

Start by enumerating the available AWS resources.

```bash
aws s3 ls
aws iam list-users
aws cloudtrail lookup-events
```

The most useful source of information is CloudTrail, but the default output is difficult to read. Since every event contains an embedded JSON document, parsing it with `jq` makes the investigation much easier.

```bash
aws cloudtrail lookup-events --max-results 50 \
| jq -r '
  .Events[]
  | .CloudTrailEvent
  | fromjson
'
```

To build a timeline, extract only the fields that matter:

```bash
aws cloudtrail lookup-events --max-results 50 \
| jq -r '
  .Events[]
  | .CloudTrailEvent
  | fromjson
  | [.eventTime, .sourceIPAddress, .userIdentity.type, .eventName]
  | @tsv
'
```

This immediately reveals two interesting IP addresses:

- `10.41.53.22` — Internal gatehouse workstation
- `198.18.44.91` — External attacker

---

# Reconstructing the Attack

Sorting the events chronologically reveals the complete attack chain.

```text
10.41.53.22
└── ListObjectsV2

198.18.44.91
├── GetCallerIdentity
├── ListAllMyBuckets
├── ListObjectsV2
├── GetObject (AccessDenied)
├── AssumeRole (ashguard-order-auditor) (unsuccessful)
├── AssumeRole (ashguard-order-scanner) (successful)
├── GetCallerIdentity
├── ListBucketVersions
├── DeleteObject
└── PutObject
```

The attacker first authenticated using compromised long-lived IAM credentials, attempted to access a protected object, failed because of insufficient permissions, attempted to assume one role unsuccessfully, successfully assumed a more privileged role, and finally deleted and replaced the target S3 object.

---

# Question 1 — Last CloudTrail API action before the attacker session

Filter the events originating from the internal workstation:

```bash
aws cloudtrail lookup-events --max-results 100 \
| jq -r '
  .Events[]
  | .CloudTrailEvent
  | fromjson
  | select(.sourceIPAddress=="10.41.53.22")
  | [.eventTime,.eventName]
  | @tsv
' | sort
```

The final event before activity switches to the attacker IP is:

```text
ListObjectsV2
```

**Answer**

```text
ListObjectsV2
```

---

# Question 2 — First API call from the attacker IP

The first event originating from `198.18.44.91` is:

```text
GetCallerIdentity
```

Attackers frequently use this API to verify which credentials they currently possess.

**Answer**

```text
GetCallerIdentity
```

---

# Question 3 — Denied S3 API call

Immediately after enumerating buckets and objects, the attacker attempts to read a protected object.

CloudTrail records:

```text
eventName: GetObject
errorCode: AccessDenied
```

The request fails because the attacker has not yet assumed the privileged role.

**Answer**

```text
GetObject
```

---

# Question 4 — Tampered Object

The `DeleteObject` and `PutObject` events both reference the same bucket and key.

```text
Bucket:
ashguard-order-custody

Key:
custody/east-gate-order.json
```

Combining them produces:

```text
s3://ashguard-order-custody/custody/east-gate-order.json
```

**Answer**

```text
s3://ashguard-order-custody/custody/east-gate-order.json
```

---

# Question 5 — IAM Role Used

The successful `AssumeRole` request contains the target role ARN inside
`requestParameters.roleArn`.

```text
arn:aws:iam::638291047582:role/ashguard-order-scanner
```

**Answer**

```text
arn:aws:iam::638291047582:role/ashguard-order-scanner
```

---

# Question 6 — STS Principal ARN

Once the role is assumed, CloudTrail records the temporary STS identity instead of the IAM role.

The `DeleteObject` event contains:

```text
arn:aws:sts::638291047582:assumed-role/ashguard-order-scanner/coalition-gate-clerk
```

**Answer**

```text
arn:aws:sts::638291047582:assumed-role/ashguard-order-scanner/coalition-gate-clerk
```

---

# Question 7 — Source IP

Every privilege escalation and destructive S3 operation originates from:

```text
198.18.44.91
```

This allows the entire attack sequence to be correlated by source IP.

**Answer**

```text
198.18.44.91
```

---

# Question 8 — IAM Username

Before assuming a role, CloudTrail records the IAM user owning the long-lived credentials.

```text
seal-copyist-contractor
```

**Answer**

```text
seal-copyist-contractor
```

---

# Question 9 — Failed Role Assumption

The attacker first attempts to assume another role.

CloudTrail returns an authorization failure.

The failed role is:

```text
ashguard-order-auditor
```

**Answer**

```text
ashguard-order-auditor
```

---

# Question 10 — Session Name

The successful AssumeRole request specifies:

```text
roleSessionName:
coalition-gate-clerk
```

This becomes the final component of the STS ARN.

**Answer**

```text
coalition-gate-clerk
```

---

# Question 11 — CloudTrail Error Code

The failed `GetObject` request records:

```text
AccessDenied
```

This confirms the attacker attempted to access the object before obtaining elevated privileges.

**Answer**

```text
AccessDenied
```

---

# Question 12 — Forged Upload

Following `DeleteObject`, CloudTrail records:

```text
PutObject
```

This indicates the original ledger was replaced with a forged version rather than simply deleted.

**Answer**

```text
PutObject
```

---

# Final Answers

| Question                  | Answer                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Last gatehouse API action | **ListObjectsV2**                                                                      |
| First attacker API action | **GetCallerIdentity**                                                                  |
| Denied S3 API             | **GetObject**                                                                          |
| Tampered object           | **s3://ashguard-order-custody/custody/east-gate-order.json**                           |
| IAM Role ARN              | **arn:aws:iam::638291047582:role/ashguard-order-scanner**                              |
| STS Principal ARN         | **arn:aws:sts::638291047582:assumed-role/ashguard-order-scanner/coalition-gate-clerk** |
| Attacker IP               | **198.18.44.91**                                                                       |
| IAM Username              | **seal-copyist-contractor**                                                            |
| Failed role               | **ashguard-order-auditor**                                                             |
| Session name              | **coalition-gate-clerk**                                                               |
| CloudTrail error          | **AccessDenied**                                                                       |
| Forged upload             | **PutObject**                                                                          |

---

# Conclusion

This challenge demonstrates how powerful CloudTrail is as a forensic data source. By starting with only investigator credentials, we reconstructed the complete intrusion without requiring direct access to the compromised resources.

The investigation began by enumerating CloudTrail events, identifying the internal workstation and attacker IP addresses, and correlating activity by timestamp. From there it was possible to follow the compromised IAM user's actions, observe both failed and successful `AssumeRole` attempts, and attribute the destructive S3 operations to a temporary STS session.
