"""
SHADOWTRACE - IP Address Scanner Service
Validates, geolocates, and assesses reputation of IP addresses.
"""
import ipaddress
import logging
import socket
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# Known malicious/suspicious ASN prefixes (illustrative)
SUSPICIOUS_ASNS = {
    "AS9009", "AS206092", "AS60068", "AS57523",  # common bullet-proof hosting
}

PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


class IPScannerService:
    def __init__(self, abuseipdb_key: str = ""):
        self.abuseipdb_key = abuseipdb_key

    async def scan(self, ip_str: str) -> Dict[str, Any]:
        findings: List[Dict[str, Any]] = []
        raw_results: Dict[str, Any] = {}
        risk_score = 0.0

        # Validate IP
        try:
            ip_obj = ipaddress.ip_address(ip_str.strip())
        except ValueError:
            return {
                "risk_score": 85.0,
                "risk_level": "critical",
                "findings": [{"type": "invalid_ip", "severity": "critical",
                               "description": f"'{ip_str}' is not a valid IP address."}],
                "raw_results": {},
            }

        raw_results["ip"] = str(ip_obj)
        raw_results["version"] = ip_obj.version

        # Check IP type
        ip_type, type_findings = self._classify_ip(ip_obj)
        raw_results["ip_type"] = ip_type
        findings.extend(type_findings)

        if ip_type == "private":
            return {
                "risk_score": 0.0,
                "risk_level": "safe",
                "findings": [{"type": "private_ip", "severity": "info",
                               "description": f"{ip_str} is a private/internal IP address."}],
                "raw_results": raw_results,
            }

        # Geolocation
        geo = await self._geolocate(str(ip_obj))
        raw_results["geolocation"] = geo
        if geo.get("country_code") in {"CN", "RU", "KP", "IR"}:
            score_add = 10.0
            risk_score += score_add
            findings.append({
                "type": "high_risk_country",
                "severity": "medium",
                "description": f"IP is geolocated to {geo.get('country', 'unknown')} — a country commonly associated with elevated threat activity.",
                "indicator": geo.get("country_code"),
            })

        # Reverse DNS
        rdns = self._reverse_dns(str(ip_obj))
        raw_results["reverse_dns"] = rdns

        # AbuseIPDB check
        if self.abuseipdb_key:
            abuse = await self._check_abuseipdb(str(ip_obj))
            raw_results["abuseipdb"] = abuse
            abuse_score = abuse.get("abuseConfidenceScore", 0)
            if abuse_score > 0:
                score_add = min(60.0, abuse_score * 0.7)
                risk_score += score_add
                severity = "critical" if abuse_score > 75 else "high" if abuse_score > 40 else "medium"
                findings.append({
                    "type": "abuseipdb_report",
                    "severity": severity,
                    "description": f"AbuseIPDB confidence score: {abuse_score}% — reported {abuse.get('totalReports', 0)} times.",
                    "source": "AbuseIPDB",
                })
        else:
            raw_results["abuseipdb"] = {"status": "no_api_key"}

        # Hosting/datacenter check via ip-api
        if geo.get("hosting"):
            risk_score += 10.0
            findings.append({
                "type": "hosting_provider",
                "severity": "low",
                "description": "IP belongs to a hosting/datacenter provider — may indicate server infrastructure rather than a user endpoint.",
            })

        # Proxy/VPN/Tor detection
        if geo.get("proxy") or geo.get("tor"):
            risk_score += 25.0
            findings.append({
                "type": "anonymizer",
                "severity": "high",
                "description": "IP is associated with a VPN, proxy, or Tor exit node — commonly used to mask identity.",
            })

        risk_score = min(risk_score, 100.0)
        risk_level = self._score_to_level(risk_score)

        return {
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "findings": findings,
            "raw_results": raw_results,
        }

    def _classify_ip(self, ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> tuple[str, List[Dict]]:
        findings = []
        for net in PRIVATE_RANGES:
            if ip in net:
                return "private", findings
        if ip.is_loopback:
            return "loopback", findings
        if ip.is_multicast:
            findings.append({"type": "multicast_ip", "severity": "info",
                              "description": "IP is a multicast address."})
            return "multicast", findings
        if ip.is_reserved:
            return "reserved", findings
        return "public", findings

    async def _geolocate(self, ip: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(
                    f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,region,regionName,city,isp,org,as,hosting,proxy,query"
                )
                if r.status_code == 200:
                    data = r.json()
                    if data.get("status") == "success":
                        return data
        except Exception as e:
            logger.debug("Geolocation failed: %s", e)
        return {}

    def _reverse_dns(self, ip: str) -> Optional[str]:
        try:
            return socket.gethostbyaddr(ip)[0]
        except Exception:
            return None

    async def _check_abuseipdb(self, ip: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    "https://api.abuseipdb.com/api/v2/check",
                    params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": True},
                    headers={"Key": self.abuseipdb_key, "Accept": "application/json"},
                )
                if r.status_code == 200:
                    return r.json().get("data", {})
        except Exception as e:
            logger.debug("AbuseIPDB check failed: %s", e)
        return {}

    def _score_to_level(self, score: float) -> str:
        if score >= 75:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 25:
            return "medium"
        elif score >= 10:
            return "low"
        return "safe"
