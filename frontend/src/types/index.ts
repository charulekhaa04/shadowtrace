// Core user types
export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  access_token: string
  token_type: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  full_name: string
}

// Investigation types
export type InvestigationStatus = 'open' | 'in_progress' | 'closed' | 'archived'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe' | 'unknown'

export interface Investigation {
  id: string
  title: string
  description: string
  status: InvestigationStatus
  risk_level: RiskLevel
  owner_id: string
  evidence_count: number
  created_at: string
  updated_at: string
  tags: string[]
}

export interface InvestigationCreate {
  title: string
  description: string
  tags?: string[]
}

// Evidence types
export type EvidenceType = 'url' | 'email' | 'ip' | 'log_file' | 'network_capture' | 'document' | 'other'

export interface Evidence {
  id: string
  investigation_id: string
  filename: string
  file_type: string
  file_size: number
  sha256?: string
  sha256_hash?: string
  mime_type?: string
  status: string
  upload_status?: string
  uploaded_at: string
  created_at?: string
  metadata?: Record<string, unknown>
}

// Scan result types
export interface ScanFinding {
  type: string
  severity: RiskLevel
  description: string
  indicator?: string
  source?: string
}

export interface ScanResult {
  id: string
  investigation_id?: string
  scan_type: 'url' | 'email' | 'ip'
  target: string
  risk_score: number
  risk_level: RiskLevel
  findings: ScanFinding[]
  raw_results: Record<string, unknown>
  scanned_at: string
  sources_checked: string[]
}

// Chat / AI Assistant types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  sources?: string[]
  confidence?: number
  evidence_refs?: string[]
}

export interface ChatSession {
  id: string
  investigation_id?: string
  messages: ChatMessage[]
  created_at: string
}

// Report types
export interface ForensicReport {
  id: string
  investigation_id: string
  investigation_title?: string
  created_at: string
  generated_at?: string
  executive_summary?: string
  risk_assessment?: string
  findings?: ReportFinding[]
  recommendations?: string[]
  timeline_summary?: string
  ioc_list?: string[]
  report_data?: Record<string, any>
}

export interface ReportFinding {
  title: string
  severity: RiskLevel
  description: string
  evidence: string[]
  mitre_techniques: string[]
}

// Timeline types
export interface TimelineEvent {
  id: string
  investigation_id: string
  timestamp: string
  event_type: string
  severity: string
  title: string
  description: string
  source?: string
  is_inferred: boolean
  indicators?: string[]
  mitre_technique?: string
}

// Dashboard stats
export interface DashboardStats {
  total_investigations: number
  critical_threats: number
  suspicious_indicators: number
  evidence_files: number
  recent_scans: number
  open_investigations: number
}

export interface ThreatActivityPoint {
  date: string
  critical: number
  high: number
  medium: number
  low: number
}

export interface ThreatDistribution {
  name: string
  value: number
  color: string
}

// Network analysis types
export interface NetworkFlow {
  src_ip: string
  dst_ip: string
  protocol: string
  bytes: number
  packets: number
  label: string
  anomaly_score: number
  timestamp: string
}

export interface NetworkAnalysisResult {
  id?: string
  filename?: string
  total_flows: number
  benign_count: number
  attack_count: number
  anomaly_score: number
  attack_distribution: Record<string, number>
  suspicious_ips?: any[]
  top_suspicious_ips?: SuspiciousIP[]
  flows_over_time?: FlowTimePoint[]
  feature_importance?: any[]
  analyzed_at?: string
}

export interface SuspiciousIP {
  ip: string
  threat_score: number
  connection_count: number
  bytes_transferred: number
  attack_types: string[]
}

export interface FlowTimePoint {
  time: string
  total: number
  attacks: number
}

export interface FeatureImportance {
  feature: string
  importance: number
}

// Log analysis types
export interface LogFinding {
  id: string
  severity: RiskLevel
  event_type: string
  description: string
  timestamp: string
  source: string
  raw_line?: string
}

export interface ExtractedIndicator {
  type: 'ip' | 'domain' | 'url' | 'email' | 'hash' | 'cve'
  value: string
  context: string
  occurrences: number
}

export interface LogAnalysisResult {
  id?: string
  filename?: string
  total_events: number
  findings?: any[]
  indicators?: any[]
  extracted_indicators?: ExtractedIndicator[]
  severity_breakdown?: Record<string, number>
  suspicious_count?: number
  summary?: string
  analyzed_at?: string
}

// Correlation graph types
export type NodeType = 'ip' | 'domain' | 'url' | 'email' | 'cve' | 'hash' | 'threat_actor'

export interface CorrelationNode {
  id: string
  type: NodeType
  label: string
  risk_level: RiskLevel
  metadata: Record<string, unknown>
}

export interface CorrelationEdge {
  id: string
  source: string
  target: string
  relationship: string
  weight: number
}

export interface CorrelationGraph {
  nodes: CorrelationNode[]
  edges: CorrelationEdge[]
  generated_at: string
}

// MITRE ATT&CK types
export type MitreTactic =
  | 'reconnaissance'
  | 'resource-development'
  | 'initial-access'
  | 'execution'
  | 'persistence'
  | 'privilege-escalation'
  | 'defense-evasion'
  | 'credential-access'
  | 'discovery'
  | 'lateral-movement'
  | 'collection'
  | 'command-and-control'
  | 'exfiltration'
  | 'impact'

export interface MitreTechnique {
  technique_id: string
  name: string
  tactic: MitreTactic
  description: string
  url: string
  sub_techniques?: string[]
  mitigations?: string[]
}

export interface ThreatIndicator {
  id: string
  indicator_type: string
  type?: string
  value: string
  threat_type?: string
  confidence?: number
  source?: string
  first_seen?: string
  last_seen?: string
  tags?: string[]
}

// API response wrappers
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size?: number
  size?: number
  pages?: number
  total_pages?: number
}

export interface ApiError {
  detail: string
  status_code?: number
}

// Settings types
export interface UserProfile {
  full_name: string
  email: string
}

export interface PasswordChange {
  current_password: string
  new_password: string
}

export interface ApiKeys {
  virustotal_key: string
  abuseipdb_key: string
  shodan_key: string
  urlscan_key: string
}

export interface NotificationSettings {
  email_on_critical: boolean
  email_on_scan_complete: boolean
  email_on_report_ready: boolean
  browser_notifications: boolean
}
