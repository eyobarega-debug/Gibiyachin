import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { client } from "../api/client";
import { useToast } from "../components/Toast";
import Icon from "../components/Icon";
import DatingNav from "../components/dating/DatingNav";
import DatingCard from "../components/dating/DatingCard";
import DatingMatchModal from "../components/dating/DatingMatchModal";
import DatingReportModal from "../components/dating/DatingReportModal";

export default function Dating() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);

  // Match Modal state
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchedCandidate, setMatchedCandidate] = useState(null);
  const [matchConversationId, setMatchConversationId] = useState(null);

  // Report Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [candidateToReport, setCandidateToReport] = useState(null);

  // 18+ Onboarding Form State (when profile is null)
  const [birthDate, setBirthDate] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [gender, setGender] = useState("female");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("2nd Year");
  const [bio, setBio] = useState("");
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [photoUrl, setPhotoUrl] = useState(user?.avatar_url || user?.avatarUrl || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState("");

  // Sync user profile defaults once auth loads
  useEffect(() => {
    if (user?.name && !displayName) {
      setDisplayName(user.name);
    }
    const avatar = user?.avatar_url || user?.avatarUrl;
    if (avatar && !photoUrl) {
      setPhotoUrl(avatar);
    }
  }, [user, displayName, photoUrl]);

  // Load User Profile and Discovery Candidates
  const loadDatingState = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/dating/profile");
      if (data?.profile && data.profile.status === "active") {
        setProfile(data.profile);
        const { data: discoverData } = await client.get("/dating/discover");
        setCandidates(discoverData || []);
        setCandidateIndex(0);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Failed to load dating state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatingState();
  }, [loadDatingState]);

  // Real-time socket listener for incoming matches
  useEffect(() => {
    if (!socket) return;

    function onDatingMatch(data) {
      setMatchedCandidate(data.partner);
      setMatchConversationId(data.conversationId);
      setMatchModalOpen(true);
    }

    socket.on("dating:match", onDatingMatch);
    return () => socket.off("dating:match", onDatingMatch);
  }, [socket]);

  // Keyboard controls for swiping (ArrowLeft = Pass, ArrowRight = Like)
  useEffect(() => {
    function handleKeyDown(e) {
      if (matchModalOpen || reportModalOpen || !profile || candidates.length === 0) return;
      if (e.key === "ArrowLeft") {
        handlePass();
      } else if (e.key === "ArrowRight") {
        handleLike();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [candidateIndex, candidates, profile, matchModalOpen, reportModalOpen]);

  // Swipe Action Handlers
  async function handlePass(targetId) {
    const current = targetId ? candidates.find((c) => c.userId === targetId) : candidates[candidateIndex];
    if (!current || swiping) return;

    setSwiping(true);
    try {
      await client.post("/dating/swipe", { targetId: current.userId, action: "pass" });
      setCandidateIndex((prev) => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Swipe failed");
    } finally {
      setSwiping(false);
    }
  }

  async function handleLike(targetId) {
    const current = targetId ? candidates.find((c) => c.userId === targetId) : candidates[candidateIndex];
    if (!current || swiping) return;

    setSwiping(true);
    try {
      const { data } = await client.post("/dating/swipe", { targetId: current.userId, action: "like" });
      if (data.matched) {
        setMatchedCandidate(data.partner || current);
        setMatchConversationId(data.conversationId);
        setMatchModalOpen(true);
      }
      setCandidateIndex((prev) => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Swipe failed");
    } finally {
      setSwiping(false);
    }
  }

  async function handleReportConfirm(payload) {
    try {
      await client.post("/dating/report", payload);
      toast.success("Profile reported and blocked");
      setCandidateIndex((prev) => prev + 1);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Failed to submit report");
    }
  }

  // 18+ Onboarding Submission
  async function handleCreateProfile(e) {
    e.preventDefault();
    setFormError("");

    if (savingProfile) return;

    // 1. Birth date & Age validation
    if (!birthDate) {
      const msg = "Please enter your date of birth.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const birth = new Date(birthDate);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      calculatedAge--;
    }

    if (isNaN(calculatedAge) || calculatedAge < 18) {
      const msg = "Age requirement not met: You must be at least 18 years old to join Gibiyachin Connect.";
      setFormError(msg);
      toast.error("Age requirement not met: You must be at least 18 years old.");
      return;
    }

    // 2. Adult confirmation checkbox
    if (!adultConfirmed) {
      const msg = "You must confirm you are at least 18 years of age.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    // 3. Display name validation
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      const msg = "Display name must be at least 2 characters long.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        birthDate,
        adultConfirmed: true,
        displayName: trimmedName,
        gender,
        department: department.trim() || null,
        academicYear,
        bio: bio.trim() || "",
        interests: selectedInterests || [],
        avatarUrl: photoUrl?.trim() || null,
        photos: photoUrl?.trim() ? [photoUrl.trim()] : [],
      };

      const { data } = await client.post("/dating/profile", payload);
      setProfile(data.profile);
      toast.success("Welcome to Gibiyachin Connect ❤️");
      loadDatingState();
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error?.message;
      let displayError = "Profile creation failed. Please check your inputs and try again.";

      if (status === 400) {
        displayError = apiMsg || "Invalid profile data. Please review the highlighted fields.";
      } else if (status === 401) {
        displayError = "Session expired. Please log in again to create your profile.";
      } else if (status === 403) {
        displayError = apiMsg || "Access denied: Gibiyachin Connect is reserved for verified campus students.";
      } else if (!err.response) {
        displayError = "Network error: Unable to reach the server. Please check your connection.";
      } else if (apiMsg) {
        displayError = apiMsg;
      }

      setFormError(displayError);
      toast.error(displayError);
    } finally {
      setSavingProfile(false);
    }
  }

  const INTERESTS_LIST = [
    "Tech & Coding", "AI & Robotics", "Reading", "Music", "Cinema",
    "Football", "Basketball", "Gym & Fitness", "Photography", "Coffee Walks",
    "Art & Design", "Gaming", "Travel", "Cooking", "Volunteering"
  ];

  function toggleInterest(interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-rose-600" />
        <p className="mt-3 text-xs font-semibold text-slate-500">Loading Gibiyachin Connect...</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 1. Onboarding Screen if user hasn't opted in yet
  // ------------------------------------------------------------------
  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-3xl border border-rose-200/80 bg-white p-6 sm:p-8 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mb-4">
            <Icon name="heart" className="h-7 w-7" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Welcome to Gibiyachin Connect <span className="text-rose-500">❤️</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Connect with fellow students for dating, campus friendships, and study dates. Exclusively verified for your university.
          </p>

          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
            <p className="font-bold flex items-center gap-1.5">
              <Icon name="shield" className="h-4 w-4 text-amber-700" />
              Campus Privacy &amp; 18+ Safety Guarantee
            </p>
            <p className="mt-1 text-amber-800 leading-relaxed">
              Gibiyachin Connect is strictly opt-in and reserved for students 18 years or older. Your birth date, phone number, and student ID are never shared with anyone.
            </p>
          </div>

          {formError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-900">
              <Icon name="close" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="flex-1">{formError}</div>
            </div>
          )}

          <form onSubmit={handleCreateProfile} className="mt-6 space-y-5">
            {/* 18+ Verification */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Date of Birth <span className="text-rose-500">* (Must be 18+)</span>
                </label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  required
                  checked={adultConfirmed}
                  onChange={(e) => setAdultConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-md text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  I confirm that I am at least 18 years of age and agree to campus safety community standards.
                </span>
              </label>
            </div>

            {/* Profile Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  I identify as <span className="text-rose-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
                >
                  <option value="female">Woman</option>
                  <option value="male">Man</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Department / Major</label>
                <input
                  type="text"
                  value={department}
                  placeholder="e.g. Software Engineering"
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Academic Year</label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="5th Year">5th Year</option>
                  <option value="Graduate">Graduate</option>
                </select>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">About Me (Bio)</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a little about yourself, your hobbies, or what you're looking for..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden"
              />
            </div>

            {/* Interests Tag Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-2">
                Pick Your Interests &amp; Passions
              </label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS_LIST.map((interest) => {
                  const selected = selectedInterests.includes(interest);
                  return (
                    <button
                      type="button"
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "bg-rose-500 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile || !adultConfirmed || !birthDate}
              className="w-full rounded-2xl bg-linear-to-r from-rose-500 to-pink-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {savingProfile ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating Profile...
                </span>
              ) : (
                "Create My Connect Profile ❤️"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. Active Discovery Feed (Swipe Deck)
  // ------------------------------------------------------------------
  const currentCandidate = candidates[candidateIndex];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <DatingNav />

      {/* Discovery Deck */}
      <div className="py-4">
        {currentCandidate ? (
          <div>
            <DatingCard
              candidate={currentCandidate}
              onPass={handlePass}
              onLike={handleLike}
              onReport={(cand) => {
                setCandidateToReport(cand);
                setReportModalOpen(true);
              }}
              disabled={swiping}
            />

            <p className="mt-4 text-center text-[11px] text-slate-400 font-medium">
              💡 Tip: Press <kbd className="rounded border px-1.5 py-0.5 font-bold">← Left</kbd> to Pass or <kbd className="rounded border px-1.5 py-0.5 font-bold">Right →</kbd> to Like
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-lg">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 mb-4">
              <Icon name="heart" className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">You're All Caught Up!</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              You've reviewed all available profiles for your current filters. Check back soon for new students joining Gibiyachin Connect, or adjust your age preferences.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/dating/matches"
                className="rounded-2xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
              >
                View Your Matches
              </Link>
              <Link
                to="/dating/settings"
                className="rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Adjust Discovery Preferences
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Mutual Match Celebration Modal */}
      <DatingMatchModal
        isOpen={matchModalOpen}
        matchedUser={matchedCandidate}
        currentUser={user}
        conversationId={matchConversationId}
        onClose={() => setMatchModalOpen(false)}
      />

      {/* Safety Report Modal */}
      <DatingReportModal
        candidate={candidateToReport}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onConfirm={handleReportConfirm}
      />
    </div>
  );
}
