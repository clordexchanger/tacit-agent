"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";

const CURL = `curl -X POST https://watch-dog-agent.vercel.app/api/watch \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://api.example.com","checkType":"content"}'`;

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

  return (
    <main>
      <div className="wd-shell">
        <nav className="wd-nav">
          <span className="wd-nav__mark">
            <span className="wd-nav__dot" aria-hidden="true" />
            watchdog agent
          </span>
          <a className="wd-nav__link" href="#access">
            get access →
          </a>
        </nav>

        <section className="wd-hero">
          <p className="wd-hero__eyebrow">agentic service provider · x layer</p>
          <h1>
            Nothing to report.
            <br />
            Until <em>something changes.</em>
          </h1>
          <p>
            Watchdog checks the endpoints you care about, on schedule, and stays
            silent — right up until one drifts, breaks, or slows down. Then it
            tells whoever's listening.
          </p>

          {stats && (
            <div className="wd-stats">
              <div className="wd-stats__cell">
                <span className="wd-stats__n">{stats.totalChecks.toLocaleString()}</span>
                <span className="wd-stats__k">checks run</span>
              </div>
              <div className="wd-stats__cell">
                <span className="wd-stats__n">{stats.totalEvents.toLocaleString()}</span>
                <span className="wd-stats__k">changes caught</span>
              </div>
              <div className="wd-stats__cell">
                <span className="wd-stats__n">{stats.activeTargets.toLocaleString()}</span>
                <span className="wd-stats__k">active targets</span>
              </div>
            </div>
          )}

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

        <section className="wd-section">
          <p className="wd-section__head">try it — free, no wallet needed</p>

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
                Paste any public URL — a GitHub Gist raw file works well for testing.
                Limited to 8 starts per hour on this free lane.
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

              {events.length > 0 && (
                <div className="wd-try__events">
                  {events.map((ev) => (
                    <div className="wd-event" key={ev.id}>
                      <span className="wd-event__time">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="wd-event__type">{ev.changeType}</span>
                      <span className="wd-event__diff">
                        {String(ev.oldValue)} → {String(ev.newValue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="wd-section">
          <p className="wd-section__head">the live board</p>
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
        </section>

        <section className="wd-section">
          <p className="wd-section__head">the watch log</p>
          <div className="wd-log">
            <div className="wd-log__entry">
              <span className="wd-log__time">entry 1</span>
              <div className="wd-log__body">
                <h3>You log what to watch</h3>
                <p>
                  A URL, and what counts as a change — content, schema, uptime,
                  or response time.
                </p>
              </div>
            </div>
            <div className="wd-log__entry">
              <span className="wd-log__time">entry 2</span>
              <div className="wd-log__body">
                <h3>It checks in on schedule</h3>
                <p>
                  Gas-free, on X Layer, at whatever interval you set — quietly,
                  in the background.
                </p>
              </div>
            </div>
            <div className="wd-log__entry">
              <span className="wd-log__time">entry 3</span>
              <div className="wd-log__body">
                <h3>The moment something's different</h3>
                <p>
                  Your webhook hears about it first — with what changed, and
                  what it used to be.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="wd-section">
          <p className="wd-section__head">what it catches</p>
          <div className="wd-grid">
            <div className="wd-grid__cell">
              <h4>content</h4>
              <p>The response body changed since last check.</p>
            </div>
            <div className="wd-grid__cell">
              <h4>schema</h4>
              <p>The shape of the data drifted — new or missing fields.</p>
            </div>
            <div className="wd-grid__cell">
              <h4>status</h4>
              <p>It stopped returning what you expect.</p>
            </div>
            <div className="wd-grid__cell">
              <h4>latency</h4>
              <p>It's answering slower than your threshold.</p>
            </div>
          </div>
        </section>

        <section className="wd-section" id="access">
          <p className="wd-section__head">access the paid api</p>
          <div className="wd-cmd">
            <code>{CURL}</code>
            <button onClick={copyCmd} type="button">
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <div className="wd-receipt">
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">endpoint</span>
              <span className="wd-receipt__v">POST /api/watch</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">price per check</span>
              <span className="wd-receipt__v wd-receipt__v--price">$0.02 · USDG</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">network</span>
              <span className="wd-receipt__v">X Layer · eip155:196</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">settlement</span>
              <span className="wd-receipt__v">x402 · verify → run → settle</span>
            </div>
            <div className="wd-receipt__row">
              <span className="wd-receipt__k">payTo</span>
              <span className="wd-receipt__v">0xf156195b3bfe5f5ab9563bdff7ad2575a8d9ad1c</span>
            </div>
          </div>
        </section>

        <footer className="wd-footer">
          <span>built for the OKX AI Genesis Hackathon</span>
          <span>see README for the full contract</span>
        </footer>
      </div>
    </main>
  );
}
