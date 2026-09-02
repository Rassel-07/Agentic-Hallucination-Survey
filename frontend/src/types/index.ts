export interface BaselineResult {
  answer: string;
  latency_ms: number;
  guardrail_passed?: boolean;
  violations: string[];
  violation_count?: number;
}

export interface ValidationDetails {
  verdict: 'VALID' | 'UNCERTAIN' | 'INVALID' | string;
  confidence: number;
  issues: string[];
}

export interface GuardrailDetails {
  passed: boolean;
  violations: string[];
  flags?: Record<string, boolean>;
}

export interface FiveIn1Result {
  answer: string;
  final_answer?: string;
  intent: string;
  tools_selected: string[];
  tool_results: string;
  rag_context: string;
  raw_response: string;
  validation: ValidationDetails;
  guardrail: GuardrailDetails;
  steering_action: string;
  retries: number;
  latency_ms: number;
}

export interface ComparisonDetails {
  baseline_latency_ms: number;
  fivein1_latency_ms: number;
  latency_difference_ms: number;
  baseline_risk: number;
  fivein1_risk: number;
  risk_reduction_pct: number;
}

export interface AnalyzeResponse {
  query: string;
  baseline: BaselineResult;
  fivein1: FiveIn1Result;
  comparison?: ComparisonDetails;
  success?: boolean;
  error?: boolean;
  message?: string;
}

export interface HealthResponse {
  status: string;
  model_loaded?: boolean;
  pipeline_loaded?: boolean;
  model_name?: string;
  runtime?: string;
  total_records?: number;
  timestamp?: number;
}

export interface EvaluationSummary {
  avg_HRS_without_5in1: number;
  avg_HRS_with_5in1: number;
  HRS_reduction_pct: number;
  baseline_expected_behavior_pct: number;
  with5in1_expected_behavior_pct: number;
  guardrail_violation_rate_pct: number;
  avg_latency_without_ms: number;
  avg_latency_with_ms: number;
}

export interface EvaluationSummaryResponse {
  success?: boolean;
  summary: EvaluationSummary;
  dataset?: string;
  evaluation_items_count?: number;
}

export interface CategorySummary {
  category: string;
  baseline_HRS: number;
  with5in1_HRS: number;
  baseline_success?: number;
  with5in1_success?: number;
  baseline_success_pct?: number;
  with5in1_success_pct?: number;
  HRS_reduction_pct: number;
}

export interface CategoryResultsResponse {
  success?: boolean;
  categories: CategorySummary[];
  items?: EvaluationItem[];
}

export interface EvaluationItem {
  id: string;
  category: string;
  query: string;
  baseline_HRS: number;
  with5in1_HRS: number;
  with5in1_validation: string;
  with5in1_tools: string;
  steering: string;
  baseline_response?: string;
  with5in1_response?: string;
}

export interface AblationConfig {
  configuration: string;
  mean_expected_behavior_pct: number;
  mean_expected_behavior?: number;
  mean_HRS: number;
  mean_latency_ms: number;
  description?: string;
}

export interface AblationResultsResponse {
  success?: boolean;
  configurations: AblationConfig[];
}

export interface GraphFact {
  subject: string;
  predicate: string;
  object: string;
}

export interface GraphResponse {
  success: boolean;
  count?: number;
  facts: (GraphFact | string)[];
}

export interface HotelAdrStats {
  mean: number;
  min: number;
  max: number;
}

export interface DatasetStatsResponse {
  success: boolean;
  total_rows: number;
  hotel_distribution: Record<string, number>;
  cancellation_rates: Record<string, number>;
  adr_statistics: Record<string, HotelAdrStats>;
  sample_records?: any[];
}

