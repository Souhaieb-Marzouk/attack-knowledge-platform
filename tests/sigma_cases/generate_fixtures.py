#!/usr/bin/env python3
"""Generate realistic positive/negative log fixtures for every Sigma rule.

The fixtures are not production captures. They are realistic event shapes
(Sysmon, Windows Security, auditd/auth, CloudTrail, Entra ID, M365, Okta,
Zeek, pfSense, Apache, BIND) with values derived from each rule's detection
fields. Replace or extend them with exports from your own environment when
tuning; the harness in tests/test_sigma.py is schema-agnostic JSONL.

Run from the repo root:  python tests/sigma_cases/generate_fixtures.py
"""
import base64
import ipaddress
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
RULES = ROOT / "sigma" / "rules"
CASES = ROOT / "tests" / "sigma_cases"
THRESHOLDS = json.loads((CASES / "thresholds.json").read_text(encoding="utf-8"))

WINDOWS_NUMERIC = {"EventID", "LogonType", "DestinationPort", "SourcePort", "Port", "StatusCode"}


def selection_names(rule):
    det = rule.get("detection") or {}
    return [k for k in det if k != "condition" and not k.startswith("timeframe")]


def set_path(event, field, value):
    if field in event or "." not in field:
        event[field] = value
        return
    current = event
    parts = field.split(".")
    for part in parts[:-1]:
        if not isinstance(current.get(part), dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def base_event(rule):
    ls = rule.get("logsource") or {}
    product = str(ls.get("product", "")).lower()
    service = str(ls.get("service", "")).lower()
    category = str(ls.get("category", "")).lower()
    event = {
        "@timestamp": "2026-10-19T08:30:00Z",
        "host": "sensor-01",
        "user": "analyst",
        "sourcetype": service or category or product or "generic",
    }
    if product == "windows" and service == "sysmon":
        event.update({"Channel": "Microsoft-Windows-Sysmon/Operational", "EventID": 9999,
                      "Computer": "WIN-WS01", "UtcTime": "2026-10-19 08:30:00.000",
                      "User": "CORP\\alice", "Image": "C:\\Windows\\System32\\benign.exe",
                      "CommandLine": "benign.exe /help", "ParentImage": "C:\\Windows\\explorer.exe",
                      "ParentCommandLine": "explorer.exe"})
    elif product == "windows" and service == "security":
        event.update({"Channel": "Security", "EventID": 9999, "Computer": "WIN-DC01",
                      "SubjectUserName": "CORP\\alice", "TargetUserName": "CORP\\bob",
                      "IpAddress": "198.51.100.77", "LogonType": 3,
                      "ShareName": "\\\\*\\IPC$", "ServiceName": "BenignSvc",
                      "ProcessName": "C:\\Windows\\System32\\benign.exe",
                      "CommandLine": "benign.exe /help"})
    elif product == "windows" and service == "powershell":
        event.update({"Channel": "Microsoft-Windows-PowerShell/Operational", "EventID": 9999,
                      "Computer": "WIN-WS01", "ScriptBlockText": "Write-Host benign"})
    elif product == "windows" and service == "system":
        event.update({"Channel": "System", "EventID": 9999, "Computer": "WIN-DC01",
                      "ServiceName": "BenignSvc", "ImagePath": "C:\\Windows\\System32\\benign.exe"})
    elif product == "windows":
        event.update({"Channel": "Security", "EventID": 9999, "Computer": "WIN-WS01",
                      "User": "CORP\\alice", "Image": "C:\\Windows\\System32\\benign.exe",
                      "CommandLine": "benign.exe /help"})
    elif product == "linux" and service == "auditd":
        event.update({"type": "EXECVE", "hostname": "lnx-app01", "uid": 1000, "auid": 1000,
                      "exe": "/usr/bin/benign", "comm": "benign", "a0": "benign",
                      "syscall": "execve", "key": "exec"})
    elif product == "linux":
        event.update({"event_type": "auth", "hostname": "lnx-app01", "src_ip": "198.51.100.77",
                      "user": "deploy", "message": "Accepted publickey for deploy from 198.51.100.77",
                      "program": "sshd"})
    elif product == "aws" or category == "cloud":
        event.update({"eventSource": "s3.amazonaws.com", "eventName": "ListBuckets",
                      "awsRegion": "eu-west-1", "sourceIPAddress": "198.51.100.77",
                      "userAgent": "aws-cli/2.17.0",
                      "userIdentity": {"type": "IAMUser", "arn": "arn:aws:iam::123456789012:user/benign",
                                       "accountId": "123456789012", "userName": "benign"},
                      "requestParameters": {"bucketName": "benign-bucket"},
                      "responseElements": {}})
    elif product == "azure":
        event.update({"category": "SignInLogs", "properties": {
            "status": {"errorCode": 0}, "authenticationRequirement": "multiFactorAuthentication",
            "location": {"countryOrRegion": "ZZ"}, "userPrincipalName": "benign@example.com",
            "ipAddress": "198.51.100.77", "appDisplayName": "Office 365"}})
    elif product == "m365":
        event.update({"Operation": "BenignOperation", "UserId": "benign@example.com",
                      "ClientIP": "198.51.100.77", "ModifiedProperties": [],
                      "Workload": "Exchange"})
    elif product == "okta":
        event.update({"eventType": "user.session.start",
                      "actor": {"displayName": "benign@example.com", "alternateId": "benign@example.com"},
                      "client": {"ipAddress": "198.51.100.77"}, "outcome": {"result": "SUCCESS"}})
    elif product in ("zeek",) or category == "dns":
        event.update({"id": {"orig_h": "198.51.100.77", "resp_h": "192.0.2.53", "resp_p": 53},
                      "query": "benign.example.com", "qtype_name": "A", "rcode_name": "NOERROR",
                      "proto": "udp", "ts": 1792398600.0})
    elif category == "network" or product == "zeek":
        event.update({"id": {"orig_h": "198.51.100.77", "resp_h": "192.0.2.10", "resp_p": 443},
                      "orig_bytes": 100, "resp_bytes": 200, "conn_state": "SF", "proto": "tcp"})
    elif category == "firewall" or product in ("pfsense", "fortinet", "fortios", "fortigate"):
        event.update({"src_ip": "198.51.100.77", "dst_ip": "192.0.2.10", "dst_port": 443,
                      "action": "allow", "proto": "tcp", "rule": "default"})
    elif category == "webserver" or product in ("apache", "f5_bigip"):
        event.update({"client_ip": "198.51.100.77", "request": "GET / HTTP/1.1", "status": 200,
                      "bytes": 100, "user_agent": "curl/8.5.0", "method": "GET", "path": "/"})
    elif product == "bind":
        event.update({"client": "198.51.100.77", "query": "benign.example.com", "rcode": "NOERROR"})
    else:
        event.update({"src_ip": "198.51.100.77", "dst_ip": "192.0.2.10", "user": "benign",
                      "message": "benign event"})
    return event


def numeric(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    text = str(value)
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)
    return value


def chosen_value(field, value, modifiers):
    mods = [m.lower() for m in modifiers]
    if isinstance(value, list) and "all" in mods and any(m in mods for m in ("contains", "startswith", "endswith")):
        text = " ".join(str(v) for v in value)
        value = text
    elif isinstance(value, list):
        value = value[0]
    text = str(value)
    if "exists" in mods:
        return True
    if "base64" in mods:
        return base64.b64encode(text.encode()).decode()
    if "contains" in mods:
        return "benign-prefix " + text + " benign-suffix"
    if "startswith" in mods:
        return text + "-benign-suffix"
    if "endswith" in mods:
        return "benign-prefix-" + text
    if "cidr" in mods:
        try:
            return str(ipaddress.ip_network(text, strict=False)[0])
        except ValueError:
            return text
    if "re" in mods:
        sample = re.sub(r"\\[a-zA-Z]", "", text)
        sample = re.sub(r"[\.\^\$\*\+\?\[\]\(\)\{\}\|]", "", sample)
        return sample or "sample"
    if "gt" in mods:
        return str(int(float(text)) + 1)
    if "gte" in mods:
        return text
    if "lt" in mods:
        return str(int(float(text)) - 1)
    if "lte" in mods:
        return text
    return numeric(value)


def apply_selection(event, selection):
    if isinstance(selection, list):
        event["message"] = " ".join(str(x) for x in selection)
        return
    for key, value in selection.items():
        parts = key.split("|")
        field = parts[0]
        set_path(event, field, chosen_value(field, value, parts[1:]))


def nonmatching_value(field, value, modifiers):
    if isinstance(value, list):
        value = value[0]
    mods = [m.lower() for m in modifiers]
    if "exists" in mods:
        return None
    if field in WINDOWS_NUMERIC or re.fullmatch(r"-?\d+", str(value)):
        return 424242
    text = str(value)
    if "contains" in mods or "startswith" in mods or "endswith" in mods:
        return "benign-value"
    if "cidr" in mods:
        return "203.0.113.250"
    return "benign-" + text[:40]


def make_nonmatching(event, selection):
    if isinstance(selection, list):
        event["message"] = "benign event"
        return
    for key, value in selection.items():
        parts = key.split("|")
        field = parts[0]
        new = nonmatching_value(field, value, parts[1:])
        if new is None:
            event.pop(field, None)
        else:
            set_path(event, field, new)


def _merge_value(field, constraints):
    """Build one field value that satisfies every constraint on that field."""
    exact = []
    prefix = None
    suffix = None
    contains = []
    regex = None
    for mods, expected in constraints:
        mods = [m.lower() for m in mods]
        values = expected if isinstance(expected, list) else [expected]
        if "all" in mods and values:
            values = [values]
        if "re" in mods:
            regex = str(values[0])
        elif "startswith" in mods:
            prefix = str(values[0])
        elif "endswith" in mods:
            suffix = str(values[0])
        elif "contains" in mods:
            contains.extend(str(v) for v in values)
        elif "exists" not in mods:
            exact.extend(str(v) for v in values)

    if exact and not (prefix or suffix or contains or regex):
        return numeric(exact[0]) if len(exact) == 1 else exact[0]

    if regex:
        if "\\d" in regex or "\\." in regex:
            return "203.0.113.50"
        sample = re.sub(r"\\[a-zA-Z]", "", regex)
        sample = re.sub(r"[\.\^\$\*\+\?\[\]\(\)\{\}\|]", "", sample)
        return sample or "sample"

    if field == "qname" or field.endswith(".qname"):
        return (prefix or (contains[0] if contains else "vpn.")) + (suffix.lstrip(".") if suffix else "example.com")
    if field in ("Image", "TargetFilename", "ParentImage"):
        base = "C:\\Users\\alice\\"
        if contains:
            base += contains[0].strip("\\") + "\\"
        name = "sample.exe"
        if suffix and suffix.startswith("."):
            name = "sample" + suffix
        elif suffix:
            name = suffix.lstrip("\\")
        return base + name
    return (prefix or "") + (" ".join(contains) if contains else "") + (suffix or "sample")


def _apply_merged(event, rule, names):
    constraints = {}
    for name in names:
        selection = rule["detection"][name]
        if isinstance(selection, list):
            event["message"] = " ".join(str(x) for x in selection)
            continue
        for key, value in selection.items():
            parts = key.split("|")
            constraints.setdefault(parts[0], []).append((parts[1:], value))
    for field, cons in constraints.items():
        set_path(event, field, _merge_value(field, cons))


def positive_events(rule, threshold):
    names = selection_names(rule)
    condition = str((rule.get("detection") or {}).get("condition", ""))
    events = []

    if threshold and threshold.get("kind") == "near":
        wanted = [n for n in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", condition)
                  if n in names]
        for name in wanted:
            event = base_event(rule)
            apply_selection(event, (rule["detection"])[name])
            events.append(event)
        return events or [base_event(rule)]

    if threshold and threshold.get("kind") in ("count", "sum"):
        count = threshold.get("value", 1) + 2 if threshold["kind"] == "count" else 2
        for i in range(max(1, count)):
            event = base_event(rule)
            for name in names:
                if not name.startswith("filter"):
                    apply_selection(event, rule["detection"][name])
            for group in threshold.get("group_by", []):
                if not field_present(event, group):
                    set_path(event, group, "203.0.113.50")
            if threshold["kind"] == "sum":
                set_path(event, threshold.get("field", "bytes"), (threshold.get("value", 1) + 1) if i == 0 else 0)
            events.append(event)
        return events

    wanted = [n for n in names if not n.startswith("filter")]
    wildcard = re.search(r"\b1\s+of\s+([A-Za-z0-9_]*\*)", condition)
    if wildcard:
        pattern = wildcard.group(1).replace("*", ".*")
        required = [n for n in wanted if not re.fullmatch(pattern, n)]
        choices = [n for n in wanted if re.fullmatch(pattern, n)]
        wanted = required + choices[:1]
    elif re.search(r"\b1\s+of\b", condition):
        wanted = wanted[:1]
    elif re.search(r"\bor\b", condition) and not re.search(r"\band\b", condition):
        wanted = wanted[:1]

    event = base_event(rule)
    _apply_merged(event, rule, wanted)
    events.append(event)
    return events


def field_present(event, field):
    current = event
    for part in field.split("."):
        if not isinstance(current, dict) or part not in current:
            return False
        current = current[part]
    return True


def negative_events(rule, threshold):
    if threshold and threshold.get("kind") == "near":
        condition = str((rule.get("detection") or {}).get("condition", ""))
        wanted = [n for n in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", condition)
                  if n in selection_names(rule)]
        event = base_event(rule)
        if wanted:
            apply_selection(event, rule["detection"][wanted[0]])
        return [event]

    if threshold and threshold.get("kind") in ("count", "sum"):
        # Below-threshold count: enough matching events to be realistic but
        # below the rule's threshold, plus one benign event. For a sum rule the
        # number of events is not the threshold value: one zero-byte event is
        # enough to stay below a byte-volume threshold.
        n = 1 if threshold.get("kind") == "sum" else max(0, threshold.get("value", 1) - 1)
        events = []
        for i in range(n):
            event = base_event(rule)
            for name in selection_names(rule):
                if not name.startswith("filter"):
                    apply_selection(event, rule["detection"][name])
            for group in threshold.get("group_by", []):
                set_path(event, group, "203.0.113.50")
            if threshold["kind"] == "sum":
                set_path(event, threshold.get("field", "bytes"), 0)
            events.append(event)
        for name in selection_names(rule):
            if not name.startswith("filter"):
                event = base_event(rule)
                make_nonmatching(event, rule["detection"][name])
                events.append(event)
                break
        return events

    event = base_event(rule)
    for name in selection_names(rule):
        if not name.startswith("filter"):
            make_nonmatching(event, rule["detection"][name])
            break
    return [event]


def write_jsonl(path, events):
    path.write_text("\n".join(json.dumps(e, ensure_ascii=False, sort_keys=True) for e in events) + "\n", encoding="utf-8")


def main():
    index = json.loads((CASES / "index.json").read_text(encoding="utf-8"))
    by_file = {item["file"]: item for item in index}
    # A time-ordered create/delete pair is a correlation, not one event.
    near_file = "sigma/rules/t1021.008-instance-connect-endpoint-deleted-and-recreated-within-24h.yml"
    if near_file in by_file:
        THRESHOLDS[near_file] = {"kind": "near", "original_condition": "selection_create and selection_delete"}
    generated = 0
    for rule_path in sorted(RULES.glob("*.yml")):
        print("processing", rule_path.name, flush=True)
        rule = yaml.safe_load(rule_path.read_text(encoding="utf-8"))
        rel = rule_path.relative_to(ROOT).as_posix()
        case_dir = CASES / rule_path.stem
        case_dir.mkdir(parents=True, exist_ok=True)
        threshold = THRESHOLDS.get(rel)
        pos = positive_events(rule, threshold)
        neg = negative_events(rule, threshold)
        write_jsonl(case_dir / "positive.jsonl", pos)
        write_jsonl(case_dir / "negative.jsonl", neg)
        item = by_file.get(rel, {"file": rel, "id": rule.get("id"), "title": rule.get("title"),
                                 "technique": "", "guide": ""})
        item["rule"] = rel
        item["positive"] = f"tests/sigma_cases/{rule_path.stem}/positive.jsonl"
        item["negative"] = f"tests/sigma_cases/{rule_path.stem}/negative.jsonl"
        by_file[rel] = item
        generated += 1
    # preserve only current rules, sorted
    ordered = [by_file[p.relative_to(ROOT).as_posix()] for p in sorted(RULES.glob("*.yml"))]
    (CASES / "index.json").write_text(json.dumps(ordered, indent=2) + "\n", encoding="utf-8")
    (CASES / "thresholds.json").write_text(json.dumps(THRESHOLDS, indent=2) + "\n", encoding="utf-8")
    print(f"generated fixtures for {generated} rules")


if __name__ == "__main__":
    main()
