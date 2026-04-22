# Project Presentation: Context-Aware Agentic Advisor

This presentation deck is fully aligned with the **6-Agent Sequential AI Swarm** and **5D Axis Model** found in the project's source code.

---

## Slide 1: Need / Motivation / Challenges
### The Gap in Retail Capability
*   **Fragmented Data Silos:** Existing tools separate quantitative OHLC data from qualitative news, forcing retail investors to bridge the gap manually.
*   **Absence of Contextual Reasoning:** Current systems fail to distinguish between isolated stock events and systemic sectoral shifts (e.g., Policy changes).
*   **Passive vs. Agentic Advisory:** Most AI in finance acts as a passive summarizer; there is a critical need for an **Agentic Simulator** that models complex human-like decision-making.

### Motivation
*   **Technical Ambition:** Mastering **High-Frequency Data Pipelines** using WebSockets and Redis with <10s average polling latency.
*   **Inductive Reasoning:** Transitioning from "Keyword Detection" to **Factual Induction**—reasoning how macro news impacts specific Nifty 50 constituents.

---

## Slide 2: Problem Statement
"Traditional retail terminals lack a unified reasoning layer, isolating price action from the broader informational context. This project proposes an **intelligent, multi-agent trading environment** that actively simulates autonomous decision-making (Buy/Short/Hold) by synthesizing real-time quantitative OHLC data with qualitative multi-agent sentiment, utilizing a **Context-Aware Temporal Search Graph** to provide hyper-personalized execution advice based on a **5D coordinate space**."

---

## Slide 3: Scope of the Project
*   **Focus Assets:** Exclusively limited to the **Nifty 50 Index** to ensure deep sectoral correlation and 5D modeling accuracy.
*   **Operational Boundary:** Trading operations are **purely simulated** for risk-free strategy backtesting and learning.
*   **Intelligence Source:** Ingesting 15+ sources per stock from **MoneyControl**, **Reuters**, and **Tavily Deep Search**.
*   **Advisory Basis:** Recommendations are dynamically mapped to a user's specific **Risk Profile** and **Capital Constraints**.

---

## Slide 4: Project Objectives
1.  **Agentic Market Observation:** To develop an autonomous scraper swarm utilizing **Tavily** for Tiered Domestic, Sectoral, and Global search.
2.  **Temporal & Contextual Reasoning:** To utilize a **Search Graph** with Temporal Edges to track stock trajectory relative to past market cycles.
3.  **Factual Induction Implementation:** To implement a reasoning engine capable of deducing the impact of policy shifts on industry peers.
4.  **5-Dimensional Coordinate Search:** To map market interactions across: **Time (T)**, **Stock (P)**, **Sectoral Relation (R)**, **Perception (Psi)**, and **Relevance (E)**.

---

## Slide 5: Architecture of the Proposed System
*   **Layer 1 (Frontend):** React 19 SPA with **Lightweight Charts** for 5D data visualization.
*   **Layer 2 (Real-time Pipeline):** Node.js and **Socket.io** broadcasting 10s price ticks via a Redis cache.
*   **Layer 3 (Agentic Swarm):** A **6-Agent Sequential Pipeline** (Scraper -> Analyst -> Auditor -> Grader) powered by Gemini AI.
*   **Layer 4 (Data Persistence):** **MongoDB** for long-term user/order storage and **Redis** for in-memory market state.

---

## Slide 6: Technology Stack / Data Sources / Tools
### Technology Stack (MERN+)
*   **Frontend:** React, Vite, Tailwind CSS, lightweight-charts.
*   **Backend:** Node.js, Express, Socket.io, Redis.
*   **Database:** MongoDB & Mongoose.

### Data Sources & Tools
*   **Equity Data:** `yahoo-finance2` API for live Nifty 50 ticks.
*   **Intelligence Pipe:** **Tavily Deep Search** and **Google Gemini AI**.
*   **Performance:** Redis for real-time pub/sub price broadcasting.

---

## Slide 7: Work Done Until Now (Implementation Status)
*   **Phase 1 (Infrastructure):** Successful deployment of the **Market Fetcher** and **Redis-Socket Pipeline** for live price updates.
*   **Phase 2 (Intelligence):** Completed the **6-Agent Advisor Swarm**, integrating domestic, global, and macro-economic induction logic.
*   **Phase 3 (Core Simulation):** Established the **5D Axis Vector Plotting** and **Hyper-Personalized Advisory** engine.
*   **Phase 4 (Execution):** Completed the **Order Matching Engine** for Market and Limit orders with real-time Portfolio/P&L settlement.
<br>
*Status: Core Functional Modules Integrated. Final Optimization Phase Underway.*
