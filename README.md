# CLMEL26 — NetDevOps Network Automation Lab

[![Lab Guide](https://img.shields.io/badge/Lab%20Guide-Live-00bceb?style=flat-square)](https://ranilf2005.github.io/clmel26_automation/)
[![pyATS](https://img.shields.io/badge/pyATS-Genie-049fd9?style=flat-square)](https://developer.cisco.com/pyats/)
[![GitLab CI/CD](https://img.shields.io/badge/GitLab-CI%2FCD-fc6d26?style=flat-square)](https://docs.gitlab.com/ee/ci/)
[![Cisco CML](https://img.shields.io/badge/Cisco-CML%202.9-1ba0d7?style=flat-square)](https://developer.cisco.com/modeling-labs/)

> **LTRENS-2687** — Build, Test, Stage, and Apply network configuration as code using
> **Cisco CML**, **pyATS**, **Ansible**, and a **GitLab CI/CD** pipeline.

This repository contains both:

1. **A published HTML lab guide** (in [`docs/`](docs/)) served via GitHub Pages.
2. **The working automation project** (repo root) used by the GitLab pipeline.

## Published lab guide

**https://ranilf2005.github.io/clmel26_automation/**

The guide is a self-contained static site (no build tooling) with a sidebar,
step-by-step instructions, Mermaid diagrams, and the full source of every file.

## What it does

A GitLab pipeline validates every change against a virtual network in CML and only
deploys to the routers when all tests pass:

```
git push ─▶ GitLab Runner ─▶ pyATS tests (ping + routes)
                               ├─ FAIL ─▶ pipeline stops, nothing changes
                               └─ PASS ─▶ configure_loopback.py applies Loopback300
```

- **Case A** — all tests pass → pipeline **SUCCESS**, `Loopback300` configured.
- **Case B** — any test fails → pipeline **FAILED**, loopback not configured.

## Ansible VLAN task (GitHub Actions)

A second, GitHub-native pipeline shows the same guardrail with **Ansible**. Attendees
describe VLANs in [`ansible/vars/vlans.yml`](ansible/vars/vlans.yml); a GitHub Actions
`validate` job (test/dev) asserts the schema — a wrong VLAN id or interface name fails
with a detailed message and **nothing is deployed**. After the fix passes, a gated
`deploy` job (needs `validate`, `main` only, `environment: production` with required
reviewers) applies the VLANs to the routers. The whole pipeline runs on a **self-hosted
GitHub Actions runner on the devbox (`198.18.1.4`)**, which reaches the routers
`198.18.1.6` (csr1000v-0) and `198.18.1.7` (iosv-1). Full walkthrough:
**https://ranilf2005.github.io/clmel26_automation/ansible-vlans.html**

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook playbooks/validate_vlans.yml            # test/dev gate
ansible-playbook playbooks/configure_vlans.yml -e target=prod   # gated deploy
```

## Project structure

```
clmel26_automation/
├── .gitlab-ci.yml               # pipeline: test -> deploy
├── testbed/
│   └── testbed.yaml             # device connection details for pyATS
├── jobs/
│   ├── smoke_job.py             # pyATS job entry point
│   ├── configure_loopback.py    # applies Loopback300 when tests pass
│   └── tests/
│       └── test_ping_routes.py  # ping + static-route test cases
├── configs/
│   └── loopbacks.yaml           # declarative loopback definitions
├── ansible/                     # Ansible VLAN task (GitHub Actions)
│   ├── inventory/hosts.yml      # test + prod device groups
│   ├── group_vars/all.yml       # connection credentials
│   ├── vars/vlans.yml           # VLAN intent (attendees edit this)
│   └── playbooks/
│       ├── validate_vlans.yml   # test/dev gate: schema asserts
│       └── configure_vlans.yml  # applies VLANs to routers
├── .github/workflows/
│   └── ansible-vlan.yml         # CI/CD: validate (test/dev) -> deploy (prod)
└── docs/                        # HTML lab guide (GitHub Pages source)
```

## Lab environment

| Component      | Address                    | Credentials          |
| -------------- | -------------------------- | -------------------- |
| Cisco CML      | `198.18.1.2`               | `admin / C1sco12345` |
| GitLab Web UI  | `http://198.18.1.4:8929/`  | `root / C1sco12345`  |
| Devbox (Ubuntu)| `198.18.1.4`               | `cisco / C1sco12345` |
| iosv-1 (IOS)   | `198.18.1.7`               | `admin / C1sco12345` |
| csr1000v-0 (IOS-XE) | `198.18.1.6`          | `admin / C1sco12345` |

## Run the tests locally

```bash
pip install -r requirements.txt
pyats run job jobs/smoke_job.py --testbed-file testbed/testbed.yaml
python jobs/configure_loopback.py --testbed testbed/testbed.yaml --config configs/loopbacks.yaml
```

---

Rebuilt for **CLMEL26 (2026)** from the LTRENS-2687 lab guide.
