---
link: "notes/running-containers-from-scratch-with-runc"
title: "Running Containers From Scratch with runc"
description: "A deep dive into how containers actually work by building one from scratch using runc — the low-level runtime behind Docker, containerd, and Podman."
date: 2026-08-03
categories:
  - Notes
tags:
  - Containers
  - Linux
  - runc
  - Docker
  - Namespaces
---

## Background

When you use Docker, a lot happens invisibly. You type `docker run` and a container appears. But if something breaks at the runtime level, like a network namespace issue or a capability error, you have no idea where to even start looking.

Doing this manually with `runc` forces you to handle everything Docker usually hides: the filesystem, the config, the process lifecycle, the network. Once you've done it by hand, Docker stops being magic.

`runc` is the actual binary that Docker, containerd, and Podman all use under the hood to create and run containers. It has no daemon, no image pulling, no networking plugin. It takes a bundle (a rootfs folder + a config file), sets up Linux namespaces and cgroups, and manages the container lifecycle. Docker is the interface, `runc` is what does the actual work.

```bash
runc --version
```

---

## The Bundle

`runc` needs two things to create a container: what filesystem the container runs on, and how the container process should behave. These live together in one directory called a bundle.

A bundle has exactly two things inside:

- `rootfs/` -- the container's filesystem (what the process sees as `/`)
- `config.json` -- everything about how the container runs: process args, namespaces, mounts, capabilities

`runc spec` generates a default `config.json` aimed at running a shell. Read it once to understand all the options available.

The `config.json` file is defined as per the specification given by Open Container Initiative (OCI). You can read more about it here [OCI specification](https://github.com/opencontainers/image-spec/blob/main/spec.md)

```bash
mkdir nginx-scratch
cd nginx-scratch

runc spec
cat config.json
```

---

## The Root Filesystem

The container process needs a full Linux filesystem to boot into: `/bin`, `/lib`, `/etc`, and so on. Without it, there's nothing to chroot into.

The rootfs is just a directory that looks like the root of a Linux system. The easiest way to get one is to pull it out of an existing Docker image. `docker export` gives you the full flat filesystem as a tar archive -- no layers, no metadata, just the files.

`runc` itself knows nothing about images or layers. It only sees a flat directory. All the image pulling and layer merging happens before `runc` is ever involved.

```bash
mkdir rootfs

docker export $(docker create nginx) | tar -C rootfs -xf -

ls rootfs
# => bin  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var
```

---

## Configuring config.json

The default config is set up to run an interactive shell in a terminal. Nginx has completely different needs: it runs headless, writes files on startup, and needs to switch users after binding to port 80. If you leave these as-is, the container either hangs silently or crashes immediately.

Open `config.json` and make the following changes:

**1. Set the entrypoint to Nginx**

Find the `process.args` field and change it:

```json
"args": [
    "nginx", "-g", "daemon off;"
],
```

`daemon off;` keeps Nginx in the foreground as PID 1. Without it, Nginx forks a worker, the master exits, and `runc` thinks the container died.

**2. Turn off the TTY**

Find `terminal` inside `process` and set it to false:

```json
"terminal": false,
```

The default assumes a PTY is attached (like `docker run -t`). Without one, `runc create` hangs forever waiting for a terminal.

**3. Make rootfs writable**

Find `root` at the top level and set `readonly` to false:

```json
"root": {
    "path": "rootfs",
    "readonly": false
},
```

Nginx writes to `/var/run/nginx.pid` and `/var/log/nginx/` at startup. A read-only filesystem causes an immediate crash.

**4. Add the capabilities Nginx needs**

Find `capabilities` inside `process` and add `CAP_CHOWN`, `CAP_SETGID`, and `CAP_SETUID` to the `bounding`, `effective`, and `permitted` sets:

```json
"capabilities": {
    "bounding": [
        "CAP_CHOWN",
        "CAP_SETGID",
        "CAP_SETUID"
    ],
    "effective": [
        "CAP_CHOWN",
        "CAP_SETGID",
        "CAP_SETUID"
    ],
    "permitted": [
        "CAP_CHOWN",
        "CAP_SETGID",
        "CAP_SETUID"
    ],
    ...
}
```

Nginx starts as root to bind port 80, then switches to the `nginx` user for worker processes. `CAP_SETUID` and `CAP_SETGID` handle that switch. `CAP_CHOWN` is needed to set ownership on temp files. All three sets need to be updated because Linux checks the intersection of all three -- a cap missing from any one set means the process can't use it.

---

## Creating the Container

`runc` splits container creation into two steps: create and start. Create sets up namespaces and cgroups but leaves the process paused. Start lets it actually run. The gap between them is specifically for network setup, which has to happen after the network namespace exists but before the process starts.

`runc create` does all the kernel-level setup: creates new namespaces (mount, PID, network, UTS, IPC), sets up cgroup limits, mounts the rootfs, applies the seccomp profile, and spawns the Nginx process held in a paused state. After this, the container exists and has its own namespaces, but Nginx hasn't run a single instruction yet.

```bash
runc create --bundle $(pwd) nginx-scratch

runc state nginx-scratch   # should show "created"

CONTAINER_PID=$(runc state nginx-scratch | jq .pid)
echo $CONTAINER_PID
```

That PID is worth thinking about: inside the container, Nginx sees itself as PID 1. From the host, it has a normal PID like 1337. Same process, but it has two different views through different namespaces.

---

## Network Namespace Wiring

When `runc create` ran, it put the container into a brand new network namespace. A network namespace is basically the kernel giving the container its own isolated copy of the entire network stack: its own interfaces, its own routing table, its own iptables rules. The container can't see any of the host's network interfaces and the host can't see into the container's namespace either.

The problem is that a fresh network namespace is empty. The only interface inside is `lo` (loopback), which means the container can talk to itself on `127.0.0.1` and nothing else. No way in, no way out. Docker handles this automatically with [CNI](https://github.com/containernetworking/CNI) plugins, but here we wire it up manually, which is actually useful because it shows you exactly what Docker does under the hood every time you run a container.

The tool for this is a **veth pair**. Think of it as a virtual Ethernet cable with two ends: whatever you send into one end comes out the other. The idea is to create this pair, keep one end on the host (`veth0`), and push the other end (`ceth0`) into the container's network namespace. Once both sides have IP addresses on the same subnet, they can talk to each other across that virtual cable.

Before we can use the `ip netns exec` command to run commands inside the container's network namespace, we need to do a small setup step. The `ip` tool looks for named network namespaces in `/run/netns/`, but the container's namespace was created by `runc` and lives at `/proc/<pid>/ns/net`. We just create a symlink so `ip` can find it by name:

```bash
mkdir -p /run/netns
ln -sT /proc/${CONTAINER_PID}/ns/net /run/netns/nginx-scratch
```

Now create the veth pair and move one end into the container's namespace:

```bash
ip link add veth0 type veth peer name ceth0
ip link set ceth0 netns nginx-scratch
```

After that second command, `ceth0` completely disappears from the host. If you run `ip link show` on the host, you won't see it. It now only exists inside the container's network namespace.

New interfaces come up in a DOWN state by default, so we need to bring them up and assign IPs. First the container side:

```bash
ip netns exec nginx-scratch ip link set ceth0 up
ip netns exec nginx-scratch ip addr add 10.0.0.2/24 dev ceth0
```

Then the host side:

```bash
ip link set veth0 up
ip addr add 10.0.0.1/24 dev veth0
```

> [!TIP]
> Check out [explainshell](https://explainshell.com/) to understand such long commands.

At this point, `10.0.0.1` (host) and `10.0.0.2` (container) are on the same `/24` subnet with a direct virtual link between them. There is no bridge, nor any NAT, so there is no routing through the internet. We can think of it just like two ends of a cable with IPs.

This is essentially what Docker does for every container, except Docker also puts the host-side veth endpoint into the `docker0` bridge instead of assigning it an IP directly. This bridge is what lets multiple containers talk to each other and share a single NAT rule out to the internet. We are keeping it simple with a direct point-to-point connection between the host and one container.

---

## Starting the Container

The network is wired up before Nginx starts, which is the whole point of the two-phase lifecycle. If we had started first, Nginx would come up with no working network interface.

`runc start` unblocks the paused process and lets it run. Nginx reads its config, binds to port 80 on `ceth0`, forks workers, and drops to the `nginx` user. The terminal running `runc start` stays attached to Nginx's stdout since we're piping stdio instead of using a PTY.

```bash
runc start nginx-scratch
# will appear to hang but that's normal, it's attached to Nginx's stdout
```

Open a new terminal and verify:

```bash
runc state nginx-scratch
# => "status": "running"

curl -s http://10.0.0.2
# => <!DOCTYPE html><html>...Welcome to nginx!...
```

---

## Cleanup

`runc` stores runtime state (PID, namespace paths, cgroup references) in `/run/runc/`. If you skip cleanup, that state sticks around and `runc` will refuse to create another container with the same name. The veth pair disappears on its own when the network namespace is destroyed, but the bundle directory has to be removed manually.

```bash
runc kill nginx-scratch TERM     # sends SIGTERM to Nginx, gracefully shutting it down
runc delete nginx-scratch        # clears runc's state, destroying the namespace

cd ..
rm -rf nginx-scratch
```

---

## Key Takeaways

**Containers are not VMs.** Nginx was visible from the host with a real PID the whole time. Only its view was isolated: it saw itself as PID 1 on a fresh network namespace, but from the host kernel we can see what its actual PID is.

**Docker's networking is this plus a bridge and NAT.** `docker0` is just a Linux bridge. Each container gets a veth pair, one end into the container, the other into the bridge. Here we skipped the bridge and connected directly.

**The create/start split exists for network setup.** CNI plugins in real runtimes run in exactly that window: after namespaces exist, before the process starts. This lab makes that obvious.

**`runc` is the foundation.** Everything else (image pulling, volumes, DNS, health checks) is built on top of this by Docker and Kubernetes. Once you understand `runc`, the rest is just scaffolding to build further upon.

---

## References

### runc and the OCI Runtime Specification

- [opencontainers/runc](https://github.com/opencontainers/runc): The official runc repository, includes usage docs and build instructions.
- [opencontainers/runtime-spec](https://github.com/opencontainers/runtime-spec): The full OCI Runtime Specification that defines the bundle format, config.json fields, and container lifecycle.
- [OCI Runtime Spec v1.3 announcement](https://opencontainers.org/posts/blog/2025-11-04-oci-runtime-spec-v1-3/): Overview of what the spec covers and which runtimes implement it (runc, crun, youki, gVisor, Kata).

### Linux Namespaces

- [namespaces(7) Linux manual page](https://man7.org/linux/man-pages/man7/namespaces.7.html): Kernel docs covering all namespace types: PID, mount, network, UTS, IPC, user, cgroup.
- [network_namespaces(7) Linux manual page](https://man7.org/linux/man-pages/man7/network_namespaces.7.html): Specifically covers network namespace isolation, veth pairs, and the loopback-only default state.

### veth Pairs

- [veth(4) Linux manual page](https://man7.org/linux/man-pages/man4/veth.4.html): Man-pages on how veth pairs work, how to create them, and how to move one end into a network namespace.

### Linux Capabilities

- [capabilities(7) Linux manual page](https://man7.org/linux/man-pages/man7/capabilities.7.html): Full reference for all Linux capabilities including CAP_SETUID, CAP_SETGID, CAP_CHOWN, and how bounding, effective, and permitted sets interact.

### Docker Networking and CNI

- [containernetworking/cni](https://github.com/containernetworking/cni): The CNI spec and reference plugins. Shows exactly what a bridge CNI config looks like.
- [Container Networking: What You Should Know](https://www.tigera.io/learn/guides/kubernetes-networking/container-networking/): Explains bridge networking, docker0, NAT, and how CNI fits into the picture.
- [Container Networking Deep Dive](https://blog.shellnetsecurity.com/posts/2025/container-networking-fundamentals/): Build container networks from scratch using namespaces and veth pairs, then connects it to Docker and Kubernetes.
