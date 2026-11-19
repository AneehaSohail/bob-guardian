import { useEffect, useState } from "react";
import "./App.css";

const emptyDashboardData = {
  project: {
    name: "",
    organization: "",
  },

  stats: {
    documentationFiles: 0,
    checkableClaims: 0,
    potentialInconsistencies: 0,
    consistencyScore: null,
  },

  documentation: {
    files: [],
  },

  consistency: {
    consistentClaims: 0,
    inconsistentClaims: 0,
    notEvaluated: 0,
    score: null,
  },

  inconsistencies: [],

  findings: [],

  agents: [
    {
      id: "documentation-consistency",
      name: "Documentation Consistency Agent",
      description: "Extract and compare claims",
      status: "pending",
    },
    {
      id: "evidence",
      name: "Evidence Agent",
      description: "Find source evidence and validate",
      status: "pending",
    },
    {
      id: "context-auditor",
      name: "Context Auditor",
      description: "Check project setup and dependencies",
      status: "pending",
    },
    {
      id: "reporting",
      name: "Reporting",
      description: "Generate final findings and insights",
      status: "pending",
    },
  ],

  system: {
    status: "waiting",
    message: "",
  },
};

const navItems = [
  { name: "Overview", icon: "fa-solid fa-house" },
  { name: "Agent Results", icon: "fa-solid fa-robot" },
  { name: "Findings", icon: "fa-solid fa-triangle-exclamation" },
  { name: "Evidence", icon: "fa-solid fa-magnifying-glass" },
  { name: "Documentation Map", icon: "fa-solid fa-diagram-project" },
  { name: "System Health", icon: "fa-solid fa-shield-halved" },
  { name: "About", icon: "fa-solid fa-circle-info" },
];

function ShieldIcon() {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
      <path
        d="M11 2L2 5.5V11.5C2 16.6 5.8 21.3 11 22.5C16.2 21.3 20 16.6 20 11.5V5.5L11 2Z"
        fill="rgba(255,255,255,0.18)"
        stroke="white"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <path
        d="M7.5 12.2L10.2 15L14.8 9.4"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" fill="#22d07a" />

      <path
        d="M4 7L6.2 9.2L10 5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RobotMascot() {
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="robotBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf2ff" />
          <stop offset="100%" stopColor="#c8d8f5" />
        </linearGradient>
      </defs>

      <line
        x1="60"
        y1="14"
        x2="60"
        y2="26"
        stroke="#4c8dff"
        strokeWidth="2.5"
      />

      <circle cx="60" cy="12" r="4" fill="#4c8dff" />

      <rect
        x="30"
        y="26"
        width="60"
        height="50"
        rx="12"
        fill="url(#robotBody)"
        stroke="#4c8dff"
        strokeWidth="2"
      />

      <circle cx="48" cy="50" r="6" fill="#0a1426" />
      <circle cx="72" cy="50" r="6" fill="#0a1426" />

      <circle cx="50" cy="48" r="2" fill="#8fbaff" />
      <circle cx="74" cy="48" r="2" fill="#8fbaff" />

      <path
        d="M50 62 Q60 70 70 62"
        stroke="#4c8dff"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      <rect
        x="38"
        y="80"
        width="44"
        height="26"
        rx="8"
        fill="url(#robotBody)"
        stroke="#4c8dff"
        strokeWidth="2"
      />

      <circle cx="52" cy="93" r="2.5" fill="#4c8dff" />
      <circle cx="60" cy="93" r="2.5" fill="#4c8dff" />
      <circle cx="68" cy="93" r="2.5" fill="#4c8dff" />
    </svg>
  );
}

function formatPercentage(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${Number(value).toFixed(1)}%`;
}

function getFindingTypeClass(type) {
  if (!type) return "missing";

  const normalized = String(type).toLowerCase();

  if (
    normalized.includes("conflict") ||
    normalized.includes("contradiction")
  ) {
    return "conflict";
  }

  if (
    normalized.includes("outdated") ||
    normalized.includes("stale")
  ) {
    return "outdated";
  }

  return "missing";
}

function getAgentStateClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "done"
  ) {
    return "complete";
  }

  if (
    normalized === "active" ||
    normalized === "running" ||
    normalized === "processing"
  ) {
    return "active";
  }

  return "pending";
}

function getAgentDisplayStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "done"
  ) {
    return "Complete";
  }

  if (
    normalized === "active" ||
    normalized === "running" ||
    normalized === "processing"
  ) {
    return "Running";
  }

  return "Waiting";
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");

  /*
   * This is the ONLY dashboard state that should eventually
   * be replaced by your backend/API response.
   */
  const [dashboardData, setDashboardData] = useState(
    emptyDashboardData
  );

  /*
   * ---------------------------------------------------------
   * FUTURE API INTEGRATION
   * ---------------------------------------------------------
   *
   * When your backend is ready, this is where the dashboard
   * should receive the agent results.
   *
   * Example:
   *
   * useEffect(() => {
   *   fetch("/api/dashboard")
   *     .then((response) => response.json())
   *     .then((data) => setDashboardData(data));
   * }, []);
   *
   * For now, no fake data is loaded.
   */

  useEffect(() => {
  const loadAgentResults = async () => {
    try {
      setDashboardData((prev) => ({
        ...prev,
        system: {
          status: "loading",
          message: "Running BOB agent analysis..."
        }
      }));

      const [consistencyRes, evidenceRes, claimsRes] = await Promise.all([
        fetch("/data/documentation_consistency.json"),
        fetch("/data/evidence.json"),
        fetch("/data/claims.json")
      ]);

      if (!consistencyRes.ok || !evidenceRes.ok || !claimsRes.ok) {
        throw new Error("Could not load agent results.");
      }

      const consistency = await consistencyRes.json();
      const evidence = await evidenceRes.json();
      const claims = await claimsRes.json();

      const consistencyFindings = Array.isArray(consistency.findings)
        ? consistency.findings
        : [];

      const evidenceFindings = Array.isArray(evidence.findings)
        ? evidence.findings
        : [];

      const claimList = Array.isArray(claims)
        ? claims
        : Array.isArray(claims.claims)
          ? claims.claims
          : Array.isArray(claims.statements)
            ? claims.statements
            : [];

      const totalClaims = claimList.length;

      const inconsistentClaims = consistencyFindings.length;

      const consistencyScore =
        totalClaims > 0
          ? Math.max(
              0,
              Math.round(
                ((totalClaims - inconsistentClaims) / totalClaims) * 100
              )
            )
          : 0;

      const files = Array.isArray(consistency.sources_checked)
        ? consistency.sources_checked.map((file, index) => ({
            id: index + 1,
            name:
              typeof file === "string"
                ? file
                : file?.name || file?.path || `Document ${index + 1}`,
            status: "checked"
          }))
        : [];

      const findings = [
        ...consistencyFindings.map((item, index) => ({
          id: `consistency-${index}`,
          type: "Documentation Consistency",
          title:
            item.title ||
            item.issue ||
            item.description ||
            "Documentation inconsistency detected",
          description:
            item.description ||
            item.explanation ||
            item.issue ||
            "The documentation contains potentially inconsistent information.",
          severity: item.severity || "medium",
          source: item.source || item.sources || "Documentation"
        })),

        ...evidenceFindings.map((item, index) => ({
          id: `evidence-${index}`,
          type: "Evidence",
          title:
            item.title ||
            item.issue ||
            item.description ||
            "Evidence finding",
          description:
            item.description ||
            item.explanation ||
            item.issue ||
            "Evidence review completed.",
          severity: item.severity || "medium",
          source: item.source || item.sources || "Evidence Agent"
        }))
      ];

      setDashboardData({
        project: {
          name: "BOB AI Documentation Guardian",
          organization: "IBM Hackathon"
        },

        stats: {
          documentationFiles: files.length,
          checkableClaims: totalClaims,
          potentialInconsistencies: inconsistentClaims,
          consistencyScore
        },

        documentation: {
          files
        },

        consistency: {
          consistentClaims: Math.max(0, totalClaims - inconsistentClaims),
          inconsistentClaims,
          notEvaluated: 0,
          score: consistencyScore
        },

        inconsistencies: consistencyFindings,

        findings,

        agents: [
          {
            id: "documentation-consistency",
            name: "Documentation Consistency Agent",
            description:
              "Checks documentation for conflicting and inconsistent claims.",
            status:
              consistency.status === "completed" ? "completed" : "error"
          },
          {
            id: "evidence",
            name: "Evidence Agent",
            description:
              "Validates findings and checks whether claims are supported by evidence.",
            status:
              evidence.status === "completed" ? "completed" : "error"
          },
          {
            id: "context-auditor",
            name: "Context Auditor",
            description:
              "Extracts and stores project documentation claims for contextual analysis.",
            status:
              claims ? "completed" : "error"
          }
        ],

        system: {
          status: "ready",
          message: "BOB analysis completed successfully."
        }
      });

    } catch (error) {
      console.error("BOB agent integration error:", error);

      setDashboardData((prev) => ({
        ...prev,
        system: {
          status: "error",
          message: "Unable to load BOB agent results."
        }
      }));
    }
  };

  loadAgentResults();
}, []);

  const stats = dashboardData.stats || {};
  const consistency = dashboardData.consistency || {};

  const documentationFiles =
    dashboardData.documentation?.files || [];

  const findings = dashboardData.findings || [];

  const inconsistencies =
    dashboardData.inconsistencies || [];

  const agents = dashboardData.agents || [];

  /* =========================================================
     STAT CARDS
  ========================================================= */

  const statCards = [
    {
      tone: "blue",
      icon: "fa-solid fa-file-lines",
      value: stats.documentationFiles ?? 0,
      label: "Documentation Files",
      sub: "Scanned by the system",
    },
    {
      tone: "green",
      icon: "fa-solid fa-clipboard-check",
      value: stats.checkableClaims ?? 0,
      label: "Checkable Claims",
      sub: "Extracted by the agents",
    },
    {
      tone: "red",
      icon: "fa-solid fa-triangle-exclamation",
      value: stats.potentialInconsistencies ?? 0,
      label: "Potential Inconsistencies",
      sub: "Detected across documentation",
    },
    {
      tone: "teal",
      icon: "fa-solid fa-circle-check",
      value: formatPercentage(stats.consistencyScore),
      label: "Documentation Consistency",
      sub: "Calculated from evaluated claims",
    },
  ];

  /* =========================================================
     DOCUMENTATION BAR CHART
  ========================================================= */

  const barData = documentationFiles.map((file) => ({
    label:
      file.name ||
      file.path ||
      "Unknown file",

    claims:
      Number(
        file.claims ??
          file.checkableClaims ??
          file.claim_count ??
          0
      ),

    issues:
      Number(
        file.issues ??
          file.inconsistencies ??
          file.issue_count ??
          0
      ),
  }));

  const maxBarValue = Math.max(
    ...barData.map((d) =>
      Math.max(d.claims, d.issues)
    ),
    1
  );

  /* =========================================================
     CONSISTENCY SCORE
  ========================================================= */

  const scorePercent =
    consistency.score ??
    stats.consistencyScore ??
    null;

  const scoreRadius = 62;
  const scoreCircumference =
    2 * Math.PI * scoreRadius;

  const scoreOffset =
    scorePercent === null
      ? scoreCircumference
      : scoreCircumference -
        (Number(scorePercent) / 100) *
          scoreCircumference;

  /* =========================================================
     INCONSISTENCY TYPES
  ========================================================= */

  const inconsistencyCounts = {
    conflict: 0,
    outdated: 0,
    missing: 0,
  };

  inconsistencies.forEach((item) => {
    const type = String(
      item.type || item.category || ""
    ).toLowerCase();

    if (
      type.includes("conflict") ||
      type.includes("contradiction")
    ) {
      inconsistencyCounts.conflict += 1;
    } else if (
      type.includes("outdated") ||
      type.includes("stale")
    ) {
      inconsistencyCounts.outdated += 1;
    } else {
      inconsistencyCounts.missing += 1;
    }
  });

  const inconsistencyTypes = [
    {
      color: "red",
      count: inconsistencyCounts.conflict,
      title: "Conflicting Information",
      description:
        "Different claims about the same feature",
    },
    {
      color: "yellow",
      count: inconsistencyCounts.outdated,
      title: "Outdated Information",
      description:
        "Information may no longer be accurate",
    },
    {
      color: "purple",
      count: inconsistencyCounts.missing,
      title: "Missing Details",
      description:
        "Important information not documented",
    },
  ];

  const inconsistencyTotal =
    inconsistencyTypes.reduce(
      (sum, item) => sum + item.count,
      0
    );

  const donutColors = {
    red: "#ff5c73",
    yellow: "#f5b93b",
    purple: "#a78bfa",
  };

  const donutSegments = (() => {
    const segments = [];
    let offset = 0;

    const radius = 62;
    const circumference =
      2 * Math.PI * radius;

    if (inconsistencyTotal === 0) {
      return segments;
    }

    inconsistencyTypes.forEach((item) => {
      if (item.count === 0) return;

      const fraction =
        item.count / inconsistencyTotal;

      segments.push({
        ...item,
        dash: fraction * circumference,
        offset,
        circumference,
        radius,
      });

      offset += fraction * circumference;
    });

    return segments;
  })();

  /* =========================================================
     TOP FINDINGS
  ========================================================= */

  const topFindings = findings.slice(0, 3);

  /* =========================================================
     AGENT PIPELINE
  ========================================================= */

  const pipelineStages =
    agents.length > 0
      ? agents
      : emptyDashboardData.agents;

  return (
    <div
      className={`guardian-app ${
        darkMode ? "dark" : "light"
      }`}
    >
      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">
            <i className="fa-solid fa-rocket"></i>
          </div>

          <div className="header-brand-text">
            <strong>
              {dashboardData.project?.name ||
                "GALAXIUM"}
            </strong>

            <span>
              {dashboardData.project?.organization ||
                "TRAVELS"}
            </span>
          </div>
        </div>

        <div className="header-title">
          <div className="header-shield">
            <ShieldIcon />
          </div>

          <div className="header-title-text">
            <h1>AI Documentation Guardian</h1>

            <p>
              Multi-Agent System for Documentation
              Consistency &amp; Compliance
            </p>

            <small>
              Powered by IBM watsonx + Local LLM +
              ChromaDB
            </small>
          </div>
        </div>

        <div className="header-badge">
          <div className="header-badge-text">
            <strong>IBM Hackathon</strong>
            <span>
              Responsible AI for Real-World Impact
            </span>
          </div>
        </div>
      </header>

      {/* =====================================================
          BODY
      ===================================================== */}

      <div className="app-body">

        {/* ===================================================
            SIDE NAV
        =================================================== */}

        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item.name}
              type="button"
              className={`side-nav-item ${
                activeNav === item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveNav(item.name)
              }
            >
              <span className="side-nav-icon">
                <i className={item.icon}></i>
              </span>

              <span>{item.name}</span>
            </button>
          ))}

          {/* Mascot */}

          <div className="mascot-card">
            <div className="mascot-bubble">
              Keeping your documentation accurate,
              consistent and trustworthy!
            </div>

            <div className="mascot-avatar">
              <RobotMascot />
            </div>

            <ul className="mascot-list">
              <li>
                <CheckBadge />
                <span>
                  Scans documentation
                </span>
              </li>

              <li>
                <CheckBadge />
                <span>
                  Finds inconsistencies
                </span>
              </li>

              <li>
                <CheckBadge />
                <span>
                  Provides evidence
                </span>
              </li>

              <li>
                <CheckBadge />
                <span>
                  Supports informed review
                </span>
              </li>
            </ul>
          </div>

          {/* Theme */}

          <div className="side-nav-theme">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={() =>
                setDarkMode(!darkMode)
              }
              title={
                darkMode
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
            >
              <i
                className={
                  darkMode
                    ? "fa-solid fa-sun"
                    : "fa-solid fa-moon"
                }
              ></i>

              <span>
                {darkMode
                  ? "Light mode"
                  : "Dark mode"}
              </span>
            </button>
          </div>
        </nav>

        {/* ===================================================
            MAIN
        =================================================== */}

        <main className="app-main">

          {/* =================================================
              STAT STRIP
          ================================================= */}

          <section className="stat-strip">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className={`stat-card ${stat.tone}`}
              >
                <div className="stat-icon">
                  <i className={stat.icon}></i>
                </div>

                <div className="stat-body">
                  <span className="stat-value">
                    {stat.value}
                  </span>

                  <span className="stat-label">
                    {stat.label}
                  </span>

                  <span className="stat-sub">
                    {stat.sub}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* =================================================
              ROW 2
          ================================================= */}

          <section className="dash-row row-2">

            {/* DOCUMENTATION OVERVIEW */}

            <div className="panel">
              <div className="panel-head">
                <div className="panel-head-left">

                  <div className="panel-head-icon">
                    <i className="fa-solid fa-chart-column"></i>
                  </div>

                  <div>
                    <h2>
                      Documentation Overview
                    </h2>

                    <p>
                      Files scanned and claims
                      extracted by the
                      Documentation Consistency
                      Agent
                    </p>
                  </div>

                </div>
              </div>

              <div className="chart-legend">
                <span className="legend-item">
                  <span className="legend-swatch blue" />
                  Checkable Claims
                </span>

                <span className="legend-item">
                  <span className="legend-swatch red" />
                  Potential Issues
                </span>
              </div>

              {barData.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-chart-column"></i>

                  <strong>
                    Waiting for documentation scan
                  </strong>

                  <span>
                    File and claim data will appear
                    here when the agents run.
                  </span>
                </div>
              ) : (
                <>
                  <div className="bar-chart">
                    <div className="chart-y-axis">
                      <span>
                        {Math.ceil(
                          maxBarValue
                        )}
                      </span>

                      <span>
                        {Math.ceil(
                          maxBarValue * 0.66
                        )}
                      </span>

                      <span>
                        {Math.ceil(
                          maxBarValue * 0.33
                        )}
                      </span>

                      <span>0</span>
                    </div>

                    <div className="chart-bars">
                      <div className="chart-grid">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>

                      {barData.map((group) => (
                        <div
                          className="bar-group"
                          key={group.label}
                        >
                          <div className="bar-pair">

                            <div
                              className="bar blue"
                              style={{
                                height: `${
                                  (group.claims /
                                    maxBarValue) *
                                  100
                                }%`,
                              }}
                            >
                              {group.claims > 0 && (
                                <span className="bar-label">
                                  {group.claims}
                                </span>
                              )}
                            </div>

                            <div
                              className="bar red"
                              style={{
                                height: `${
                                  (group.issues /
                                    maxBarValue) *
                                  100
                                }%`,
                              }}
                            >
                              {group.issues > 0 && (
                                <span className="bar-label">
                                  {group.issues}
                                </span>
                              )}
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="bar-chart"
                    style={{
                      minHeight: 0,
                      paddingTop: 0,
                      paddingBottom: 14,
                    }}
                  >
                    <div />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${barData.length}, minmax(0, 1fr))`,
                        gap: 8,
                      }}
                    >
                      {barData.map((group) => (
                        <div
                          className="bar-x-label"
                          key={`${group.label}-x`}
                        >
                          {String(group.label)
                            .split("\n")
                            .map(
                              (line, i) => (
                                <div key={i}>
                                  {line}
                                </div>
                              )
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* CONSISTENCY SCORE */}

            <div className="panel">
              <div className="panel-head">

                <div className="panel-head-left">

                  <div className="panel-head-icon">
                    <i className="fa-solid fa-magnifying-glass-chart"></i>
                  </div>

                  <div>
                    <h2>
                      Consistency Score
                    </h2>

                    <p>
                      How aligned the documentation
                      is across files
                    </p>
                  </div>

                </div>

              </div>

              <div className="score-panel-body">

                <div className="score-ring-wrap">

                  <svg
                    className="score-ring-svg"
                    viewBox="0 0 160 160"
                  >
                    <defs>
                      <linearGradient
                        id="scoreGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#22d07a"
                        />

                        <stop
                          offset="100%"
                          stopColor="#119d5a"
                        />
                      </linearGradient>
                    </defs>

                    <circle
                      className="score-ring-bg"
                      cx="80"
                      cy="80"
                      r={scoreRadius}
                    />

                    <circle
                      className="score-ring-fg"
                      cx="80"
                      cy="80"
                      r={scoreRadius}
                      strokeDasharray={
                        scoreCircumference
                      }
                      strokeDashoffset={
                        scoreOffset
                      }
                    />
                  </svg>

                  <div className="score-ring-center">
                    <strong>
                      {formatPercentage(
                        scorePercent
                      )}
                    </strong>

                    <span>
                      {scorePercent === null
                        ? "Awaiting data"
                        : "Consistent"}
                    </span>
                  </div>

                </div>

                <div className="score-legend">

                  <div className="score-legend-item">
                    <span className="dot green" />

                    <span className="label">
                      Consistent Claims
                    </span>

                    <span className="value">
                      {consistency.consistentClaims ??
                        0}
                    </span>
                  </div>

                  <div className="score-legend-item">
                    <span className="dot red" />

                    <span className="label">
                      Potential Issues
                    </span>

                    <span className="value">
                      {consistency.inconsistentClaims ??
                        0}
                    </span>
                  </div>

                  <div className="score-legend-item">
                    <span className="dot grey" />

                    <span className="label">
                      Not Evaluated
                    </span>

                    <span className="value">
                      {consistency.notEvaluated ??
                        0}
                    </span>
                  </div>

                  <p className="score-note">
                    {scorePercent === null
                      ? "The consistency score will appear after the agents evaluate the documentation."
                      : `${consistency.inconsistentClaims ?? 0} areas require review.`}
                  </p>

                </div>
              </div>
            </div>
          </section>

          {/* =================================================
              ROW 3
          ================================================= */}

          <section className="dash-row row-3">

            {/* INCONSISTENCY TYPES */}

            <div className="panel">

              <div className="panel-head">

                <div className="panel-head-left">

                  <div className="panel-head-icon">
                    <i className="fa-solid fa-chart-pie"></i>
                  </div>

                  <div>
                    <h2>
                      Inconsistency Types
                    </h2>

                    <p>
                      Categories of issues found
                      by the agents
                    </p>
                  </div>

                </div>

              </div>

              <div className="donut-panel-body">

                <div className="donut-wrap">

                  <svg
                    viewBox="0 0 160 160"
                    width="100%"
                    height="100%"
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r="62"
                      fill="none"
                      stroke="var(--surface-3)"
                      strokeWidth="20"
                    />

                    {donutSegments.map(
                      (seg, i) => (
                        <circle
                          key={i}
                          cx="80"
                          cy="80"
                          r={seg.radius}
                          fill="none"
                          stroke={
                            donutColors[
                              seg.color
                            ]
                          }
                          strokeWidth="20"
                          strokeDasharray={`${seg.dash} ${
                            seg.circumference -
                            seg.dash
                          }`}
                          strokeDashoffset={
                            -seg.offset
                          }
                          transform="rotate(-90 80 80)"
                        />
                      )
                    )}
                  </svg>

                  <div className="donut-center">

                    <strong>
                      {inconsistencyTotal}
                    </strong>

                    <span>
                      Total Issues
                    </span>

                  </div>

                </div>

                <div className="donut-legend">

                  {inconsistencyTypes.map(
                    (item) => (
                      <div
                        className="donut-legend-item"
                        key={item.title}
                      >
                        <span
                          className={`swatch ${item.color}`}
                        />

                        <div className="legend-body">

                          <span className="legend-title">
                            {item.title}
                          </span>

                          <span className="legend-desc">
                            {item.description}
                          </span>

                        </div>

                        <span className="legend-count">
                          {item.count}
                        </span>
                      </div>
                    )
                  )}

                </div>

              </div>
            </div>

            {/* TOP FINDINGS */}

            <div className="panel">

              <div className="panel-head">

                <div className="panel-head-left">

                  <div className="panel-head-icon">
                    <i className="fa-solid fa-thumbtack"></i>
                  </div>

                  <div>
                    <h2>
                      Top Findings
                    </h2>

                    <p>
                      Key inconsistencies found
                      by the agents
                    </p>
                  </div>

                </div>

                <button
                  type="button"
                  className="panel-link"
                  onClick={() =>
                    setActiveNav(
                      "Findings"
                    )
                  }
                >
                  View All Findings{" "}
                  <i className="fa-solid fa-arrow-right"></i>
                </button>

              </div>

              <div className="panel-body tight">

                {topFindings.length === 0 ? (
                  <div className="empty-state compact">

                    <i className="fa-solid fa-circle-check"></i>

                    <strong>
                      No findings yet
                    </strong>

                    <span>
                      Findings generated by the
                      agents will appear here.
                    </span>

                  </div>
                ) : (
                  <table className="findings-table">

                    <thead>
                      <tr>
                        <th className="col-index">
                          #
                        </th>

                        <th>
                          Issue
                        </th>

                        <th className="col-narrow">
                          Type
                        </th>

                        <th className="col-narrow">
                          Confidence
                        </th>

                        <th className="col-status">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {topFindings.map(
                        (row, index) => (
                          <tr
                            key={
                              row.id ||
                              row.finding_id ||
                              index
                            }
                          >

                            <td className="col-index">
                              {row.id ||
                                row.finding_id ||
                                index + 1}
                            </td>

                            <td className="col-issue">
                              {row.issue ||
                                row.title ||
                                row.description ||
                                "Finding detected"}
                            </td>

                            <td>
                              <span
                                className={`type-pill ${getFindingTypeClass(
                                  row.type ||
                                    row.category
                                )}`}
                              >
                                {row.type ||
                                  row.category ||
                                  "Issue"}
                              </span>
                            </td>

                            <td>
                              {row.confidence !==
                                undefined &&
                              row.confidence !==
                                null
                                ? `${Number(
                                    row.confidence
                                  ) > 1
                                    ? Number(
                                        row.confidence
                                      ).toFixed(
                                        0
                                      )
                                    : (
                                        Number(
                                          row.confidence
                                        ) *
                                        100
                                      ).toFixed(
                                        0
                                      )}%`
                                : "—"}
                            </td>

                            <td>
                              <span className="status-pill open">
                                {row.status ||
                                  "Open"}
                              </span>
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>
                )}

              </div>
            </div>

          </section>

          {/* =================================================
              AGENT PIPELINE
          ================================================= */}

          <section className="pipeline-strip">

            <div className="pipeline-strip-head">

              <h2>
                Agent Pipeline
              </h2>

              <p>
                Multi-agent workflow for
                documentation governance
              </p>

            </div>

            <div className="pipeline-timeline">

              {pipelineStages.map(
                (stage, index) => {

                  const state =
                    getAgentStateClass(
                      stage.status ||
                        stage.state
                    );

                  const lineClass =
                    state === "complete"
                      ? "line-complete"
                      : state === "active"
                      ? "line-active"
                      : "";

                  return (
                    <div
                      className={`pipeline-stage ${lineClass}`}
                      key={
                        stage.id ||
                        stage.name ||
                        stage.title ||
                        index
                      }
                    >

                      <div className="pipeline-node-wrap">

                        <div
                          className={`pipeline-stage-node ${state}`}
                        >
                          {state ===
                          "complete" ? (
                            <i className="fa-solid fa-check"></i>
                          ) : state ===
                            "active" ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          ) : (
                            index + 1
                          )}
                        </div>

                      </div>

                      <div className="pipeline-stage-title">
                        {index + 1}.{" "}
                        {stage.name ||
                          stage.title}
                      </div>

                      <div className="pipeline-stage-desc">
                        {stage.description ||
                          stage.desc}
                      </div>

                      <div className="pipeline-stage-status">
                        {getAgentDisplayStatus(
                          stage.status ||
                            stage.state
                        )}
                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </section>

        </main>
      </div>
    </div>
  );
}

export default App;