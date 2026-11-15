"""
SHADOWTRACE - Threat Intelligence Library Route
MITRE ATT&CK techniques, threat indicators, and CTI search.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_active_user
from app.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/threat-intel", tags=["Threat Intelligence"])

# MITRE ATT&CK techniques (curated subset of real techniques)
MITRE_TECHNIQUES = [
    {"technique_id": "T1566", "name": "Phishing", "tactic": "initial-access",
     "description": "Adversaries may send phishing messages to gain access to victim systems. Phishing is an attempt to trick targets into providing information (credential phishing) or in a more general sense executing actions that are requested by the attacker."},
    {"technique_id": "T1566.001", "name": "Spearphishing Attachment", "tactic": "initial-access",
     "description": "Adversaries may send spearphishing emails with a malicious attachment in an attempt to elicit sensitive information and/or gain access to victim systems."},
    {"technique_id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "initial-access",
     "description": "Adversaries may attempt to take advantage of a weakness in an Internet-facing computer or program using software, data, or commands in order to cause unintended or unanticipated behavior."},
    {"technique_id": "T1059", "name": "Command and Scripting Interpreter", "tactic": "execution",
     "description": "Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries. These interfaces and languages provide ways of interacting with computer systems and are a common feature across many different platforms."},
    {"technique_id": "T1059.001", "name": "PowerShell", "tactic": "execution",
     "description": "Adversaries may abuse PowerShell commands and scripts for execution."},
    {"technique_id": "T1053", "name": "Scheduled Task/Job", "tactic": "persistence",
     "description": "Adversaries may abuse task scheduling functionality to facilitate initial or recurring execution of malicious code."},
    {"technique_id": "T1078", "name": "Valid Accounts", "tactic": "defense-evasion",
     "description": "Adversaries may obtain and abuse credentials of existing accounts as a means of gaining Initial Access, Persistence, Privilege Escalation, or Defense Evasion."},
    {"technique_id": "T1110", "name": "Brute Force", "tactic": "credential-access",
     "description": "Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained."},
    {"technique_id": "T1110.001", "name": "Password Guessing", "tactic": "credential-access",
     "description": "Adversaries with no prior knowledge of legitimate credentials within the system or environment may guess passwords to attempt access to accounts."},
    {"technique_id": "T1046", "name": "Network Service Discovery", "tactic": "discovery",
     "description": "Adversaries may attempt to get a listing of services running on remote hosts and local network infrastructure devices, including those that may be vulnerable to remote exploitation through unexpected attack vectors."},
    {"technique_id": "T1021", "name": "Remote Services", "tactic": "lateral-movement",
     "description": "Adversaries may use Valid Accounts to log into a service that accepts remote connections, such as telnet, SSH, and VNC. The adversary may then perform actions as the logged-on user."},
    {"technique_id": "T1041", "name": "Exfiltration Over C2 Channel", "tactic": "exfiltration",
     "description": "Adversaries may steal data by exfiltrating it over an existing command and control channel. Stolen data is encoded into the normal communications channel using the same protocol as command and control communications."},
    {"technique_id": "T1486", "name": "Data Encrypted for Impact", "tactic": "impact",
     "description": "Adversaries may encrypt data on target systems or on large numbers of systems in a network to interrupt availability to system and network resources."},
    {"technique_id": "T1071", "name": "Application Layer Protocol", "tactic": "command-and-control",
     "description": "Adversaries may communicate using OSI application layer protocols to avoid detection/network filtering by blending in with existing traffic."},
    {"technique_id": "T1055", "name": "Process Injection", "tactic": "privilege-escalation",
     "description": "Adversaries may inject code into processes in order to evade process-based defenses as well as possibly elevate privileges."},
    {"technique_id": "T1027", "name": "Obfuscated Files or Information", "tactic": "defense-evasion",
     "description": "Adversaries may attempt to make an executable or file difficult to discover or analyze by encrypting, encoding, or otherwise obfuscating its contents on the system or in transit."},
    {"technique_id": "T1082", "name": "System Information Discovery", "tactic": "discovery",
     "description": "An adversary may attempt to get detailed information about the operating system and hardware, including version, patches, hotfixes, service packs, and architecture."},
    {"technique_id": "T1033", "name": "System Owner/User Discovery", "tactic": "discovery",
     "description": "Adversaries may attempt to identify the primary user, currently logged in user, set of users that commonly use a system, or whether a user is actively using the system."},
    {"technique_id": "T1016", "name": "System Network Configuration Discovery", "tactic": "discovery",
     "description": "Adversaries may look for details about the network configuration and settings, such as IP and/or MAC addresses, of systems they access or through information discovery of remote systems."},
    {"technique_id": "T1057", "name": "Process Discovery", "tactic": "discovery",
     "description": "Adversaries may attempt to get information about running processes on a system. Information obtained could be used to gain an understanding of common software/applications running on systems within the network."},
    {"technique_id": "T1098", "name": "Account Manipulation", "tactic": "persistence",
     "description": "Adversaries may manipulate accounts to maintain access to victim systems. Account manipulation may consist of any action that preserves adversary access to a compromised account."},
    {"technique_id": "T1136", "name": "Create Account", "tactic": "persistence",
     "description": "Adversaries may create an account to maintain access to victim systems. With a sufficient level of access, creating such accounts may be used to establish secondary credentialed access."},
    {"technique_id": "T1562", "name": "Impair Defenses", "tactic": "defense-evasion",
     "description": "Adversaries may maliciously modify components of a victim environment in order to hinder or disable defensive mechanisms."},
    {"technique_id": "T1070", "name": "Indicator Removal", "tactic": "defense-evasion",
     "description": "Adversaries may delete or modify artifacts generated within systems to remove evidence of their presence or hinder defenses."},
    {"technique_id": "T1548", "name": "Abuse Elevation Control Mechanism", "tactic": "privilege-escalation",
     "description": "Adversaries may circumvent mechanisms designed to control elevate privileges to gain higher-level permissions."},
]

KNOWN_INDICATORS = [
    {"type": "ip", "value": "91.203.5.146", "threat_type": "C2 Server", "confidence": 95,
     "source": "URLhaus", "tags": ["c2", "botnet"], "first_seen": "2024-01-15", "last_seen": "2024-11-01"},
    {"type": "domain", "value": "malware-distribution.tk", "threat_type": "Malware Distribution",
     "confidence": 99, "source": "URLhaus", "tags": ["malware", "distribution"],
     "first_seen": "2024-03-01", "last_seen": "2024-10-15"},
    {"type": "ip", "value": "185.220.101.0", "threat_type": "Tor Exit Node", "confidence": 90,
     "source": "TorProject", "tags": ["tor", "anonymizer"],
     "first_seen": "2023-06-01", "last_seen": "2024-11-10"},
    {"type": "domain", "value": "phishing-paypal-verify.xyz", "threat_type": "Phishing",
     "confidence": 97, "source": "PhishTank", "tags": ["phishing", "paypal"],
     "first_seen": "2024-08-20", "last_seen": "2024-09-05"},
    {"type": "hash", "value": "44d88612fea8a8f36de82e1278abb02f", "threat_type": "Ransomware",
     "confidence": 100, "source": "VirusTotal", "tags": ["ransomware", "wannacry"],
     "first_seen": "2017-05-12", "last_seen": "2024-01-01"},
    {"type": "url", "value": "http://update-flashplayer.tk/setup.exe", "threat_type": "Trojan Dropper",
     "confidence": 98, "source": "URLhaus", "tags": ["trojan", "dropper"],
     "first_seen": "2024-07-10", "last_seen": "2024-10-30"},
]


@router.get("/mitre")
def get_mitre_techniques(
    tactic: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    _: User = Depends(get_current_active_user),
) -> List[Dict[str, Any]]:
    """List MITRE ATT&CK techniques, optionally filtered."""
    techniques = MITRE_TECHNIQUES
    if tactic:
        techniques = [t for t in techniques if t["tactic"] == tactic.lower()]
    if search:
        q = search.lower()
        techniques = [
            t for t in techniques
            if q in t["name"].lower() or q in t["technique_id"].lower() or q in t["description"].lower()
        ]
    return techniques


@router.get("/indicators")
def get_indicators(
    type_filter: Optional[str] = Query(None, alias="type"),
    _: User = Depends(get_current_active_user),
) -> List[Dict[str, Any]]:
    """Get known malicious indicators."""
    indicators = KNOWN_INDICATORS
    if type_filter:
        indicators = [i for i in indicators if i["type"] == type_filter.lower()]
    return indicators


@router.get("/search")
def search_threat_intel(
    q: str = Query(..., min_length=2),
    _: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Search across all threat intelligence."""
    q_lower = q.lower()

    matched_techniques = [
        t for t in MITRE_TECHNIQUES
        if q_lower in t["name"].lower() or q_lower in t["description"].lower()
        or q_lower in t["technique_id"].lower()
    ]
    matched_indicators = [
        i for i in KNOWN_INDICATORS
        if q_lower in i["value"].lower() or q_lower in i["threat_type"].lower()
        or q_lower in " ".join(i.get("tags", []))
    ]

    return {
        "query": q,
        "mitre_techniques": matched_techniques[:10],
        "indicators": matched_indicators[:10],
        "total_results": len(matched_techniques) + len(matched_indicators),
    }
