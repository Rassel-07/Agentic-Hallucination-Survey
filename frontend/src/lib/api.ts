import { 
  AnalyzeResponse, 
  HealthResponse, 
  EvaluationSummary, 
  CategorySummary, 
  EvaluationItem, 
  AblationConfig 
} from '@/types';

// The frontend communicates ONLY with the external Google Colab FastAPI server via NEXT_PUBLIC_API_URL
const ENV_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const STORAGE_KEY = '5in1_colab_api_url';
const IS_DEV = process.env.NODE_ENV !== 'production';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const userOverride = localStorage.getItem(STORAGE_KEY);
    if (userOverride && userOverride.trim()) {
      return userOverride.trim().replace(/\/+$/, '');
    }
  }
  return ENV_API_URL.trim().replace(/\/+$/, '');
}

export function setBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, cleanUrl);
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
    if (!res.ok) return null;
    return await res.json();
  } catch {
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
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.categories && Array.isArray(data.categories)) {
      data.categories = data.categories.map((c: any) => ({
        ...c,
        baseline_success_pct: c.baseline_success_pct ?? (c.baseline_success != null ? (c.baseline_success <= 1.0 ? c.baseline_success * 100 : c.baseline_success) : undefined),
        with5in1_success_pct: c.with5in1_success_pct ?? (c.with5in1_success != null ? (c.with5in1_success <= 1.0 ? c.with5in1_success * 100 : c.with5in1_success) : undefined),
      }));
    }
    return data;
  } catch {
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
    if (!res.ok) return null;
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
  } catch {
    return null;
  }
}

// 6. GET ${NEXT_PUBLIC_API_URL}/dataset/stats
export async function getDatasetStats(): Promise<any | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/dataset/stats`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 7. GET ${NEXT_PUBLIC_API_URL}/graph
export async function getKnowledgeGraph(): Promise<any | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/graph`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
