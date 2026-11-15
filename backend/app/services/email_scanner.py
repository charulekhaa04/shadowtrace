"""
SHADOWTRACE - Email Scanner Service
Analyses email addresses for phishing, spoofing, and reputation indicators.
"""
import logging
import re
from typing import Any, Dict, List, Optional

import dns.resolver
import httpx

logger = logging.getLogger(__name__)

FREE_EMAIL_PROVIDERS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
    "icloud.com", "protonmail.com", "tutanota.com", "zoho.com", "aol.com",
    "mail.com", "yandex.com", "gmx.com", "inbox.com",
}

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "throwaway.email", "sharklasers.com", "guerrillamailblock.com", "grr.la",
    "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net",
    "guerrillamail.org", "spam4.me", "yopmail.com", "dispostable.com", "mailnull.com",
    "maildrop.cc", "trashmail.com", "fakeinbox.com", "discard.email",
}

PHISHING_PATTERNS = [
    r"(?i)(paypal|apple|amazon|microsoft|google|netflix|ebay|facebook|instagram)\s*support",
    r"(?i)(no.?reply|noreply|donotreply)@(?!.*official)",
    r"(?i)(security|verify|account|update|confirm|alert)@",
    r"[0-9]{4,}@",  # Many numbers before @
]

SUSPICIOUS_DISPLAY_NAME_PATTERNS = [
    r"(?i)(ceo|cfo|hr|payroll|finance|it.?support|helpdesk)",
    r"(?i)(urgent|action required|password|invoice|wire transfer)",
]


class EmailScannerService:
    async def scan(self, email: str, content: str = "") -> Dict[str, Any]:
        findings: List[Dict[str, Any]] = []
        raw_results: Dict[str, Any] = {}
        risk_score = 0.0

        # Validate format
        if not self._is_valid_email(email):
            return {
                "risk_score": 85.0,
                "risk_level": "critical",
                "findings": [{"type": "invalid_format", "severity": "critical",
                               "description": "Email address format is invalid."}],
                "raw_results": {},
            }

        local, domain = email.rsplit("@", 1)
        raw_results["email"] = email
        raw_results["local_part"] = local
        raw_results["domain"] = domain

        # 1. Domain checks
        domain_score, domain_findings, domain_data = await self._check_domain(domain)
        risk_score += domain_score
        findings.extend(domain_findings)
        raw_results["domain_analysis"] = domain_data

        # 2. Email address heuristics
        addr_score, addr_findings = self._check_address_heuristics(email, local, domain)
        risk_score += addr_score
        findings.extend(addr_findings)

        # 3. Content analysis
        if content:
            content_score, content_findings = self._analyse_content(content)
            risk_score += content_score
            findings.extend(content_findings)
            raw_results["content_analysed"] = True
        else:
            raw_results["content_analysed"] = False

        risk_score = min(risk_score, 100.0)
        risk_level = self._score_to_level(risk_score)

        return {
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "findings": findings,
            "raw_results": raw_results,
        }

    def _is_valid_email(self, email: str) -> bool:
        pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, email))

    async def _check_domain(self, domain: str) -> tuple[float, List[Dict], Dict]:
        score = 0.0
        findings = []
        data: Dict[str, Any] = {}

        # Disposable email
        if domain.lower() in DISPOSABLE_DOMAINS:
            score += 60.0
            findings.append({
                "type": "disposable_email",
                "severity": "high",
                "description": f"Domain '{domain}' is a known disposable/temporary email provider.",
            })
            data["is_disposable"] = True
        else:
            data["is_disposable"] = False

        # Free provider
        if domain.lower() in FREE_EMAIL_PROVIDERS:
            score += 5.0
            data["is_free_provider"] = True
            findings.append({
                "type": "free_email_provider",
                "severity": "low",
                "description": f"'{domain}' is a free email provider — not inherently malicious but worth noting in a corporate context.",
            })
        else:
            data["is_free_provider"] = False

        # DNS checks
        mx_records = await self._get_mx_records(domain)
        data["mx_records"] = mx_records
        if not mx_records:
            score += 30.0
            findings.append({
                "type": "no_mx_record",
                "severity": "high",
                "description": f"Domain '{domain}' has no MX records — cannot receive email and may be spoofed.",
            })

        # SPF check
        spf = await self._get_spf(domain)
        data["spf"] = spf
        if spf is None:
            score += 10.0
            findings.append({
                "type": "no_spf",
                "severity": "medium",
                "description": f"Domain '{domain}' has no SPF record — sender spoofing is not prevented.",
            })

        # DMARC check
        dmarc = await self._get_dmarc(domain)
        data["dmarc"] = dmarc
        if dmarc is None:
            score += 10.0
            findings.append({
                "type": "no_dmarc",
                "severity": "medium",
                "description": f"Domain '{domain}' has no DMARC policy — phishing emails from this domain are harder to detect.",
            })
        elif "p=none" in (dmarc or "").lower():
            score += 5.0
            findings.append({
                "type": "weak_dmarc",
                "severity": "low",
                "description": "DMARC policy is set to 'none' — it monitors but does not enforce.",
            })

        return score, findings, data

    def _check_address_heuristics(self, email: str, local: str, domain: str) -> tuple[float, List[Dict]]:
        score = 0.0
        findings = []

        for pattern in PHISHING_PATTERNS:
            if re.search(pattern, email):
                score += 15.0
                findings.append({
                    "type": "phishing_pattern",
                    "severity": "high",
                    "description": f"Email address matches a known phishing pattern.",
                })
                break

        # Excessive numbers / random-looking local part
        num_count = sum(1 for c in local if c.isdigit())
        if num_count > 6:
            score += 10.0
            findings.append({
                "type": "numeric_local_part",
                "severity": "medium",
                "description": "Local part of email contains many numbers — may indicate an auto-generated account.",
            })

        # Brand name in domain with extra characters (e.g. paypal-secure.com)
        brands = ["paypal", "apple", "amazon", "microsoft", "google", "netflix", "ebay"]
        for brand in brands:
            if brand in domain.lower() and not domain.lower().startswith(brand + "."):
                score += 25.0
                findings.append({
                    "type": "brand_domain_spoofing",
                    "severity": "critical",
                    "description": f"Domain contains '{brand}' but is not the official {brand} domain — likely impersonation.",
                })
                break

        return score, findings

    def _analyse_content(self, content: str) -> tuple[float, List[Dict]]:
        score = 0.0
        findings = []
        content_lower = content.lower()

        urgency_words = ["urgent", "immediately", "action required", "your account has been",
                         "verify now", "click here", "limited time", "expires in",
                         "suspended", "compromised", "unusual activity", "confirm your identity"]
        matched = [w for w in urgency_words if w in content_lower]
        if matched:
            score += min(25.0, len(matched) * 5)
            findings.append({
                "type": "urgency_language",
                "severity": "high",
                "description": f"Content uses urgency/pressure language: {', '.join(matched[:4])}",
            })

        # URL extraction from content
        urls_in_content = re.findall(r"https?://[^\s<>\"']+", content)
        if urls_in_content:
            findings.append({
                "type": "embedded_urls",
                "severity": "info",
                "description": f"Email contains {len(urls_in_content)} URL(s): {', '.join(urls_in_content[:3])}",
            })

        # Credential harvesting language
        if any(w in content_lower for w in ["enter your password", "verify your password", "confirm password"]):
            score += 30.0
            findings.append({
                "type": "credential_harvesting",
                "severity": "critical",
                "description": "Content requests password entry — a strong phishing indicator.",
            })

        return score, findings

    async def _get_mx_records(self, domain: str) -> List[str]:
        try:
            answers = dns.resolver.resolve(domain, "MX", lifetime=5)
            return [str(r.exchange) for r in answers]
        except Exception:
            return []

    async def _get_spf(self, domain: str) -> Optional[str]:
        try:
            answers = dns.resolver.resolve(domain, "TXT", lifetime=5)
            for r in answers:
                txt = r.to_text().strip('"')
                if txt.startswith("v=spf1"):
                    return txt
        except Exception:
            pass
        return None

    async def _get_dmarc(self, domain: str) -> Optional[str]:
        try:
            answers = dns.resolver.resolve(f"_dmarc.{domain}", "TXT", lifetime=5)
            for r in answers:
                txt = r.to_text().strip('"')
                if txt.startswith("v=DMARC1"):
                    return txt
        except Exception:
            pass
        return None

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
