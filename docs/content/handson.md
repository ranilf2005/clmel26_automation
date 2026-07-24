## 11. Step‑by‑step lab tasks

> **Task 0 — Prerequisites.** You have access to the devbox and the GitLab UI at `http://198.18.1.4:8929/`. The `root/clmel26_automation` project exists and is bound to the `pyats-fast` runner.

**Task 1 — Get the code.**
```bash
git clone http://198.18.1.4:8929/root/clmel26_automation.git
cd clmel26_automation
```

**Task 2 — (Optional) Dry‑run the ping/loopback job locally** using the pyATS runner image (read‑only, no changes):
```bash
docker run --rm -v "$PWD":/build -w /tmp \
  --entrypoint sh 198.18.1.4:5050/root/pyatscml/pyats:1.0.0 \
  -c "python /build/jobs/ping_and_loopback.py \
        --testbed /build/testbed/testbed.yaml \
        --config  /build/configs/loopback3.yaml --dry-run"
```

**Task 3 — Break it on purpose (see the guardrail).** Edit `ansible/vars/vlans.yml`, set a VLAN `id: 5000`, then:
```bash
git commit -am "demo: invalid VLAN id 5000"
git push
```
Watch **CI/CD → Pipelines** — `validate_intent` fails with the clear error; nothing deploys.

**Task 4 — Fix and pass.** Restore `id: 20`, commit, push. `validate_intent` goes green. Open the **`deploy_prod`** job and click **Deploy** to apply the VLANs.

**Task 5 — Run the ping → Loopback3 job.** Ensure `configs/loopback3.yaml` has `ping_target: 192.168.1.1`, push, and watch `ping_and_loopback` create `Loopback3` on both routers. To demo the failure path, set it to `198.168.1.1` and push again.

**Task 6 — Verify on the routers** (see §12).

---

## 12. Verification & command cheat‑sheet

**Push to the lab GitLab (you enter your own GitLab credentials):**
```bash
git add -A
git commit -m "your change"
git push        # origin is the GitLab project
```

**Watch the pipeline:** `http://198.18.1.4:8929/root/clmel26_automation/-/pipelines`

**On the routers (SSH `admin / C1sco12345`, enable `C1sco12345`):**
```
show ip interface brief | include Loopback     ! Loopback3 = 3.3.3.1 / 3.3.3.2
show vlan brief                                ! VLANs 10/20/30
show running-config interface GigabitEthernet0/2
ping 192.168.1.1                               ! the ping-gate target
```

**Run pyATS locally:**
```bash
pip install -r requirements.txt
pyats run job jobs/smoke_job.py --testbed-file testbed/testbed.yaml
python jobs/ping_and_loopback.py --testbed testbed/testbed.yaml --config configs/loopback3.yaml --dry-run
```

**Run Ansible locally:**
```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook playbooks/validate_vlans.yml                    # test/dev gate
ansible-playbook -i inventory/hosts.yml playbooks/configure_vlans.yml -e target=prod
```

---

## 13. Port it to another server

This project is self‑contained. To run it elsewhere:

1. **Copy the repo** (or just the folders you need: `jobs/`, `testbed/`, `configs/`, `ansible/`, and one of `.gitlab-ci.yml` / `.github/workflows/`).
2. **Update device details** in `testbed/testbed.yaml` (pyATS) and `ansible/inventory/hosts.yml` + `ansible/group_vars/all.yml` (Ansible): set the real router IPs and credentials. **Move secrets to Ansible Vault or CI/CD variables** — do not commit plain‑text passwords in production.
3. **Point the ping target** in `configs/loopback3.yaml` at an address your routers should reach.
4. **Provide a runner:**
   - *GitLab:* register a runner, give it a tag, and set that tag in `.gitlab-ci.yml` (`default.tags`). If you don't use the registry pyATS image, add a `before_script` that `pip install`s `pyats[full] genie PyYAML`.
   - *GitHub:* register a self‑hosted runner with a label and set it in `runs-on:`.
5. **Re‑point the image** in `.gitlab-ci.yml` (`default.image`) to wherever your pyATS image lives, or drop the image line and install deps in `before_script`.
6. **Edit the guide:** the website content lives in `docs/content/*.md` — one Markdown file per tab (`overview`, `project`, `pipeline`, `handson`). Edit any of them (Mermaid diagrams and tables included), push, and the published GitHub Pages site updates automatically.

---

## 14. Appendix — credentials, URLs, glossary

### Credentials (lab only)

| Where | User | Password |
| --- | --- | --- |
| CML | `admin` | `C1sco12345` |
| GitLab UI | `root` | `C1sco12345` |
| Devbox | `cisco` | `C1sco12345` |
| Routers (login + enable) | `admin` | `C1sco12345` |

### Key URLs

| Thing | URL |
| --- | --- |
| GitLab project | `http://198.18.1.4:8929/root/clmel26_automation` |
| GitLab pipelines | `http://198.18.1.4:8929/root/clmel26_automation/-/pipelines` |
| Container registry | `198.18.1.4:5050` |
| Published HTML lab guide | `https://ranilf2005.github.io/clmel26_automation/` |

### Glossary

- **CI/CD** — Continuous Integration / Continuous Delivery: automatically test every change and safely deliver it.
- **Runner** — the agent that executes pipeline jobs (here: docker‑executor containers on the devbox).
- **pyATS / Genie / Unicon** — Cisco's Python test/automation framework, its parsing library, and its device‑connection library.
- **Testbed** — the pyATS device inventory (`testbed/testbed.yaml`).
- **Idempotent** — running a job again produces the same result without creating duplicates.
- **Gate** — a stage that blocks progress until a condition is met (tests pass, a human approves).

---

*Generated for CLMEL26 (2026), rebuilt from the LTRENS‑2687 NetDevOps lab. Lab credentials and addresses are for the isolated lab environment only.*
