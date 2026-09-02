import { 
  AnalyzeResponse, 
  HealthResponse, 
  EvaluationSummary, 
  CategorySummary, 
  EvaluationItem, 
  AblationConfig,
  GraphResponse,
  DatasetStatsResponse
} from '@/types';

// The frontend communicates with the external Google Colab FastAPI server
const ENV_API_URL = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
const STORAGE_KEY = '5in1_colab_api_url';
const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Returns the raw environment variable (if defined)
 */
export function getEnvUrl(): string {
  return ENV_API_URL;
}

/**
 * Resolves the backend API URL:
 * 1. Checks environment variable (NEXT_PUBLIC_API_URL from Vercel / .env) FIRST.
 * 2. If the environment variable is NOT set, falls back to the URL entered directly by the user in the frontend (localStorage).
 */
export function getBackendUrl(): string {
  // 1. Check env first
  if (ENV_API_URL.length > 0) {
    // Check if the user explicitly provided a manual override in the frontend modal
    if (typeof window !== 'undefined') {
      const manualOverride = localStorage.getItem('5in1_manual_override');
      if (manualOverride && manualOverride.trim().length > 0) {
        return manualOverride.trim().replace(/\/+$/, '');
      }
    }
    return ENV_API_URL;
  }

  // 2. If env is not there, check URL entered directly in frontend
  if (typeof window !== 'undefined') {
    const userEntered = localStorage.getItem(STORAGE_KEY);
    if (userEntered && userEntered.trim().length > 0) {
      return userEntered.trim().replace(/\/+$/, '');
    }
  }

  return '';
}

export function setBackendUrl(url: string, asManualOverride: boolean = false): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  if (asManualOverride) {
    localStorage.setItem('5in1_manual_override', cleanUrl);
  } else {
    localStorage.setItem(STORAGE_KEY, cleanUrl);
  }
}

export function clearBackendUrlOverride(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('5in1_manual_override');
}

// 1. GET ${NEXT_PUBLIC_API_URL}/health
export async function checkHealth(customUrl?: string): Promise<HealthResponse | null> {
  const baseUrl = (customUrl || getBackendUrl()).replace(/\/+$/, '');
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (IS_DEV) {
      console.log(`[Diagnostic] Health Check: ${baseUrl}/health -> HTTP ${res.status}`);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as HealthResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    if (IS_DEV) {
      console.warn(`[Diagnostic] Health Check Failed on: ${baseUrl}/health`);
    }
    return null;
  }
}

// 2. POST ${NEXT_PUBLIC_API_URL}/analyze
export async function sendQuery(query: string): Promise<AnalyzeResponse> {
  const baseUrl = getBackendUrl();
  const apiUrl = `${baseUrl}/analyze`;

  if (!baseUrl) {
    throw new Error('Backend URL is not configured. Please set NEXT_PUBLIC_API_URL to your Google Colab Cloudflare Tunnel URL.');
  }

  const controller = new AbortController();
  // Live inference on Colab GPU takes 4-20 seconds
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    // Temporary development diagnostic logging (Dev mode only)
    if (IS_DEV) {
      console.group('🔍 [5in1 Diagnostic] Live Colab API Inference');
      console.log('📡 API URL:', apiUrl);
      console.log('❓ Request Query:', query);
      console.log('📊 Response Status:', res.status, res.statusText);
      console.log('📦 Response JSON:', data);
      console.groupEnd();
    }

    if (!res.ok) {
      throw new Error(data.detail || data.message || `Colab backend returned HTTP error ${res.status}`);
    }

    return data as AnalyzeResponse;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (IS_DEV) {
      console.error('❌ [5in1 Diagnostic] Inference Call Failed:', err.message);
    }
    if (err.name === 'AbortError') {
      throw new Error('Inference request timed out after 90 seconds. Please check your Google Colab runtime.');
    }
    throw new Error(err.message || 'Failed to connect to Google Colab backend.');
  }
}

// 3. GET ${NEXT_PUBLIC_API_URL}/evaluation-summary
export async function getEvaluationSummary(): Promise<{ summary: EvaluationSummary; dataset?: string; evaluation_items_count?: number } | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/evaluation-summary`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      if (IS_DEV) console.error(`[API Error] GET /evaluation-summary returned HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    if (IS_DEV) console.error('[API Error] Failed to fetch /evaluation-summary:', err?.message || err);
    return null;
  }
}

// 4. GET ${NEXT_PUBLIC_API_URL}/category-results
export async function getCategoryResults(): Promise<{ categories: CategorySummary[]; items?: EvaluationItem[] } | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/category-results`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      if (IS_DEV) console.error(`[API Error] GET /category-results returned HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data?.categories && Array.isArray(data.categories)) {
      data.categories = data.categories.map((c: any) => ({
        ...c,
        baseline_success_pct: c.baseline_success_pct ?? (c.baseline_success != null ? (c.baseline_success <= 1.0 ? c.baseline_success * 100 : c.baseline_success) : undefined),
        with5in1_success_pct: c.with5in1_success_pct ?? (c.with5in1_success != null ? (c.with5in1_success <= 1.0 ? c.with5in1_success * 100 : c.with5in1_success) : undefined),
      }));
    }
    return data;
  } catch (err: any) {
    if (IS_DEV) console.error('[API Error] Failed to fetch /category-results:', err?.message || err);
    return null;
  }
}

// 5. GET ${NEXT_PUBLIC_API_URL}/ablation-results
export async function getAblationResults(): Promise<{ configurations: AblationConfig[] } | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/ablation-results`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      if (IS_DEV) console.error(`[API Error] GET /ablation-results returned HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data?.configurations && Array.isArray(data.configurations)) {
      const descriptions: Record<string, string> = {
        'Full 5in1': 'All 5 protective layers active (Graph-RAG + ToolGate + Validation + Guardrails + Steering)',
        'w/o Graph-RAG': 'Omits Knowledge Graph retrieval; relies solely on ToolGate and Qwen3 parametric memory',
        'w/o ToolGate': 'Disables SQLite tool execution; answers factual queries without exact database aggregations',
        'w/o Validation': 'Bypasses dual Qwen3 judges (Factuality & Consistency), eliminating hallucination verification',
        'w/o Guardrails': 'Disables deterministic regex guardrails against policy claims, certainty markers, and dangerous tools',
        'w/o Steering': 'Suppresses feedback retry loops and abstention fallback; returns raw unsteered generation',
      };
      data.configurations = data.configurations.map((cfg: any) => {
        const rawScore = cfg.mean_expected_behavior_pct ?? cfg.mean_expected_behavior ?? 0;
        const pct = rawScore <= 1.0 && rawScore > 0 ? rawScore * 100 : rawScore;
        return {
          ...cfg,
          mean_expected_behavior_pct: Math.round(pct * 10) / 10,
          description: cfg.description || descriptions[cfg.configuration] || `Evaluation variant: ${cfg.configuration}`,
        };
      });
    }
    return data;
  } catch (err: any) {
    if (IS_DEV) console.error('[API Error] Failed to fetch /ablation-results:', err?.message || err);
    return null;
  }
}

// 6. GET ${NEXT_PUBLIC_API_URL}/dataset/stats
export async function getDatasetStats(): Promise<DatasetStatsResponse | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/dataset/stats`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      if (IS_DEV) console.error(`[API Error] GET /dataset/stats returned HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    if (IS_DEV) console.error('[API Error] Failed to fetch /dataset/stats:', err?.message || err);
    return null;
  }
}

// 7. GET ${NEXT_PUBLIC_API_URL}/graph
export async function getKnowledgeGraph(): Promise<GraphResponse | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/graph`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      if (IS_DEV) console.error(`[API Error] GET /graph returned HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const rawFacts = data?.facts || data?.data?.facts || [];
    const count = data?.count ?? data?.total_facts ?? rawFacts.length;
    return {
      success: Boolean(data?.success ?? true),
      count,
      facts: rawFacts,
    };
  } catch (err: any) {
    if (IS_DEV) console.error('[API Error] Failed to fetch /graph:', err?.message || err);
    return null;
  }
}
