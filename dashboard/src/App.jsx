import { useEffect, useState } from "react";
import "./App.css";

const agents = [
  {
    name: "Documentation Consistency",
    short: "DC",
    status: "Completed",
    detail: "Real report loaded",
  },
  {
    name: "Evidence Agent",
    short: "EV",
    status: "Completed",
    detail: "Real report loaded",
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

function buildFindings(documentationReport, evidenceReport) {
  const evidenceById = Object.fromEntries(
    (evidenceReport?.findings || []).map((finding) => [
      finding.finding_id,
      finding,
    ])
  );

  return (documentationReport?.findings || []).map((finding) => {
    const evidenceFinding = evidenceById[finding.finding_id];

    return {
      id: finding.finding_id,

      severity: finding.severity
        ? finding.severity.charAt(0).toUpperCase() +
          finding.severity.slice(1)
        : "Unknown",

      confidence: evidenceFinding?.confidence
        ? evidenceFinding.confidence.charAt(0).toUpperCase() +
          evidenceFinding.confidence.slice(1)
        : "Unverified",

      title: finding.topic || "Untitled finding",

      description: finding.explanation || "",

      // Actual claim text
      claimAText: finding.claim_a || "",

      claimBText: finding.claim_b || "",

      // Source locations
      claimA: finding.location_a || "Unknown location",

      claimB: finding.location_b || "Unknown location",

      type: "Documentation contradiction",

      evidence: evidenceFinding?.evidence || [],

      conclusion: evidenceFinding?.conclusion || "",

      evidenceConfidence: evidenceFinding?.confidence || "unknown",
    };
  });
}

function App() {
  /* =========================================================
     CORE UI STATE
  ========================================================= */

  const [darkMode, setDarkMode] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");

  const [contradictions, setContradictions] = useState([]);
  const [selectedFinding, setSelectedFinding] = useState(null);

  /* =========================================================
     REPORT LOADING STATE
  ========================================================= */

  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState(null);

  /* =========================================================
     SCAN STATE
  ========================================================= */

  const [scanRunning, setScanRunning] = useState(false);

  /* =========================================================
     FINDING CONTROLS
  ========================================================= */

  const [severityFilter, setSeverityFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");

  /* =========================================================
     ACTION PANEL STATE
  ========================================================= */

  const [sourceInspecting, setSourceInspecting] = useState(false);
  const [repairProposal, setRepairProposal] = useState(false);

  /* =========================================================
     LOAD REAL AGENT REPORTS
  ========================================================= */

  useEffect(() => {
    const loadReports = async () => {
      try {
        setReportsLoading(true);
        setReportsError(null);

        const [documentationResponse, evidenceResponse] =
          await Promise.all([
            fetch("/reports/documentation_consistency.json"),
            fetch("/reports/evidence.json"),
          ]);

        if (!documentationResponse.ok) {
          throw new Error(
            `Documentation report could not be loaded (${documentationResponse.status})`
          );
        }

        if (!evidenceResponse.ok) {
          throw new Error(
            `Evidence report could not be loaded (${evidenceResponse.status})`
          );
        }

        const documentationReport =
          await documentationResponse.json();

        const evidenceReport =
          await evidenceResponse.json();

        const findings = buildFindings(
          documentationReport,
          evidenceReport
        );

        setContradictions(findings);

        if (findings.length > 0) {
          setSelectedFinding(findings[0]);
        }
      } catch (error) {
        console.error(
          "Failed to load Guardian reports:",
          error
        );

        setReportsError(
          error instanceof Error
            ? error.message
            : "Unknown report loading error"
        );
      } finally {
        setReportsLoading(false);
      }
    };

    loadReports();
  }, []);

  /* =========================================================
     RUN SCAN BUTTON
  ========================================================= */

  const runScan = () => {
    setScanRunning(true);

    setTimeout(() => {
      setScanRunning(false);
    }, 1800);
  };

  /* =========================================================
     COUNTS
  ========================================================= */

  const completedAgents = agents.filter(
    (agent) => agent.status === "Completed"
  ).length;

  const highSeverityCount = contradictions.filter(
    (finding) => finding.severity === "High"
  ).length;

  const mediumSeverityCount = contradictions.filter(
    (finding) => finding.severity === "Medium"
  ).length;

  /* =========================================================
     FILTER + SORT
  ========================================================= */

  const filteredContradictions = [...contradictions]
    .filter((finding) => {
      if (severityFilter === "All") {
        return true;
      }

      return finding.severity === severityFilter;
    })
    .sort((a, b) => {
      /*
        The current reports do not contain timestamps.
        Therefore this temporarily sorts by finding ID.
        Once timestamps are added to the reports, this
        can be changed to true chronological sorting.
      */

      if (sortOrder === "newest") {
        return b.id.localeCompare(a.id);
      }

      return a.id.localeCompare(b.id);
    });

  /* =========================================================
     FILTER HANDLER
  ========================================================= */

  const cycleSeverityFilter = () => {
    const filters = ["All", "High", "Medium", "Low"];

    const currentIndex = filters.indexOf(severityFilter);

    const nextFilter =
      filters[(currentIndex + 1) % filters.length];

    setSeverityFilter(nextFilter);

    /*
      If the currently selected finding will disappear because
      of the new filter, automatically select the first visible
      finding.
    */
    const visibleFindings = contradictions.filter((finding) => {
      if (nextFilter === "All") {
        return true;
      }

      return finding.severity === nextFilter;
    });

    if (
      selectedFinding &&
      !visibleFindings.some(
        (finding) => finding.id === selectedFinding.id
      )
    ) {
      setSelectedFinding(visibleFindings[0] || null);
      setSourceInspecting(false);
      setRepairProposal(false);
    }
  };

  /* =========================================================
     SELECT FINDING
  ========================================================= */

  const selectFinding = (finding) => {
    setSelectedFinding(finding);
    setSourceInspecting(false);
    setRepairProposal(false);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      className={`guardian-app ${
        darkMode ? "dark" : "light"
      }`}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

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
          <div className="workspace-label">
            WORKSPACE
          </div>

          <div className="workspace-card">
            <div className="repo-icon">
              &lt;/&gt;
            </div>

            <div className="workspace-info">
              <strong>bob-guardian</strong>
              <span>feature/b-dashboard</span>
            </div>

            <button
              className="dots-button"
              type="button"
              aria-label="Workspace options"
            >
              •••
            </button>
          </div>
        </div>

        <nav className="navigation">
          <div className="nav-label">
            MONITOR
          </div>

          {[
            {
              name: "Overview",
              icon: "⌂",
            },
            {
              name: "Contradictions",
              icon: "◈",
              count: contradictions.length,
            },
            {
              name: "Evidence",
              icon: "⌕",
            },
            {
              name: "Agents",
              icon: "◇",
            },
          ].map((item) => (
            <button
              key={item.name}
              type="button"
              className={`nav-item ${
                activeNav === item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveNav(item.name)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>{item.name}</span>

              {item.count !== undefined && (
                <span className="nav-count">
                  {item.count}
                </span>
              )}
            </button>
          ))}

          <div className="nav-label nav-label-spaced">
            WORKFLOW
          </div>

          {[
            {
              name: "Context Repair",
              icon: "✦",
            },
            {
              name: "Scan History",
              icon: "◷",
            },
          ].map((item) => (
            <button
              key={item.name}
              type="button"
              className={`nav-item ${
                activeNav === item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveNav(item.name)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

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

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="main">
        {/* TOPBAR */}

        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>

            <span className="breadcrumb-arrow">
              /
            </span>

            <strong>{activeNav}</strong>
          </div>

          <div className="top-actions">
            <div className="last-scan">
              <span className="live-dot"></span>
              Reports{" "}
              <strong>
                {reportsLoading
                  ? "loading"
                  : reportsError
                  ? "error"
                  : "loaded"}
              </strong>
            </div>

            <button
              type="button"
              className={`scan-button ${
                scanRunning ? "scanning" : ""
              }`}
              onClick={runScan}
              disabled={scanRunning}
            >
              <span className="scan-icon">
                {scanRunning ? "◌" : "↻"}
              </span>

              {scanRunning
                ? "Scanning..."
                : "Run Guardian Scan"}
            </button>

            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setDarkMode(!darkMode)
              }
              aria-label="Toggle theme"
              title={
                darkMode
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
            >
              {darkMode ? "☼" : "☾"}
            </button>
          </div>
        </header>

        {/* PAGE HEADING */}

        <section className="page-heading">
          <div>
            <div className="heading-kicker">
              CONTEXT INTEGRITY
            </div>

            <h1>Repository health</h1>

            <p>
              Verify that BOB's persistent context
              still matches the reality of your
              codebase.
            </p>
          </div>

          <div className="branch-pill">
            <span className="branch-symbol">
              ⑂
            </span>

            feature/b-dashboard
          </div>
        </section>

        {/* ===================================================
            HERO
        =================================================== */}

        <section className="hero-grid">
          {/* INTEGRITY CARD */}

          <div className="integrity-card">
            <div className="card-header">
              <div>
                <span className="card-label">
                  CONTEXT INTEGRITY
                </span>

                <h2>
                  {reportsLoading
                    ? "Loading reports"
                    : reportsError
                    ? "Report error"
                    : contradictions.length > 0
                    ? "Needs attention"
                    : "No contradictions"}
                </h2>
              </div>

              <div className="score-meta">
                <span className="score-change">
                  LIVE
                </span>

                <span>
                  from agent reports
                </span>
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
                  <strong>
                    {reportsLoading
                      ? "—"
                      : contradictions.length}
                  </strong>

                  <span>findings</span>
                </div>
              </div>

              <div className="score-explanation">
                <div className="status-line">
                  <span className="warning-dot"></span>

                  {reportsError
                    ? "Report loading failed"
                    : contradictions.length > 0
                    ? "Context drift detected"
                    : "No contradictions detected"}
                </div>

                <p>
                  Guardian found{" "}
                  <strong>
                    {contradictions.length}{" "}
                    contradiction
                    {contradictions.length === 1
                      ? ""
                      : "s"}
                  </strong>{" "}
                  in the currently loaded agent
                  reports.
                </p>

                <div className="score-breakdown">
                  <div>
                    <span>Findings</span>
                    <strong>
                      {contradictions.length}
                    </strong>
                  </div>

                  <div>
                    <span>High</span>
                    <strong>
                      {highSeverityCount}
                    </strong>
                  </div>

                  <div>
                    <span>Medium</span>
                    <strong>
                      {mediumSeverityCount}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-footer">
              <span>
                Source:{" "}
                <strong>
                  Documentation + Evidence reports
                </strong>
              </span>

              <button
                type="button"
                onClick={() =>
                  setActiveNav("Evidence")
                }
              >
                View evidence →
              </button>
            </div>
          </div>

          {/* PIPELINE CARD */}

          <div className="activity-card">
            <div className="card-header">
              <div>
                <span className="card-label">
                  SCAN ACTIVITY
                </span>

                <h2>Agent pipeline</h2>
              </div>

              <span className="pipeline-status">
                {completedAgents} /{" "}
                {agents.length} complete
              </span>
            </div>

            <div className="pipeline">
              {agents.map((agent, index) => (
                <div
                  className="pipeline-row"
                  key={agent.name}
                >
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

                    {index !==
                      agents.length - 1 && (
                      <i
                        className={
                          agent.status ===
                          "Completed"
                            ? "connector-complete"
                            : ""
                        }
                      ></i>
                    )}
                  </div>

                  <div className="pipeline-agent">
                    <strong>
                      {agent.name}
                    </strong>

                    <span>
                      {agent.detail}
                    </span>
                  </div>

                  <span
                    className={`pipeline-state ${
                      agent.status ===
                      "Completed"
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

        {/* ===================================================
            FINDINGS
        =================================================== */}

        <section className="findings-section">
          <div className="section-heading">
            <div>
              <div className="heading-kicker">
                DETECTION RESULTS
              </div>

              <h2>
                Context contradictions
              </h2>
            </div>

            <div className="finding-tools">
              <button
                type="button"
                className="filter"
                onClick={cycleSeverityFilter}
              >
                {severityFilter === "All"
                  ? "All severity"
                  : `${severityFilter} severity`}

                <span>⌄</span>
              </button>

              <button
                type="button"
                className="filter"
                onClick={() =>
                  setSortOrder(
                    sortOrder === "newest"
                      ? "oldest"
                      : "newest"
                  )
                }
              >
                {sortOrder === "newest"
                  ? "Newest first"
                  : "Oldest first"}

                <span>⌄</span>
              </button>
            </div>
          </div>

          {/* LOADING */}

          {reportsLoading && (
            <div className="empty-panel">
              <div className="empty-icon">
                ⌕
              </div>

              <h3>
                Loading Guardian reports
              </h3>

              <p>
                Reading the latest Documentation
                Consistency and Evidence Agent
                results.
              </p>
            </div>
          )}

          {/* ERROR */}

          {reportsError && (
            <div className="empty-panel">
              <div className="empty-icon">
                !
              </div>

              <h3>
                Could not load reports
              </h3>

              <p>{reportsError}</p>
            </div>
          )}

          {/* NO FINDINGS */}

          {!reportsLoading &&
            !reportsError &&
            contradictions.length === 0 && (
              <div className="empty-panel">
                <div className="empty-icon">
                  ✓
                </div>

                <h3>
                  No contradictions found
                </h3>

                <p>
                  The loaded Guardian reports
                  contain no contradiction
                  findings.
                </p>
              </div>
            )}

          {/* FINDINGS */}

          {!reportsLoading &&
            !reportsError &&
            contradictions.length > 0 && (
              <div className="findings-layout">
                <div className="findings-list">
                  {filteredContradictions.length ===
                  0 ? (
                    <div className="empty-panel">
                      <div className="empty-icon">
                        ⌕
                      </div>

                      <h3>
                        No matching findings
                      </h3>

                      <p>
                        No findings match the
                        selected severity filter.
                      </p>
                    </div>
                  ) : (
                    filteredContradictions.map(
                      (item) => (
                        <button
                          type="button"
                          className={`finding-card ${
                            selectedFinding?.id ===
                            item.id
                              ? "selected"
                              : ""
                          }`}
                          key={item.id}
                          onClick={() =>
                            selectFinding(item)
                          }
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

                          <h3>
                            {item.title}
                          </h3>

                          <p>
                            {item.description}
                          </p>

                          <div className="finding-bottom">
                            <span className="finding-type">
                              {item.type}
                            </span>

                            <span className="finding-confidence">
                              {item.confidence}{" "}
                              confidence
                            </span>

                            <span className="finding-arrow">
                              →
                            </span>
                          </div>
                        </button>
                      )
                    )
                  )}
                </div>

                {/* =================================================
                    EVIDENCE PANEL
                ================================================= */}

                <div className="evidence-panel">
                  {selectedFinding ? (
                    <>
                      <div className="panel-top">
                        <div>
                          <span className="card-label">
                            FINDING{" "}
                            {selectedFinding.id}
                          </span>

                          <h3>
                            {selectedFinding.title}
                          </h3>
                        </div>

                        <button
                          type="button"
                          className="close-panel"
                          onClick={() => {
                            setSelectedFinding(
                              null
                            );
                            setSourceInspecting(
                              false
                            );
                            setRepairProposal(
                              false
                            );
                          }}
                          aria-label="Close finding"
                        >
                          ×
                        </button>
                      </div>

                      {/* WHY */}

                      <div className="panel-section">
                        <span className="panel-label">
                          WHY GUARDIAN FLAGGED THIS
                        </span>

                        <p>
                          {
                            selectedFinding.description
                          }
                        </p>
                      </div>

                      {/* CLAIM COMPARISON */}

                      <div className="claim-comparison">
                        <div className="claim">
                          <div className="claim-heading">
                            <span className="claim-badge">
                              A
                            </span>

                            <span>
                              Persistent context
                            </span>
                          </div>

                          <code>
                            {
                              selectedFinding.claimAText
                            }
                          </code>

                          <p>
                            Source:{" "}
                            {
                              selectedFinding.claimA
                            }
                          </p>
                        </div>

                        <div className="comparison-line">
                          <span>
                            CONTRADICTS
                          </span>
                        </div>

                        <div className="claim">
                          <div className="claim-heading">
                            <span className="claim-badge reality">
                              B
                            </span>

                            <span>
                              Repository reality
                            </span>
                          </div>

                          <code>
                            {
                              selectedFinding.claimBText
                            }
                          </code>

                          <p>
                            Source:{" "}
                            {
                              selectedFinding.claimB
                            }
                          </p>
                        </div>
                      </div>

                      {/* VERIFIED EVIDENCE */}

                      <div className="panel-section">
                        <span className="panel-label">
                          VERIFIED EVIDENCE
                        </span>

                        <div className="real-evidence-list">
                          {selectedFinding.evidence
                            .length === 0 ? (
                            <p>
                              No evidence items
                              were included in
                              the Evidence Agent
                              report.
                            </p>
                          ) : (
                            selectedFinding.evidence.map(
                              (
                                evidence,
                                index
                              ) => (
                                <div
                                  className="real-evidence-item"
                                  key={`${selectedFinding.id}-${index}`}
                                >
                                  <div className="evidence-meta">
                                    <code>
                                      {
                                        evidence.file
                                      }

                                      {evidence.line_start
                                        ? `:${evidence.line_start}`
                                        : ""}

                                      {evidence.line_end &&
                                      evidence.line_end !==
                                        evidence.line_start
                                        ? `-${evidence.line_end}`
                                        : ""}
                                    </code>

                                    <span>
                                      {
                                        evidence.strength
                                      }{" "}
                                      strength
                                    </span>
                                  </div>

                                  <p>
                                    {
                                      evidence.excerpt
                                    }
                                  </p>

                                  <small>
                                    {
                                      evidence.source_type
                                    }
                                  </small>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>

                      {/* CONCLUSION */}

                      <div className="panel-section">
                        <span className="panel-label">
                          AGENT CONCLUSION
                        </span>

                        <p>
                          {
                            selectedFinding.conclusion
                          }
                        </p>
                      </div>

                      {/* ACTION BUTTONS */}

                      <div className="panel-actions">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => {
                            setSourceInspecting(
                              !sourceInspecting
                            );
                            setRepairProposal(
                              false
                            );
                          }}
                        >
                          {sourceInspecting
                            ? "Hide source"
                            : "Inspect source"}
                        </button>

                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => {
                            setRepairProposal(
                              !repairProposal
                            );
                            setSourceInspecting(
                              false
                            );
                          }}
                        >
                          {repairProposal
                            ? "Hide proposal"
                            : "Propose context repair"}
                        </button>
                      </div>

                      {/* =================================================
                          SOURCE INSPECTION
                      ================================================= */}

                      {sourceInspecting && (
                        <div className="action-result">
                          <div className="action-result-header">
                            <span className="panel-label">
                              SOURCE INSPECTION
                            </span>

                            <button
                              type="button"
                              className="close-panel"
                              onClick={() =>
                                setSourceInspecting(
                                  false
                                )
                              }
                              aria-label="Close source inspection"
                            >
                              ×
                            </button>
                          </div>

                          <p>
                            Guardian verified this
                            finding using the
                            following repository
                            evidence:
                          </p>

                          <div className="source-list">
                            {selectedFinding.evidence.map(
                              (
                                evidence,
                                index
                              ) => (
                                <div
                                  className="source-item"
                                  key={`source-${index}`}
                                >
                                  <code>
                                    {
                                      evidence.file
                                    }

                                    {evidence.line_start
                                      ? `:${evidence.line_start}`
                                      : ""}

                                    {evidence.line_end &&
                                    evidence.line_end !==
                                      evidence.line_start
                                      ? `-${evidence.line_end}`
                                      : ""}
                                  </code>

                                  <p>
                                    {
                                      evidence.excerpt
                                    }
                                  </p>

                                  <span>
                                    {
                                      evidence.source_type
                                    }{" "}
                                    ·{" "}
                                    {
                                      evidence.strength
                                    }{" "}
                                    evidence
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* =================================================
                          REPAIR PROPOSAL
                      ================================================= */}

                      {repairProposal && (
                        <div className="action-result repair-result">
                          <div className="action-result-header">
                            <span className="panel-label">
                              PROPOSED CONTEXT REPAIR
                            </span>

                            <button
                              type="button"
                              className="close-panel"
                              onClick={() =>
                                setRepairProposal(
                                  false
                                )
                              }
                              aria-label="Close repair proposal"
                            >
                              ×
                            </button>
                          </div>

                          <p>
                            Guardian has identified
                            a stale context statement.
                            The following change is
                            proposed for human review.
                          </p>

                          <div className="repair-comparison">
                            <div className="repair-block current">
                              <span>
                                CURRENT CONTEXT
                              </span>

                              <code>
                                {
                                  selectedFinding.claimAText
                                }
                              </code>

                              <p>
                                Source:{" "}
                                {
                                  selectedFinding.claimA
                                }
                              </p>
                            </div>

                            <div className="repair-arrow">
                              →
                            </div>

                            <div className="repair-block proposed">
                              <span>
                                PROPOSED CHANGE
                              </span>

                              <code>
                                Update the stale
                                repository description
                                so BOB's persistent
                                context reflects the
                                currently verified
                                repository structure.
                              </code>
                            </div>
                          </div>

                          <div className="repair-warning">
                            <strong>
                              Human approval required.
                            </strong>

                            <span>
                              Guardian will not modify
                              project context
                              automatically.
                            </span>
                          </div>

                          <div className="repair-actions">
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() =>
                                setRepairProposal(
                                  false
                                )
                              }
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              className="primary-action"
                              onClick={() =>
                                setRepairProposal(
                                  false
                                )
                              }
                            >
                              Mark for review
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-panel">
                      <div className="empty-icon">
                        ⌕
                      </div>

                      <h3>
                        Select a finding
                      </h3>

                      <p>
                        Choose a contradiction to
                        inspect its evidence, source
                        locations and proposed repair.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
        </section>

        {/* FOOTER */}

        <footer className="main-footer">
          <span>
            BOB Guardian · Context verification
            layer
          </span>

          <span>
            Human approval required for all
            context changes
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;