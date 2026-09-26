import { useState } from "react";
import "./App.css";

const contradictions = [
  {
    id: "DC-001",
    severity: "Medium",
    confidence: "98%",
    title: "Repository state is inconsistent with persistent context",
    description:
      "AGENTS.md describes the repository as containing only README.md, while the current repository contains multiple .bob guidance files and agent specifications.",
    claimA: "AGENTS.md:7",
    claimB: "AGENTS.md:23",
    type: "Context drift",
  },
  {
    id: "DC-002",
    severity: "Medium",
    confidence: "97%",
    title: "Ask-mode context contains a stale repository description",
    description:
      "Ask-mode guidance still states that the repository contains only a README, despite additional documentation and agent specifications now being present.",
    claimA: ".bob/rules-ask/AGENTS.md:7",
    claimB: "AGENTS.md:23",
    type: "Stale instruction",
  },
  {
    id: "DC-003",
    severity: "High",
    confidence: "99%",
    title: "Agent documentation is missing from AI context",
    description:
      "Ask-mode context claims there is no source documentation, but documentation_consistency.md and evidence_agent.md are now present.",
    claimA: ".bob/rules-ask/AGENTS.md:7",
    claimB: "agents/documentation_consistency.md:1",
    type: "Contradiction",
  },
];

const agents = [
  {
    name: "Documentation Consistency",
    short: "DC",
    status: "Completed",
    detail: "3 findings",
  },
  {
    name: "Evidence Agent",
    short: "EV",
    status: "Completed",
    detail: "3 findings",
  },
  {
    name: "Context Auditor",
    short: "CA",
    status: "Waiting",
    detail: "Not run",
  },
  {
    name: "Code Reality",
    short: "CR",
    status: "Waiting",
    detail: "Not run",
  },
  {
    name: "Contradiction Engine",
    short: "CX",
    status: "Waiting",
    detail: "Awaiting inputs",
  },
];

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [scanRunning, setScanRunning] = useState(false);

  const runScan = () => {
    setScanRunning(true);

    setTimeout(() => {
      setScanRunning(false);
    }, 1800);
  };

  return (
    <div className={`guardian-app ${darkMode ? "dark" : "light"}`}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="brand-text">
            <strong>guardian</strong>
            <span>BOB context integrity</span>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-label">WORKSPACE</div>

          <div className="workspace-card">
            <div className="repo-icon">
              &lt;/&gt;
            </div>

            <div className="workspace-info">
              <strong>bob-guardian</strong>
              <span>feature/b-agents</span>
            </div>

            <button className="dots-button">•••</button>
          </div>
        </div>

        <nav className="navigation">
          <div className="nav-label">MONITOR</div>

          {[
            { name: "Overview", icon: "⌂" },
            { name: "Contradictions", icon: "◈", count: 3 },
            { name: "Evidence", icon: "⌕" },
            { name: "Agents", icon: "◇" },
          ].map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activeNav === item.name ? "active" : ""
              }`}
              onClick={() => setActiveNav(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>

              {item.count && (
                <span className="nav-count">{item.count}</span>
              )}
            </button>
          ))}

          <div className="nav-label nav-label-spaced">
            WORKFLOW
          </div>

          {[
            { name: "Context Repair", icon: "✦" },
            { name: "Scan History", icon: "◷" },
          ].map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activeNav === item.name ? "active" : ""
              }`}
              onClick={() => setActiveNav(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

                <div className="sidebar-footer">
          <div className="connection-status">
            <span className="status-pulse"></span>
            Guardian connected
          </div>

          <div className="sidebar-footer-row">
            <span>BOB Guardian v0.1</span>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-arrow">/</span>
            <strong>Overview</strong>
          </div>

                    <div className="top-actions">
            <div className="last-scan">
              <span className="live-dot"></span>
              Last scan <strong>just now</strong>
            </div>

            <button
              className={`scan-button ${scanRunning ? "scanning" : ""}`}
              onClick={runScan}
              disabled={scanRunning}
            >
              <span className="scan-icon">{scanRunning ? "◌" : "↻"}</span>
              {scanRunning ? "Scanning..." : "Run Guardian Scan"}
            </button>

            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
              title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            >
              {darkMode ? "☼" : "☾"}
            </button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="heading-kicker">
              CONTEXT INTEGRITY
            </div>

            <h1>Repository health</h1>

            <p>
              Verify that BOB's persistent context still matches
              the reality of your codebase.
            </p>
          </div>

          <div className="branch-pill">
            <span className="branch-symbol">⑂</span>
            feature/b-agents
          </div>
        </section>

        {/* HERO */}
        <section className="hero-grid">
          <div className="integrity-card">
            <div className="card-header">
              <div>
                <span className="card-label">
                  CONTEXT INTEGRITY SCORE
                </span>
                <h2>Needs attention</h2>
              </div>

              <div className="score-meta">
                <span className="score-change">−12</span>
                <span>since last scan</span>
              </div>
            </div>

            <div className="integrity-body">
              <div className="score-visual">
                <svg
                  className="score-ring"
                  viewBox="0 0 200 200"
                >
                  <circle
                    className="ring-background"
                    cx="100"
                    cy="100"
                    r="82"
                  />

                  <circle
                    className="ring-progress"
                    cx="100"
                    cy="100"
                    r="82"
                  />
                </svg>

                <div className="score-number">
                  <strong>63</strong>
                  <span>/100</span>
                </div>
              </div>

              <div className="score-explanation">
                <div className="status-line">
                  <span className="warning-dot"></span>
                  Context drift detected
                </div>

                <p>
                  Guardian found <strong>3 contradictions</strong>{" "}
                  between persistent project context and the
                  current repository state.
                </p>

                <div className="score-breakdown">
                  <div>
                    <span>Verified</span>
                    <strong>12</strong>
                  </div>

                  <div>
                    <span>Contradicting</span>
                    <strong>3</strong>
                  </div>

                  <div>
                    <span>Unverified</span>
                    <strong>4</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-footer">
              <span>
                Last verified against <strong>19 repository claims</strong>
              </span>

              <button
                onClick={() => setActiveNav("Evidence")}
              >
                View evidence →
              </button>
            </div>
          </div>

          <div className="activity-card">
            <div className="card-header">
              <div>
                <span className="card-label">
                  SCAN ACTIVITY
                </span>
                <h2>Agent pipeline</h2>
              </div>

              <span className="pipeline-status">
                2 / 5 complete
              </span>
            </div>

            <div className="pipeline">
              {agents.map((agent, index) => (
                <div className="pipeline-row" key={agent.name}>
                  <div className="pipeline-marker">
                    <span
                      className={
                        agent.status === "Completed"
                          ? "marker-complete"
                          : "marker-waiting"
                      }
                    >
                      {agent.status === "Completed"
                        ? "✓"
                        : index === 4
                        ? "◇"
                        : "•"}
                    </span>

                    {index !== agents.length - 1 && (
                      <i
                        className={
                          agent.status === "Completed"
                            ? "connector-complete"
                            : ""
                        }
                      ></i>
                    )}
                  </div>

                  <div className="pipeline-agent">
                    <strong>{agent.name}</strong>
                    <span>{agent.detail}</span>
                  </div>

                  <span
                    className={`pipeline-state ${
                      agent.status === "Completed"
                        ? "complete"
                        : "waiting"
                    }`}
                  >
                    {agent.status === "Completed"
                      ? "done"
                      : "waiting"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINDINGS */}
        <section className="findings-section">
          <div className="section-heading">
            <div>
              <div className="heading-kicker">
                DETECTION RESULTS
              </div>
              <h2>Context contradictions</h2>
            </div>

            <div className="finding-tools">
              <button className="filter">
                All severity
                <span>⌄</span>
              </button>

              <button className="filter">
                Newest first
                <span>⌄</span>
              </button>
            </div>
          </div>

          <div className="findings-layout">
            <div className="findings-list">
              {contradictions.map((item) => (
                <button
                  className={`finding-card ${
                    selectedFinding?.id === item.id
                      ? "selected"
                      : ""
                  }`}
                  key={item.id}
                  onClick={() => setSelectedFinding(item)}
                >
                  <div className="finding-top">
                    <span className="finding-id">
                      {item.id}
                    </span>

                    <span
                      className={`severity ${item.severity.toLowerCase()}`}
                    >
                      <i></i>
                      {item.severity}
                    </span>
                  </div>

                  <h3>{item.title}</h3>

                  <p>{item.description}</p>

                  <div className="finding-bottom">
                    <span className="finding-type">
                      {item.type}
                    </span>

                    <span className="finding-confidence">
                      {item.confidence} confidence
                    </span>

                    <span className="finding-arrow">→</span>
                  </div>
                </button>
              ))}
            </div>

            {/* EVIDENCE PANEL */}
            <div className="evidence-panel">
              {selectedFinding ? (
                <>
                  <div className="panel-top">
                    <div>
                      <span className="card-label">
                        FINDING {selectedFinding.id}
                      </span>
                      <h3>{selectedFinding.title}</h3>
                    </div>

                    <button
                      className="close-panel"
                      onClick={() => setSelectedFinding(null)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="panel-section">
                    <span className="panel-label">
                      WHY GUARDIAN FLAGGED THIS
                    </span>

                    <p>{selectedFinding.description}</p>
                  </div>

                  <div className="claim-comparison">
                    <div className="claim">
                      <div className="claim-heading">
                        <span className="claim-badge">
                          A
                        </span>

                        <span>Persistent context</span>
                      </div>

                      <code>
                        {selectedFinding.claimA}
                      </code>

                      <p>
                        “Only README.md exists. No source code,
                        build system, package manager, or
                        configuration files are present.”
                      </p>
                    </div>

                    <div className="comparison-line">
                      <span>CONTRADICTS</span>
                    </div>

                    <div className="claim">
                      <div className="claim-heading">
                        <span className="claim-badge reality">
                          B
                        </span>

                        <span>Repository reality</span>
                      </div>

                      <code>
                        {selectedFinding.claimB}
                      </code>

                      <p>
                        Repository contains .bob guidance,
                        agent specifications, reports and
                        session artifacts.
                      </p>
                    </div>
                  </div>

                  <div className="panel-actions">
                    <button className="secondary-action">
                      Inspect source
                    </button>

                    <button className="primary-action">
                      Propose context repair
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-panel">
                  <div className="empty-icon">⌕</div>
                  <h3>Select a finding</h3>
                  <p>
                    Choose a contradiction to inspect its
                    evidence, source locations and proposed
                    repair.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="main-footer">
          <span>
            BOB Guardian · Context verification layer
          </span>

          <span>
            Human approval required for all context changes
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;