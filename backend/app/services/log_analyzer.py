"""
SHADOWTRACE - Log Analysis Service
Parses uploaded log files, extracts security events and IOCs.
"""
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Regex patterns for extraction
IP_PATTERN = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)
TIMESTAMP_PATTERNS = [
    re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"),
    re.compile(r"\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}"),
    re.compile(r"\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2}"),
]
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+")
CVE_PATTERN = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)
HASH_PATTERN = re.compile(r"\b[a-fA-F0-9]{32,64}\b")

# Attack detection rules: (name, regex, severity)
DETECTION_RULES: List[Tuple[str, re.Pattern, str]] = [
    ("Failed Login", re.compile(r"(?i)(failed|failure|invalid|bad)\s+(password|login|auth|credential)", re.IGNORECASE), "medium"),
    ("Brute Force Attempt", re.compile(r"(?i)too many (failed|invalid|incorrect) (login|auth|password) attempts", re.IGNORECASE), "high"),
    ("SQL Injection", re.compile(r"(?i)(union\s+select|drop\s+table|insert\s+into|'--|\bOR\s+1=1\b|'=\'|SELECT\s+\*\s+FROM)", re.IGNORECASE), "critical"),
    ("XSS Attempt", re.compile(r"(?i)(<script[^>]*>|javascript:|onerror\s*=|onload\s*=|eval\()", re.IGNORECASE), "high"),
    ("Path Traversal", re.compile(r"(?i)(\.\./|\.\.\\|%2e%2e%2f|%252e%252e%252f)", re.IGNORECASE), "high"),
    ("Command Injection", re.compile(r"(?i)(\|\s*sh|\|\s*bash|\|\s*cmd|;\s*rm\s+-rf|`[^`]+`)", re.IGNORECASE), "critical"),
    ("Privilege Escalation", re.compile(r"(?i)(sudo|su\s+-|chmod\s+[0-7]{3,4}|chown\s+root|setuid)", re.IGNORECASE), "medium"),
    ("Suspicious User Agent", re.compile(r"(?i)(sqlmap|nikto|nmap|masscan|metasploit|dirbuster|gobuster|burpsuite|havij)", re.IGNORECASE), "high"),
    ("Data Exfiltration", re.compile(r"(?i)(wget|curl|base64|/dev/tcp|nc\s+-e|netcat)", re.IGNORECASE), "high"),
    ("Malware Execution", re.compile(r"(?i)(powershell\s+-enc|cmd\.exe\s+/c|mshta|regsvr32|certutil\s+-decode|rundll32)", re.IGNORECASE), "critical"),
    ("Port Scan", re.compile(r"(?i)(SYN_SENT|port\s+scan|nmap)", re.IGNORECASE), "medium"),
    ("Account Lockout", re.compile(r"(?i)(account\s+locked|lockout|access\s+denied\s+.*user)", re.IGNORECASE), "medium"),
    ("Authentication Success", re.compile(r"(?i)(accepted\s+password|authentication\s+success|logged\s+in\s+successfully|session\s+opened)", re.IGNORECASE), "info"),
]


class LogAnalyzerService:
    async def analyse(self, file_path: str, filename: str, file_type: str) -> Dict[str, Any]:
        """Main analysis entry point."""
        lines = self._read_file(file_path, file_type)
        if not lines:
            return {"error": "Could not read or parse the uploaded log file."}

        findings: List[Dict[str, Any]] = []
        extracted_indicators: Dict[str, Dict[str, Any]] = {}
        severity_counts: Dict[str, int] = {
            "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0
        }

        for line_num, line in enumerate(lines, 1):
            line_str = str(line).strip()
            if not line_str:
                continue

            # Extract timestamp
            ts = self._extract_timestamp(line_str)

            # Run detection rules
            for rule_name, pattern, severity in DETECTION_RULES:
                if pattern.search(line_str):
                    findings.append({
                        "id": f"finding-{len(findings)+1}",
                        "line": line_num,
                        "timestamp": ts,
                        "event_type": rule_name,
                        "severity": severity,
                        "description": self._describe_finding(rule_name, line_str),
                        "raw_line": line_str[:500],
                    })
                    severity_counts[severity] = severity_counts.get(severity, 0) + 1

            # Extract IOCs
            self._extract_iocs(line_str, extracted_indicators)

        # Format indicators
        indicators_list = [
            {"type": k[0], "value": k[1], "occurrences": v["count"],
             "context": v["sample"][:200]}
            for k, v in extracted_indicators.items()
        ]
        indicators_list.sort(key=lambda x: x["occurrences"], reverse=True)

        return {
            "filename": filename,
            "total_lines": len(lines),
            "total_events": len(findings),
            "findings": findings[:200],  # Cap at 200 findings
            "extracted_indicators": indicators_list[:100],
            "severity_breakdown": severity_counts,
        }

    def _read_file(self, file_path: str, file_type: str) -> List[Any]:
        path = Path(file_path)
        try:
            if file_type in ("json", "application/json"):
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    return [json.dumps(item) if isinstance(item, dict) else str(item) for item in data]
                return [json.dumps(data)]
            else:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    return f.readlines()
        except Exception as e:
            logger.error("Failed to read log file: %s", e)
            return []

    def _extract_timestamp(self, line: str) -> Optional[str]:
        for pattern in TIMESTAMP_PATTERNS:
            m = pattern.search(line)
            if m:
                return m.group(0)
        return None

    def _describe_finding(self, rule_name: str, line: str) -> str:
        descriptions = {
            "Failed Login": "Failed authentication attempt detected.",
            "Brute Force Attempt": "Multiple consecutive failed logins — possible brute force attack.",
            "SQL Injection": "SQL injection payload detected in log entry.",
            "XSS Attempt": "Cross-site scripting (XSS) payload detected.",
            "Path Traversal": "Directory traversal attempt detected — attacker may be trying to access restricted files.",
            "Command Injection": "OS command injection attempt detected.",
            "Privilege Escalation": "Privilege escalation activity detected.",
            "Suspicious User Agent": "Scanning or exploitation tool user-agent detected.",
            "Data Exfiltration": "Potential data exfiltration command detected.",
            "Malware Execution": "Suspicious process execution pattern — possible malware activity.",
            "Port Scan": "Port scanning activity detected.",
            "Account Lockout": "Account lockout event detected.",
            "Authentication Success": "Successful authentication event.",
        }
        base = descriptions.get(rule_name, f"{rule_name} event detected.")
        # Append extracted IPs if any
        ips = IP_PATTERN.findall(line)[:2]
        if ips:
            base += f" Source IP(s): {', '.join(ips)}"
        return base

    def _extract_iocs(self, line: str, indicators: Dict):
        for ip in IP_PATTERN.findall(line):
            if not ip.startswith(("127.", "0.", "255.")):
                key = ("ip", ip)
                if key not in indicators:
                    indicators[key] = {"count": 0, "sample": line}
                indicators[key]["count"] += 1

        for email in EMAIL_PATTERN.findall(line):
            key = ("email", email)
            if key not in indicators:
                indicators[key] = {"count": 0, "sample": line}
            indicators[key]["count"] += 1

        for url in URL_PATTERN.findall(line):
            key = ("url", url[:200])
            if key not in indicators:
                indicators[key] = {"count": 0, "sample": line}
            indicators[key]["count"] += 1

        for cve in CVE_PATTERN.findall(line):
            key = ("cve", cve.upper())
            if key not in indicators:
                indicators[key] = {"count": 0, "sample": line}
            indicators[key]["count"] += 1
