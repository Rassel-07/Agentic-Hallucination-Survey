# 🏨 5in1 Hotel Agent — Capstone Deployment Guide

This guide details how to deploy the **5in1 Hotel Agent** system with the **Next.js frontend on Vercel** and the **Qwen3 (8B 4-bit GPU) inference server in Google Colab**.

---

## 🏛️ Deployment Architecture

```
User Browser
    ↓
Vercel (Next.js + TypeScript Frontend)
    ↓
Environment Variable: NEXT_PUBLIC_API_URL
    ↓
Google Colab Public HTTPS Tunnel (https://*.trycloudflare.com)
    ↓
FastAPI Backend (Port 8000)
    ↓
Preloaded Qwen3 (8B 4-bit GPU) + 5in1 Pipeline
(Graph-RAG → ToolGate → Multi-Agent Validation → Guardrails → Steering)
    ↓
JSON Response
    ↓
Vercel UI (Dynamic Comparative Display & Visual Trace)
```

> [!IMPORTANT]
> **No Large Models on Vercel**: Heavy GPU inference runs in Google Colab. The frontend only handles the presentation layer and makes HTTPS API calls.
> **Zero Retraining on Requests**: The Qwen3 model is loaded **once** at Colab startup and reused for all user queries.
> **No Exposed Secrets**: No API keys or Kaggle credentials are embedded in the client bundle.

---

## 📋 Step-by-Step Deployment Instructions

### Step 1: Run the ML System in Google Colab
1. Open [Google Colab](https://colab.research.google.com).
2. Upload and open [`colab_backend.ipynb`](file:///Users/razel/Downloads/Project/colab_backend.ipynb).
3. Ensure a GPU runtime is selected:
   - Click **Runtime → Change runtime type**
   - Select **T4 GPU** (or A100 GPU) and save.

### Step 2: Start the FastAPI Backend
1. Click **Runtime → Run all** (or run cells sequentially 1 through 7).
2. The notebook will automatically:
   - Install dependencies (`transformers`, `accelerate`, `bitsandbytes`, `fastapi`, `uvicorn`, `networkx`, `kagglehub`, `pandas`).
   - Download the Kaggle dataset (`mojtaba142/hotel-booking`, 119,390 records) and create the SQLite table `bookings`.
   - Build the 22 fact-triple Knowledge Graph and embed it with the 384-dimensional lexical embedder.
   - Load the **Qwen3 (8B 4-bit)** model into GPU memory.
   - Initialize the 4 deterministic Guardrail rules, dual Multi-Agent Validation judges, Intent Router, and the `FiveIn1` Orchestrator.
   - Start the FastAPI server on `http://127.0.0.1:8000` in a background daemon thread.

### Step 3: Obtain the Public HTTPS Tunnel URL
At the output of **Cell 7**, Cloudflare Tunnel will start and print your public tunnel URL:

```text
================================================================================
🏨 5in1 HOTEL AGENT — GOOGLE COLAB GPU INFERENCE SERVER READY
================================================================================
✓ Model loaded        : Qwen/Qwen3-8B (GPU / Qwen3-8B 4-bit)
✓ Dataset loaded      : mojtaba142/hotel-booking (119,390 rows)
✓ Database ready      : SQLite table 'bookings' (/content/hotel_booking_kaggle.db)
✓ Graph-RAG ready     : 22 Knowledge Graph fact triples
✓ ToolGate ready      : 4 dataset analysis tools
✓ Validator ready     : Dual Qwen3 judges (Factuality + Scope)
✓ Guardrails ready    : 4 deterministic policy regex rules
✓ 5in1 orchestrator   : Ready (max retries: 1)
✓ API ready           : http://127.0.0.1:8000
✓ Public URL ready    : https://xxxxxxxx-xxxx.trycloudflare.com
================================================================================
👉 PASTE THIS URL INTO YOUR VERCEL FRONTEND: https://xxxxxxxx-xxxx.trycloudflare.com
================================================================================
```

Copy the `https://*.trycloudflare.com` URL.

---

### Step 4: Set `NEXT_PUBLIC_API_URL` in Vercel
1. Go to your [Vercel Dashboard](https://vercel.com).
2. Open your project settings: **Settings → Environment Variables**.
3. Add a new variable:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://xxxxxxxx-xxxx.trycloudflare.com` (your Colab tunnel URL)
   - **Target**: Production, Preview, Development.
4. Click **Save**.

---

### Step 5: Deploy the Frontend to Vercel
1. Connect your GitHub repository containing the `frontend/` folder to Vercel.
2. If the project root is the repository root:
   - Set **Root Directory** in Vercel Project Settings to `frontend`.
   - **Framework Preset**: Next.js.
   - **Build Command**: `next build` (default).
   - **Output Directory**: `.next` (default).
3. Click **Deploy**.

---

### Step 6: Test the `/health` Endpoint
Verify your Colab backend is live and answering health queries:

```bash
curl -X GET https://your-colab-tunnel.trycloudflare.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_name": "Qwen/Qwen3-8B",
  "runtime": "GPU / Qwen3-8B 4-bit",
  "cuda_available": true,
  "pipeline_initialized": true,
  "dataset_loaded": true,
  "total_records": 119390,
  "database_tables": ["bookings"],
  "timestamp": 1788362400.12
}
```

---

### Step 7: Test a Live Query (`POST /analyze`)
Send a test query to verify live baseline and 5in1 pipeline execution:

```bash
curl -X POST https://your-colab-tunnel.trycloudflare.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the average ADR for City Hotel?"}'
```

**Expected Response**:
```json
{
  "query": "What is the average ADR for City Hotel?",
  "baseline": {
    "answer": "The average ADR for City Hotel is not provided in the available information...",
    "latency_ms": 782.4,
    "guardrail_passed": true,
    "violations": []
  },
  "fivein1": {
    "answer": "The average ADR for City Hotel is 105.30 across 79,330 bookings.",
    "intent": "normal_data_question",
    "tools_selected": ["average_adr"],
    "tool_results": "average_adr (score=1.000): [{'hotel': 'City Hotel', 'bookings': 79330, 'avg_adr': 105.304}]",
    "rag_context": "DATASET-DERIVED FACTS:\n- City Hotel | average_adr | 105.30...",
    "raw_response": "According to the dataset, the average ADR for City Hotel is 105.30.",
    "validation": { "verdict": "VALID", "confidence": 0.95, "issues": [] },
    "guardrail": { "passed": true, "violations": [], "flags": { "no_fake_booking_ref": true, "no_external_policy_claims": true, "no_unsupported_certainty": true, "no_dangerous_tool_claim": true } },
    "steering_action": "PASS",
    "retries": 0,
    "latency_ms": 1150.2
  },
  "comparison": {
    "baseline_latency_ms": 782.4,
    "fivein1_latency_ms": 1150.2,
    "latency_difference_ms": 367.8,
    "baseline_risk": 0.1500,
    "fivein1_risk": 0.0000,
    "risk_reduction_pct": 100.0
  }
}
```

---

### Step 8: What Happens If the Colab Runtime Is Offline?

If the Colab runtime disconnects, times out, or is restarting:

1. **Status Pill Indicator**: The top-right status pill in the Vercel header turns red: `COLAB BACKEND OFFLINE`.
2. **Graceful Error Banner**: When a user enters a query, a non-blocking error banner appears explaining that the backend is unreachable, with a direct link to reconfigure the URL.
3. **Instant Reconnection Modal**: Clicking the status pill opens the configuration modal, allowing you to paste a new Cloudflare Tunnel URL without redeploying the Vercel app.
4. **Persistent Research Tabs**: The **Evaluation Benchmark (25 Queries)**, **Ablation Matrix (6 Configs)**, and **Architecture Guides** remain fully browsable.

---

## 📁 Repository File Map

| Path | Purpose |
|---|---|
| [`colab_backend.ipynb`](file:///Users/razel/Downloads/Project/colab_backend.ipynb) | 1-click Google Colab notebook (GPU model loading + FastAPI daemon + Cloudflare tunnel) |
| [`colab_server.py`](file:///Users/razel/Downloads/Project/colab_server.py) | Standalone Python server script for Colab terminal execution (`!python colab_server.py`) |
| [`frontend/`](file:///Users/razel/Downloads/Project/frontend) | Next.js + TypeScript web application for Vercel deployment |
| [`frontend/.env.example`](file:///Users/razel/Downloads/Project/frontend/.env.example) | Example environment variable template (`NEXT_PUBLIC_API_URL`) |
| [`DEPLOYMENT.md`](file:///Users/razel/Downloads/Project/DEPLOYMENT.md) | This deployment and operations guide |
