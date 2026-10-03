import { useEffect, useState } from "react";
import AttendanceWorkspace from "./AttendanceWorkspace.jsx";
import BrowserDiagnostics from "./BrowserDiagnostics.jsx";
import { requestApi } from "./apiClient.js";
import "./style.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

const demoAccountsByRole = {
  student: Array.from({ length: 30 }, (_, index) =>
    `student.${String(index + 1).padStart(3, "0")}`,
  ),
  professor: [
    "professor.cs",
    "professor.math",
    "professor.kavya.iyer",
    "professor.rahul.menon",
    "professor.neha.sharma",
    "professor.vikram.nair",
  ],
  administrator: ["admin.demo"],
};

const loginRoles = [
  {
    id: "student",
    label: "Student",
    icon: "student",
  },
  {
    id: "professor",
    label: "Professor",
    icon: "professor",
  },
  {
    id: "administrator",
    label: "Administrator",
    icon: "administrator",
  },
];

const navigationByRole = {
  student: [
    ["overview", "Overview", "grid"],
    ["attendance", "My attendance", "calendar"],
    ["academic-progress", "Academic progress", "chart"],
    ["notifications", "Notifications", "bell"],
    ["privacy", "Privacy", "shield"],
  ],
  professor: [
    ["overview", "Overview", "grid"],
    ["manual-attendance", "Attendance", "calendar"],
    ["academic-progress", "Assessments", "book"],
    ["face-attendance-heading", "Face review", "scan"],
    ["voice-attendance-heading", "Voice entry", "mic"],
  ],
  administrator: [
    ["overview", "Overview", "grid"],
    ["attendance", "Attendance", "calendar"],
    ["academic-progress", "Academic overview", "chart"],
    ["management-students", "Students", "users"],
    ["management-subjects", "Courses", "book"],
  ],
};

function NavigationIcon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></>,
    chart: <><path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5zM4 16h16M8 7h8M8 11h6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="navigation-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function LoginRoleIcon({ name }) {
  const paths = {
    student: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1.5a7 7 0 0 1 14 0V20z" /></>,
    professor: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 12h16m-9 0v2h2v-2" /></>,
    administrator: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.5a7.5 7.5 0 0 1-1.7 1l-.3 1.6h-3l-.3-1.6a7.5 7.5 0 0 1-1.7-1l-1.5.5-1.5-2.6 1.2-1a7 7 0 0 1 0-2l-1.2-1 1.5-2.6 1.5.5a7.5 7.5 0 0 1 1.7-1l.3-1.6h3l.3 1.6a7.5 7.5 0 0 1 1.7 1l1.5-.5 1.5 2.6-1.2 1a7 7 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="login-role-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function App() {
  const [apiStatus, setApiStatus] = useState("Checking API...");
  const [selectedRole, setSelectedRole] = useState("student");
  const [username, setUsername] = useState(demoAccountsByRole.student[0]);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [activeNavigation, setActiveNavigation] = useState(
    () => window.location.hash.slice(1) || "overview",
  );

  useEffect(() => {
    function updateActiveNavigation() {
      setActiveNavigation(window.location.hash.slice(1) || "overview");
    }
    window.addEventListener("hashchange", updateActiveNavigation);
    return () => window.removeEventListener("hashchange", updateActiveNavigation);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${apiBaseUrl}/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}.`);
        }
        return response.json();
      })
      .then((health) => {
        if (active) {
          setApiStatus(health.status === "ok" ? "API is responding." : "API returned an unexpected response.");
        }
      })
      .catch((fetchError) => {
        if (active) {
          setApiStatus(`API unavailable: ${fetchError.message}`);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      const login = await requestApi("/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      const currentUser = await requestApi("/auth/me", { token: login.access_token });
      setToken(login.access_token);
      setUser(currentUser);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoggingIn(false);
    }
  }

  function signOut() {
    setToken("");
    setUser(null);
    setError("");
    setSelectedRole("student");
    setUsername(demoAccountsByRole.student[0]);
  }

  if (!user) {
    return (
      <main className="auth-layout">
        <section className="auth-brand" aria-label="Academic Monitoring System">
          <div className="auth-brand-lockup">
            <div>
              <strong>ScholarSpace</strong>
              <span>Academic Support Portal</span>
            </div>
          </div>
          <p className="auth-brand-statement">
            Academic visibility for students, faculty, and administrators.
          </p>
          <p className="auth-brand-footer">
            Monitor attendance. Understand performance. Support students earlier.
          </p>
        </section>
        <section className="auth-content">
          <div className="auth-card">
            <p className="eyebrow">ACADEMIC SUPPORT PORTAL</p>
            <h1 id="login-heading">Welcome back</h1>
            <p className="auth-description">
              Sign in to continue to your academic workspace.
            </p>
            <p
              className={`api-status auth-api-status ${
                apiStatus === "API is responding." ? "is-online" : ""
              } ${
                apiStatus.startsWith("API unavailable")
                  || apiStatus.includes("unexpected response")
                  ? "is-error"
                  : ""
              }`}
              role="status"
            >
              <span className="status-dot" aria-hidden="true" />
              {apiStatus === "API is responding." ? "API responding" : apiStatus}
            </p>
            <form onSubmit={signIn} className="login-form">
              <fieldset className="login-role-fieldset">
                <legend>Sign in as</legend>
                <div className="login-role-options">
                  {loginRoles.map((role) => (
                    <button
                      key={role.id}
                      className={`login-role-option ${
                        selectedRole === role.id ? "is-selected" : ""
                      }`}
                      type="button"
                      aria-pressed={selectedRole === role.id}
                      onClick={() => {
                        setSelectedRole(role.id);
                        setUsername(demoAccountsByRole[role.id][0]);
                        setError("");
                      }}
                    >
                      <LoginRoleIcon name={role.icon} />
                      <span className="login-role-name">{role.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="demo-account">Demo account</label>
              <select
                id="demo-account"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              >
                {demoAccountsByRole[selectedRole].map((account) => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
              {error && <p className="feedback error" role="alert">{error}</p>}
              <button className="primary-button sign-in-button" type="submit" disabled={loggingIn}>
                {loggingIn ? "Signing in..." : "Continue"}
                <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="auth-demo-note">
              Fictional demo accounts for hackathon evaluation.
            </p>
          </div>
          <footer className="auth-footer">
            Intelligent Student Academic Monitoring and Support System
          </footer>
        </section>
      </main>
    );
  }

  const navigation = navigationByRole[user.role] ?? navigationByRole.student;
  const activeTarget = navigation.some(([target]) => target === activeNavigation)
    ? activeNavigation
    : navigation[0][0];
  const initials = user.username
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className={`app-shell app-shell--${user.role}`}>
      <aside className={`sidebar ${mobileNavigationOpen ? "is-open" : ""}`}>
        <a className="brand-lockup" href="#overview" aria-label="ScholarSpace home">
          <div className="brand-mark small" aria-hidden="true">S</div>
          <span className="brand-copy">
            <strong>ScholarSpace</strong>
            <small>Academic Support Portal</small>
          </span>
        </a>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="main-navigation">
          {navigation.map(([target, label, icon]) => (
            <a
              key={target}
              href={`#${target}`}
              className={`navigation-link ${activeTarget === target ? "is-active" : ""}`}
              onClick={() => setMobileNavigationOpen(false)}
            >
              <NavigationIcon name={icon} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-section-label">DEMO ENVIRONMENT</span>
          <p>Fictional data · Local prototype</p>
          <div className="api-status sidebar-status" role="status">
            <span className={`status-dot ${apiStatus.startsWith("API unavailable") ? "is-error" : ""}`} aria-hidden="true" />
            {apiStatus}
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavigationOpen}
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
          <div className="topbar-context">
            <span>ACADEMIC SUPPORT</span>
            <span className="topbar-separator">/</span>
            <span>{user.role}</span>
          </div>
          <div className="account-menu">
            <div className="account-avatar" aria-hidden="true">{initials || "U"}</div>
            <div className="account-copy">
              <strong>{user.username}</strong>
              <span>{user.role}</span>
            </div>
            <button type="button" className="topbar-signout" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <div className="workspace-content">
          <AttendanceWorkspace token={token} user={user} />
          <BrowserDiagnostics />
          <footer className="app-footer">
            ScholarSpace · Academic monitoring prototype · Fictional demo data
          </footer>
        </div>
      </main>
      {mobileNavigationOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="navigation-scrim"
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}
    </div>
  );
}
