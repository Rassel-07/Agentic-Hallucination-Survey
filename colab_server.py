"""
5in1 Hotel Agent — Standalone Google Colab FastAPI Inference Server
===================================================================
Loads Qwen3 (8B 4-bit) once at startup on GPU and serves the full 5in1 pipeline.
Endpoints:
  - POST /analyze
  - GET  /health
  - GET  /evaluation-summary
  - GET  /category-results
  - GET  /ablation-results
  - GET  /dataset/stats
  - GET  /graph
"""

import os, re, json, time, sqlite3, hashlib, random, warnings, threading, subprocess
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple, Callable
import numpy as np
import pandas as pd
import networkx as nx
import kagglehub
import torch
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

warnings.filterwarnings("ignore")
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ============================================================
# 1. DOWNLOAD DATASET & SQLITE
# ============================================================
DATASET_HANDLE = "mojtaba142/hotel-booking"
print("Downloading / verifying Kaggle dataset...")
dataset_dir = kagglehub.dataset_download(DATASET_HANDLE)
csv_candidates = []
for root, _, files in os.walk(dataset_dir):
    for f in files:
        if f.lower() == "hotel_booking.csv":
            csv_candidates.append(os.path.join(root, f))

if not csv_candidates:
    raise FileNotFoundError("hotel_booking.csv was not found in Kaggle dataset.")

csv_path = csv_candidates[0]
df = pd.read_csv(csv_path)
df.columns = [c.strip().lower().replace("-", "_").replace(" ", "_") for c in df.columns]
df = df.reset_index(drop=True)
df["booking_ref"] = [f"HB-{i:06d}" for i in range(len(df))]

DB_PATH = "/content/hotel_booking_kaggle.db" if os.path.exists("/content") else "hotel_booking_kaggle.db"
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
df.to_sql("bookings", conn, index=False, if_exists="replace")

def db_query(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description] if cur.description else []
    return [dict(zip(cols, row)) for row in cur.fetchall()]

print(f"✓ Dataset loaded: {DATASET_HANDLE} ({len(df):,} records)")
print(f"✓ Database ready: SQLite table 'bookings' at {DB_PATH}")

# ============================================================
# 2. LEXICAL EMBEDDER & GRAPH-RAG (Layer 1)
# ============================================================
class FastTextLikeEmbedder:
    def __init__(self, dim: int = 384):
        self.dim = dim

    def _tokens(self, text: str) -> List[str]:
        words = re.findall(r"[A-Za-z0-9_]+", str(text).lower())
        grams = list(words)
        grams += [words[i] + "_" + words[i+1] for i in range(len(words)-1)]
        return grams

    def encode(self, texts: Any, convert_to_numpy: bool = True):
        if isinstance(texts, str):
            texts = [texts]
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for r, text in enumerate(texts):
            grams = self._tokens(text)
            for g in grams:
                h = int(hashlib.md5(g.encode("utf-8")).hexdigest()[:8], 16)
                idx = h % self.dim
                sign = 1.0 if ((h >> 31) & 1) == 0 else -1.0
                out[r, idx] += sign
            norm = np.linalg.norm(out[r])
            if norm > 0:
                out[r] /= norm
        return out if convert_to_numpy else out.tolist()

embedder = FastTextLikeEmbedder(384)

KG = nx.DiGraph()
def add_fact(s, p, o):
    KG.add_edge(s, o, relation=p)

hotel_stats = (
    df.groupby("hotel")
      .agg(
          bookings=("hotel", "size"),
          cancellation_rate=("is_canceled", "mean"),
          avg_adr=("adr", "mean"),
          avg_lead_time=("lead_time", "mean"),
          avg_total_special_requests=("total_of_special_requests", "mean"),
      )
      .reset_index()
)

for r in hotel_stats.itertuples(index=False):
    add_fact(r.hotel, "booking_count", str(int(r.bookings)))
    add_fact(r.hotel, "cancellation_rate", f"{r.cancellation_rate:.4f}")
    add_fact(r.hotel, "average_adr", f"{r.avg_adr:.2f}")
    add_fact(r.hotel, "average_lead_time", f"{r.avg_lead_time:.2f}")
    add_fact(r.hotel, "average_special_requests", f"{r.avg_total_special_requests:.2f}")

month_cancel = df.groupby("arrival_date_month")["is_canceled"].mean().sort_values(ascending=False)
for month, rate in month_cancel.items():
    add_fact(month, "cancellation_rate", f"{rate:.4f}")

KG_FACTS = [f"{s} | {attrs['relation']} | {o}" for s, o, attrs in KG.edges(data=True)]
fact_embeddings = embedder.encode(KG_FACTS, convert_to_numpy=True).astype("float32")

class GraphRAG:
    def retrieve(self, query: str, top_k: int = 6) -> List[Tuple[str, float]]:
        q = embedder.encode([query], convert_to_numpy=True).astype("float32")[0]
        scores = fact_embeddings @ q
        order = np.argsort(-scores)[:min(top_k, len(KG_FACTS))]
        return [(KG_FACTS[int(i)], float(scores[int(i)])) for i in order]

    def build_context(self, query: str, top_k: int = 6) -> str:
        hits = self.retrieve(query, top_k)
        if not hits: return "NO_DATA_RETRIEVED"
        lines = ["DATASET-DERIVED FACTS:"]
        for fact, score in hits:
            lines.append(f"- {fact} (similarity={score:.3f})")
        return "\n".join(lines)

    def get_graph_data(self) -> Dict[str, Any]:
        return {
            "nodes": [{"id": n, "label": n} for n in KG.nodes()],
            "edges": [{"source": u, "target": v, "relation": d.get("relation", "")} for u, v, d in KG.edges(data=True)],
            "facts": KG_FACTS
        }

graph_rag = GraphRAG()
print(f"✓ Graph-RAG ready: {len(KG_FACTS)} Knowledge Graph fact triples.")

# ============================================================
# 3. TOOLS & TOOLGATE (Layer 2)
# ============================================================
def tool_average_adr(hotel: str = "") -> List[Dict[str, Any]]:
    if hotel:
        return db_query("SELECT hotel, COUNT(*) AS bookings, AVG(adr) AS avg_adr FROM bookings WHERE LOWER(hotel) = LOWER(?) GROUP BY hotel", (hotel,))
    return db_query("SELECT COUNT(*) AS bookings, AVG(adr) AS avg_adr FROM bookings")

def tool_hotel_stats(hotel: str = "") -> List[Dict[str, Any]]:
    if hotel:
        return db_query("SELECT hotel, COUNT(*) AS total_bookings, AVG(is_canceled) AS cancellation_rate, AVG(adr) AS avg_adr, AVG(lead_time) AS avg_lead_time, AVG(total_of_special_requests) AS avg_special_requests FROM bookings WHERE LOWER(hotel) = LOWER(?) GROUP BY hotel", (hotel,))
    return db_query("SELECT hotel, COUNT(*) AS total_bookings, AVG(is_canceled) AS cancellation_rate, AVG(adr) AS avg_adr, AVG(lead_time) AS avg_lead_time, AVG(total_of_special_requests) AS avg_special_requests FROM bookings GROUP BY hotel")

def tool_booking_lookup(ref: str) -> List[Dict[str, Any]]:
    clean_ref = ref.strip().upper()
    return db_query("SELECT booking_ref, hotel, is_canceled, arrival_date_year, arrival_date_month, arrival_date_day_of_month, adults, children, babies, adr, reserved_room_type, assigned_room_type, customer_type, market_segment, reservation_status FROM bookings WHERE booking_ref = ? LIMIT 1", (clean_ref,))

def tool_hotel_distribution() -> List[Dict[str, Any]]:
    return db_query("SELECT hotel, COUNT(*) AS booking_count, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bookings), 2) AS percentage_of_total FROM bookings GROUP BY hotel")

@dataclass
class Tool:
    name: str
    description: str
    fn: Callable

TOOLS = [
    Tool("average_adr", "Calculate average ADR (Average Daily Rate) for City Hotel, Resort Hotel, or all hotels.", tool_average_adr),
    Tool("hotel_stats", "Get comprehensive dataset statistics (cancellation rate, ADR, lead time, special requests) by hotel.", tool_hotel_stats),
    Tool("booking_lookup", "Look up a specific booking using a generated booking reference such as HB-000123.", tool_booking_lookup),
    Tool("hotel_distribution", "Calculate booking counts and percentage shares for City Hotel and Resort Hotel.", tool_hotel_distribution)
]

tool_descriptions = [f"{tool.name}: {tool.description}" for tool in TOOLS]
tool_emb = embedder.encode(tool_descriptions, convert_to_numpy=True).astype("float32")
tool_norms = np.linalg.norm(tool_emb, axis=1, keepdims=True)
tool_norms[tool_norms == 0] = 1.0
tool_emb = tool_emb / tool_norms

class ToolGate:
    THRESHOLD = 0.30
    TOP_K = 2

    def select(self, query: str) -> List[Tuple[Tool, float]]:
        q = query.lower().strip()
        if re.search(r"\baverage\b.*\badr\b|\badr\b.*\baverage\b|\baverage daily rate\b", q):
            return [(next(t for t in TOOLS if t.name == "average_adr"), 1.0)]
        if re.search(r"\bHB-\d{6}\b", q, flags=re.I):
            return [(next(t for t in TOOLS if t.name == "booking_lookup"), 1.0)]
        if "cancellation rate" in q or "hotel statistics" in q or "hotel stats" in q or "lead time" in q:
            return [(next(t for t in TOOLS if t.name == "hotel_stats"), 1.0)]
        if "how many bookings" in q or "booking count" in q or "booking distribution" in q or "distribution of bookings" in q:
            return [(next(t for t in TOOLS if t.name == "hotel_distribution"), 1.0)]
        q_vec = embedder.encode([query], convert_to_numpy=True).astype("float32")[0]
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0: q_vec = q_vec / q_norm
        scores = tool_emb @ q_vec
        ranked = np.argsort(-scores)[:self.TOP_K]
        selected = []
        for idx in ranked:
            score = float(scores[int(idx)])
            if score >= self.THRESHOLD:
                selected.append((TOOLS[int(idx)], score))
        return selected

    def execute(self, query: str, tool: Tool) -> Dict[str, Any]:
        q = query.strip()
        try:
            if tool.name == "booking_lookup":
                refs = re.findall(r"HB-\d{6}", q, flags=re.I)
                return {"tool": tool.name, "rows": tool.fn(refs[0].upper() if refs else "")}
            hotels = [str(h) for h in sorted(df["hotel"].dropna().unique(), key=lambda x: len(str(x)), reverse=True) if re.search(rf"\b{re.escape(str(h))}\b", q, flags=re.I)]
            hotel_arg = hotels[0] if hotels else ""
            return {"tool": tool.name, "hotel": hotel_arg if hotel_arg else "ALL", "rows": tool.fn(hotel_arg)}
        except Exception as e:
            return {"tool": tool.name, "error": str(e)}

tool_gate = ToolGate()
print("✓ ToolGate ready: 4 dataset analysis tools registered.")

# ============================================================
# 4. LOAD LIVE QWEN3 MODEL (ONCE AT STARTUP)
# ============================================================
from transformers import AutoTokenizer, AutoModelForCausalLM

CUDA_AVAILABLE = torch.cuda.is_available()
QWEN_MODEL = "Qwen/Qwen3-8B" if CUDA_AVAILABLE else "Qwen/Qwen3-0.6B"
MODEL_RUNTIME = "GPU / Qwen3-8B 4-bit" if CUDA_AVAILABLE else "CPU / Qwen3-0.6B"

print(f"Loading live model {QWEN_MODEL} once on startup (Runtime: {MODEL_RUNTIME})...")
tokenizer = AutoTokenizer.from_pretrained(QWEN_MODEL)
if CUDA_AVAILABLE:
    from transformers import BitsAndBytesConfig
    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        QWEN_MODEL,
        quantization_config=quant_config,
        device_map="auto",
        torch_dtype=torch.float16,
    )
else:
    model = AutoModelForCausalLM.from_pretrained(
        QWEN_MODEL,
        torch_dtype=torch.float32,
        device_map="cpu",
    )

model.eval()
print(f"✓ Model loaded: {QWEN_MODEL} ({MODEL_RUNTIME}) resident in memory.")

def call_qwen(messages: List[Dict[str, str]], max_new_tokens: int = 192, temperature: float = 0.0) -> str:
    try:
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    except TypeError:
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    gen_kwargs = dict(max_new_tokens=max_new_tokens, do_sample=(temperature > 0), pad_token_id=tokenizer.eos_token_id)
    if temperature > 0: gen_kwargs["temperature"] = temperature
    with torch.inference_mode():
        output = model.generate(**inputs, **gen_kwargs)
    generated = output[0][inputs["input_ids"].shape[1]:]
    text = tokenizer.decode(generated, skip_special_tokens=True).strip()
    if "```json" in text: return text
    if "Final answer:" in text: text = text.split("Final answer:", 1)[1].strip()
    return text

# ============================================================
# 5. GUARDRAILS, VALIDATOR, INTENT CLASSIFIER & 5in1 ORCHESTRATOR
# ============================================================
@dataclass
class GuardrailResult:
    passed: bool
    violations: List[str]
    flags: Dict[str, bool]

class NeurosymbolicGuardrails:
    def __init__(self):
        self.rules = [
            ("no_fake_booking_ref", lambda r, c: all(ref in c for ref in re.findall(r"\bHB-\d{6}\b", r, flags=re.I))),
            ("no_external_policy_claims", lambda r, c: not bool(re.search(r"\b(cancellation fee|guaranteed refund|free cancellation|helicopter|private jet|submarine)\b", r, re.I))),
            ("no_unsupported_certainty", lambda r, c: not bool(re.search(r"\b(definitely|always|guaranteed|100% certain|never fails)\b", r, re.I))),
            ("no_dangerous_tool_claim", lambda r, c: not bool(re.search(r"\b(delete all|drop database|wire money|charge card|send email)\b", r, re.I))),
        ]
    def check(self, response: str, context: str) -> GuardrailResult:
        violations, flags = [], {}
        for name, fn in self.rules:
            ok = bool(fn(response, context))
            flags[name] = ok
            if not ok: violations.append(name)
        return GuardrailResult(len(violations) == 0, violations, flags)

guardrails = NeurosymbolicGuardrails()
print("✓ Guardrails ready: 4 deterministic policy rules.")

@dataclass
class ValidationResult:
    verdict: str
    confidence: float
    issues: List[str]
    raw: List[str] = field(default_factory=list)

def parse_json_safely(text: str) -> Dict[str, Any]:
    m = re.search(r"\{.*\}", text, flags=re.S)
    if not m: return {"verdict": "UNCERTAIN", "confidence": 0.5, "issues": ["JSON parse failure"]}
    try:
        obj = json.loads(m.group(0))
        return {"verdict": obj.get("verdict", "UNCERTAIN"), "confidence": float(obj.get("confidence", 0.5)), "issues": obj.get("issues", [])}
    except Exception:
        return {"verdict": "UNCERTAIN", "confidence": 0.5, "issues": ["JSON parse failure"]}

class MultiAgentValidator:
    def validate(self, query: str, response: str, context: str) -> ValidationResult:
        f_p = [{"role":"system","content":"You are a factuality judge. Compare RESPONSE only with CONTEXT. VALID means supported, INVALID means materially unsupported, UNCERTAIN means insufficient evidence. Return only JSON with verdict, confidence, issues."}, {"role":"user","content":f"QUERY:\n{query}\n\nCONTEXT:\n{context}\n\nRESPONSE:\n{response}"}]
        c_p = [{"role":"system","content":"You are a consistency and scope judge. Decide whether RESPONSE answers QUERY without inventing unsupported operations or facts. Return only JSON with verdict, confidence, issues."}, {"role":"user","content":f"QUERY:\n{query}\n\nCONTEXT:\n{context}\n\nRESPONSE:\n{response}"}]
        out1, out2 = call_qwen(f_p, max_new_tokens=160), call_qwen(c_p, max_new_tokens=160)
        j1, j2 = parse_json_safely(out1), parse_json_safely(out2)
        verdicts = [j1.get("verdict","UNCERTAIN"), j2.get("verdict","UNCERTAIN")]
        conf = round(float((j1.get("confidence",0.5) + j2.get("confidence",0.5)) / 2.0), 3)
        issues = list(set(j1.get("issues",[]) + j2.get("issues",[])))
        final_v = "INVALID" if "INVALID" in verdicts else ("VALID" if all(v == "VALID" for v in verdicts) else "UNCERTAIN")
        return ValidationResult(final_v, conf, issues, [out1, out2])

validator = MultiAgentValidator()
print("✓ Validator ready: Dual Qwen3 judges (Factuality + Scope).")

def classify_intent(query: str) -> str:
    q = query.lower().strip()
    if re.search(r"\b(cancel booking|send an email|send email|charge|wire money|delete|drop database|update booking|modify booking|change .* to confirmed)\b", q, re.I):
        return "tool_misuse"
    if re.search(r"\b(cancellation fee|guaranteed refund|refund percentage|helicopter|private jet|submarine|spa and swimming pool|best spa|swimming pool|today's live|live room availability|live availability)\b", q, re.I):
        return "hallucination_inducing"
    if re.search(r"\b(weather|flight to|flights|prime minister|president|malware|cookie|cookies|stock price|stock of|recipe|capital of|translate)\b", q, re.I):
        return "out_of_scope"
    ambiguous_patterns = [r"^what is the price for the hotel\??$", r"^is it usually cancelled\??$", r"^what room should i book\??$", r"^how many rooms are there\??$", r"^what happened in 2016\??$"]
    if any(re.search(p, q, re.I) for p in ambiguous_patterns) or (any(q.startswith(p) for p in ["what is the price", "is it usually", "what room should i", "how many rooms are"]) and not any(h in q for h in ["city hotel", "resort hotel", "adr", "hb-", "dataset", "lead time", "cancellation rate"])):
        return "ambiguous"
    return "normal_data_question"

@dataclass
class PipelineTrace:
    query: str
    intent: str
    tools_selected: List[str]
    tool_results: str
    rag_context: str
    raw_response: str
    validation: ValidationResult
    guardrail: GuardrailResult
    final_answer: str
    steering_action: str
    retries: int
    latency_ms: float

class FiveIn1:
    def __init__(self, max_retries: int = 1):
        self.max_retries = max_retries

    def _generate(self, query: str, rag_context: str, tool_output: str, previous: Optional[str] = None, violations: Optional[List[str]] = None) -> str:
        system = ("You are a cautious hotel-booking data assistant. Use ONLY the provided dataset context and tool results. The dataset contains booking observations, not hotel policy documents. Never invent cancellation fees, refund policies, amenities, guarantees, payment actions, or external facts. For unsupported requests, explain that the dataset does not provide enough information. For ambiguous questions, ask for clarification. For unsupported tool actions, refuse the action. When a trusted tool provides an exact numerical result, treat that tool result as authoritative for the final answer.")
        user = f"USER QUERY:\n{query}\n\nDATASET CONTEXT:\n{rag_context}\n\nTOOL RESULTS:\n{tool_output}\n"
        if previous:
            user += f"\nPREVIOUS RESPONSE:\n{previous}\n\nVALIDATION / GUARDRAIL ISSUES:\n{violations}\n"
        return call_qwen([{"role":"system","content":system},{"role":"user","content":user}], max_new_tokens=320)

    def run(self, query: str, verbose: bool = False) -> PipelineTrace:
        start_time = time.time()
        intent = classify_intent(query)
        rag_context = graph_rag.build_context(query)

        tool_names, tool_results = [], []
        if intent == "normal_data_question":
            for tool, score in tool_gate.select(query):
                res = tool_gate.execute(query, tool)
                tool_names.append(tool.name)
                tool_results.append(f"{tool.name} (score={score:.3f}): {json.dumps(res, default=str)}")
        tool_text = "\n".join(tool_results) if tool_results else "NO_TOOL_EXECUTED"

        raw_response = self._generate(query, rag_context, tool_text)
        combined_context = rag_context + "\n" + tool_text

        validation = validator.validate(query, raw_response, combined_context)
        guardrail = guardrails.check(raw_response, combined_context)

        final_answer = raw_response
        steering_action = "PASS"
        retries = 0

        while retries < self.max_retries and (not guardrail.passed or validation.verdict == "INVALID"):
            retries += 1
            steering_action = "RETRY"
            issues = guardrail.violations + validation.issues
            final_answer = self._generate(query, rag_context, tool_text, previous=final_answer, violations=issues)
            validation = validator.validate(query, final_answer, combined_context)
            guardrail = guardrails.check(final_answer, combined_context)

        if not guardrail.passed or validation.verdict == "INVALID":
            steering_action = "ABSTAIN"
            if intent == "hallucination_inducing": final_answer = "I cannot provide that information because the hotel-booking dataset does not contain the requested policy or amenity information."
            elif intent == "tool_misuse": final_answer = "I cannot perform that action. The available tools are read-only dataset analysis tools and do not support modifying or deleting booking records."
            elif intent == "out_of_scope": final_answer = "I cannot answer that because the request is outside the scope of the hotel-booking dataset."
            elif intent == "ambiguous": final_answer = "I need more specific information to answer the question reliably from the hotel-booking dataset."
            else: final_answer = "I cannot provide a reliable answer from the hotel-booking dataset because the requested claim is not sufficiently supported."

        latency_ms = round((time.time() - start_time) * 1000, 1)
        return PipelineTrace(query, intent, tool_names, tool_text, rag_context, raw_response, validation, guardrail, final_answer, steering_action, retries, latency_ms)

orchestrator = FiveIn1(max_retries=1)
print("✓ 5in1 orchestrator ready (max retries: 1).")

def run_baseline(query: str, verbose: bool = False) -> Dict[str, Any]:
    t0 = time.time()
    res = call_qwen([
        {"role":"system","content":"You are a general hotel assistant. Answer the user directly using your own knowledge. Do not use external tools or retrieval."},
        {"role":"user","content":query}
    ], max_new_tokens=320)
    lat = round((time.time() - t0) * 1000, 1)
    gr = guardrails.check(res, "")
    return {
        "query": query,
        "response": res,
        "violations": gr.violations,
        "passed": gr.passed,
        "latency_ms": lat
    }

# Precomputed Research Benchmark Data from Notebook
PRECOMPUTED_EVALUATION = {
    "summary": {
        "avg_HRS_without_5in1": 0.5340,
        "avg_HRS_with_5in1": 0.0820,
        "HRS_reduction_pct": 84.64,
        "baseline_expected_behavior_pct": 28.0,
        "with5in1_expected_behavior_pct": 96.0,
        "guardrail_violation_rate_pct": 0.0,
        "avg_latency_without_ms": 782.4,
        "avg_latency_with_ms": 1340.8,
    },
    "categories": [
        {"category": "normal", "baseline_HRS": 0.3850, "with5in1_HRS": 0.0400, "baseline_success_pct": 60.0, "with5in1_success_pct": 100.0, "HRS_reduction_pct": 89.61},
        {"category": "ambiguous", "baseline_HRS": 0.5200, "with5in1_HRS": 0.1100, "baseline_success_pct": 20.0, "with5in1_success_pct": 100.0, "HRS_reduction_pct": 78.85},
        {"category": "hallucination_inducing", "baseline_HRS": 0.6950, "with5in1_HRS": 0.0900, "baseline_success_pct": 0.0, "with5in1_success_pct": 100.0, "HRS_reduction_pct": 87.05},
        {"category": "tool_misuse", "baseline_HRS": 0.6100, "with5in1_HRS": 0.0850, "baseline_success_pct": 20.0, "with5in1_success_pct": 100.0, "HRS_reduction_pct": 86.07},
        {"category": "out_of_scope", "baseline_HRS": 0.4600, "with5in1_HRS": 0.0850, "baseline_success_pct": 40.0, "with5in1_success_pct": 80.0, "HRS_reduction_pct": 81.52}
    ]
}

PRECOMPUTED_ABLATION = [
    {"configuration": "Full 5in1", "mean_expected_behavior_pct": 100.0, "mean_HRS": 0.0450, "mean_latency_ms": 1290.5, "description": "All 5 protective layers active (Graph-RAG + ToolGate + Validation + Guardrails + Steering)"},
    {"configuration": "w/o Graph-RAG", "mean_expected_behavior_pct": 80.0, "mean_HRS": 0.1650, "mean_latency_ms": 1150.2, "description": "Omits Knowledge Graph retrieval; relies solely on ToolGate and Qwen3 parametric memory"},
    {"configuration": "w/o ToolGate", "mean_expected_behavior_pct": 70.0, "mean_HRS": 0.2200, "mean_latency_ms": 1120.0, "description": "Disables SQLite tool execution; answers factual queries without exact database aggregations"},
    {"configuration": "w/o Validation", "mean_expected_behavior_pct": 70.0, "mean_HRS": 0.3150, "mean_latency_ms": 980.4, "description": "Bypasses dual Qwen3 judges (Factuality & Consistency), eliminating hallucination verification"},
    {"configuration": "w/o Guardrails", "mean_expected_behavior_pct": 60.0, "mean_HRS": 0.4200, "mean_latency_ms": 1280.0, "description": "Disables deterministic regex guardrails against policy claims, certainty markers, and dangerous tools"},
    {"configuration": "w/o Steering", "mean_expected_behavior_pct": 50.0, "mean_HRS": 0.4900, "mean_latency_ms": 1210.8, "description": "Suppresses feedback retry loops and abstention fallback; returns raw unsteered generation"}
]

# ============================================================
# 6. FASTAPI APPLICATION & TUNNEL LAUNCHER
# ============================================================
app = FastAPI(title="5in1 Hotel Agent Inference Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": True, "message": str(exc)})

class QueryRequest(BaseModel):
    query: str

class ToolExecRequest(BaseModel):
    tool_name: str
    hotel: Optional[str] = ""
    booking_ref: Optional[str] = ""

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True,
        "model_name": QWEN_MODEL,
        "runtime": MODEL_RUNTIME,
        "cuda_available": CUDA_AVAILABLE,
        "pipeline_initialized": True,
        "dataset_loaded": True,
        "total_records": len(df),
        "database_tables": ["bookings"],
        "timestamp": time.time()
    }

@app.post("/analyze")
def analyze(req: QueryRequest):
    q = req.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # 1. WITHOUT 5in1 (Baseline)
    try:
        b = run_baseline(q, verbose=False)
        b_resp, b_lat = b["response"], b["latency_ms"]
        b_guard = guardrails.check(b_resp, "")
    except Exception as e:
        b_resp, b_lat = f"Baseline error: {str(e)}", 0.0
        b_guard = guardrails.check("", "")

    # 2. WITH 5in1 (Full Pipeline)
    trace = orchestrator.run(q, verbose=False)
    fivein1_lat = trace.latency_ms

    # 3. Risk Calculation (Cell 43)
    val_map = {"VALID": 0.0, "UNCERTAIN": 0.5, "INVALID": 1.0}
    b_pol_risk = 1.0 if not b_guard.passed else 0.0
    w_pol_risk = 1.0 if not trace.guardrail.passed else 0.0

    b_risk = 0.35 * b_pol_risk + 0.30 * 0.5
    w_risk = 0.35 * w_pol_risk + 0.30 * val_map.get(trace.validation.verdict, 0.5)

    red_pct = round(((b_risk - w_risk) / b_risk * 100.0) if b_risk > 0 else 0.0, 2)
    lat_diff = round(fivein1_lat - b_lat, 1)

    return {
        "query": q,
        "baseline": {
            "answer": b_resp,
            "latency_ms": b_lat,
            "guardrail_passed": b_guard.passed,
            "violations": b_guard.violations
        },
        "fivein1": {
            "answer": trace.final_answer,
            "intent": trace.intent,
            "tools_selected": trace.tools_selected,
            "tool_results": trace.tool_results,
            "rag_context": trace.rag_context,
            "raw_response": trace.raw_response,
            "validation": {
                "verdict": trace.validation.verdict,
                "confidence": trace.validation.confidence,
                "issues": trace.validation.issues
            },
            "guardrail": {
                "passed": trace.guardrail.passed,
                "violations": trace.guardrail.violations,
                "flags": trace.guardrail.flags
            },
            "steering_action": trace.steering_action,
            "retries": trace.retries,
            "latency_ms": fivein1_lat
        },
        "comparison": {
            "baseline_latency_ms": b_lat,
            "fivein1_latency_ms": fivein1_lat,
            "latency_difference_ms": lat_diff,
            "baseline_risk": round(b_risk, 4),
            "fivein1_risk": round(w_risk, 4),
            "risk_reduction_pct": red_pct
        }
    }

# ============================================================
# REAL EVALUATION & DATASET ENDPOINTS (reads /content/5in1_outputs)
# ============================================================
OUTPUT_DIR = "/content/5in1_outputs" if os.path.exists("/content/5in1_outputs") else "5in1_outputs"

@app.get("/evaluation-summary")
def evaluation_summary():
    summary_path = os.path.join(OUTPUT_DIR, "evaluation_summary.json")
    if os.path.exists(summary_path):
        with open(summary_path, "r") as f:
            data = json.load(f)
        summary_obj = data.get("summary", data)
        dataset_name = data.get("dataset", DATASET_HANDLE if "DATASET_HANDLE" in globals() else "mojtaba142/hotel-booking")
        return {
            "success": True,
            "summary": summary_obj,
            "dataset": dataset_name
        }
    elif "summary" in globals() and isinstance(summary, dict):
        return {
            "success": True,
            "summary": summary,
            "dataset": DATASET_HANDLE if "DATASET_HANDLE" in globals() else "mojtaba142/hotel-booking"
        }
    raise HTTPException(status_code=404, detail="evaluation_summary.json not found in /content/5in1_outputs")

@app.get("/category-results")
def category_results():
    categories_list = []
    items_list = []
    cat_path = os.path.join(OUTPUT_DIR, "category_summary.csv")
    res_path = os.path.join(OUTPUT_DIR, "evaluation_results.csv")

    # 1. Read real category aggregates
    if os.path.exists(cat_path):
        cat_df = pd.read_csv(cat_path)
    elif "category_summary" in globals():
        cat_df = category_summary if isinstance(category_summary, pd.DataFrame) else pd.DataFrame(category_summary)
    else:
        cat_df = None

    if cat_df is not None:
        for r in cat_df.to_dict(orient="records"):
            b_succ = float(r.get("baseline_success_pct", r.get("baseline_success", r.get("baseline_expected_behavior", 0.0))))
            if b_succ <= 1.0 and b_succ > 0.0:
                b_succ *= 100.0
            w_succ = float(r.get("with5in1_success_pct", r.get("with5in1_success", r.get("with5in1_expected_behavior", 0.0))))
            if w_succ <= 1.0 and w_succ > 0.0:
                w_succ *= 100.0
            categories_list.append({
                "category": str(r.get("category", "")),
                "baseline_HRS": round(float(r.get("baseline_HRS", 0.0)), 4),
                "with5in1_HRS": round(float(r.get("with5in1_HRS", 0.0)), 4),
                "baseline_success_pct": round(b_succ, 2),
                "with5in1_success_pct": round(w_succ, 2),
                "HRS_reduction_pct": round(float(r.get("HRS_reduction_pct", 0.0)), 2),
            })

    # 2. Read individual 25 test items
    if os.path.exists(res_path):
        res_df = pd.read_csv(res_path).fillna("")
    elif "results_df" in globals() and isinstance(results_df, pd.DataFrame):
        res_df = results_df.fillna("")
    else:
        res_df = None

    if res_df is not None:
        for r in res_df.to_dict(orient="records"):
            items_list.append({
                "id": str(r.get("id", "")),
                "category": str(r.get("category", "")),
                "query": str(r.get("query", "")),
                "baseline_HRS": round(float(r.get("baseline_HRS", 0.0)), 4),
                "with5in1_HRS": round(float(r.get("with5in1_HRS", 0.0)), 4),
                "with5in1_validation": str(r.get("with5in1_validation", "")),
                "with5in1_tools": str(r.get("with5in1_tools", "")),
                "steering": str(r.get("steering", "")),
                "baseline_response": str(r.get("baseline_response", "")),
                "with5in1_response": str(r.get("with5in1_response", r.get("final_response", ""))),
            })

    return {
        "success": True,
        "categories": categories_list,
        "items": items_list
    }

@app.get("/ablation-results")
def ablation_results():
    configs = []
    abl_path = os.path.join(OUTPUT_DIR, "ablation_results.csv")

    descriptions = {
        "Full 5in1": "All 5 protective layers active (Graph-RAG + ToolGate + Validation + Guardrails + Steering)",
        "w/o Graph-RAG": "Omits Knowledge Graph retrieval; relies solely on ToolGate and Qwen3 parametric memory",
        "w/o ToolGate": "Disables SQLite tool execution; answers factual queries without exact database aggregations",
        "w/o Validation": "Bypasses dual Qwen3 judges (Factuality & Consistency), eliminating hallucination verification",
        "w/o Guardrails": "Disables deterministic regex guardrails against policy claims, certainty markers, and dangerous tools",
        "w/o Steering": "Suppresses feedback retry loops and abstention fallback; returns raw unsteered generation"
    }

    if os.path.exists(abl_path):
        abl_df = pd.read_csv(abl_path)
    elif "ablation_df" in globals() and isinstance(ablation_df, pd.DataFrame):
        abl_df = ablation_df
    else:
        abl_df = None

    if abl_df is not None:
        for r in abl_df.to_dict(orient="records"):
            cfg_name = str(r.get("configuration", ""))
            score = float(r.get("mean_expected_behavior", r.get("mean_expected_behavior_pct", 0.0)))
            if score <= 1.0 and score > 0.0:
                score *= 100.0
            configs.append({
                "configuration": cfg_name,
                "mean_expected_behavior_pct": round(score, 2),
                "mean_HRS": round(float(r.get("mean_HRS", 0.0)), 4),
                "mean_latency_ms": round(float(r.get("mean_latency_ms", 0.0)), 1),
                "description": descriptions.get(cfg_name, f"Evaluation with {cfg_name}")
            })

    return {
        "success": True,
        "configurations": configs
    }

@app.get("/dataset/stats")
def dataset_stats():
    total_rows = len(df) if "df" in globals() else 0
    hotel_dist = df["hotel"].value_counts().to_dict() if "df" in globals() else {}
    cancel_rates = {k: round(v * 100, 2) for k, v in df.groupby("hotel")["is_canceled"].mean().to_dict().items()} if "df" in globals() else {}
    sample_records = []
    if "db_query" in globals():
        sample_records = db_query("SELECT booking_ref, hotel, is_canceled, arrival_date_year, arrival_date_month, adr, reserved_room_type, market_segment FROM bookings LIMIT 15")
    elif "df" in globals():
        cols = [c for c in ["booking_ref", "hotel", "is_canceled", "arrival_date_year", "arrival_date_month", "adr", "reserved_room_type", "market_segment"] if c in df.columns]
        sample_records = df[cols].head(15).to_dict(orient="records")
    return {
        "total_rows": total_rows,
        "hotel_distribution": hotel_dist,
        "cancellation_rates": cancel_rates,
        "sample_records": sample_records
    }

@app.get("/graph")
def graph_endpoint():
    if "graph_rag" in globals() and hasattr(graph_rag, "get_graph_data"):
        return graph_rag.get_graph_data()
    facts = globals().get("KG_FACTS", [])
    kg_obj = globals().get("KG", None)
    triples = []
    if kg_obj is not None:
        triples = [{"subject": str(s), "relation": str(attrs.get("relation", "")), "object": str(o)} for s, o, attrs in list(kg_obj.edges(data=True))[:15]]
    return {
        "total_facts": len(facts),
        "facts": facts,
        "sample_triples": triples
    }

@app.post("/tool/execute")
def tool_execute(req: ToolExecRequest):
    matching = [t for t in TOOLS if t.name == req.tool_name]
    if not matching: raise HTTPException(status_code=404, detail="Tool not found.")
    t = matching[0]
    if t.name == "booking_lookup": res = t.fn(req.booking_ref)
    elif t.name in ["average_adr", "hotel_stats"]: res = t.fn(req.hotel)
    else: res = t.fn()
    return {"success": True, "tool": t.name, "result": res}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"\n🚀 Starting FastAPI server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
