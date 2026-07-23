"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";

const CURL = `curl -X POST https://watch-dog-agent.vercel.app/api/watch \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://api.example.com","checkType":"content"}'`;

const GITHUB_URL = "https://github.com/Oladayo001/watchdog-agent";

const API_REFERENCE = [
  {
    tag: "paid",
    method: "POST",
    path: "/api/watch",
    desc: "Registers a target. Gated by x402 — the first call without payment returns 402 with the exact price and payTo address; sign and retry to get a 201 with the target. Body: url, checkType (content | status | schema | latency), intervalMinutes, threshold, webhookUrl.",
  },
  {
    tag: "free",
    method: "GET",
    path: "/api/status/:id",
    desc: "Returns a target and its full detected-change history.",
  },
  {
    tag: "free",
    method: "POST",
    path: "/api/demo-watch",
    desc: "The no-wallet lane used by the \"try it\" panel above. Rate-limited per visitor; same detection engine as the paid API.",
  },
  {
    tag: "free",
    method: "GET",
    path: "/api/stats",
    desc: "The real, live numbers shown at the top of this page — total checks run, changes caught, active targets.",
  },
];

const FAQ_ITEMS = [
  {
    q: "What if my target goes down entirely?",
    a: "A \"status\" check catches this directly — if the endpoint stops returning the expected status code, that's flagged as critical. For \"content\" checks, an unreachable target is logged as an error event rather than ignored.",
  },
  {
    q: "Which chains and assets do you support?",
    a: "Checks settle in USDG on X Layer (eip155:196) via OKX's x402 facilitator today. Nothing about the design is tied to one chain — X Layer is just where it lives first, since it's gas-free.",
  },
  {
    q: "Is there a rate limit?",
    a: "The free web demo is capped at 8 new targets per hour per visitor, to keep it fair. The paid API has no such limit — it's metered per call instead.",
  },
  {
    q: "What data does TACIT store?",
    a: "Just what's needed to detect drift: the target URL, the check type, a hash of the last response — not the raw content itself — and the history of what changed and when.",
  },
  {
    q: "Can alerts go somewhere other than a webhook?",
    a: "Not yet — webhooks are the only delivery method today. Telegram and Discord alerts are next.",
  },
];

type CheckType = "content" | "status" | "latency" | "schema";

interface Target {
  id: string;
  url: string;
  checkType: CheckType;
}

interface BoardEntry {
  id: string;
  url: string;
  checkType: CheckType;
  createdAt: number;
  lastCheckedAt: number | null;
}

interface WatchEvent {
  id: string;
  changeType: string;
  oldValue: unknown;
  newValue: unknown;
  severity: string;
  timestamp: number;
}

export default function Home() {
  const [copied, setCopied] = useState(false);

  const [url, setUrl] = useState("");
  const [checkType, setCheckType] = useState<CheckType>("content");
  const [target, setTarget] = useState<Target | null>(null);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "registering" | "checking" | "watching">("idle");
  const [note, setNote] = useState<string | null>(null);

  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [historyEvents, setHistoryEvents] = useState<WatchEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [stats, setStats] = useState<{ totalChecks: number; totalEvents: number; activeTargets: number } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openApi, setOpenApi] = useState<number | null>(null);

  const refreshBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/demo-watch");
      const data = await res.json();
      setBoard(data.board ?? []);
    } catch {
      // Board is best-effort — a failed refresh just leaves the last known list showing.
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      // Stats are best-effort — leave the last known numbers showing on failure.
    }
  }, []);

  useEffect(() => {
    refreshBoard();
    refreshStats();
    const interval = setInterval(() => {
      refreshBoard();
      refreshStats();
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshBoard, refreshStats]);

  function copyCmd() {
    navigator.clipboard.writeText(CURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function startWatching(e: FormEvent) {
    e.preventDefault();
    setNote(null);
    setEvents([]);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setNote("That doesn't look like a valid URL — include https:// at the start.");
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setNote("Only http/https URLs are supported.");
      return;
    }

    setStatus("registering");

    try {
      const res = await fetch("/api/demo-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, checkType, intervalMinutes: 1 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNote(
          res.status === 429
            ? "You've hit the free demo limit for this hour — the paid API at /api/watch has no such limit."
            : data.error || "Couldn't register that target."
        );
        setStatus("idle");
        return;
      }

      setTarget(data.target);
      setStatus("checking");

      await fetch(`/api/demo-watch/${data.target.id}/check`, { method: "POST" });
      setStatus("watching");
      setNote("Baseline recorded. Change the page you're watching, then check again.");
      refreshBoard();
      refreshStats();
    } catch {
      setNote("Couldn't reach that URL — double check it's publicly accessible and try again.");
      setStatus("idle");
    }
  }

  async function checkNow() {
    if (!target) return;
    setStatus("checking");
    setNote(null);

    try {
      const checkRes = await fetch(`/api/demo-watch/${target.id}/check`, { method: "POST" });
      const checkData = await checkRes.json();

      const statusRes = await fetch(`/api/status/${target.id}`);
      const statusData = await statusRes.json();
      setEvents(statusData.events ?? []);

      setNote(
        checkData.eventsFired > 0
          ? "Change detected — see below."
          : "Checked. No change since last time."
      );
      refreshBoard();
      refreshStats();
    } catch {
      setNote("Couldn't complete the check. Try again.");
    } finally {
      setStatus("watching");
    }
  }

  function reset() {
    setTarget(null);
    setEvents([]);
    setNote(null);
    setStatus("idle");
    setUrl("");
  }

  async function toggleHistory(id: string) {
    if (openHistoryId === id) {
      setOpenHistoryId(null);
      return;
    }
    setOpenHistoryId(id);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();
      setHistoryEvents(data.events ?? []);
    } catch {
      setHistoryEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function timeAgo(ts: number | null) {
    if (!ts) return "never checked";
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  const latestEvent = events[0] ?? null;

  return (
    <main>
      <div className="wd-navwrap">
        <nav className="wd-nav">
          <span className="wd-nav__mark">
            <svg className="wd-nav__logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="#0a0b0e" />
              <path
                d="M8,34 L24,34 L28,20 L32,42 L36,14 L40,34 L56,34"
                stroke="#f2a65a"
                strokeWidth="4.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            tacit
          </span>
          <div className="wd-nav__links">
            <a className="wd-nav__link" href="#system">
              System
            </a>
            <a className="wd-nav__link" href="#demo">
              Try it
            </a>
            <a className="wd-nav__link" href="#access">
              Access
            </a>
            <a className="wd-nav__link" href="#docs">
              Docs
            </a>
            <a className="wd-nav__link" href={GITHUB_URL} target="_blank" rel="noreferrer">
              Source
            </a>
          </div>
          <a className="wd-nav__cta" href="#demo">
            Try it free →
          </a>
        </nav>
      </div>

      <div className="wd-shell">
        {stats && (
          <div className="wd-topstats">
            <div className="wd-topstats__cell">
              <div className="wd-topstats__k">
                <span className="wd-topstats__dot wd-topstats__dot--live" />
                status
              </div>
              <div className="wd-topstats__v">live</div>
            </div>
            <div className="wd-topstats__cell">
              <div className="wd-topstats__k">targets</div>
              <div className="wd-topstats__v">{stats.activeTargets}</div>
            </div>
            <div className="wd-topstats__cell">
              <div className="wd-topstats__k">checks run</div>
              <div className="wd-topstats__v">{stats.totalChecks.toLocaleString()}</div>
            </div>
            <div className="wd-topstats__cell">
              <div className="wd-topstats__k">changes caught</div>
              <div className="wd-topstats__v">{stats.totalEvents.toLocaleString()}</div>
            </div>
            <div className="wd-topstats__cell">
              <div className="wd-topstats__k">price / check</div>
              <div className="wd-topstats__v">$0.02</div>
            </div>
            <div className="wd-topstats__cell">
              <div className="wd-topstats__k">network</div>
              <div className="wd-topstats__v">X Layer</div>
            </div>
          </div>
        )}

        <section className="wd-hero" id="system">
          <p className="wd-hero__eyebrow">agentic service provider · x layer</p>
          <h1>
            Point at anything.
            <br />
            <span>TACIT answers.</span>
          </h1>
          <p>
            Give it a URL and a definition of "changed." It checks on schedule,
            says nothing while things are normal, and pays out an alert the
            instant something drifts, breaks, or slows down.
          </p>
          <div className="wd-hero__ctas">
            <a className="wd-btn wd-btn--primary" href="#demo">
              Try it free, no wallet →
            </a>
            <a className="wd-btn wd-btn--ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
              View source
            </a>
          </div>

          <div className="wd-trace" aria-hidden="true">
            <svg viewBox="0 0 1200 220" preserveAspectRatio="none">
              <path
                className="wd-trace__path"
                d="M0,150 L640,150 L672,92 L706,178 L738,64 L772,150 L1200,150"
              />
              <circle className="wd-trace__dot" r="4">
                <animateMotion
                  dur="6s"
                  repeatCount="indefinite"
                  path="M0,150 L640,150 L672,92 L706,178 L738,64 L772,150 L1200,150"
                />
              </circle>
            </svg>
            <span className="wd-trace__label">02:14:09 — schema drift detected</span>
            <div className="wd-trace__caption">
              <span>target: api.example.com/status</span>
              <span>interval: 5m</span>
            </div>
          </div>
        </section>

        <div className="wd-divider">
          <span className="wd-divider__label">who this is for</span>
          <span className="wd-divider__line" />
        </div>

        <section id="who-its-for" style={{ padding: "48px 0" }}>
          <div className="wd-access">
            <div className="wd-access__card">
              <span className="wd-access__tag">api teams</span>
              <span className="wd-access__title">Watch your own uptime</span>
              <p className="wd-access__body">
                Point TACIT at your own production endpoint. Get a webhook
                the moment it goes down, slows down, or starts returning
                something unexpected — before your users notice first.
              </p>
            </div>
            <div className="wd-access__card">
              <span className="wd-access__tag">defi agents</span>
              <span className="wd-access__title">Watch a price oracle</span>
              <p className="wd-access__body">
                An autonomous trading agent registers a price feed with a
                latency or content threshold, and reacts the instant the
                oracle drifts or stops responding on time.
              </p>
            </div>
            <div className="wd-access__card">
              <span className="wd-access__tag">other agents</span>
              <span className="wd-access__title">Watch a dependency</span>
              <p className="wd-access__body">
                Any agent that relies on a third-party tool or API can pay
                TACIT per check to monitor that dependency, and get alerted
                the moment it changes shape or disappears.
              </p>
            </div>
          </div>
        </section>

        <div className="wd-divider">
          <span className="wd-divider__label">follow one check through the system</span>
          <span className="wd-divider__line" />
        </div>

        {/* STEP 01 — REGISTER */}
        <section className="wd-step" id="demo">
          <div className="wd-step__num">01</div>
          <div>
            <p className="wd-step__tag">registered</p>
            <h2 className="wd-step__title">You point it at something.</h2>
            <p className="wd-step__body">
              A URL, and what counts as a change — content, schema, uptime, or
              response time. This lane is free and rate-limited, meant for
              trying it out. No wallet needed.
            </p>

            <div className="wd-panel">
              {!target ? (
                <form className="wd-try" onSubmit={startWatching}>
                  <div className="wd-try__row">
                    <input
                      className="wd-try__input"
                      type="url"
                      required
                      placeholder="https://your-endpoint-or-page.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <select
                      className="wd-try__select"
                      value={checkType}
                      onChange={(e) => setCheckType(e.target.value as CheckType)}
                    >
                      <option value="content">content changed</option>
                      <option value="status">status code changed</option>
                      <option value="schema">schema drifted</option>
                      <option value="latency">latency spiked</option>
                    </select>
                    <button className="wd-try__button" type="submit" disabled={status !== "idle"}>
                      {status === "registering" ? "starting…" : "start watching"}
                    </button>
                  </div>
                  <p className="wd-try__hint">
                    Paste any public URL — a GitHub Gist raw file works well for
                    testing. Limited to 8 starts per hour on this free lane.
                  </p>
                </form>
              ) : (
                <div className="wd-try wd-try--active">
                  <div className="wd-try__target">
                    <span className="wd-try__target-url">{target.url}</span>
                    <span className="wd-try__target-type">{target.checkType}</span>
                  </div>

                  <div className="wd-try__row">
                    <button
                      className="wd-try__button"
                      onClick={checkNow}
                      disabled={status === "checking"}
                      type="button"
                    >
                      {status === "checking" ? "checking…" : "check now"}
                    </button>
                    <button className="wd-try__button wd-try__button--ghost" onClick={reset} type="button">
                      watch something else
                    </button>
                  </div>

                  {note && <p className="wd-try__note">{note}</p>}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STEP 02 — CHECK */}
        <section className="wd-step">
          <div className="wd-step__num">02</div>
          <div>
            <p className="wd-step__tag">checked</p>
            <h2 className="wd-step__title">It checks in on schedule.</h2>
            <p className="wd-step__body">
              Gas-free, on X Layer, at whatever interval is set — quietly, in
              the background. Everything currently being watched, live:
            </p>

            <div className="wd-panel">
              <div className="wd-panel__head">
                <span>the live board</span>
                <span className="wd-panel__live">
                  <span className="wd-topstats__dot wd-topstats__dot--live" /> live
                </span>
              </div>
              {board.length === 0 ? (
                <p className="wd-board__empty">Nothing being watched yet — start one above.</p>
              ) : (
                <div className="wd-board">
                  {board.map((b) => (
                    <div className="wd-board__item" key={b.id}>
                      <button
                        className="wd-board__row"
                        onClick={() => toggleHistory(b.id)}
                        type="button"
                      >
                        <span className="wd-board__url">{b.url}</span>
                        <span className="wd-board__type">{b.checkType}</span>
                        <span className="wd-board__time">{timeAgo(b.lastCheckedAt)}</span>
                        <span className="wd-board__caret">
                          {openHistoryId === b.id ? "▲" : "▼"}
                        </span>
                      </button>
                      {openHistoryId === b.id && (
                        <div className="wd-board__history">
                          {historyLoading ? (
                            <p className="wd-board__loading">loading history…</p>
                          ) : historyEvents.length === 0 ? (
                            <p className="wd-board__loading">No changes recorded yet.</p>
                          ) : (
                            historyEvents.map((ev) => (
                              <div className="wd-event" key={ev.id}>
                                <span className="wd-event__time">
                                  {new Date(ev.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="wd-event__type">{ev.changeType}</span>
                                <span className="wd-event__diff">
                                  {String(ev.oldValue)} → {String(ev.newValue)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STEP 03 — DETECT */}
        <section className="wd-step">
          <div className="wd-step__num">03</div>
          <div>
            <p className="wd-step__tag">detected</p>
            <h2 className="wd-step__title">The moment something's different.</h2>
            <p className="wd-step__body">
              A byte-for-byte diff, not a guess — old value against new value,
              timestamped the instant it's caught.
            </p>

            <div className="wd-panel">
              <div className="wd-panel__head">
                <span>most recent detection, this session</span>
              </div>
              {latestEvent ? (
                <div className="wd-event" style={{ gridTemplateColumns: "120px minmax(0, 1fr)" }}>
                  <span className="wd-event__time">
                    {new Date(latestEvent.timestamp).toLocaleTimeString()} · {latestEvent.changeType}
                  </span>
                  <span className="wd-event__diff">
                    {String(latestEvent.oldValue)} → {String(latestEvent.newValue)}
                  </span>
                </div>
              ) : (
                <p className="wd-board__loading">
                  Nothing detected yet this session — register a target in step 01 and check it twice.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* STEP 04 — ALERT */}
        <section className="wd-step">
          <div className="wd-step__num">04</div>
          <div>
            <p className="wd-step__tag">alerted</p>
            <h2 className="wd-step__title">Your webhook hears about it first.</h2>
            <p className="wd-step__body">
              Every registered target can carry a webhook. The instant a
              change is confirmed, this is what lands there:
            </p>

            <div className="wd-panel">
              <div className="wd-panel__head">
                <span>webhook payload · shape</span>
              </div>
              <pre className="wd-json">
{`{
  "target": `}<span className="s">&quot;https://your-endpoint.com&quot;</span>{`,
  "event": {
    "changeType": `}<span className="s">&quot;content&quot;</span>{`,
    "oldValue": `}<span className="s">&quot;a1b2c3…&quot;</span>{`,
    "newValue": `}<span className="s">&quot;f9e8d7…&quot;</span>{`,
    "severity": `}<span className="s">&quot;info&quot;</span>{`,
    "timestamp": `}<span className="n">1752480000000</span>{`
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* STEP 05 — SETTLE */}
        <section className="wd-step">
          <div className="wd-step__num">05</div>
          <div>
            <p className="wd-step__tag">settled</p>
            <h2 className="wd-step__title">Every check settles on X Layer.</h2>
            <p className="wd-step__body">
              The paid API is metered per call through OKX's x402 facilitator —
              verified, run, then settled. Nothing is charged unless the check
              actually completes.
            </p>

            <div className="wd-flow">
              <div className="wd-flow__cell">
                <div className="wd-flow__n">01</div>
                <div className="wd-flow__k">Request</div>
                <div className="wd-flow__v">POST /api/watch</div>
                <div className="wd-flow__d">no payment attached</div>
              </div>
              <div className="wd-flow__cell">
                <div className="wd-flow__n">02</div>
                <div className="wd-flow__k">402 issued</div>
                <div className="wd-flow__v">$0.02 · USDG</div>
                <div className="wd-flow__d">price + payTo returned</div>
              </div>
              <div className="wd-flow__cell">
                <div className="wd-flow__n">03</div>
                <div className="wd-flow__k">Payment signed</div>
                <div className="wd-flow__v">eip155:196</div>
                <div className="wd-flow__d">caller's wallet, X Layer</div>
              </div>
              <div className="wd-flow__cell">
                <div className="wd-flow__n">04</div>
                <div className="wd-flow__k">Verified</div>
                <div className="wd-flow__v">x402 · verify</div>
                <div className="wd-flow__d">OKX facilitator checks it</div>
              </div>
              <div className="wd-flow__cell">
                <div className="wd-flow__n">05</div>
                <div className="wd-flow__k">Settled</div>
                <div className="wd-flow__v">x402 · settle</div>
                <div className="wd-flow__d">only on a successful check</div>
              </div>
            </div>
          </div>
        </section>

        <div className="wd-divider">
          <span className="wd-divider__label">access</span>
          <span className="wd-divider__line" />
        </div>

        <section id="access" style={{ padding: "48px 0" }}>
          <div className="wd-access">
            <div className="wd-access__card">
              <span className="wd-access__tag">no code</span>
              <span className="wd-access__title">Try it in the browser</span>
              <p className="wd-access__body">
                The full loop — register, check, detect — right on this page,
                free, no wallet. Good for a quick look before integrating.
              </p>
              <a className="wd-btn wd-btn--ghost" href="#demo">
                Jump to demo →
              </a>
            </div>

            <div className="wd-access__card">
              <span className="wd-access__tag">for agents & developers</span>
              <span className="wd-access__title">Call the API directly</span>
              <p className="wd-access__body">
                Metered per check via x402 on X Layer. The first call
                without payment returns a 402 with exact pricing — sign it and
                retry.
              </p>
              <div className="wd-cmd">
                <code>{CURL}</code>
                <button onClick={copyCmd} type="button">
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>

            <div className="wd-access__card">
              <span className="wd-access__tag">marketplace</span>
              <span className="wd-access__title">Find it on OKX AI</span>
              <p className="wd-access__body">
                Listed as an Agentic Service Provider on OKX's agent
                marketplace — discoverable and payable by other agents
                directly, no integration work needed on their side.
              </p>
              <a
                className="wd-btn wd-btn--ghost"
                href="https://web3.okx.com/onchainos/dev-portal"
                target="_blank"
                rel="noreferrer"
              >
                OKX AI dev portal →
              </a>
            </div>
          </div>
        </section>

        <div className="wd-divider">
          <span className="wd-divider__label">docs</span>
          <span className="wd-divider__line" />
        </div>

        <section id="docs" style={{ padding: "48px 0" }}>
          <p className="wd-hero__eyebrow" style={{ marginBottom: 8 }}>
            reference
          </p>
          <h2 className="wd-step__title" style={{ marginBottom: 28 }}>
            Everything about how TACIT works.
          </h2>

          <div className="wd-panel" style={{ marginBottom: 16 }}>
            <div className="wd-panel__head">
              <span>overview</span>
            </div>
            <p className="wd-step__body" style={{ margin: 0, maxWidth: "80ch" }}>
              TACIT is an Agentic Service Provider: register any public URL and
              a definition of "changed" — content, schema, status code, or
              latency — and it checks on schedule, staying silent until a real
              difference is detected. When it fires, a webhook receives the
              old value, the new value, and a timestamp. The paid API is
              metered per check and settles automatically on X Layer via
              OKX's x402 protocol; a free, rate-limited demo lane on this page
              needs no wallet at all.
            </p>
          </div>

          <div className="wd-panel" style={{ marginBottom: 16 }}>
            <div className="wd-panel__head">
              <span>api reference</span>
            </div>
            <div className="wd-faq">
              {API_REFERENCE.map((item, i) => (
                <div className="wd-faq__item" key={i}>
                  <button
                    className="wd-faq__q"
                    onClick={() => setOpenApi(openApi === i ? null : i)}
                    type="button"
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500 }}>
                      <span
                        style={{
                          color: item.tag === "paid" ? "var(--amber)" : "var(--teal)",
                          marginRight: 10,
                        }}
                      >
                        {item.tag}
                      </span>
                      {item.method} {item.path}
                    </span>
                    <span className="wd-faq__caret">{openApi === i ? "−" : "+"}</span>
                  </button>
                  {openApi === i && <p className="wd-faq__a">{item.desc}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="wd-panel" style={{ marginBottom: 16 }}>
            <div className="wd-panel__head">
              <span>payment</span>
            </div>
            <div className="wd-receipt__row" style={{ borderTop: "none" }}>
              <span className="wd-receipt__k">protocol</span>
              <span className="wd-receipt__v">x402 · exact scheme</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">network</span>
              <span className="wd-receipt__v">X Layer · eip155:196</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">asset</span>
              <span className="wd-receipt__v">USDG</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">price</span>
              <span className="wd-receipt__v wd-receipt__v--price">$0.02 / check</span>
            </div>
          </div>

          <div className="wd-panel">
            <div className="wd-panel__head">
              <span>built with</span>
            </div>
            <div className="wd-receipt__row" style={{ borderTop: "none" }}>
              <span className="wd-receipt__k">framework</span>
              <span className="wd-receipt__v">Next.js on Vercel</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">state</span>
              <span className="wd-receipt__v">Upstash Redis</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">scheduling</span>
              <span className="wd-receipt__v">cron-job.org</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">wallet & payments</span>
              <span className="wd-receipt__v">OKX Onchain OS</span>
            </div>
          </div>
        </section>

        <div className="wd-divider">
          <span className="wd-divider__label">faq</span>
          <span className="wd-divider__line" />
        </div>

        <section id="faq" style={{ padding: "48px 0" }}>
          <div className="wd-panel">
            <div className="wd-faq">
              {FAQ_ITEMS.map((item, i) => (
                <div className="wd-faq__item" key={i}>
                  <button
                    className="wd-faq__q"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    type="button"
                  >
                    <span>{item.q}</span>
                    <span className="wd-faq__caret">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && <p className="wd-faq__a">{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="wd-divider">
          <span className="wd-divider__label">what's next</span>
          <span className="wd-divider__line" />
        </div>

        <section id="roadmap" style={{ padding: "48px 0" }}>
          <div className="wd-panel">
            <p className="wd-step__body" style={{ margin: 0 }}>
              Multi-region checks, so an outage in one region can't hide from
              a check running in another. Telegram and Discord alerts,
              alongside webhooks. And richer schema-diff detail — the exact
              field that changed, not just a shape hash.
            </p>
          </div>
        </section>

        <footer className="wd-footer">
          <span>TACIT — quiet until it matters</span>
          <span>
            <a href="https://twitter.com/Tacit_Agent" target="_blank" rel="noreferrer">
              @Tacit_Agent on X
            </a>
            {" · "}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              source on GitHub
            </a>
            {" · "}
            <a href="#system">back to top</a>
          </span>
        </footer>
      </div>
    </main>
  );
}
