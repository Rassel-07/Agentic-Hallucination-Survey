# 🏨 5in1 Hotel Agent

**A safer and more grounded Qwen3 hotel-booking agent**

This repository contains the complete implementation and deployment code for the **5in1 Hotel Agent** research capstone project.

---

## 📌 Overview

Large language models frequently hallucinate unsupported policies, invent fake booking references, and misuse tools when querying domain datasets.

The **5in1 Hotel Agent** couples the **Qwen3 (8B 4-bit)** generative model with five neurosymbolic protection layers on the **Kaggle Hotel Booking dataset** (119,390 records):

1. **Graph-RAG**: 22 NetworkX knowledge graph fact triples indexed via 384-dimensional lexical n-gram embeddings.
2. **ToolGate**: Intent-gated selective SQLite execution across 4 dataset tools (`average_adr`, `hotel_stats`, `booking_lookup`, `hotel_distribution`).
3. **Multi-Agent Validation**: Dual Qwen3 judges (Factuality Judge + Scope/Consistency Judge).
4. **Neurosymbolic Guardrails**: 4 deterministic regex policy rules (`no_fake_booking_ref`, `no_external_policy_claims`, `no_unsupported_certainty`, `no_dangerous_tool_claim`).
5. **Agent Steering**: Self-correcting feedback retry loops and intent-tailored safe refusal.

---

## 🏗️ Architecture

```
User Browser
    ↓
Vercel Frontend (Next.js + TypeScript)
    ↓
NEXT_PUBLIC_API_URL
    ↓
Google Colab Public HTTPS Tunnel (Cloudflare)
    ↓
FastAPI Backend (Port 8000)
    ↓
Loaded Qwen3 (8B 4-bit GPU) + 5in1 Pipeline
    ↓
JSON Response
    ↓
Vercel Interactive UI (Dynamic Comparative Display & Pipeline Stepper)
```

---

## 🚀 Quick Start

### 1. Backend (Google Colab)
Run the 5in1 Qwen3 FastAPI backend in Google Colab with **T4 GPU** runtime. Copy the generated public `https://*.trycloudflare.com` URL.

### 2. Frontend (Vercel)
Set `NEXT_PUBLIC_API_URL=https://your-tunnel.trycloudflare.com` in your Vercel project environment variables and deploy the `frontend/` directory.

For detailed step-by-step deployment instructions, see [**`DEPLOYMENT.md`**](file:///Users/razel/Downloads/Project/DEPLOYMENT.md).

---

## 📊 Benchmark Results

- **Hallucination Risk Score (HRS) Reduction**: **84.64%** (`0.5340` → `0.0820`)
- **Expected Safe-Behavior Score**: **96.0%** (vs. `28.0%` Baseline)
- **Guardrail Violation Rate**: **0.0%**
