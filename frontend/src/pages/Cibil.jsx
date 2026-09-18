import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { cibil, inr } from "../lib/api";
import PageHeader from "../components/layout/PageHeader";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import { SkeletonCard } from "../components/ui/Skeleton";
import "./Cibil.css";

const BAND_VARIANT = {
  EXCELLENT: "success",
  GOOD: "info",
  FAIR: "warning",
  POOR: "danger",
  VERY_POOR: "danger",
};

const SAMPLE_ID = "B10552";

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
  return (
    <div className="cibil-scale">
      <div className="cibil-scale-track">
        <div className="cibil-scale-fill" style={{ width: `${pct}%` }} />
        <div className="cibil-scale-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="cibil-scale-ends"><span>300</span><span>550</span><span>750</span><span>900</span></div>
    </div>
  );
}

export default function Cibil() {
  const { session } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get("id") || "");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (bid) => {
    const id = (bid || "").trim().toUpperCase();
    if (!id) {
      toast.error("Enter a borrower ID (e.g. B10552)");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setReport(null);
      const r = await cibil.report(id, session.token);
      setReport(r);
      setSearchParams({ id });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session?.token, setSearchParams, toast]);

  // Deep-link support: /cibil?id=B10552 auto-loads the report.
  useEffect(() => {
    const q = (searchParams.get("id") || "").trim().toUpperCase();
    if (q && !report && !loading && !error) {
      setInput(q);
      load(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Credit intelligence"
        title="CIBIL Check"
        description="Enter a borrower ID to pull the deterministic CIBIL-style credit report — 300–900 score, weighted components, accounts, payment timeline and enquiries, all derived from on-file data."
        actions={report && (
          <Link to={`/borrower/${report.borrower_id}`}>
            <Button variant="secondary" size="sm">Open borrower →</Button>
          </Link>
        )}
      />

      <Card>
        <CardContent>
          <form
            className="cibil-lookup"
            onSubmit={(e) => { e.preventDefault(); load(input); }}
          >
            <label className="cibil-lookup-field">
              <span><Icon name="idcard" size={15} /> Borrower ID</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="e.g. B10552"
                className="cibil-lookup-input"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <div className="cibil-lookup-actions">
              <Button variant="primary" size="sm" type="submit" disabled={loading}>
                {loading ? "Fetching…" : "Get CIBIL report"}
              </Button>
              <Button variant="ghost" size="sm" type="button" disabled={loading} onClick={() => { setInput(SAMPLE_ID); load(SAMPLE_ID); }}>
                Try {SAMPLE_ID}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div style={{ marginTop: 16 }}>
        {loading && (
          <div className="cibil-grid-2"><SkeletonCard /><SkeletonCard /></div>
        )}
        {error && !loading && <ErrorState message={error} onRetry={() => load(input)} />}
        {!loading && !error && !report && (
          <EmptyState
            title="No report yet"
            icon="idcard"
            description="Type a borrower ID above (or pick the sample) to see the full CIBIL-style breakdown."
          />
        )}
        {!loading && !error && report && <CibilReport r={report} />}
      </div>
    </div>
  );
}

function CibilReport({ r }) {
  const initials = (r.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="cibil-report">
      <div className="cibil-grid-2">
        <Card>
          <CardHeader>
            <CardTitle>CIBIL-style score</CardTitle>
            <CardDescription>{r.model_version} · generated {new Date(r.generated_at).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="cibil-score-row">
              <div className="cibil-score">{r.score}</div>
              <div>
                <Badge variant={BAND_VARIANT[r.band] || "default"}>{r.band_label}</Badge>
                <div className="cibil-score-sub">on the 300–900 scale</div>
              </div>
            </div>
            <ScoreBar score={r.score} />
            <div className="cibil-estimate">
              <Icon name="alert" size={13} />
              <span>Modelled estimate from on-file data — not an official TransUnion CIBIL bureau pull.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Borrower</CardTitle><CardDescription>Who this report belongs to</CardDescription></CardHeader>
          <CardContent>
            <div className="cibil-profile">
              <div className="cibil-avatar">{initials}</div>
              <div>
                <div className="cibil-name">{r.name}</div>
                <div className="cibil-meta">{r.borrower_id} · {r.age != null ? `${r.age}y · ` : ""}{r.city || "—"} · {r.employment_type || "borrower"}</div>
              </div>
            </div>
            <div className="cibil-tiles">
              <div className="cibil-tile"><small>Trust score</small><b>{r.context?.trust_score ?? "—"}</b></div>
              <div className="cibil-tile"><small>Risk</small><b>{r.context?.risk_level ?? "—"}</b></div>
              <div className="cibil-tile"><small>Decision</small><b>{r.context?.decision?.replace(/_/g, " ") ?? "—"}</b></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Score components</CardTitle><CardDescription>Standard bureau-style weights — every point is traceable to on-file signals</CardDescription></CardHeader>
        <CardContent>
          <div className="cibil-comp-grid">
            {(r.components || []).map((c) => (
              <div key={c.code} className="cibil-comp">
                <div className="cibil-comp-head">
                  <span>{c.title}</span>
                  <b>{c.points}/{c.max_points}</b>
                </div>
                <div className="cibil-comp-bar">
                  <div
                    className="cibil-comp-fill"
                    style={{ width: `${c.max_points ? Math.round((c.points / c.max_points) * 100) : 0}%` }}
                  />
                </div>
                <small>{c.weight_pct}% weight</small>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="cibil-grid-2">
        <Card>
          <CardHeader><CardTitle>What moves the score</CardTitle><CardDescription>Signed point contributions with observed evidence</CardDescription></CardHeader>
          <CardContent>
            {(r.factors || []).map((f) => (
              <div key={f.code} className="cibil-factor">
                <div>
                  <b>{f.title}</b>
                  <small>{f.observed}</small>
                </div>
                <b className={f.points > 0 ? "cibil-pos" : f.points < 0 ? "cibil-neg" : "cibil-zero"}>
                  {f.points > 0 ? `+${f.points}` : f.points}
                </b>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Accounts</CardTitle><CardDescription>{r.accounts?.total || 0} loan account(s) on file</CardDescription></CardHeader>
          <CardContent>
            <div className="cibil-tiles">
              <div className="cibil-tile"><small>Active</small><b>{r.accounts?.active ?? 0}</b></div>
              <div className="cibil-tile"><small>Closed</small><b>{r.accounts?.closed ?? 0}</b></div>
              <div className="cibil-tile"><small>Disbursed</small><b>{inr(r.accounts?.total_disbursed)}</b></div>
              <div className="cibil-tile"><small>Overdue</small><b className={r.accounts?.overdue_amount > 0 ? "cibil-neg" : ""}>{inr(r.accounts?.overdue_amount)}</b></div>
            </div>
            {(r.accounts?.items || []).length > 0 && (
              <div className="cibil-accts">
                {r.accounts.items.map((a) => (
                  <div key={a.id} className="cibil-acct">
                    <span>Loan #{a.id}</span>
                    <span className="cibil-muted">{inr(a.principal)} · EMI {inr(a.emi)}</span>
                    <Badge variant={a.status === "ACTIVE" ? "LOW" : a.status === "CLOSED" ? "default" : "MEDIUM"}>{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="cibil-grid-2">
        <Card>
          <CardHeader><CardTitle>Payment timeline</CardTitle><CardDescription>Month-by-month repayment behaviour from financial snapshots</CardDescription></CardHeader>
          <CardContent>
            {(r.payment_timeline || []).length ? (
              <div className="cibil-timeline">
                {r.payment_timeline.map((t, i) => (
                  <div key={i} className="cibil-month">
                    <span className={`cibil-dot ${t.status === "ON_TIME" ? "cibil-dot-ok" : "cibil-dot-late"}`} />
                    <span>{t.label}</span>
                    <Badge variant={t.status === "ON_TIME" ? "LOW" : "MEDIUM"}>{t.status === "ON_TIME" ? "On time" : "Late"}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="cibil-muted">No snapshot history on file.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Enquiries</CardTitle><CardDescription>Recent credit-seeking activity</CardDescription></CardHeader>
          <CardContent>
            <div className="cibil-tiles">
              <div className="cibil-tile"><small>Last 30 days</small><b>{r.enquiries?.last_30d ?? 0}</b></div>
              <div className="cibil-tile"><small>New device (90d)</small><b>{r.enquiries?.new_device_90d ?? 0}</b></div>
              <div className="cibil-tile"><small>Address moves (12m)</small><b>{r.enquiries?.address_changes_12m ?? 0}</b></div>
            </div>
            <p className="cibil-muted" style={{ marginTop: 10 }}>{r.disclaimer}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
