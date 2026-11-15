"""
SHADOWTRACE - URL Scanner Service
Analyses URLs for phishing, malicious content, and threat indicators.
"""
import re
import hashlib
import logging
import ipaddress
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
import tldextract

logger = logging.getLogger(__name__)

# Suspicious TLDs commonly used in phishing
SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "club", "work", "click",
    "link", "online", "site", "website", "space", "live", "stream",
}

# Phishing keywords
PHISHING_KEYWORDS = [
    "login", "signin", "verify", "account", "secure", "update", "confirm",
    "banking", "paypal", "ebay", "amazon", "netflix", "apple", "microsoft",
    "google", "facebook", "instagram", "twitter", "password", "credential",
    "wallet", "crypto", "bitcoin", "urgent", "suspended", "limited",
    "verify-account", "account-verify", "secure-login",
]

# Legitimate domains to check impersonation
BRAND_DOMAINS = {
    "paypal": "paypal.com", "apple": "apple.com", "google": "google.com",
    "microsoft": "microsoft.com", "amazon": "amazon.com", "netflix": "netflix.com",
    "facebook": "facebook.com", "instagram": "instagram.com", "twitter": "twitter.com",
    "ebay": "ebay.com", "bank": None, "chase": "chase.com", "wellsfargo": "wellsfargo.com",
}


class URLScannerService:
    def __init__(self, vt_api_key: str = "", gsb_key: str = ""):
        self.vt_api_key = vt_api_key
        self.gsb_key = gsb_key

    async def scan(self, url: str) -> Dict[str, Any]:
        """Full URL scan pipeline."""
        findings: List[Dict[str, Any]] = []
        raw_results: Dict[str, Any] = {}
        risk_score = 0.0

        # 1. Validate & parse
        parsed = self._parse_url(url)
        if not parsed:
            return {
                "risk_score": 90.0,
                "risk_level": "critical",
                "findings": [{"type": "invalid_url", "severity": "critical",
                               "description": "URL is malformed or cannot be parsed."}],
                "raw_results": {},
            }

        raw_results["parsed"] = parsed

        # 2. Heuristic analysis
        heuristic_score, heuristic_findings = self._heuristic_analysis(url, parsed)
        risk_score += heuristic_score
        findings.extend(heuristic_findings)

        # 3. External checks (best-effort)
        if self.vt_api_key:
            vt_result = await self._check_virustotal(url)
            raw_results["virustotal"] = vt_result
            if vt_result.get("positives", 0) > 0:
                positives = vt_result["positives"]
                total = vt_result.get("total", 70)
                score_add = min(50.0, (positives / max(total, 1)) * 60)
                risk_score += score_add
                findings.append({
                    "type": "virustotal_detection",
                    "severity": "critical" if positives > 5 else "high",
                    "description": f"VirusTotal: {positives}/{total} engines flagged this URL as malicious.",
                    "source": "VirusTotal",
                })
        else:
            raw_results["virustotal"] = {"status": "no_api_key"}

        urlhaus_result = await self._check_urlhaus(url)
        raw_results["urlhaus"] = urlhaus_result
        if urlhaus_result.get("query_status") == "is_host":
            risk_score += 40.0
            findings.append({
                "type": "urlhaus_match",
                "severity": "critical",
                "description": f"URLhaus: Host is known to distribute malware. Tags: {urlhaus_result.get('tags', [])}",
                "source": "URLhaus",
            })

        risk_score = min(risk_score, 100.0)
        risk_level = self._score_to_level(risk_score)

        return {
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "findings": findings,
            "raw_results": raw_results,
        }

    def _parse_url(self, url: str) -> Optional[Dict[str, Any]]:
        try:
            if not url.startswith(("http://", "https://")):
                url = "http://" + url
            parsed = urlparse(url)
            extracted = tldextract.extract(url)
            return {
                "scheme": parsed.scheme,
                "domain": parsed.netloc,
                "path": parsed.path,
                "query": parsed.query,
                "subdomain": extracted.subdomain,
                "registered_domain": extracted.registered_domain,
                "suffix": extracted.suffix,
                "full_url": url,
            }
        except Exception:
            return None

    def _heuristic_analysis(self, url: str, parsed: Dict) -> tuple[float, List[Dict]]:
        score = 0.0
        findings = []
        domain = parsed.get("domain", "")
        registered = parsed.get("registered_domain", "")
        suffix = parsed.get("suffix", "")
        subdomain = parsed.get("subdomain", "")

        # IP-based URL
        try:
            host = domain.split(":")[0]
            ipaddress.ip_address(host)
            score += 25.0
            findings.append({
                "type": "ip_based_url",
                "severity": "high",
                "description": f"URL uses a raw IP address ({host}) instead of a domain — common in phishing.",
            })
        except ValueError:
            pass

        # Very long URL
        if len(url) > 100:
            added = min(15.0, (len(url) - 100) / 10)
            score += added
            findings.append({
                "type": "long_url",
                "severity": "medium",
                "description": f"URL length is {len(url)} characters — unusually long URLs are often used to obscure malicious destinations.",
            })

        # Suspicious TLD
        if suffix.split(".")[-1].lower() in SUSPICIOUS_TLDS:
            score += 15.0
            findings.append({
                "type": "suspicious_tld",
                "severity": "medium",
                "description": f"Top-level domain '.{suffix}' is associated with high abuse rates.",
            })

        # Phishing keywords in domain
        url_lower = url.lower()
        matched_keywords = [kw for kw in PHISHING_KEYWORDS if kw in url_lower]
        if matched_keywords:
            score += min(20.0, len(matched_keywords) * 5)
            findings.append({
                "type": "phishing_keywords",
                "severity": "high",
                "description": f"URL contains suspicious keywords: {', '.join(matched_keywords[:5])}",
            })

        # Brand impersonation
        for brand, legit_domain in BRAND_DOMAINS.items():
            if brand in url_lower and legit_domain and registered != legit_domain:
                score += 30.0
                findings.append({
                    "type": "brand_impersonation",
                    "severity": "critical",
                    "description": f"URL contains '{brand}' but domain is '{registered}', not '{legit_domain}' — possible impersonation.",
                })
                break

        # Excessive subdomains
        subdomain_parts = [s for s in subdomain.split(".") if s] if subdomain else []
        if len(subdomain_parts) > 3:
            score += 10.0
            findings.append({
                "type": "excessive_subdomains",
                "severity": "medium",
                "description": f"URL has {len(subdomain_parts)} subdomain levels — may be used to disguise malicious domains.",
            })

        # HTTP (not HTTPS)
        if parsed.get("scheme") == "http":
            score += 5.0
            findings.append({
                "type": "no_https",
                "severity": "low",
                "description": "URL uses unencrypted HTTP — credentials entered would be transmitted in plaintext.",
            })

        # Hex/encoded characters
        if re.search(r"%[0-9a-fA-F]{2}", url):
            score += 8.0
            findings.append({
                "type": "url_encoding",
                "severity": "medium",
                "description": "URL contains percent-encoded characters, which may be used to obfuscate the true destination.",
            })

        # Double slashes or unusual patterns
        if "//" in parsed.get("path", ""):
            score += 5.0
            findings.append({
                "type": "double_slash_path",
                "severity": "low",
                "description": "URL path contains double slashes — sometimes used to confuse URL parsers.",
            })

        return score, findings

    async def _check_virustotal(self, url: str) -> Dict[str, Any]:
        url_id = hashlib.sha256(url.encode()).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"https://www.virustotal.com/api/v3/urls/{url_id}",
                    headers={"x-apikey": self.vt_api_key},
                )
                if r.status_code == 200:
                    data = r.json()
                    stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
                    return {
                        "positives": stats.get("malicious", 0) + stats.get("suspicious", 0),
                        "total": sum(stats.values()),
                        "stats": stats,
                    }
        except Exception as e:
            logger.debug("VirusTotal check failed: %s", e)
        return {"positives": 0, "total": 0, "error": "check_failed"}

    async def _check_urlhaus(self, url: str) -> Dict[str, Any]:
        try:
            parsed = urlparse(url if url.startswith("http") else "http://" + url)
            host = parsed.hostname or ""
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.post(
                    "https://urlhaus-api.abuse.ch/v1/host/",
                    data={"host": host},
                )
                if r.status_code == 200:
                    return r.json()
        except Exception as e:
            logger.debug("URLhaus check failed: %s", e)
        return {"query_status": "no_results"}

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
