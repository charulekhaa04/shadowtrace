"""
SHADOWTRACE - Forensic Report Generator
Produces structured JSON reports and PDF exports using ReportLab.
"""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

MITRE_TECHNIQUES_SAMPLE = [
    {"id": "T1566", "name": "Phishing", "tactic": "initial-access"},
    {"id": "T1078", "name": "Valid Accounts", "tactic": "defense-evasion"},
    {"id": "T1059", "name": "Command and Scripting Interpreter", "tactic": "execution"},
    {"id": "T1053", "name": "Scheduled Task/Job", "tactic": "persistence"},
    {"id": "T1110", "name": "Brute Force", "tactic": "credential-access"},
    {"id": "T1046", "name": "Network Service Discovery", "tactic": "discovery"},
    {"id": "T1021", "name": "Remote Services", "tactic": "lateral-movement"},
    {"id": "T1041", "name": "Exfiltration Over C2 Channel", "tactic": "exfiltration"},
]


class ReportGeneratorService:
    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = Path(upload_dir)
        self.reports_dir = self.upload_dir / "reports"
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def generate_report_data(
        self,
        investigation: Dict,
        evidence_items: List[Dict],
        scan_results: List[Dict],
        timeline_events: List[Dict],
        chat_messages: List[Dict],
    ) -> Dict[str, Any]:
        """Build the full forensic report data structure."""
        now = datetime.now(timezone.utc).isoformat()

        # Risk assessment
        risk_levels = [s.get("risk_level", "safe") for s in scan_results]
        risk_map = {"critical": 4, "high": 3, "medium": 2, "low": 1, "safe": 0}
        max_risk = max((risk_map.get(r, 0) for r in risk_levels), default=0)
        overall_risk = ["safe", "low", "medium", "high", "critical"][max_risk]

        # Collect all findings
        all_findings = []
        for scan in scan_results:
            findings = scan.get("findings") or []
            if isinstance(findings, str):
                try:
                    findings = json.loads(findings)
                except Exception:
                    findings = []
            for f in findings:
                f["scan_target"] = scan.get("target", "")
                f["scan_type"] = scan.get("scan_type", "")
                all_findings.append(f)

        # Extract MITRE mappings from findings
        mitre_mappings = self._map_mitre(all_findings, scan_results)

        # Build executive summary
        executive_summary = self._build_executive_summary(
            investigation, evidence_items, scan_results, overall_risk
        )

        # Recommendations
        recommendations = self._build_recommendations(all_findings, overall_risk)

        return {
            "investigation_id": investigation.get("id"),
            "investigation_title": investigation.get("title"),
            "generated_at": now,
            "overall_risk": overall_risk,
            "executive_summary": executive_summary,
            "evidence_overview": {
                "total_files": len(evidence_items),
                "files": [
                    {
                        "filename": e.get("original_filename", e.get("filename", "")),
                        "type": e.get("file_type", ""),
                        "size": e.get("file_size", 0),
                        "sha256": e.get("sha256_hash", ""),
                        "uploaded_at": str(e.get("created_at", "")),
                    }
                    for e in evidence_items
                ],
            },
            "threat_findings": all_findings[:50],
            "scan_summary": [
                {
                    "type": s.get("scan_type"),
                    "target": s.get("target"),
                    "risk_level": s.get("risk_level"),
                    "risk_score": s.get("risk_score"),
                    "scanned_at": str(s.get("created_at", "")),
                }
                for s in scan_results
            ],
            "incident_timeline": [
                {
                    "timestamp": str(e.get("timestamp", "")),
                    "severity": e.get("severity"),
                    "title": e.get("title"),
                    "description": e.get("description"),
                    "is_inferred": e.get("is_inferred", False),
                }
                for e in sorted(timeline_events, key=lambda x: str(x.get("timestamp", "")))
            ],
            "mitre_mappings": mitre_mappings,
            "risk_assessment": {
                "overall": overall_risk,
                "breakdown": {
                    level: sum(1 for r in risk_levels if r == level)
                    for level in ["critical", "high", "medium", "low", "safe"]
                },
            },
            "recommendations": recommendations,
        }

    def _build_executive_summary(self, inv: Dict, evidence: List, scans: List, risk: str) -> str:
        title = inv.get("title", "Untitled Investigation")
        created = str(inv.get("created_at", "unknown"))[:10]
        total_scans = len(scans)
        total_evidence = len(evidence)

        critical_scans = sum(1 for s in scans if s.get("risk_level") == "critical")
        high_scans = sum(1 for s in scans if s.get("risk_level") == "high")

        summary = (
            f"This forensic report covers investigation '{title}', initiated on {created}. "
            f"A total of {total_evidence} evidence file(s) and {total_scans} threat scan(s) were analysed.\n\n"
        )

        if critical_scans > 0:
            summary += (
                f"CRITICAL: {critical_scans} scan(s) returned a CRITICAL risk rating, indicating "
                f"confirmed or highly probable malicious activity that requires immediate attention.\n\n"
            )
        if high_scans > 0:
            summary += (
                f"HIGH: {high_scans} scan(s) returned a HIGH risk rating, indicating significant "
                f"threat indicators that should be investigated urgently.\n\n"
            )

        summary += (
            f"The overall investigation risk level is assessed as: {risk.upper()}.\n\n"
            "All findings in this report are grounded in the analysed evidence. "
            "AI-generated inferences are clearly marked as such and should not be treated as confirmed facts."
        )
        return summary

    def _map_mitre(self, findings: List[Dict], scans: List[Dict]) -> List[Dict]:
        mappings = []
        type_to_mitre = {
            "failed_login": {"id": "T1110", "name": "Brute Force"},
            "brute_force": {"id": "T1110", "name": "Brute Force"},
            "sql_injection": {"id": "T1190", "name": "Exploit Public-Facing Application"},
            "xss": {"id": "T1059.007", "name": "Command and Scripting Interpreter: JavaScript"},
            "command_injection": {"id": "T1059", "name": "Command and Scripting Interpreter"},
            "phishing": {"id": "T1566", "name": "Phishing"},
            "phishing_keywords": {"id": "T1566", "name": "Phishing"},
            "credential_harvesting": {"id": "T1056", "name": "Input Capture"},
            "data_exfiltration": {"id": "T1041", "name": "Exfiltration Over C2 Channel"},
            "malware_execution": {"id": "T1059", "name": "Command and Scripting Interpreter"},
            "port_scan": {"id": "T1046", "name": "Network Service Discovery"},
        }
        seen = set()
        for finding in findings:
            ftype = finding.get("type", "").lower().replace(" ", "_")
            for key, technique in type_to_mitre.items():
                if key in ftype and technique["id"] not in seen:
                    mappings.append({
                        "technique_id": technique["id"],
                        "technique_name": technique["name"],
                        "evidence_type": finding.get("type"),
                        "severity": finding.get("severity", "medium"),
                    })
                    seen.add(technique["id"])
        return mappings

    def _build_recommendations(self, findings: List[Dict], overall_risk: str) -> List[str]:
        recs = []
        types_found = {f.get("type", "").lower() for f in findings}

        if any("login" in t or "brute" in t for t in types_found):
            recs.append("Implement account lockout policies after 5 failed login attempts.")
            recs.append("Enable multi-factor authentication (MFA) on all user accounts.")

        if any("sql" in t for t in types_found):
            recs.append("Review and sanitise all database query inputs. Use parameterised queries.")
            recs.append("Deploy a Web Application Firewall (WAF) with SQL injection rules.")

        if any("phish" in t for t in types_found):
            recs.append("Conduct phishing awareness training for all staff.")
            recs.append("Enforce DMARC, DKIM, and SPF on all email domains.")

        if any("malware" in t or "execution" in t for t in types_found):
            recs.append("Deploy endpoint detection and response (EDR) on all workstations.")
            recs.append("Review and restrict PowerShell execution policy.")

        if any("exfil" in t for t in types_found):
            recs.append("Implement data loss prevention (DLP) controls.")
            recs.append("Monitor and restrict outbound network connections.")

        if overall_risk in ("critical", "high"):
            recs.insert(0, "IMMEDIATE ACTION REQUIRED: Isolate affected systems from the network.")
            recs.append("Engage incident response procedures and preserve all evidence for forensic analysis.")

        recs.append("Conduct a post-incident review and update security policies accordingly.")
        recs.append("Ensure all systems are patched to the latest security updates.")

        return recs

    def generate_pdf(self, report_data: Dict, investigation_id: str) -> Optional[str]:
        """Generate a PDF forensic report and return the file path."""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import cm
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
            )
            from reportlab.lib.enums import TA_CENTER, TA_LEFT

            pdf_path = self.reports_dir / f"report_{investigation_id}.pdf"

            doc = SimpleDocTemplate(
                str(pdf_path), pagesize=A4,
                leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm
            )

            styles = getSampleStyleSheet()
            teal = colors.HexColor("#00D6C9")
            dark = colors.HexColor("#080D16")
            critical_red = colors.HexColor("#FF4757")

            title_style = ParagraphStyle("Title", parent=styles["Title"],
                                          textColor=teal, fontSize=20, spaceAfter=12)
            heading_style = ParagraphStyle("H1", parent=styles["Heading1"],
                                            textColor=teal, fontSize=14, spaceAfter=8)
            body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                         fontSize=10, spaceAfter=6)
            risk_colors = {
                "critical": critical_red, "high": colors.HexColor("#FF8C00"),
                "medium": colors.HexColor("#F5B942"), "low": colors.HexColor("#35C98A"),
                "safe": colors.HexColor("#35C98A"),
            }

            story = []

            # Cover
            story.append(Paragraph("SHADOWTRACE", title_style))
            story.append(Paragraph("Digital Forensics Investigation Report", styles["Heading2"]))
            story.append(HRFlowable(width="100%", thickness=1, color=teal))
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph(f"Investigation: {report_data.get('investigation_title', '')}", body_style))
            story.append(Paragraph(f"Generated: {report_data.get('generated_at', '')[:19]} UTC", body_style))
            risk = report_data.get("overall_risk", "unknown").upper()
            risk_color = risk_colors.get(report_data.get("overall_risk", "safe"), colors.grey)
            story.append(Paragraph(f'Overall Risk: <font color="{risk_color.hexval() if hasattr(risk_color, "hexval") else "#888888"}">{risk}</font>', body_style))
            story.append(Spacer(1, 0.5*cm))

            # Executive Summary
            story.append(Paragraph("1. Executive Summary", heading_style))
            story.append(Paragraph(report_data.get("executive_summary", ""), body_style))
            story.append(Spacer(1, 0.3*cm))

            # Evidence Overview
            story.append(Paragraph("2. Evidence Overview", heading_style))
            ev = report_data.get("evidence_overview", {})
            story.append(Paragraph(f"Total evidence files: {ev.get('total_files', 0)}", body_style))
            files = ev.get("files", [])
            if files:
                table_data = [["Filename", "Type", "Size (bytes)", "SHA-256"]]
                for f in files[:20]:
                    table_data.append([
                        f.get("filename", "")[:40],
                        f.get("type", ""),
                        str(f.get("size", "")),
                        f.get("sha256", "")[:16] + "...",
                    ])
                t = Table(table_data, colWidths=[6*cm, 3*cm, 3*cm, 5*cm])
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), dark),
                    ("TEXTCOLOR", (0, 0), (-1, 0), teal),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ]))
                story.append(t)
            story.append(Spacer(1, 0.3*cm))

            # Threat Findings
            story.append(Paragraph("3. Threat Findings", heading_style))
            scan_summary = report_data.get("scan_summary", [])
            for scan in scan_summary[:20]:
                story.append(Paragraph(
                    f"• [{scan.get('scan_type','').upper()}] {scan.get('target','')} — "
                    f"Risk: {scan.get('risk_level','').upper()} ({scan.get('risk_score',0)}/100)",
                    body_style
                ))
            story.append(Spacer(1, 0.3*cm))

            # Timeline
            story.append(Paragraph("4. Incident Timeline", heading_style))
            timeline = report_data.get("incident_timeline", [])
            if timeline:
                for event in timeline[:20]:
                    inferred = " [INFERRED]" if event.get("is_inferred") else ""
                    story.append(Paragraph(
                        f"• {event.get('timestamp','')[:19]} [{event.get('severity','').upper()}] "
                        f"{event.get('title','')}{inferred}",
                        body_style
                    ))
            else:
                story.append(Paragraph("No timeline events recorded for this investigation.", body_style))
            story.append(Spacer(1, 0.3*cm))

            # MITRE Mappings
            story.append(Paragraph("5. MITRE ATT&CK Mapping", heading_style))
            mitre = report_data.get("mitre_mappings", [])
            if mitre:
                for m in mitre:
                    story.append(Paragraph(
                        f"• {m.get('technique_id')} — {m.get('technique_name')} "
                        f"[{m.get('severity','').upper()}]",
                        body_style
                    ))
            else:
                story.append(Paragraph("No MITRE ATT&CK techniques mapped.", body_style))
            story.append(Spacer(1, 0.3*cm))

            # Recommendations
            story.append(Paragraph("6. Recommendations", heading_style))
            for rec in report_data.get("recommendations", []):
                story.append(Paragraph(f"• {rec}", body_style))

            # Footer note
            story.append(Spacer(1, 0.5*cm))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
            story.append(Paragraph(
                "SHADOWTRACE — Intelligence. Evidence. Investigation. | "
                "AI-generated inferences are marked as such and do not constitute confirmed forensic evidence.",
                ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey)
            ))

            doc.build(story)
            logger.info("PDF report generated: %s", pdf_path)
            return str(pdf_path)

        except Exception as e:
            logger.error("PDF generation failed: %s", e)
            return None
