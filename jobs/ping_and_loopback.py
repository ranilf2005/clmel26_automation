#!/usr/bin/env python3
"""
ping_and_loopback.py  -  CLMEL26 lab job

Flow (any problem fails the CI/CD pipeline with a clear message):

  STEP 1  Both routers (csr1000v-0 198.18.1.6, iosv-1 198.18.1.7) ping a
          target IP. Ping is read-only and changes nothing.
  STEP 2  ONLY if every router reached the target, read the loopback config
          file and create each Loopback3 - but for every router it first
          checks for a DUPLICATE (an existing Loopback3, or the IP already in
          use on another interface) and skips creation if one is found.
  FAIL    If ANY router fails the ping, print a clear error and exit 1 so the
          pipeline stops BEFORE touching any device configuration.

Usage:
  python jobs/ping_and_loopback.py \
      --testbed testbed/testbed.yaml \
      --config  configs/loopback3.yaml \
      [--target 198.168.1.1] [--dry-run]
"""
import re
import sys
import argparse

import yaml
from genie.testbed import load as load_testbed

DEFAULT_TARGET = "198.168.1.1"
MIN_SUCCESS = 80            # a router "passes" if ping success rate >= this (%)


def banner(title):
    line = "=" * 70
    print(f"\n{line}\n{title}\n{line}")


def ping(dev, target):
    """Ping the target from dev. Read-only. Returns (ok, rate, last_line)."""
    out = dev.execute(f"ping {target} repeat 5 timeout 2")
    m = re.search(r"Success +rate +is +(\d+) +percent", out, re.I)
    rate = int(m.group(1)) if m else 0
    last = out.strip().splitlines()[-1] if out.strip() else "(no output)"
    return rate >= MIN_SUCCESS, rate, last


def find_interface(dev, name, ip):
    """
    Inspect 'show ip interface brief' and report duplicates.
    Returns (iface_exists, ip_owner) where ip_owner is the interface that
    already carries `ip` (or None).
    """
    out = dev.execute("show ip interface brief")
    iface_exists = re.search(rf"^{re.escape(name)}\b", out, re.M) is not None
    owner = re.search(rf"^(\S+)\s+{re.escape(ip)}\b", out, re.M)
    return iface_exists, (owner.group(1) if owner else None)


def save_config(dev):
    try:
        dev.execute("write memory")
    except Exception:
        try:
            dev.execute("copy running-config startup-config\n\n")
        except Exception:
            pass


def disconnect_all(tb):
    for dev in tb.devices.values():
        try:
            dev.disconnect()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(
        description="Ping pre-check, then create Loopback3 only if there is no duplicate."
    )
    parser.add_argument("--testbed", required=True)
    parser.add_argument("--config", required=True,
                        help="loopback config file, e.g. configs/loopback3.yaml")
    parser.add_argument("--target", help="override the ping target IP")
    parser.add_argument("--dry-run", action="store_true",
                        help="ping and report only; never change device config")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f) or {}
    target = args.target or cfg.get("ping_target") or DEFAULT_TARGET
    plan = cfg.get("devices", {})

    tb = load_testbed(args.testbed)

    # ---------------- STEP 1: ping pre-check on EVERY router ----------------
    banner(f"STEP 1  Ping pre-check  ->  every router must reach {target}")
    ping_failures = []
    for name, dev in tb.devices.items():
        try:
            dev.connect(log_stdout=False)
        except Exception as exc:
            print(f"  [FAIL] {name}: could not connect - {exc}")
            ping_failures.append(f"{name}: SSH connection failed ({exc})")
            continue
        ok, rate, last = ping(dev, target)
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} -> {target}: "
              f"success rate {rate}%   ({last})")
        if not ok:
            ping_failures.append(
                f"{name} could NOT reach {target} - success rate {rate}% "
                f"(need >= {MIN_SUCCESS}%)"
            )

    if ping_failures:
        banner("PIPELINE FAILED  -  ping pre-check did not pass")
        print(f"One or more routers cannot reach {target}, so Loopback3 was")
        print("NOT created on ANY device. Fix reachability and re-run the pipeline.\n")
        for item in ping_failures:
            print(f"  - {item}")
        print()
        disconnect_all(tb)
        sys.exit(1)

    print(f"\n  OK: every router reached {target}. Proceeding to Loopback3.")

    # ------------- STEP 2: create Loopback3 (duplicate-checked) -------------
    banner("STEP 2  Create Loopback3 on each router (skip if duplicate)")
    errors = []
    for name, loopbacks in plan.items():
        if name not in tb.devices:
            print(f"  [WARN] {name} is in the config but not in the testbed - skipping")
            continue
        dev = tb.devices[name]
        for lb in loopbacks:
            iface = lb["name"]
            ip = lb["ip"]
            mask = lb.get("mask", "255.255.255.255")

            exists, ip_owner = find_interface(dev, iface, ip)

            # ---- duplicate checks BEFORE creating anything ----
            if exists:
                print(f"  [SKIP] {name}: {iface} already exists (duplicate) - not re-creating")
                continue
            if ip_owner and ip_owner != iface:
                print(f"  [SKIP] {name}: {ip} already used by {ip_owner} (duplicate IP) - "
                      f"not creating {iface}")
                continue

            if args.dry_run:
                print(f"  [DRY ] {name}: would create {iface} with {ip} {mask}")
                continue

            print(f"  [CFG ] {name}: creating {iface} {ip} {mask}")
            dev.configure("\n".join([f"interface {iface}",
                                     f" ip address {ip} {mask}",
                                     "exit"]))
            save_config(dev)

            exists_after, _ = find_interface(dev, iface, ip)
            if exists_after:
                print(f"  [OK  ] {name}: verified {iface} has {ip}")
            else:
                print(f"  [ERROR] {name}: verification FAILED for {iface} {ip}")
                errors.append(f"{name}: {iface} {ip} failed verification")

    disconnect_all(tb)

    if errors:
        banner("PIPELINE FAILED  -  Loopback3 creation had problems")
        for item in errors:
            print(f"  - {item}")
        sys.exit(1)

    banner("SUCCESS  -  ping passed and Loopback3 is in place on all routers")


if __name__ == "__main__":
    main()
