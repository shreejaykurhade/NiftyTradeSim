# Proper State Diagram: Context-Aware Agentic Advisor

This documentation provides an institutional-grade UML State Diagram of the **Nifty 50 Agentic Simulation** environment, verified against the project's background polling and multi-agent reasoning architecture.

---

## Technical State Diagram (Mermaid)

```mermaid
stateDiagram-v2
    %% TRACK 1: REAL-TIME DATA PIPELINE (BACKGROUND)
    state "Real-time Data Worker" as WorkerState {
        [*] --> Idle_Polling : Wait 10 Seconds
        Idle_Polling --> Fetching_Yahoo : Execute cron job
        Fetching_Yahoo --> Updating_Redis : Cache latest OHLC
        Updating_Redis --> Broadcasting_Sockets : Emit 'market_update' 
        Broadcasting_Sockets --> Idle_Polling : Cycle complete
    }

    %% TRACK 2: AGENTIC ADVISOR TERMINAL (FOREGROUND)
    [*] --> Login_Interface
    
    Login_Interface --> Advisor_Terminal : Secure JWT Auth
    
    state Advisor_Terminal {
        [*] --> Live_Market_Dashboard : Initialize Feed
        
        Live_Market_Dashboard --> Agentic_Reasoning_Swarm : Pulse Request
        
        state Agentic_Reasoning_Swarm {
            [*] --> News_Scraping_Tavily : Deploy Scraper Agents
            News_Scraping_Tavily --> Analytical_Deep_Dive : Perform Factual Induction
            Analytical_Deep_Dive --> Factual_Auditor_Check : Verify Inductive Logic
            Factual_Auditor_Check --> Portfolio_Grader : Calculate Proprietary Score
        }
        
        Agentic_Reasoning_Swarm --> 5D_Coordinate_Mapping : Plot S = (T,P,R,Psi,E)
        5D_Coordinate_Mapping --> Hyper_Personalized_Advisory : Synthesize Signal
        
        Hyper_Personalized_Advisory --> Simulated_Trade_Execution : Process Order
        
        state Simulated_Trade_Execution {
            [*] --> Order_Matching_Engine : Price Comparison
            Order_Matching_Engine --> Portfolio_Settlement : Margin/Holdings Update
        }
        
        Portfolio_Settlement --> Live_Market_Dashboard : Refresh P&L state
    }
    
    Advisor_Terminal --> Login_Interface : De-authenticate
```

---

## State Descriptions (Institutional Accuracy)

### 1. Real-time Data Worker (Background)
A persistent background state managed by `node-cron`. Every 10 seconds, the system transitions from **Idle** to **Fetching**, then **Caching** in Redis, and finally **Broadcasting** price ticks to all connected clients via Socket.io.

### 2. Login Interface
The gateway state. It manages the transition from anonymous access to an authenticated session, which is required to trigger the high-compute AI agents.

### 3. Agentic Reasoning Swarm (Agents 1-6)
A complex composite state representing the sequential pipeline in `sentimentService.js`.
*   **Scraping (Tavily):** Ingests 15+ data points from Domestic, Sectoral, and Global sources.
*   **Induction & Auditing:** Performs the logic-based deduction (Factual Induction) and fact-checks it against raw data.
*   **Grading:** Translates unstructured reasoning into the final structured score.

### 4. 5D Coordinate Mapping
The logic-heavy state where the graded results are plotted into the 5D axis (Time, Stock, Sector, Perception, Relevance). This state transforms the "What" into the "Why" for the retail investor.

### 5. Simulated Trade Execution
Manages the lifecycle of simulated Market and Limit orders. It ensures that the **Portfolio Settlement** state correctly reflects the new average cost and capital levels once the trade is finalized.
