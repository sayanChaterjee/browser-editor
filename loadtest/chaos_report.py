"""Summarises k6 JSON output per chaos phase: requests, failures and p95 per endpoint.

Usage: python3 chaos_report.py phases.csv k6-a.json [k6-b.json ...]
A request fails when k6 marks it unexpected (expected_response=false), i.e. not a
2xx/3xx or an explicitly expected status such as 404 for "no active contest".
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import datetime

LABELS = {
    'baseline': 'Baseline',
    'kafka-down': 'Kafka down',
    'kafka-up': 'Kafka recovered',
    'redis-down': 'Redis down',
    'redis-up': 'Redis recovered',
    'contest-down': 'contest-service down',
    'contest-up': 'contest-service recovered',
    'identity-down': 'identity-service down',
    'identity-up': 'identity-service recovered',
}
ENDPOINTS = ['contest_active', 'profile', 'projects', 'project', 'save']


def p95(values):
    if not values:
        return None
    values = sorted(values)
    return values[min(len(values) - 1, int(round(0.95 * (len(values) - 1))))]


def main(phases_file, *k6_files):
    with open(phases_file) as f:
        marks = [(row['phase'], float(row['epoch'])) for row in csv.DictReader(f)]
    windows = [(name, start, marks[i + 1][1]) for i, (name, start) in enumerate(marks[:-1])]

    stats = defaultdict(lambda: {'n': 0, 'failed': 0, 'durations': [], 'statuses': defaultdict(int)})
    # Per-second failures after each recovery, to time how long errors lasted
    fail_seconds = defaultdict(set)

    for path in k6_files:
        with open(path) as f:
            for line in f:
                point = json.loads(line)
                if point.get('type') != 'Point' or point.get('metric') != 'http_req_duration':
                    continue
                tags = point['data'].get('tags', {})
                endpoint = tags.get('endpoint')
                if endpoint not in ENDPOINTS:
                    continue
                t = datetime.fromisoformat(point['data']['time']).timestamp()
                for name, start, end in windows:
                    if start <= t < end:
                        s = stats[(name, endpoint)]
                        s['n'] += 1
                        s['durations'].append(point['data']['value'])
                        s['statuses'][tags.get('status', '?')] += 1
                        if tags.get('expected_response') == 'false':
                            s['failed'] += 1
                            fail_seconds[name].add(int(t - start))
                        break

    print('| Phase | Endpoint | Requests | Failed | p95 | Statuses |')
    print('|---|---|---|---|---|---|')
    for name, start, end in windows:
        for endpoint in ENDPOINTS:
            s = stats.get((name, endpoint))
            if not s or s['n'] == 0:
                continue
            rate = 100 * s['failed'] / s['n']
            statuses = ', '.join(f'{k}×{v}' for k, v in sorted(s['statuses'].items()))
            print(f"| {LABELS.get(name, name)} ({end - start:.0f}s) | {endpoint} | {s['n']} | "
                  f"{s['failed']} ({rate:.1f}%) | {p95(s['durations']):.0f} ms | {statuses} |")

    print()
    for name, _, _ in windows:
        if name.endswith('-up') and fail_seconds[name]:
            print(f'- {LABELS[name]}: last failure {max(fail_seconds[name])}s after the restart')
        elif name.endswith('-up'):
            print(f'- {LABELS[name]}: no failures after the restart')


if __name__ == '__main__':
    main(*sys.argv[1:])
