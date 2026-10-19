#!/usr/bin/env python3
"""Small, dependency-free Sigma evaluator used by the log-based test suite.

It supports the subset of Sigma used by this library: field modifiers
(contains, startswith, endswith, all, re, cidr, numeric comparisons), simple
boolean conditions, `1 of` / `all of` wildcards, and the count/sum/near
metadata stored in tests/sigma_cases/thresholds.json.
"""
import ipaddress
import json
import re
from pathlib import Path

import yaml

WINDOWS_FIELDS = {
    "EventID", "Channel", "Computer", "Image", "CommandLine", "ParentImage",
    "ParentCommandLine", "User", "TargetUserName", "SubjectUserName",
    "IpAddress", "LogonType", "ShareName", "ServiceName", "ProcessName",
    "DestinationIp", "DestinationPort", "TargetFilename", "TargetObject",
    "Details", "SourceImage", "TargetImage", "GrantedAccess", "ScriptBlockText",
}


def load_rule(path):
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: not a Sigma rule mapping")
    return data


def flatten(value):
    if isinstance(value, list):
        return [item for sub in value for item in flatten(sub)]
    if isinstance(value, dict):
        return [json.dumps(value, sort_keys=True)]
    return [value]


def field_values(event, field):
    if field in event:
        return flatten(event[field])
    current = event
    for part in field.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return []
    return flatten(current)


def as_text(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def compare(actual, expected, modifiers):
    actual_s = as_text(actual)
    expected_s = as_text(expected)
    lowered = [m.lower() for m in modifiers]

    if "exists" in lowered:
        exists = bool(actual_s)
        return exists is bool(expected)
    if "contains" in lowered:
        return expected_s.casefold() in actual_s.casefold()
    if "startswith" in lowered:
        return actual_s.casefold().startswith(expected_s.casefold())
    if "endswith" in lowered:
        return actual_s.casefold().endswith(expected_s.casefold())
    if "re" in lowered:
        try:
            return re.search(expected_s, actual_s, re.I) is not None
        except re.error:
            return False
    if "cidr" in lowered:
        try:
            return ipaddress.ip_address(actual_s) in ipaddress.ip_network(expected_s, strict=False)
        except ValueError:
            return False
    if "windash" in lowered:
        return actual_s.replace("/", "-").casefold() == expected_s.replace("/", "-").casefold()
    if "gt" in lowered or "gte" in lowered or "lt" in lowered or "lte" in lowered:
        try:
            a, b = float(actual_s), float(expected_s)
        except ValueError:
            return False
        if "gt" in lowered:
            return a > b
        if "gte" in lowered:
            return a >= b
        if "lt" in lowered:
            return a < b
        return a <= b
    return actual_s.casefold() == expected_s.casefold()


def match_selection(event, selection):
    if isinstance(selection, list):
        blob = " ".join(as_text(v) for v in walk_scalars(event))
        return all(str(term).casefold() in blob.casefold() for term in selection)
    if not isinstance(selection, dict):
        return False
    for key, expected in selection.items():
        parts = key.split("|")
        field = parts[0]
        modifiers = parts[1:]
        actual_values = field_values(event, field)
        if not actual_values:
            if "exists" in [m.lower() for m in modifiers] and not expected:
                continue
            return False
        expected_values = expected if isinstance(expected, list) else [expected]
        results = [any(compare(a, e, modifiers) for a in actual_values) for e in expected_values]
        if "all" in [m.lower() for m in modifiers]:
            if not all(results):
                return False
        else:
            if not any(results):
                return False
    return True


def walk_scalars(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from walk_scalars(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_scalars(item)
    else:
        yield value


def selection_names(rule):
    det = rule.get("detection") or {}
    return [k for k in det if k != "condition" and not k.startswith("timeframe")]


def condition_names(condition):
    return [n for n in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", condition)
            if n.lower() not in ("and", "or", "not", "of", "them")]


def expand_quantifiers(condition, names):
    def repl(match):
        quant, target = match.group(1).lower(), match.group(2)
        if target == "them":
            chosen = names
        else:
            pattern = target.replace("*", ".*")
            chosen = [n for n in names if re.fullmatch(pattern, n)]
        if not chosen:
            return "False"
        return ("any" if quant == "1" else "all") + "([" + ",".join(chosen) + "])"

    return re.sub(r"\b(1|all)\s+of\s+([A-Za-z0-9_*]+)", repl, condition, flags=re.I)


def eval_condition(condition, rule, event):
    values = {name: match_selection(event, (rule.get("detection") or {}).get(name)) for name in selection_names(rule)}
    expr = expand_quantifiers(str(condition), list(values))
    try:
        return bool(eval(expr, {"__builtins__": {"any": any, "all": all}}, values))
    except Exception:
        return False


def rule_matches(rule, event):
    det = rule.get("detection") or {}
    condition = det.get("condition")
    if isinstance(condition, list):
        return any(eval_condition(c, rule, event) for c in condition)
    if not condition:
        return False
    return eval_condition(condition, rule, event)


def grouped(events, group_by):
    buckets = {}
    for event in events:
        if not all(field_values(event, field) for field in group_by):
            continue
        key = tuple(as_text(field_values(event, field)[0]) for field in group_by)
        buckets.setdefault(key, []).append(event)
    return buckets


def compare_threshold(value, operator, target):
    if operator == ">":
        return value > target
    if operator == ">=":
        return value >= target
    if operator == "<":
        return value < target
    if operator == "<=":
        return value <= target
    return value == target


def evaluate_case(rule, events, threshold=None):
    """Return (matched, detail)."""
    if threshold and threshold.get("kind") == "near":
        base = str((rule.get("detection") or {}).get("condition", ""))
        names = [n for n in condition_names(base) if n in selection_names(rule)]
        hits = {name: any(match_selection(e, (rule.get("detection") or {})[name]) for e in events) for name in names}
        return all(hits.values()), {"near": hits}

    if threshold and threshold.get("kind") in ("count", "sum"):
        base = str((rule.get("detection") or {}).get("condition", ""))
        matching = [e for e in events if eval_condition(base, rule, e)]
        group_by = threshold.get("group_by") or []
        buckets = grouped(matching, group_by) if group_by else {(): matching}
        results = {}
        for key, bucket in buckets.items():
            if threshold["kind"] == "count":
                value = len(bucket)
            else:
                field = threshold.get("field", "")
                value = sum(float(field_values(e, field)[0]) for e in bucket if field_values(e, field))
            results[key] = value
            if compare_threshold(value, threshold.get("operator", ">"), threshold.get("value", 0)):
                return True, {"buckets": results}
        return False, {"buckets": results}

    for event in events:
        if rule_matches(rule, event):
            return True, {}
    return False, {}
