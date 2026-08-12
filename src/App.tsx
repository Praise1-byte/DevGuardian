
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

interface Finding {
  type: string;
  severity: string;
  title: string;
  description: string;
  line?: number;
}

interface Report {
  repository: string;
  score: number;
  filesAnalyzed: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: Finding[];
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

function App() {
  const [repository, setRepository] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ==========================================
  // MOUSE TRACKING
  // ==========================================

  const [mousePosition, setMousePosition] = useState({
    x: -20,
    y: -20,
  });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // ==========================================
  // REPOSITORY ANALYSIS
  // ==========================================

  async function analyzeRepository() {
    setError("");

    const value = repository
      .trim()
      .replace("https://github.com/", "")
      .replace("http://github.com/", "")
      .replace(/\/$/, "");

    const [owner, repo] = value.split("/");

    if (!owner || !repo) {
      setError("Enter a valid GitHub repository URL.");
      return;
    }

    try {
      setLoading(true);
      setReport(null);

      const response = await fetch(
        `http://localhost:5000/api/repositories/${owner}/${repo}/review`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to analyze repository."
        );
      }

      setReport(data.report);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">

      {/* ==========================================
          TINY MOUSE TRACKER
      ========================================== */}

      <motion.div
        className="mouse-follower"
        animate={{
          x: mousePosition.x,
          y: mousePosition.y,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
          mass: 0.25,
        }}
      />

      {/* BACKGROUND */}

      <div className="grid-background" />

      <div className="orb orb-one" />
      <div className="orb orb-two" />

      {/* ==========================================
          NAVBAR
      ========================================== */}

      <nav className="navbar">
        <motion.div
          className="brand"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <motion.div
            className="brand-symbol"
            animate={{
              rotate: [0, 90, 180, 270, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            ◈
          </motion.div>

          <span>DevGuardian</span>
        </motion.div>

        <div className="nav-right">
          <a href="#features">Features</a>

          <a
            href="https://github.com/Praise1-byte"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </nav>

      <AnimatePresence mode="wait">

        {/* ==========================================
            LANDING PAGE
        ========================================== */}

        {!report ? (
          <motion.main
            key="landing"
            className="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
          >

            {/* HERO */}

            <section className="hero">

              <motion.div
                className="system-status"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="pulse-dot" />
                DEVGUARDIAN ENGINE ONLINE
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.15,
                  duration: 0.7,
                }}
              >
                Your repository.
                <br />
                <span>Under surveillance.</span>
              </motion.h1>

              <motion.p
                className="hero-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                Automated code intelligence that detects quality
                problems, security risks and maintainability issues
                before they become expensive.
              </motion.p>

              {/* INPUT */}

              <motion.div
                className="scan-box"
                initial={{
                  opacity: 0,
                  scale: 0.97,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                transition={{
                  delay: 0.45,
                  duration: 0.5,
                }}
              >

                <div className="scan-icon">
                  ◉
                </div>

                <input
                  value={repository}
                  onChange={(e) =>
                    setRepository(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      analyzeRepository();
                    }
                  }}
                  placeholder="Paste a GitHub repository URL..."
                />

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={analyzeRepository}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="loader" />
                      Scanning
                    </>
                  ) : (
                    <>
                      Scan repository
                      <span>→</span>
                    </>
                  )}
                </motion.button>

                {loading && (
                  <motion.div
                    className="scan-line"
                    initial={{ left: "0%" }}
                    animate={{ left: "100%" }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                )}
              </motion.div>

              {/* ERROR */}

              {error && (
                <motion.div
                  className="error"
                  initial={{
                    opacity: 0,
                    y: -10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >
                  <span>!</span>
                  {error}
                </motion.div>
              )}

              <div className="trust-row">
                <span>◈ READ ONLY</span>
                <span>◈ NO CODE MODIFICATION</span>
                <span>◈ AUTOMATED ANALYSIS</span>
              </div>

            </section>

            {/* ==========================================
                LIVE ANALYSIS PREVIEW

                IMPORTANT:
                Only appears after the user starts scanning.
            ========================================== */}

            {loading && (
              <motion.section
                className="demo-section"
                initial={{
                  opacity: 0,
                  y: 40,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <div className="demo-window">

                  <div className="window-header">

                    <div className="window-dots">
                      <i />
                      <i />
                      <i />
                    </div>

                    <div className="window-title">
                      DEVGUARDIAN / ANALYSIS
                    </div>

                    <div className="live">
                      <span />
                      SCANNING
                    </div>

                  </div>

                  <div className="demo-content">

                    <div className="demo-repository">

                      <div>
                        <small>
                          ANALYZING REPOSITORY
                        </small>

                        <h3>
                          {repository
                            .replace("https://github.com/", "")
                            .replace("http://github.com/", "")
                            .replace(/\/$/, "") ||
                            "repository"}
                        </h3>
                      </div>

                      <div className="scan-status">
                        <span />
                        ANALYSIS IN PROGRESS
                      </div>

                    </div>

                    <div className="scanning-animation">

                      <div className="scan-core">
                        <span />
                      </div>

                      <div>
                        <strong>
                          Scanning repository
                        </strong>

                        <p>
                          Inspecting source files, dependencies,
                          architecture and security patterns...
                        </p>
                      </div>

                    </div>

                  </div>
                </div>
              </motion.section>
            )}

            {/* ==========================================
                FEATURES
            ========================================== */}

            <section
              className="features"
              id="features"
            >
              <div className="section-heading">

                <span>
                  WHAT WE CHECK
                </span>

                <h2>
                  Built for developers who care about their code.
                </h2>

              </div>

              <motion.div
                className="feature-grid"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{
                  once: true,
                }}
              >

                {[
                  [
                    "01",
                    "Code Quality",
                    "Identify patterns that make your code harder to maintain.",
                  ],
                  [
                    "02",
                    "Security",
                    "Detect suspicious patterns and common security risks.",
                  ],
                  [
                    "03",
                    "Architecture",
                    "Understand structural problems before they scale.",
                  ],
                ].map(
                  ([number, title, text]) => (
                    <motion.div
                      className="feature"
                      variants={itemVariants}
                      key={number}
                    >
                      <span>
                        {number}
                      </span>

                      <h3>
                        {title}
                      </h3>

                      <p>
                        {text}
                      </p>
                    </motion.div>
                  )
                )}

              </motion.div>
            </section>

            {/* FOOTER */}

            <footer>

              <span>
                Built by{" "}
                <strong>
                  DevPraise
                </strong>
              </span>

              <a
                href="https://github.com/Praise1-byte"
                target="_blank"
                rel="noreferrer"
              >
                github.com/Praise1-byte ↗
              </a>

            </footer>

          </motion.main>

        ) : (

          /* ==========================================
             REPORT
          ========================================== */

          <motion.main
            key="report"
            className="report-page"
            initial={{
              opacity: 0,
              y: 30,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >

            <button
              className="back"
              onClick={() => {
                setReport(null);
                setRepository("");
              }}
            >
              ← Scan another repository
            </button>

            <div className="report-top">

              <div>

                <span>
                  REPOSITORY ANALYSIS
                </span>

                <h1>
                  {report.repository}
                </h1>

                <p>
                  {report.filesAnalyzed} files analyzed
                </p>

              </div>

              <div className="report-score">

                <strong>
                  {report.score}
                </strong>

                <small>
                  /100
                </small>

              </div>

            </div>

            <div className="summary-grid">

              {[
                [
                  "CRITICAL",
                  report.summary.critical,
                  "critical",
                ],
                [
                  "HIGH",
                  report.summary.high,
                  "high",
                ],
                [
                  "MEDIUM",
                  report.summary.medium,
                  "medium",
                ],
                [
                  "LOW",
                  report.summary.low,
                  "low",
                ],
              ].map(
                ([label, value, type]) => (

                  <motion.div
                    className="summary"
                    whileHover={{
                      y: -4,
                    }}
                    key={label}
                  >

                    <span>
                      {label}
                    </span>

                   <strong
  className={String(type)}
>
                      {value}
                    </strong>

                  </motion.div>

                )
              )}

            </div>

            <section className="findings">

              <span>
                DETECTED ISSUES
              </span>

              <h2>
                {report.findings.length} findings
              </h2>

              {report.findings.length === 0 ? (

                <div className="clean">

                  <div>
                    ✓
                  </div>

                  <h3>
                    Repository looks clean.
                  </h3>

                  <p>
                    No issues were detected by the
                    current analysis engine.
                  </p>

                </div>

              ) : (

                <div className="finding-list">

                  {report.findings.map(
                    (finding, index) => (

                      <motion.article
                        className="finding"
                        initial={{
                          opacity: 0,
                          x: -20,
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                        }}
                        transition={{
                          delay: index * 0.04,
                        }}
                        key={index}
                      >

                        <div
                          className={`severity-bar ${finding.severity}`}
                        />

                        <div>

                          <div className="finding-meta">

                            <span
                              className={`badge ${finding.severity}`}
                            >
                              {finding.severity}
                            </span>

                            <span>
                              {finding.type}
                            </span>

                          </div>

                          <h3>
                            {finding.title}
                          </h3>

                          <p>
                            {finding.description}
                          </p>

                          {finding.line && (
                            <small>
                              Line {finding.line}
                            </small>
                          )}

                        </div>

                      </motion.article>

                    )
                  )}

                </div>

              )}

            </section>

          </motion.main>
        )}

      </AnimatePresence>

    </div>
  );
}

export default App;
