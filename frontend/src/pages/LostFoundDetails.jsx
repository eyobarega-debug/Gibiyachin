import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmProvider";
import ImageUploader from "../components/ImageUploader";
import { MediaImage } from "../components/cards";
import {
  Badge,
  Button,
  Modal,
  TextArea,
  Input,
  Select,
  Alert,
  Spinner,
  Skeleton,
} from "../components/ui";
import Icon from "../components/Icon";

export default function LostFoundDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Claim modal state (for "This might be mine")
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimProof, setClaimProof] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimEvidence, setClaimEvidence] = useState([]);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState("");

  // Report modal state (for "Report suspicious")
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Status edit modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("open");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchItem = useCallback(() => {
    setLoading(true);
    client
      .get(`/lost-found/${id}`)
      .then(({ data }) => {
        setItem(data.item);
        setNewStatus(data.item.status);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setError(err.response?.data?.error?.message || "Failed to load item details.");
      });
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const isReporter = Boolean(user && item && user.id === item.reporter_id);
  const isAdmin = Boolean(user && ["admin", "super_admin"].includes(user.role));
  const isFound = item?.type === "found";
  const isLost = item?.type === "lost";

  async function messageReporter() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!item.reporter_id) return;
    try {
      const { data } = await client.post("/messages/conversations", {
        recipientId: item.reporter_id,
        type: "lost_found",
        contextType: "lost_found",
        contextId: item.id,
        contextData: {
          title: item.title,
          itemType: item.type,
          category: item.category,
          campus: item.location,
          image: item.images?.[0] || null,
        },
      });
      navigate(`/messages/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Could not start chat");
    }
  }

  // Check if current user already submitted a claim
  const userClaim = item?.claims?.find((c) => c.claimant_id === user?.id);

  // Submit a claim on a found item
  async function handleClaimSubmit(e) {
    e.preventDefault();
    if (!claimProof.trim()) {
      setClaimError("Verification proof description is required.");
      return;
    }
    setClaimSubmitting(true);
    setClaimError("");

    try {
      await client.post(`/lost-found/${id}/claim`, {
        private_proof: claimProof.trim(),
        contact_phone: claimPhone.trim() || undefined,
        evidence_images: claimEvidence.length > 0 ? claimEvidence : undefined,
      });
      toast.success("Claim submitted successfully! The finder will review your verification.");
      setClaimModalOpen(false);
      setClaimProof("");
      setClaimPhone("");
      setClaimEvidence([]);
      fetchItem();
    } catch (err) {
      setClaimError(err.response?.data?.error?.message || "Failed to submit claim.");
    } finally {
      setClaimSubmitting(false);
    }
  }

  // Review a claim (approve or reject)
  async function handleReviewClaim(claimId, decision, reason) {
    try {
      await client.post(`/lost-found/claims/${claimId}/review`, {
        decision,
        rejection_reason: reason || undefined,
      });
      toast.success(
        decision === "approve"
          ? "Claim approved! Both parties can now coordinate safe campus handover."
          : "Claim has been rejected."
      );
      setRejectModalOpen(false);
      setSelectedClaimId(null);
      setRejectionReason("");
      fetchItem();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to update claim review.");
    }
  }

  // Handover confirmation
  async function handleConfirmHandover(role) {
    const ok = await confirm({
      title: "Confirm Safe Handover",
      message:
        "Are you sure you want to confirm the physical handover of this item? Once both parties confirm, the item will be marked as safely recovered.",
      confirmLabel: "Confirm Handover",
    });
    if (!ok) return;

    try {
      await client.post(`/lost-found/${id}/handover`, { role });
      toast.success("Handover confirmed!");
      fetchItem();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to confirm handover.");
    }
  }

  // Status update
  async function handleStatusUpdate(e) {
    e.preventDefault();
    setStatusSubmitting(true);
    try {
      await client.patch(`/lost-found/${id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}.`);
      setStatusModalOpen(false);
      fetchItem();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to update status.");
    } finally {
      setStatusSubmitting(false);
    }
  }

  // Delete item
  async function handleDeleteItem() {
    const ok = await confirm({
      title: "Remove Report",
      message: "Are you sure you want to remove this report? This action cannot be undone.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;

    try {
      await client.delete(`/lost-found/${id}`);
      toast.success("Report removed.");
      navigate("/lost-found");
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to remove report.");
    }
  }

  // Submit report to moderation
  async function handleReportItem(e) {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await client.post("/reports", {
        target_type: "lost_found_item",
        target_id: id,
        reason: reportReason.trim(),
      });
      toast.success("Thank you. Our campus admin team will review this report.");
      setReportModalOpen(false);
      setReportReason("");
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to submit report.");
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl text-center py-12">
        <Icon name="alert" className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Item Not Found</h2>
        <p className="mt-1 text-sm text-slate-500">{error || "This report does not exist or has been removed."}</p>
        <Button variant="primary" className="mt-6" onClick={() => navigate("/lost-found")}>
          Return to Lost &amp; Found
        </Button>
      </div>
    );
  }

  const images = Array.isArray(item.images) && item.images.length > 0 ? item.images : [];
  const activeImage = images[activeImageIdx] || null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/lost-found"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <Icon name="arrowLeft" className="h-3.5 w-3.5" />
          <span>Back to Lost &amp; Found</span>
        </Link>

        {/* Reporter / Admin Action Buttons */}
        <div className="flex items-center gap-2">
          {(isReporter || isAdmin) && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusModalOpen(true)}
              >
                <Icon name="edit" className="h-3.5 w-3.5" />
                <span>Update Status</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
                onClick={handleDeleteItem}
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
                <span>Remove</span>
              </Button>
            </>
          )}

          {!isReporter && user && (
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600 transition"
            >
              <Icon name="alert" className="h-3.5 w-3.5" />
              <span>Report Suspicious</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Item Presentation */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Gallery */}
        <div className="md:col-span-6 space-y-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-sm backdrop-blur-md">
            <MediaImage
              src={activeImage}
              alt={item.title}
              icon="lost_found"
              className="h-full w-full object-cover"
            />
            {/* Report Type Badge */}
            <span
              className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${
                isLost
                  ? "border border-amber-300 bg-amber-500/95 text-white"
                  : "border border-emerald-300 bg-emerald-600/95 text-white"
              }`}
            >
              {isLost ? "Lost Item" : "Found Item"}
            </span>

            {/* Status Badge */}
            <span className="absolute right-4 top-4">
              <Badge tone={item.status === "returned" ? "ok" : item.status === "open" ? "info" : "warn"}>
                {item.status.toUpperCase()}
              </Badge>
            </span>
          </div>

          {/* Thumbnails row */}
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto thin-scrollbar pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    activeImageIdx === idx
                      ? "border-slate-800 scale-95"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & Primary Actions */}
        <div className="md:col-span-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>{item.category}</span>
              {item.brand && (
                <>
                  <span>•</span>
                  <span>{item.brand}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 leading-tight">
              {item.title}
            </h1>
          </div>

          {/* Location & Date Card */}
          <div className="glass rounded-2xl border border-white/80 bg-white/70 p-4 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Icon name="mapPin" className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                <strong>Campus Location:</strong> {item.location}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="calendar" className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                <strong>{isLost ? "Date Lost:" : "Date Found:"}</strong>{" "}
                {new Date(item.date_incident).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            {item.color && (
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border border-slate-300 bg-slate-200 shrink-0" />
                <span>
                  <strong>Color:</strong> {item.color}
                </span>
              </div>
            )}
            {Number(item.reward_amount) > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 font-semibold text-emerald-800">
                <Icon name="wallet" className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Reward Offered: {Number(item.reward_amount).toFixed(0)} ETB</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Description
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Reporter safe profile banner */}
          <div className="glass flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                {item.reporter_name ? item.reporter_name[0].toUpperCase() : "U"}
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {item.reporter_name || "Campus Member"}
                </p>
                <p className="text-[11px] text-slate-400 capitalize">
                  {item.reporter_role || "Student"} • Verified Student
                </p>
              </div>
            </div>
            <Badge tone="ok">Campus Verified</Badge>
          </div>

          {/* Confidential Finder Verification Note (Owner or Admin only) */}
          {(isReporter || isAdmin) && item.private_details && (
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide">
                <Icon name="shield" className="h-4 w-4 text-amber-700" />
                <span>Your Confidential Verification Proof (Secret)</span>
              </div>
              <p className="text-xs text-amber-800 whitespace-pre-line">
                {item.private_details}
              </p>
            </div>
          )}

          {/* User Handover Action Section */}
          {item.status === "awaiting_handover" && (
            <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/70 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                <Icon name="checkCircle" className="h-5 w-5 text-emerald-600" />
                <span>Handover Dual-Confirmation Required</span>
              </div>
              <p className="text-xs text-emerald-900">
                A claim was verified! Once both the finder and owner meet safely on campus and exchange
                the belonging, each party must confirm handover to mark the item as returned.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {isReporter && !item.handover_confirmed_by_finder && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    onClick={() => handleConfirmHandover("finder")}
                  >
                    Confirm I Handed Item Over
                  </Button>
                )}
                {isReporter && item.handover_confirmed_by_finder && (
                  <Badge tone="ok">Finder Handover Confirmed ✓</Badge>
                )}

                {userClaim && !item.handover_confirmed_by_claimant && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    onClick={() => handleConfirmHandover("claimant")}
                  >
                    Confirm I Received My Belonging
                  </Button>
                )}
                {userClaim && item.handover_confirmed_by_claimant && (
                  <Badge tone="ok">Owner Receipt Confirmed ✓</Badge>
                )}
              </div>
            </div>
          )}

          {/* Primary Call to Action Button for non-reporters */}
          {!isReporter && item.status === "open" && isFound && (
            <div>
              {userClaim ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                  <p className="font-bold">You submitted a claim for this item.</p>
                  <p className="mt-0.5">Status: <Badge tone="info">{userClaim.status}</Badge></p>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full py-3.5 shadow-md text-base"
                  onClick={() => {
                    if (!user) navigate("/login");
                    else setClaimModalOpen(true);
                  }}
                >
                  <Icon name="checkCircle" className="h-5 w-5" />
                  <span>This Might Be Mine (Claim Item)</span>
                </Button>
              )}
            </div>
          )}

          {!isReporter && item.status === "open" && isLost && (
            <Button
              variant="primary"
              size="lg"
              className="w-full py-3.5 shadow-md text-base"
              onClick={() => {
                if (!user) navigate("/login");
                else navigate(`/lost-found/new?type=found`);
              }}
            >
              <Icon name="lost_found" className="h-5 w-5" />
              <span>I Found Something Matching This</span>
            </Button>
          )}

          {!isReporter && (
            <Button
              variant="outline"
              size="lg"
              className="w-full py-3 mt-2"
              onClick={messageReporter}
            >
              <Icon name="messages" className="h-5 w-5" />
              <span>{isFound ? "Message Finder Privately" : "Message Owner Privately"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Claims Management Section (Visible to Reporter of Found Item or Admin) */}
      {(isReporter || isAdmin) && isFound && item.claims && item.claims.length > 0 && (
        <div className="glass rounded-3xl border border-white/80 bg-white/80 p-6 sm:p-8 shadow-xs backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Ownership Claims ({item.claims.length})</h2>
              <p className="text-xs text-slate-500">
                Carefully review the private proofs submitted by claimants before approving.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {item.claims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{claim.claimant_name}</span>
                    <Badge tone={claim.status === "approved" ? "ok" : claim.status === "pending" ? "warn" : "danger"}>
                      {claim.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(claim.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Private proof */}
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-800 space-y-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500 block">
                    Claimant's Proof of Ownership:
                  </span>
                  <p className="whitespace-pre-line">{claim.private_proof}</p>
                </div>

                {claim.contact_phone && (
                  <p className="text-xs text-slate-600">
                    <strong>Contact Phone:</strong> {claim.contact_phone}
                  </p>
                )}

                {/* Evidence Images */}
                {Array.isArray(claim.evidence_images) && claim.evidence_images.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Submitted Evidence:
                    </span>
                    <div className="flex gap-2">
                      {claim.evidence_images.map((img, i) => (
                        <a key={i} href={img} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claim Actions */}
                {claim.status === "pending" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800 text-white"
                      onClick={() => handleReviewClaim(claim.id, "approve")}
                    >
                      <Icon name="check" className="h-3.5 w-3.5" />
                      <span>Approve Claim</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setSelectedClaimId(claim.id);
                        setRejectModalOpen(true);
                      }}
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Matching Section (Visible to Reporter or Admin) */}
      {(isReporter || isAdmin) && item.matches && item.matches.length > 0 && (
        <div className="glass rounded-3xl border border-white/80 bg-white/80 p-6 sm:p-8 shadow-xs backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Icon name="sparkles" className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Smart Automated Matches ({item.matches.length})
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Our campus matching engine discovered potential matching reports based on category, title,
                keywords, brand, color, campus location, and incident dates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {item.matches.map((match) => {
              const matchedItem = match.matched_item;
              if (!matchedItem) return null;
              const isScoreStrong = match.similarity_score >= 85;

              return (
                <div
                  key={match.id}
                  className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isScoreStrong
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {match.similarity_score}% Match Score
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {matchedItem.type} item
                      </span>
                    </div>

                    <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">
                      {matchedItem.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                      {matchedItem.description}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      📍 {matchedItem.location || "Campus"}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => navigate(`/lost-found/${matchedItem.id}`)}
                  >
                    <span>View Matching Report</span>
                    <Icon name="arrowRight" className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Claim Submission Modal */}
      <Modal
        open={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title="Claim Found Belonging"
        size="md"
      >
        <form onSubmit={handleClaimSubmit} className="space-y-4 p-5">
          <Alert tone="info" title="Verification Process">
            To prevent fraudulent claims, describe private details only the genuine owner would know
            (e.g., precise ID card numbers, laptop wallpaper, serial digits, keychain trinkets, or wallet cards).
          </Alert>

          {claimError && <Alert tone="error">{claimError}</Alert>}

          <TextArea
            label="Confidential Proof of Ownership"
            required
            rows={4}
            placeholder="Explain detailed characteristics, engraving, internal contents, or identifiers..."
            value={claimProof}
            onChange={(e) => setClaimProof(e.target.value)}
          />

          <Input
            label="Your Contact Phone (Optional)"
            placeholder="e.g., 0911223344"
            value={claimPhone}
            onChange={(e) => setClaimPhone(e.target.value)}
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Supporting Proof Images (Receipt, Old Photo with item)
            </label>
            <ImageUploader
              value={claimEvidence}
              onChange={setClaimEvidence}
              max={2}
              uploadEndpoint="/lost-found/upload-evidence"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setClaimModalOpen(false)}
              disabled={claimSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={claimSubmitting}>
              Submit Verification Claim
            </Button>
          </div>
        </form>
      </Modal>

      {/* Claim Rejection Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Ownership Claim"
        size="sm"
      >
        <div className="space-y-4 p-5">
          <p className="text-xs text-slate-600">
            Provide a respectful reason for rejecting this claim (e.g. proof does not match confidential details).
          </p>
          <TextArea
            label="Rejection Reason (Optional)"
            rows={3}
            placeholder="e.g. Provided ID number does not match found card..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => handleReviewClaim(selectedClaimId, "reject", rejectionReason)}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Report Status"
        size="sm"
      >
        <form onSubmit={handleStatusUpdate} className="space-y-4 p-5">
          <Select
            label="Select Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          >
            <option value="open">Open (Active)</option>
            <option value="matched">Matched</option>
            <option value="claim_pending">Claim Pending</option>
            <option value="awaiting_handover">Awaiting Handover</option>
            <option value="returned">Returned / Recovered</option>
            <option value="closed">Closed</option>
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusModalOpen(false)}
              disabled={statusSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={statusSubmitting}>
              Save Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* Report Suspicious Modal */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Report Suspicious Item"
        size="sm"
      >
        <form onSubmit={handleReportItem} className="space-y-4 p-5">
          <p className="text-xs text-slate-600">
            Notify campus administrators if this report violates campus policy, includes spam, or appears fraudulent.
          </p>
          <TextArea
            label="Reason for report"
            required
            rows={3}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Explain why this post is suspicious..."
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportModalOpen(false)}
              disabled={reportSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={reportSubmitting}>
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
