import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, ErrorBanner, Input, SuccessBanner } from "../ui";
import Icon from "../Icon";
import { client, errMsg } from "../../api/client";

const NOTIF_PREF_LABELS = {
  orders: "Order updates & delivery alerts",
  rentals: "Rental reminders & due date notifications",
  events: "Event reminders & ticket announcements",
  announcements: "Campus-wide official announcements",
};

const DEFAULT_NOTIFS = {
  orders: true,
  rentals: true,
  events: true,
  announcements: true,
};

export default function ProfileSettings({ user, onProfileUpdated }) {
  // Password State
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [passFieldErrors, setPassFieldErrors] = useState({});

  // Privacy State
  const initialPrivacy = user?.privacy_settings || {
    showEmail: false,
    showPhone: false,
    showActivity: true,
  };
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const [privacySuccess, setPrivacySuccess] = useState("");

  // Notification State
  const initialNotifs = { ...DEFAULT_NOTIFS, ...(user?.notification_prefs || {}) };
  const [notifs, setNotifs] = useState(initialNotifs);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifsError, setNotifsError] = useState("");
  const [notifsSuccess, setNotifsSuccess] = useState("");

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    const errs = {};
    if (!passwords.currentPassword) errs.currentPassword = "Enter your current password.";
    if (passwords.newPassword.length < 8) errs.newPassword = "New password must be at least 8 characters long.";
    if (passwords.newPassword !== passwords.confirmPassword) errs.confirmPassword = "New passwords do not match.";
    setPassFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setChangingPass(true);
    try {
      await client.post("/users/me/password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPassSuccess("Password updated successfully. Other active sessions have been signed out.");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPassFieldErrors({});
    } catch (err) {
      setPassError(errMsg(err, "Failed to update password. Please check your current password."));
    } finally {
      setChangingPass(false);
    }
  }

  async function handlePrivacySubmit(e) {
    e.preventDefault();
    setPrivacyError("");
    setPrivacySuccess("");
    setSavingPrivacy(true);
    try {
      await client.patch("/users/me", { privacySettings: privacy });
      setPrivacySuccess("Privacy preferences saved.");
      if (onProfileUpdated) await onProfileUpdated();
    } catch (err) {
      setPrivacyError(errMsg(err, "Failed to save privacy settings."));
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function handleNotifsSubmit(e) {
    e.preventDefault();
    setNotifsError("");
    setNotifsSuccess("");
    setSavingNotifs(true);
    try {
      await client.patch("/users/me", { notificationPrefs: notifs });
      setNotifsSuccess("Notification preferences saved.");
      if (onProfileUpdated) await onProfileUpdated();
    } catch (err) {
      setNotifsError(errMsg(err, "Failed to save notification settings."));
    } finally {
      setSavingNotifs(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Privacy Settings Card */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-ink">Public Profile Privacy</h3>
        <p className="mt-1 text-xs text-muted">
          Control which contact and activity details appear to others on your public profile.
        </p>
        <form onSubmit={handlePrivacySubmit} className="mt-4 space-y-4">
          <ErrorBanner message={privacyError} />
          <SuccessBanner message={privacySuccess} />

          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            <label className="flex items-center justify-between text-sm text-ink">
              <div>
                <span className="font-medium">Show email address</span>
                <p className="text-xs text-muted">Allow campus members to see your email</p>
              </div>
              <input
                type="checkbox"
                checked={!!privacy.showEmail}
                onChange={(e) => setPrivacy({ ...privacy, showEmail: e.target.checked })}
                className="h-4 w-4 accent-white"
              />
            </label>

            <div className="border-t border-white/8" />

            <label className="flex items-center justify-between text-sm text-ink">
              <div>
                <span className="font-medium">Show phone number</span>
                <p className="text-xs text-muted">Allow campus members to see your phone</p>
              </div>
              <input
                type="checkbox"
                checked={!!privacy.showPhone}
                onChange={(e) => setPrivacy({ ...privacy, showPhone: e.target.checked })}
                className="h-4 w-4 accent-white"
              />
            </label>

            <div className="border-t border-white/8" />

            <label className="flex items-center justify-between text-sm text-ink">
              <div>
                <span className="font-medium">Show activity & listings</span>
                <p className="text-xs text-muted">Display your active products, rentals, or events</p>
              </div>
              <input
                type="checkbox"
                checked={privacy.showActivity !== false}
                onChange={(e) => setPrivacy({ ...privacy, showActivity: e.target.checked })}
                className="h-4 w-4 accent-white"
              />
            </label>
          </div>

          <Button type="submit" loading={savingPrivacy} disabled={savingPrivacy}>
            {savingPrivacy ? "Saving…" : "Save Privacy Settings"}
          </Button>
        </form>
      </Card>

      {/* Security & Password Card */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-ink">Security & Password</h3>
        <p className="mt-1 text-xs text-muted">
          Update your password to keep your ግቢያችን account secure.
        </p>
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
          <ErrorBanner message={passError} />
          <SuccessBanner message={passSuccess} />

          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={passwords.currentPassword}
            error={passFieldErrors.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            required
          />

          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            hint="Use at least 8 characters."
            value={passwords.newPassword}
            error={passFieldErrors.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            required
          />

          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={passwords.confirmPassword}
            error={passFieldErrors.confirmPassword}
            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
            required
          />

          <p className="text-xs text-muted">
            Security notice: Changing your password revokes existing refresh tokens and logs out other devices.
          </p>

          <Button type="submit" loading={changingPass} disabled={changingPass}>
            {changingPass ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </Card>

      {/* Notification Preferences (FR-046) */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-ink">Notification Preferences</h3>
        <p className="mt-1 text-xs text-muted">
          Select which notifications you would like to receive.
        </p>
        <form onSubmit={handleNotifsSubmit} className="mt-4 space-y-4">
          <ErrorBanner message={notifsError} />
          <SuccessBanner message={notifsSuccess} />

          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            {Object.entries(NOTIF_PREF_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-sm text-ink">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={!!notifs[key]}
                  onChange={(e) => setNotifs({ ...notifs, [key]: e.target.checked })}
                  className="h-4 w-4 accent-white"
                />
              </label>
            ))}
          </div>

          <p className="text-xs text-muted">
            Note: Security, password recovery, and cancellation notices are always delivered regardless of settings.
          </p>

          <Button type="submit" loading={savingNotifs} disabled={savingNotifs}>
            {savingNotifs ? "Saving…" : "Save Preferences"}
          </Button>
        </form>
      </Card>

      {/* Campus Verification Status */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Campus Account Verification</h3>
            <p className="mt-1 text-xs text-muted">
              Verification confirms you are an authentic student or faculty member on campus.
            </p>
          </div>
          {user?.verified ? (
            <Badge tone="ok">
              <Icon name="check" className="h-3 w-3" />
              Campus Verified
            </Badge>
          ) : (
            <Badge tone="warn">Unverified</Badge>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-white/4 border border-white/8 p-4 text-sm text-ink">
          {user?.verified ? (
            <div className="space-y-2">
              <p className="font-medium text-ok">Your account has been officially verified!</p>
              <p className="text-xs text-muted">
                {user.verification_method === "domain"
                  ? "Verified automatically via official university email address domain."
                  : "Verified manually by university campus administration."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Your email domain didn&apos;t automatically verify. You can submit your student ID card or proof of enrollment for administrator review.
              </p>
              <Button as={Link} to="/verify" variant="accent">
                Submit Campus Verification Proof
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
