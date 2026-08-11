
interface CodeFinding {
  ruleId: string;
  type: "security" | "bug" | "quality" | "performance";
  severity: "critical" | "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";

  title: string;
  description: string;

  line?: number;
  lines?: number[];
  occurrences?: number;
}

interface AnalysisResult {
  file: string;
  score: number;
  findings: CodeFinding[];
}

type Language =
  | "javascript"
  | "typescript"
  | "jsx"
  | "tsx"
  | "shell"
  | "powershell"
  | "unknown";

interface RuleMatch {
  ruleId: string;
  type: CodeFinding["type"];
  severity: CodeFinding["severity"];
  confidence: CodeFinding["confidence"];
  title: string;
  description: string;
  line: number;
}

const MAX_FINDINGS = 80;
const MAX_LINES_PER_FINDING = 50;
const LONG_LINE_LIMIT = 180;

/* ============================================================
   LANGUAGE DETECTION
============================================================ */

function detectLanguage(filePath: string): Language {
  const extension = filePath
    .toLowerCase()
    .split(".")
    .pop();

  switch (extension) {
    case "js":
      return "javascript";

    case "jsx":
      return "jsx";

    case "ts":
      return "typescript";

    case "tsx":
      return "tsx";

    case "cmd":
    case "bat":
      return "shell";

    case "ps1":
      return "powershell";

    default:
      return "unknown";
  }
}

/* ============================================================
   HELPERS
============================================================ */

function isComment(line: string, language: Language): boolean {
  const trimmed = line.trim();

  if (!trimmed) return true;

  if (
    language === "javascript" ||
    language === "typescript" ||
    language === "jsx" ||
    language === "tsx"
  ) {
    return (
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*")
    );
  }

  if (
    language === "shell" ||
    language === "powershell"
  ) {
    return (
      trimmed.startsWith("REM ") ||
      trimmed.startsWith("::") ||
      trimmed.startsWith("#")
    );
  }

  return false;
}

function addMatch(
  matches: RuleMatch[],
  match: RuleMatch
) {
  if (matches.length >= MAX_FINDINGS) return;

  matches.push(match);
}

/* ============================================================
   JAVASCRIPT / TYPESCRIPT ANALYSIS
============================================================ */

function analyzeJavaScriptLike(
  lines: string[],
  language: Language
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  const isTypeScript =
    language === "typescript" ||
    language === "tsx";

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!trimmed || isComment(line, language)) {
      return;
    }

    /* --------------------------------------------------------
       eval()
    -------------------------------------------------------- */

    if (/\beval\s*\(/.test(line)) {
      addMatch(matches, {
        ruleId: "JS-EVAL",
        type: "security",
        severity: "critical",
        confidence: "high",
        title: "Dangerous eval() usage",
        description:
          "eval() executes dynamically supplied JavaScript and can enable arbitrary code execution when its input is influenced by an attacker.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Function constructor
    -------------------------------------------------------- */

    if (
      /\bnew\s+Function\s*\(/.test(line) ||
      /\bFunction\s*\(/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-FUNCTION-CONSTRUCTOR",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Dynamic JavaScript execution",
        description:
          "The Function constructor dynamically creates executable JavaScript and can introduce code-injection vulnerabilities.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       innerHTML / outerHTML
    -------------------------------------------------------- */

    if (
      /\.innerHTML\s*=/i.test(line) ||
      /\.outerHTML\s*=/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-INNERHTML",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Potential XSS vulnerability",
        description:
          "Direct HTML injection can execute attacker-controlled markup when the assigned value contains untrusted data.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       document.write
    -------------------------------------------------------- */

    if (/\bdocument\.write\s*\(/.test(line)) {
      addMatch(matches, {
        ruleId: "JS-DOCUMENT-WRITE",
        type: "security",
        severity: "medium",
        confidence: "high",
        title: "Unsafe document.write() usage",
        description:
          "document.write() can create injection risks and can unexpectedly replace document content.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Dangerous child_process APIs
    -------------------------------------------------------- */

    if (
      /\bexec\s*\(/.test(line) &&
      /(child_process|exec|shell)/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-COMMAND-EXEC",
        type: "security",
        severity: "high",
        confidence: "medium",
        title: "Potential command injection",
        description:
          "A shell command appears to be executed dynamically. User-controlled values should never be concatenated directly into shell commands.",
        line: lineNumber,
      });
    }

    if (
      /\bexecSync\s*\(/.test(line) ||
      /\bspawn\s*\(/.test(line) ||
      /\bspawnSync\s*\(/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-PROCESS-EXECUTION",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Process execution",
        description:
          "The application launches an operating-system process. Validate arguments carefully and avoid passing untrusted input to shell execution.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       SQL injection indicators
    -------------------------------------------------------- */

    if (
      /(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(line) &&
      /(\+|\$\{|`[^`]*\$\{)/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "SQL-CONCATENATION",
        type: "security",
        severity: "high",
        confidence: "medium",
        title: "Potential SQL injection",
        description:
          "SQL appears to be constructed using string interpolation or concatenation. Parameterized queries should be used instead.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Hardcoded secrets
    -------------------------------------------------------- */

    const secretPattern =
      /\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*["'`]([^"'`]{8,})["'`]/i;

    const secretMatch = line.match(secretPattern);

    if (secretMatch) {
      const value = secretMatch[2];

      const obviousPlaceholder =
        /^(test|demo|example|sample|changeme|password|your[_-]?key|your[_-]?token|xxx+|placeholder)/i.test(
          value
        );

      if (!obviousPlaceholder) {
        addMatch(matches, {
          ruleId: "SECRET-HARDCODED",
          type: "security",
          severity: "critical",
          confidence: "high",
          title: "Possible hardcoded secret",
          description:
            "A credential-like value appears directly in source code. Secrets should be stored in environment variables or a dedicated secret manager.",
          line: lineNumber,
        });
      }
    }

    /* --------------------------------------------------------
       JWT-like token
    -------------------------------------------------------- */

    if (
      /["'`]eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}["'`]/.test(
        line
      )
    ) {
      addMatch(matches, {
        ruleId: "JWT-HARDCODED",
        type: "security",
        severity: "critical",
        confidence: "high",
        title: "Hardcoded JWT token",
        description:
          "A JWT-like credential appears embedded in source code and may expose authentication data.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Weak randomness
    -------------------------------------------------------- */

    if (
      /\bMath\.random\s*\(\)/.test(line) &&
      /(token|password|secret|key|auth|session|otp|code)/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-WEAK-RANDOMNESS",
        type: "security",
        severity: "high",
        confidence: "medium",
        title: "Weak randomness for security-sensitive data",
        description:
          "Math.random() is not designed for cryptographic randomness and should not be used for tokens, secrets, authentication codes, or similar values.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       HTTP instead of HTTPS
    -------------------------------------------------------- */

    if (
      /["'`]http:\/\/[^"'`]+["'`]/i.test(line) &&
      !/localhost|127\.0\.0\.1/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "HTTP-NOT-HTTPS",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Unencrypted HTTP connection",
        description:
          "The source contains an HTTP URL that may transmit data without transport encryption.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Dangerous URL redirects
    -------------------------------------------------------- */

    if (
      /(window\.location|location\.href|location\.assign)\s*=/.test(
        line
      ) &&
      /(\+|\$\{)/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-OPEN-REDIRECT",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Potential open redirect",
        description:
          "A navigation target appears to be constructed dynamically. Untrusted redirect destinations should be validated.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       localStorage sensitive data
    -------------------------------------------------------- */

    if (
      /localStorage\.(setItem|getItem)/.test(line) &&
      /(token|password|secret|auth|session)/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-SENSITIVE-LOCALSTORAGE",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Sensitive data in localStorage",
        description:
          "Authentication or secret-like data appears to be stored in localStorage, where it can be accessed by JavaScript running on the page.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       dangerouslySetInnerHTML
    -------------------------------------------------------- */

    if (/dangerouslySetInnerHTML/.test(line)) {
      addMatch(matches, {
        ruleId: "REACT-DANGEROUS-HTML",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Dangerous HTML rendering",
        description:
          "React's dangerouslySetInnerHTML bypasses normal escaping and should only be used with trusted or sanitized HTML.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       TypeScript explicit any
    -------------------------------------------------------- */

    if (
      isTypeScript &&
      /:\s*any\b/.test(line) &&
      !/\/\/.*:\s*any\b/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "TS-EXPLICIT-ANY",
        type: "quality",
        severity: "low",
        confidence: "high",
        title: "Explicit any type",
        description:
          "The explicit any type disables useful TypeScript type checking and can hide runtime errors.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       console logging
    -------------------------------------------------------- */

    if (
      /\bconsole\.(log|debug|info|warn|error)\s*\(/.test(
        line
      )
    ) {
      addMatch(matches, {
        ruleId: "JS-CONSOLE",
        type: "quality",
        severity: "low",
        confidence: "high",
        title: "Console logging",
        description:
          "Debug logging may expose implementation details or sensitive data and should be reviewed before production.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       TODO / FIXME
    -------------------------------------------------------- */

    if (/\b(TODO|FIXME|HACK)\b/i.test(line)) {
      addMatch(matches, {
        ruleId: "CODE-TODO",
        type: "quality",
        severity: "low",
        confidence: "high",
        title: "Unresolved code marker",
        description:
          "The source contains a TODO, FIXME, or HACK marker that may indicate unfinished work.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Loose equality
       Only flag actual JS/TS code.
    -------------------------------------------------------- */

    if (
      /(^|[^=!])==([^=]|$)/.test(line) ||
      /(^|[^!])!=([^=]|$)/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "JS-LOOSE-EQUALITY",
        type: "bug",
        severity: "low",
        confidence: "high",
        title: "Loose equality comparison",
        description:
          "Loose equality performs type coercion that can produce unexpected results. Strict equality is usually safer.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Empty catch
    -------------------------------------------------------- */

    if (
      /catch\s*\([^)]*\)\s*\{\s*\}/.test(
        line.replace(/\s+/g, " ")
      )
    ) {
      addMatch(matches, {
        ruleId: "JS-EMPTY-CATCH",
        type: "bug",
        severity: "medium",
        confidence: "high",
        title: "Empty error handler",
        description:
          "An empty catch block silently ignores errors and can make failures difficult to diagnose.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Very long lines
       Don't punish generated/minified-looking code excessively.
    -------------------------------------------------------- */

    if (
      line.length > LONG_LINE_LIMIT &&
      line.length < 2000 &&
      !/[{};,]\s*[{};,]/.test(line)
    ) {
      addMatch(matches, {
        ruleId: "CODE-LONG-LINE",
        type: "quality",
        severity: "low",
        confidence: "high",
        title: "Very long line",
        description:
          "This line is unusually long and may reduce readability and maintainability.",
        line: lineNumber,
      });
    }
  });

  return matches;
}

/* ============================================================
   WINDOWS CMD / BAT ANALYSIS
============================================================ */

function analyzeWindowsShell(
  lines: string[]
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!trimmed || isComment(line, "shell")) {
      return;
    }

    const lower = trimmed.toLowerCase();

    /* --------------------------------------------------------
       PowerShell
    -------------------------------------------------------- */

    if (
      /\bpowershell(?:\.exe)?\b/i.test(trimmed) ||
      /\bpwsh(?:\.exe)?\b/i.test(trimmed)
    ) {
      const encoded =
        /-enc(?:odedcommand)?\b/i.test(trimmed);

      addMatch(matches, {
        ruleId: encoded
          ? "WIN-POWERSHELL-ENCODED"
          : "WIN-POWERSHELL",
        type: "security",
        severity: encoded ? "high" : "medium",
        confidence: "high",
        title: encoded
          ? "Encoded PowerShell execution"
          : "PowerShell execution",
        description: encoded
          ? "The script executes an encoded PowerShell command. Encoded commands can hide behavior and should be reviewed carefully."
          : "The batch script invokes PowerShell. This can be legitimate, but commands and their arguments should be reviewed.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Dynamic command execution
    -------------------------------------------------------- */

    if (
      /\bcall\s+.*%[^%]+%/i.test(trimmed) ||
      /\bfor\s+\/f\b.*\bdo\s+/i.test(trimmed) ||
      /\b%[^%]+%\b.*\b(?:call|start)\b/i.test(trimmed)
    ) {
      addMatch(matches, {
        ruleId: "WIN-DYNAMIC-COMMAND",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Dynamic command execution",
        description:
          "The script constructs or invokes a command dynamically. Validate variables and external inputs before they reach execution.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Dangerous utilities
    -------------------------------------------------------- */

    const dangerousUtilities =
      /\b(?:mshta|rundll32|regsvr32|certutil|bitsadmin|wmic)\b/i;

    if (dangerousUtilities.test(trimmed)) {
      addMatch(matches, {
        ruleId: "WIN-DANGEROUS-UTILITY",
        type: "security",
        severity: "high",
        confidence: "medium",
        title: "Potentially dangerous Windows utility",
        description:
          "The script uses a Windows utility that can load or execute external content. Verify that its arguments are trusted.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Registry
    -------------------------------------------------------- */

    if (
      /\breg(?:\.exe)?\s+(?:add|delete|import|copy|save)\b/i.test(
        trimmed
      )
    ) {
      addMatch(matches, {
        ruleId: "WIN-REGISTRY-MODIFICATION",
        type: "security",
        severity: "medium",
        confidence: "high",
        title: "Windows registry modification",
        description:
          "The script modifies the Windows registry. Registry changes can affect system configuration and should be reviewed.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       File deletion
    -------------------------------------------------------- */

    if (
      /\b(?:del|erase|rd|rmdir)\b/i.test(trimmed)
    ) {
      addMatch(matches, {
        ruleId: "WIN-FILE-DELETION",
        type: "security",
        severity: "medium",
        confidence: "high",
        title: "File deletion command",
        description:
          "The script can delete files or directories. Verify that the target path is intentional and cannot be controlled by untrusted input.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Administrative privileges
    -------------------------------------------------------- */

    if (
      /\b(?:runas|net\s+session|fltmc)\b/i.test(trimmed) ||
      /\b(?:administrator|admin)\b/i.test(trimmed) &&
      /\b(?:elevat|privilege|require)\w*\b/i.test(trimmed)
    ) {
      addMatch(matches, {
        ruleId: "WIN-ADMIN-PRIVILEGE",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Administrative privilege operation",
        description:
          "The script appears to check for or request elevated Windows privileges. Verify that elevation is required.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Download commands
    -------------------------------------------------------- */

    if (
      /\b(?:curl|wget|bitsadmin|certutil)\b/i.test(
        trimmed
      ) &&
      /https?:\/\//i.test(trimmed)
    ) {
      addMatch(matches, {
        ruleId: "WIN-REMOTE-DOWNLOAD",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Remote content download",
        description:
          "The script downloads content from a remote URL. Verify the source, integrity, and destination before executing downloaded content.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Command obfuscation
    -------------------------------------------------------- */

    const variableExpansionCount =
      (trimmed.match(/%[^%]+%/g) || []).length;

    if (
      variableExpansionCount >= 4 ||
      /(?:\^|\|\||&&)\s*(?:%|!)[^ ]+/i.test(
        trimmed
      )
    ) {
      addMatch(matches, {
        ruleId: "WIN-COMMAND-OBFUSCATION",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Potential command obfuscation",
        description:
          "The command uses unusual variable expansion or shell metacharacters that may obscure its behavior. Review the expanded command carefully.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Environment-sensitive command execution
    -------------------------------------------------------- */

    if (
      /\b(?:start|call)\b/i.test(trimmed) &&
      /%[^%]+%/.test(trimmed)
    ) {
      addMatch(matches, {
        ruleId: "WIN-ENV-COMMAND",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Environment-controlled command",
        description:
          "A command target appears to depend on an environment variable. Unexpected environment values may alter execution behavior.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Network configuration changes
    -------------------------------------------------------- */

    if (
      /\b(?:netsh|ipconfig|route|net\s+(?:user|localgroup|start|stop))\b/i.test(
        trimmed
      )
    ) {
      addMatch(matches, {
        ruleId: "WIN-SYSTEM-CONFIG",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Windows system configuration change",
        description:
          "The script interacts with Windows networking, users, services, or system configuration.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Suspicious remote execution
    -------------------------------------------------------- */

    if (
      /\b(?:psexec|wmic)\b/i.test(trimmed) &&
      /\\\\|\/node:|process\s+call/i.test(trimmed)
    ) {
      addMatch(matches, {
        ruleId: "WIN-REMOTE-EXECUTION",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Potential remote command execution",
        description:
          "The script appears capable of executing commands against another Windows host.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Long shell lines
    -------------------------------------------------------- */

    if (
      line.length > LONG_LINE_LIMIT &&
      line.length < 3000
    ) {
      addMatch(matches, {
        ruleId: "CODE-LONG-LINE",
        type: "quality",
        severity: "low",
        confidence: "high",
        title: "Very long line",
        description:
          "This line is unusually long and may reduce readability and maintainability.",
        line: lineNumber,
      });
    }

    /* --------------------------------------------------------
       Suspicious encoded content
    -------------------------------------------------------- */

    if (
      /(?:-enc(?:odedcommand)?\s+[A-Za-z0-9+/=]{40,})/i.test(
        trimmed
      )
    ) {
      addMatch(matches, {
        ruleId: "WIN-ENCODED-PAYLOAD",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Potentially encoded payload",
        description:
          "A large encoded payload appears in the command. Encoding can be legitimate, but it may also conceal executable behavior.",
        line: lineNumber,
      });
    }

    void lower;
  });

  return matches;
}

/* ============================================================
   POWERSHELL ANALYSIS
============================================================ */

function analyzePowerShell(
  lines: string[]
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (
      !line.trim() ||
      isComment(line, "powershell")
    ) {
      return;
    }

    /* Invoke-Expression */
    if (
      /\bInvoke-Expression\b/i.test(line) ||
      /\bIEX\b/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "PS-IEX",
        type: "security",
        severity: "critical",
        confidence: "high",
        title: "Dynamic PowerShell execution",
        description:
          "Invoke-Expression can execute dynamically constructed PowerShell code and may enable arbitrary command execution.",
        line: lineNumber,
      });
    }

    /* Download + execute */
    if (
      /(Invoke-WebRequest|iwr|curl|wget|WebClient|DownloadString|DownloadFile)/i.test(
        line
      ) &&
      /(Invoke-Expression|IEX|&\s*\(|Start-Process)/i.test(
        line
      )
    ) {
      addMatch(matches, {
        ruleId: "PS-DOWNLOAD-EXECUTE",
        type: "security",
        severity: "critical",
        confidence: "high",
        title: "Remote content followed by execution",
        description:
          "The script appears to retrieve remote content and execute it. This pattern is highly sensitive and should be carefully verified.",
        line: lineNumber,
      });
    }

    /* Encoded command */
    if (
      /-(?:EncodedCommand|enc)\b/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "PS-ENCODED-COMMAND",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "Encoded PowerShell command",
        description:
          "Encoded PowerShell commands can conceal command behavior and should be reviewed carefully.",
        line: lineNumber,
      });
    }

    /* Execution policy bypass */
    if (
      /ExecutionPolicy\s+(?:Bypass|Unrestricted)/i.test(
        line
      )
    ) {
      addMatch(matches, {
        ruleId: "PS-POLICY-BYPASS",
        type: "security",
        severity: "high",
        confidence: "high",
        title: "PowerShell execution policy bypass",
        description:
          "The script attempts to weaken PowerShell execution policy restrictions.",
        line: lineNumber,
      });
    }

    /* Hidden window */
    if (
      /-WindowStyle\s+Hidden/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "PS-HIDDEN-WINDOW",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "Hidden PowerShell window",
        description:
          "PowerShell is configured to execute with a hidden window, which can obscure user-visible activity.",
        line: lineNumber,
      });
    }

    /* Credential material */
    if (
      /\$(?:password|passwd|secret|token|apikey)\s*=\s*["'][^"']{8,}["']/i.test(
        line
      )
    ) {
      addMatch(matches, {
        ruleId: "PS-HARDCODED-SECRET",
        type: "security",
        severity: "critical",
        confidence: "high",
        title: "Possible hardcoded secret",
        description:
          "A secret-like value appears to be embedded directly in the PowerShell script.",
        line: lineNumber,
      });
    }

    /* Registry */
    if (
      /\b(?:Set-ItemProperty|New-ItemProperty|Remove-ItemProperty)\b/i.test(
        line
      ) &&
      /Registry::|HKLM:|HKCU:/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "PS-REGISTRY",
        type: "security",
        severity: "medium",
        confidence: "high",
        title: "Windows registry modification",
        description:
          "The PowerShell script modifies Windows registry settings.",
        line: lineNumber,
      });
    }

    /* File removal */
    if (
      /\bRemove-Item\b/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "PS-FILE-DELETION",
        type: "security",
        severity: "medium",
        confidence: "high",
        title: "File deletion command",
        description:
          "The script removes files or directories. Verify that the target path is intentional.",
        line: lineNumber,
      });
    }

    /* Process execution */
    if (
      /\bStart-Process\b/i.test(line)
    ) {
      addMatch(matches, {
        ruleId: "PS-PROCESS-EXECUTION",
        type: "security",
        severity: "medium",
        confidence: "medium",
        title: "PowerShell process execution",
        description:
          "The script launches another process. Review arguments and executable paths carefully.",
        line: lineNumber,
      });
    }
  });

  return matches;
}

/* ============================================================
   DEDUPLICATION
============================================================ */

function deduplicateFindings(
  matches: RuleMatch[]
): CodeFinding[] {
  const groups = new Map<string, CodeFinding>();

  for (const match of matches) {
    const existing = groups.get(match.ruleId);

    if (!existing) {
      groups.set(match.ruleId, {
        ruleId: match.ruleId,
        type: match.type,
        severity: match.severity,
        confidence: match.confidence,
        title: match.title,
        description: match.description,
        line: match.line,
        lines: [match.line],
        occurrences: 1,
      });

      continue;
    }

    existing.occurrences =
      (existing.occurrences ?? 1) + 1;

    existing.lines ??= [];

    if (
      !existing.lines.includes(match.line) &&
      existing.lines.length < MAX_LINES_PER_FINDING
    ) {
      existing.lines.push(match.line);
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => {
      const severityWeight = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };

      return (
        severityWeight[b.severity] -
        severityWeight[a.severity]
      );
    }
  );
}

/* ============================================================
   SMART SCORING
============================================================ */

function calculateScore(
  findings: CodeFinding[],
  lineCount: number
): number {
  if (findings.length === 0) {
    return 100;
  }

  let penalty = 0;

  for (const finding of findings) {
    const occurrences =
      finding.occurrences ?? 1;

    const severityPenalty = {
      critical: 35,
      high: 18,
      medium: 8,
      low: 2,
    }[finding.severity];

    const confidenceMultiplier = {
      high: 1,
      medium: 0.7,
      low: 0.4,
    }[finding.confidence];

    /*
     * First occurrence carries the majority of the penalty.
     * Repeated occurrences increase risk, but much less.
     */
    const repeatedOccurrencePenalty =
      Math.min(
        Math.max(occurrences - 1, 0) * 0.75,
        severityPenalty * 0.75
      );

    penalty +=
      severityPenalty *
        confidenceMultiplier +
      repeatedOccurrencePenalty;
  }

  /*
   * Very large files should not automatically receive
   * terrible scores just because they contain lots of code.
   */
  if (lineCount > 10000) {
    penalty *= 0.85;
  }

  if (lineCount > 50000) {
    penalty *= 0.7;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(100 - penalty))
  );
}

/* ============================================================
   MAIN ANALYZER
============================================================ */

export function analyzeCode(
  filePath: string,
  code: string
): AnalysisResult {
  const language = detectLanguage(filePath);

  const lines = code.split(/\r?\n/);

  let matches: RuleMatch[] = [];

  switch (language) {
    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
      matches = analyzeJavaScriptLike(
        lines,
        language
      );
      break;

    case "shell":
      matches = analyzeWindowsShell(lines);
      break;

    case "powershell":
      matches = analyzePowerShell(lines);
      break;

    default:
      matches = [];
  }

  /*
   * Deduplicate repeated occurrences of the same rule.
   */
  const findings = deduplicateFindings(matches);

  const score = calculateScore(
    findings,
    lines.length
  );

  return {
    file: filePath,
    score,
    findings,
  };
}

