## 5. Full project file structure

```
clmel26_automation/
├── .github/
│   └── workflows/
│       └── ansible-vlan.yml       # GitHub Actions: validate (test/dev) -> deploy (prod)
├── .gitlab-ci.yml                 # GitLab CI: validate -> network_check -> deploy
├── .gitignore                     # ignore pyATS artifacts, caches, editor files
├── README.md                      # repo overview + quick start
├── requirements.txt               # Python deps for pyATS jobs (pyats[full], genie, PyYAML)
│
├── testbed/
│   └── testbed.yaml               # pyATS device inventory (IPs, OS, SSH creds)
│
├── jobs/                          # pyATS / Genie automation
│   ├── smoke_job.py               # pyATS easypy entry point -> runs the test script
│   ├── configure_loopback.py      # applies Loopback300 (2.2.2.2) when tests pass
│   ├── ping_and_loopback.py       # ping gate -> duplicate-checked Loopback3 (3.3.3.x)
│   └── tests/
│       └── test_ping_routes.py    # pyATS testcases: ping gateway + static-route parity
│
├── configs/                       # declarative data consumed by the jobs
│   ├── loopbacks.yaml             # Loopback300 = 2.2.2.2/32 on both routers
│   └── loopback3.yaml             # ping_target + Loopback3 = 3.3.3.1 / 3.3.3.2
│
├── ansible/                       # Ansible VLAN task
│   ├── ansible.cfg                # inventory path, collections path, timeouts
│   ├── requirements.yml           # collections: cisco.ios, ansible.netcommon
│   ├── .yamllint                  # YAML lint rules
│   ├── .ansible-lint              # ansible-lint profile (min)
│   ├── inventory/
│   │   └── hosts.yml              # test + prod device groups
│   ├── group_vars/
│   │   └── all.yml                # connection creds (network_cli, admin/C1sco12345)
│   ├── vars/
│   │   └── vlans.yml              # VLAN intent — ATTENDEES EDIT THIS
│   └── playbooks/
│       ├── validate_vlans.yml     # test/dev gate: schema asserts (no device needed)
│       └── configure_vlans.yml    # applies VLANs + access ports to routers
│
└── docs/                          # Lab guide website (GitHub Pages source)
    ├── index.html                 # renders the Markdown content into a tabbed site
    ├── assets/                    # guide.css (Cisco dark theme) + guide.js
    └── content/                   # one editable Markdown file per tab
        ├── overview.md            #   Overview  (sections 1-4)
        ├── project.md             #   Project   (sections 5-7)
        ├── pipeline.md            #   Pipeline  (sections 8-10)
        └── handson.md             #   Hands-on  (sections 11-14)
```

---

## 6. Every file explained

### Root

| File | What it is / does |
| --- | --- |
| `.gitlab-ci.yml` | The GitLab pipeline. Declares 3 stages (`validate`, `network_check`, `deploy`), sets the default runner tag `pyats-fast` and the pyATS image, and defines the jobs `validate_intent`, `ping_and_loopback`, and `deploy_prod`. |
| `.github/workflows/ansible-vlan.yml` | The GitHub Actions pipeline (mirror of the Ansible flow). `validate` job lints + asserts the VLAN schema; `deploy` job applies to routers on `main`, gated by `needs: validate` and an `environment: production`. Runs on `[self-hosted, clmel]`. |
| `.gitignore` | Keeps pyATS run artifacts (`logs/`, `runinfo/`, `archive/`, `*.log`), Python caches, and editor folders out of Git. |
| `README.md` | Human overview + quick‑start commands and the lab environment table. |
| `requirements.txt` | Python packages the pyATS jobs need: `pyats[full]`, `genie`, `PyYAML`. |

### `testbed/`

| File | What it is / does |
| --- | --- |
| `testbed.yaml` | pyATS device inventory. Defines `iosv-1` (`os: ios`, `198.18.1.7`) and `csr1000v-0` (`os: iosxe`, `198.18.1.6`), both connecting over SSH with `unicon.Unicon`. Includes legacy SSH options (`diffie-hellman-group14-sha1`, `ssh-rsa`) required by older IOS images, plus login/enable credentials. |

### `jobs/` (pyATS / Genie)

| File | What it is / does |
| --- | --- |
| `smoke_job.py` | A pyATS **easypy** job. Its `main(runtime)` runs the test script `tests/test_ping_routes.py` against the testbed. Invoke with `pyats run job jobs/smoke_job.py --testbed-file testbed/testbed.yaml`. |
| `tests/test_ping_routes.py` | The pyATS **AEtest** script. `CommonSetup` connects to all devices; `PingGateway` pings `192.168.1.1` from every router (fails if success rate < 100%); `StaticRoutesEqual` compares the set of static (`S`) routes across routers and fails on mismatch; `CommonCleanup` disconnects. |
| `configure_loopback.py` | Stand‑alone script that reads `configs/loopbacks.yaml` and creates `Loopback300 = 2.2.2.2/32` on each router **if it does not already exist** (idempotent), saves config, and verifies. Exits `1` on any verification failure. |
| `ping_and_loopback.py` | The headline job (see §7). **Step 1** pings a target from *both* routers; if any router fails, it prints a clear error and exits `1` — **nothing is configured**. **Step 2** (only if all pings passed) creates `Loopback3` from `configs/loopback3.yaml`, first checking for a **duplicate** (existing `Loopback3`, or the IP already used by another interface) and skipping if found. Supports `--target` (override) and `--dry-run` (report only, no changes). |

### `configs/`

| File | What it is / does |
| --- | --- |
| `loopbacks.yaml` | Declarative data for `configure_loopback.py`: `Loopback300 = 2.2.2.2/32` on `iosv-1` and `csr1000v-0`. |
| `loopback3.yaml` | Declarative data for `ping_and_loopback.py`: `ping_target: 192.168.1.1`, plus `Loopback3 = 3.3.3.1/32` on `csr1000v-0` and `Loopback3 = 3.3.3.2/32` on `iosv-1`. Change `ping_target` here to steer the pass/fail path. |

### `ansible/`

| File | What it is / does |
| --- | --- |
| `ansible.cfg` | Points Ansible at `inventory/hosts.yml`, sets `collections_path`, disables host‑key checking (lab), and sets 60‑second connection timeouts. |
| `requirements.yml` | Galaxy collections required: `cisco.ios >= 5.0.0`, `ansible.netcommon >= 5.0.0`. |
| `.yamllint` | YAML style rules (extends default, relaxes line length to 160). |
| `.ansible-lint` | Uses the `min` profile — fail on real errors, not style opinions. |
| `inventory/hosts.yml` | Two groups, `test` and `prod`, each containing `iosv-1` (`198.18.1.7`) and `csr1000v-0` (`198.18.1.6`). The playbook chooses the group via `-e target=…`. |
| `group_vars/all.yml` | Connection settings for every router: `network_cli`, `cisco.ios.ios`, user `admin`, password + enable `C1sco12345`. *(Lab creds only — use Vault/CI secrets in production.)* |
| `vars/vlans.yml` | **The file attendees edit.** The declared VLAN intent: `USERS` id 10 → `Gi0/1`, `VOICE` id 20 → `Gi0/2`, `MGMT` id 30 → `Gi0/3`. |
| `playbooks/validate_vlans.yml` | The **test/dev gate**. Runs on `localhost` (no device needed) and asserts: ≥1 VLAN; id is a whole number 1–4094 and not 1002–1005; name 1–32 chars `[A-Za-z0-9_-]`; interface matches `GigabitEthernet<slot>/<port>`; ids are unique. Any failure stops the pipeline with a detailed message. |
| `playbooks/configure_vlans.yml` | The **apply** step. Builds the VLAN list, creates/updates VLANs with `cisco.ios.ios_vlans`, assigns access VLANs to interfaces with `cisco.ios.ios_l2_interfaces`, then saves config. Targets `{{ target | default('test') }}`. |

### `docs/`

The `docs/` folder is the GitHub Pages source. `index.html` renders the Markdown in `docs/content/` — one file per tab (`overview.md`, `project.md`, `pipeline.md`, `handson.md`) — as a single‑page, Cisco‑branded dark‑themed site via `assets/guide.css` and `assets/guide.js`. Edit any content file, commit, and push: the published page updates automatically.

---

## 7. Tests & jobs available in this project

| Job / test | Tooling | What it checks / does | Where it runs | On failure |
| --- | --- | --- | --- | --- |
| `validate_intent` (GitLab) / `validate` (GitHub) | Ansible + yamllint + ansible‑lint | Lints YAML & playbooks, syntax‑checks, and asserts the VLAN schema in `vars/vlans.yml`. **No device contacted.** | GitLab `validate` stage / GitHub `validate` job | Pipeline fails with a detailed message; deploy never runs |
| `ping_and_loopback` | pyATS/Genie | **Step 1:** both routers ping `192.168.1.1`. **Step 2:** if all pass, create duplicate‑checked `Loopback3`. | GitLab `network_check` stage | Prints per‑router ping result + "PIPELINE FAILED"; exits 1; **no config applied** |
| `deploy_prod` (GitLab) / `deploy` (GitHub) | Ansible `cisco.ios` | Dry‑run (`--check --diff`) then apply VLANs to the routers. **Manual/approval gated.** | GitLab `deploy` stage / GitHub `deploy` job | Job fails; VLANs not applied |
| `test_ping_routes.py` | pyATS AEtest | `PingGateway` (ping `192.168.1.1`, needs 100%) + `StaticRoutesEqual` (route parity across routers). | Local / pyATS runner via `smoke_job.py` | Testcase marked failed; job returns non‑zero |
| `configure_loopback.py` | pyATS/Genie | Idempotently create `Loopback300 = 2.2.2.2/32` on both routers. | Local / pyATS runner | Exits 1 on verification failure |
