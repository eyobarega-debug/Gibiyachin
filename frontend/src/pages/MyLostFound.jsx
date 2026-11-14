import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import LostFoundCard from "../components/LostFoundCard";
import { Tabs, EmptyState, Skeleton, ErrorBanner, Button, Badge } from "../components/ui";
import Icon from "../components/Icon";

export default function MyLostFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("my_lost");
  const [data, setData] = useState({
    myLost: [],
    myFound: [],
    potentialMatches: [],
    receivedClaims: [],
    myClaims: [],
    returned: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadDashboard() {
    setLoading(true);
    client
      .get("/lost-found/my-items")
      .then(({ data: res }) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setError(err.response?.data?.error?.message || "Failed to load your Lost & Found items.");
      });
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const tabItems = [
    { key: "my_lost", label: "My Lost Items", count: data.myLost.length },
    { key: "my_found", label: "My Found Items", count: data.myFound.length },
    { key: "matches", label: "Potential Matches", count: data.potentialMatches.length },
    { key: "received_claims", label: "Received Claims", count: data.receivedClaims.length },
    { key: "my_claims", label: "My Claims", count: data.myClaims.length },
    { key: "returned", label: "Returned Items", count: data.returned.length },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/lost-found"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-2"
          >
            <Icon name="arrowLeft" className="h-3.5 w-3.5" />
            <span>Campus Lost &amp; Found</span>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            My Lost &amp; Found Dashboard
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Track your reports, inspect AI-driven smart matches, manage ownership claims, and confirm safe handovers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/lost-found/new?type=lost")}
          >
            + Report Lost
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/lost-found/new?type=found")}
          >
            + Report Found
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto thin-scrollbar pb-1">
        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
      </div>

      {/* Error state */}
      {error && <ErrorBanner title="Error" message={error} onClose={() => setError(null)} />}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass flex flex-col rounded-[22px] border border-white/80 bg-white/75 p-4 shadow-xs space-y-3"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Tab 1: My Lost Items */}
      {!loading && activeTab === "my_lost" && (
        <>
          {data.myLost.length === 0 ? (
            <EmptyState
              icon="lost_found"
              title="You haven't reported any lost items"
              subtitle="Lost your phone, calculator, or ID card? Report it to notify the campus community."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/lost-found/new?type=lost")}
                >
                  Report Lost Belonging
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {data.myLost.map((item) => (
                <LostFoundCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: My Found Items */}
      {!loading && activeTab === "my_found" && (
        <>
          {data.myFound.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="You haven't reported any found items"
              subtitle="Found belongings on campus? Turn them in here to help reconnect them with fellow students."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("/lost-found/new?type=found")}
                >
                  Report Found Belonging
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {data.myFound.map((item) => (
                <LostFoundCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 3: Potential Matches */}
      {!loading && activeTab === "matches" && (
        <>
          {data.potentialMatches.length === 0 ? (
            <EmptyState
              icon="sparkles"
              title="No active matches discovered yet"
              subtitle="Our matching engine automatically compares newly reported items against your belongings in real-time."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.potentialMatches.map((m) => {
                const isScoreStrong = m.similarity_score >= 85;
                return (
                  <div
                    key={m.id}
                    className="glass rounded-2xl border border-white/80 bg-white/85 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          isScoreStrong
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {m.similarity_score}% Match Confidence
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-3 rounded-xl">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Your Item ({m.my_item_type}):
                        </span>
                        <p className="font-semibold text-slate-900 truncate">{m.my_item_title}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Potential Match ({m.matched_item_type}):
                        </span>
                        <p className="font-semibold text-slate-900 truncate">
                          {m.matched_item_title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/lost-found/${m.matched_item_id}`)}
                      >
                        <span>Inspect Match</span>
                        <Icon name="arrowRight" className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab 4: Received Claims */}
      {!loading && activeTab === "received_claims" && (
        <>
          {data.receivedClaims.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No claims received"
              subtitle="When students submit verification proof on items you found, their claims will appear here."
            />
          ) : (
            <div className="space-y-4">
              {data.receivedClaims.map((c) => (
                <div
                  key={c.id}
                  className="glass rounded-2xl border border-white/80 bg-white/85 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Claim on: {c.item_title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Submitted by: <strong>{c.claimant_name}</strong>
                      </p>
                    </div>
                    <Badge tone={c.status === "approved" ? "ok" : c.status === "pending" ? "warn" : "danger"}>
                      {c.status}
                    </Badge>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
                      Proof details:
                    </span>
                    <p className="whitespace-pre-line">{c.private_proof}</p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/lost-found/${c.item_id}`)}
                    >
                      View Report &amp; Manage Claim
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 5: My Claims */}
      {!loading && activeTab === "my_claims" && (
        <>
          {data.myClaims.length === 0 ? (
            <EmptyState
              icon="key"
              title="You haven't submitted any claims"
              subtitle="If you see a found item that belongs to you, submit a verification claim to contact the finder."
            />
          ) : (
            <div className="space-y-4">
              {data.myClaims.map((c) => (
                <div
                  key={c.id}
                  className="glass rounded-2xl border border-white/80 bg-white/85 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Claimed Item: {c.item_title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Date: {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone={c.status === "approved" ? "ok" : c.status === "pending" ? "warn" : "danger"}>
                      {c.status}
                    </Badge>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
                      Your submitted proof:
                    </span>
                    <p className="whitespace-pre-line">{c.private_proof}</p>
                  </div>

                  {c.rejection_reason && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-800">
                      <strong>Rejection note:</strong> {c.rejection_reason}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/lost-found/${c.item_id}`)}
                    >
                      View Item Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 6: Returned Items */}
      {!loading && activeTab === "returned" && (
        <>
          {data.returned.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="No returned belongings yet"
              subtitle="Items with completed dual-handover confirmations will appear here as recovered campus property."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {data.returned.map((item) => (
                <LostFoundCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
