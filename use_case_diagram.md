# System Use Case Diagram: Context-Aware Agentic Advisor

This documentation provides an accurate visual and functional interaction map for the **Nifty 50 Agentic Advisor** system, fully aligned with the 6-agent sequential AI pipeline and the 5D axis model.

## Technical Use Case Diagram (Mermaid)

```mermaid
usecaseDiagram
    %% Primary Actor
    actor :Retail Investor (User): as User
    
    %% External System Actors
    actor :Yahoo Finance (Market Feed): as Yahoo
    actor :Tavily / News Swarm (Search Engine): as Tavily
    actor :Gemini AI (6 Agent Reasoning Swarm): as Gemini

    package "Agentic Simulation System" {
        %% Core Use Cases
        usecase (UC1: Secure Login / User Session) as UC1
        usecase (UC2: Monitor Live Nifty 50 Price Ticks) as UC2
        usecase (UC3: Trigger Sequential Agent Scraper Swarm) as UC3
        usecase (UC4: Execute Deep-Analyst Factual Induction) as UC4
        usecase (UC5: Perform Agentic Factual Auditor Check) as UC5
        usecase (UC6: Provide Final Sentiment Grade & JSON) as UC6
        usecase (UC7: Execute Simulated Trade Orders) as UC7
        usecase (UC8: Map Market Events to 5D S-Vector) as UC8
        usecase (UC9: Receive Hyper-Personalized Execution Advice) as UC9
    }

    %% User Interactions
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC7
    User --> UC8
    User --> UC9

    %% External System Integrations
    UC2 -- Yahoo : "Streams Live OHLC"
    UC3 -- Tavily : "Deep Searches Domestic/Global Context"
    UC4 -- Gemini : "Deduces Sectoral Policy Impact"
    UC5 -- Gemini : "Audits Analyst Reports for Hallucinations"
    UC6 -- Gemini : "Calculates Proprietary Sentiment Scores"
    
    %% Internal Dependencies
    UC4 ..> UC3 : "<<include>>"
    UC9 ..> UC8 : "<<include>>"
```

---

## Detailed Use Case Descriptions (Verified)

### 1. Sequential Agent Scraper (UC3)
*   **Actor:** Tavily Search Swarm.
*   **Description:** The system utilizes the **Tavily API** in a three-tiered search strategy (Domestic News, Sectoral Insights, and Global Macro Trends) to ingest over 15+ sources for a single stock ticker.

### 2. Deep-Analyst Factual Induction (UC4)
*   **Actor:** Gemini AI Swarm.
*   **Description:** Instead of basic sentiment analysis, **Agent 4 (Analyst)** performs logical induction. It reasons out how high-level policies (e.g., Green Hydrogen) specifically impact Nifty 50 constituents like Reliance or Adani Green.

### 3. Factual Auditor Check (UC5)
*   **Actor:** Gemini AI Swarm.
*   **Description:** To ensure institutional-grade reliability, **Agent 5 (Auditor)** cross-references the Analyst report against raw scrape data to eliminate AI hallucinations and ensure factual consistency.

### 4. 5-Dimensional S-Vector Mapping (UC8)
*   **Actor:** User, Gemini AI.
*   **Description:** The system maps the final audited results into the 5D coordinate space: Time (T), Primary Stock (P), Sector (R), Perception (Psi), and Relevance (E).

### 5. Hyper-Personalized Execution Advice (UC9)
*   **Actor:** User.
*   **Description:** Final-stage agents synthesize the 5D market signal against the user's **specific risk profile** and **capital constraints** to provide actionable advice (e.g., "Sell 50 units based on Skeptical Psi coordinate").
