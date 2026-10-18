import { useCallback, useEffect, useState } from "react";
import { client, errMsg } from "../api/client";
import { Alert, Checkbox, Spinner } from "./ui";

const TYPE_LABEL = { merchant: "Merchant", organizer: "Organizer" };

// Loads the active, versioned terms for an onboarding flow. The commission
// rate and worked example come from the backend (resolved from the platform
// commission configuration) — nothing is hard-coded here.
export function useTerms(type) {
  const [terms, setTerms] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    setTerms(null);
    client
      .get("/onboarding/terms", { params: { type } })
      .then(({ data }) => setTerms(data.terms))
      .catch((err) => setError(errMsg(err, "Could not load the terms")));
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  return { terms, error, reload: load };
}

function CommissionHighlight({ commission }) {
  if (!commission) return null;
  const ex = commission.example;
  return (
    <div className="rounded-2xl border border-accent/25 bg-white/80 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform commission</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-ink">
        {commission.percent.toFixed(commission.percent % 1 === 0 ? 0 : 2)}%
      </p>
      <p className="mt-1 text-xs text-muted">
        Applied to each completed transaction and configured by platform administrators.
      </p>
      {ex && (
        <div className="mt-3 space-y-1 rounded-xl bg-slate-50/90 px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{ex.amountLabel}</span>
            <span className="font-semibold text-ink">
              {ex.amount.toLocaleString()} {ex.currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Gibiychen commission ({commission.percent.toFixed(commission.percent % 1 === 0 ? 0 : 2)}%)</span>
            <span className="font-semibold text-danger">
              −{ex.commissionAmount.toLocaleString()} {ex.currency}
            </span>
          </div>
          <div className="hairline my-1 h-px" />
          <div className="flex justify-between">
            <span className="font-semibold text-ink">You receive</span>
            <span className="font-bold text-ok">
              {ex.sellerAmount.toLocaleString()} {ex.currency}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Full, readable rendering of a terms document: intro, the commission
// numbers up front, then every section. Nothing important is hidden behind
// tiny links.
export function TermsBody({ terms, className = "" }) {
  if (!terms) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold text-ink">{terms.title}</h3>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          v{terms.version}
        </span>
        {terms.effectiveFrom && (
          <span className="text-xs text-muted">
            effective {new Date(terms.effectiveFrom).toLocaleDateString()}
          </span>
        )}
      </div>
      {terms.intro && <p className="mt-2 text-sm leading-relaxed text-muted">{terms.intro}</p>}
      <div className="mt-3">
        <CommissionHighlight commission={terms.commission} />
      </div>
      <div className="thin-scrollbar mt-4 max-h-[380px] space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        {(terms.content || []).map((section) => (
          <div key={section.heading}>
            <h4 className="text-sm font-bold text-ink">{section.heading}</h4>
            <ol className="mt-1.5 space-y-1.5">
              {(section.items || []).map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <p className="text-xs leading-relaxed text-muted">
          These are platform terms for Gibiychin (ግቢያችን) and are not claimed to be legally sufficient.
          They should be reviewed and finalized by the project owner or a legal advisor before
          real-world launch.
        </p>
      </div>
    </div>
  );
}

// Read-only display of the active terms with the explicit agreement checkbox.
export default function TermsAgreement({ type, accepted, onAcceptChange, terms, error }) {
  const label = TYPE_LABEL[type] || "Platform";

  if (error) {
    return <Alert tone="danger" title="Could not load the terms">{error}</Alert>;
  }
  if (!terms) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-4 w-4" /> Loading {label} Terms…
      </div>
    );
  }

  return (
    <section aria-label={`${label} Terms`}>
      <TermsBody terms={terms} />
      {onAcceptChange && (
        <div className="mt-4">
          <Checkbox
            checked={!!accepted}
            onChange={(e) => onAcceptChange(e.target.checked)}
            label={`I have read and agree to the Gibiychen ${label} Terms v${terms.version}, including the commission, payment, refund, and platform rules.`}
          />
        </div>
      )}
    </section>
  );
}
