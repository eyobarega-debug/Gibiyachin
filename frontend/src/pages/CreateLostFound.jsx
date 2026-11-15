import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { client } from "../api/client";
import { useToast } from "../components/Toast";
import ImageUploader from "../components/ImageUploader";
import { Input, TextArea, Select, Button, Alert } from "../components/ui";
import Icon from "../components/Icon";

const CATEGORIES = [
  "Student ID Cards",
  "Electronics",
  "Phones",
  "Laptops",
  "Bags and Backpacks",
  "Books and Notes",
  "Wallets",
  "Keys",
  "Clothing",
  "Accessories",
  "Other",
];

export default function CreateLostFound() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const initialType = searchParams.get("type") === "found" ? "found" : "lost";
  const [reportType, setReportType] = useState(initialType);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [description, setDescription] = useState("");
  const [dateIncident, setDateIncident] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [location, setLocation] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [privateDetails, setPrivateDetails] = useState("");
  const [images, setImages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Item title is required.");
      return;
    }
    if (!category) {
      setFormError("Category is required.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }
    if (!dateIncident) {
      setFormError("Incident date is required.");
      return;
    }
    if (!location.trim()) {
      setFormError("Campus location is required.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: reportType,
        title: title.trim(),
        category,
        description: description.trim(),
        date_incident: dateIncident,
        location: location.trim(),
        brand: brand.trim() || undefined,
        color: color.trim() || undefined,
        images: images.length > 0 ? images : undefined,
      };

      if (reportType === "lost" && rewardAmount) {
        const parsedReward = parseFloat(rewardAmount);
        if (!isNaN(parsedReward) && parsedReward > 0) {
          payload.reward_amount = parsedReward;
        }
      }

      if (reportType === "found" && privateDetails.trim()) {
        payload.private_details = privateDetails.trim();
      }

      const { data } = await client.post("/lost-found", payload);
      toast.success(
        reportType === "lost"
          ? "Lost item report published! Our matching engine is scanning campus reports."
          : "Found item report submitted! Thank you for helping your campus community."
      );

      navigate(`/lost-found/${data.item.id}`);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        "Failed to submit report. Please check the fields and try again.";
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header & Back link */}
      <div>
        <Link
          to="/lost-found"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-3"
        >
          <Icon name="arrowLeft" className="h-3.5 w-3.5" />
          <span>Back to Campus Lost &amp; Found</span>
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          {reportType === "lost" ? "Report a Lost Item" : "Report a Found Item"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {reportType === "lost"
            ? "Provide accurate details to help campus members and security identify and return your belonging."
            : "Help return found property to its rightful owner. Private verification details will be safely kept hidden."}
        </p>
      </div>

      {/* Type Toggle Tabs */}
      <div className="flex rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => setReportType("lost")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition duration-200 ${
            reportType === "lost"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <Icon name="search" className="h-3 w-3" />
          </span>
          <span>I Lost Something</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType("found")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition duration-200 ${
            reportType === "found"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <Icon name="checkCircle" className="h-3 w-3" />
          </span>
          <span>I Found Something</span>
        </button>
      </div>

      {/* Privacy Notice for Found items */}
      {reportType === "found" && (
        <Alert tone="info" title="Privacy Protection Notice">
          Gibiyachin protects student privacy. Never post personal ID numbers, full sensitive student
          names, or security codes publicly. Use the confidential verification field below for secret
          details only the genuine owner would know.
        </Alert>
      )}

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="glass rounded-3xl border border-white/80 bg-white/80 p-6 sm:p-8 shadow-xs backdrop-blur-xl space-y-5"
      >
        {formError && (
          <Alert tone="error" onClose={() => setFormError("")}>
            {formError}
          </Alert>
        )}

        {/* Title */}
        <Input
          label="Item Title"
          required
          placeholder={
            reportType === "lost"
              ? "e.g., Black HP Laptop Charger, Blue Leather Wallet"
              : "e.g., Found Silver Keychain, Blue Scientific Calculator"
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          hint="Use a descriptive, clear title mentioning the item type and color."
        />

        {/* Category & Incident Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>

          <Input
            label={reportType === "lost" ? "Approximate Date Lost" : "Date Found"}
            type="date"
            required
            value={dateIncident}
            onChange={(e) => setDateIncident(e.target.value)}
          />
        </div>

        {/* Campus Location */}
        <Input
          label="Campus Location"
          required
          placeholder="e.g., Main Library 2nd Floor, Science Faculty Cafeteria, Block 44"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          hint="Where the item was lost or discovered on campus."
        />

        {/* Brand & Color (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Brand / Make (Optional)"
            placeholder="e.g., HP, Samsung, Casio, Nike"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />

          <Input
            label="Primary Color (Optional)"
            placeholder="e.g., Black, Blue, Silver, Red"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>

        {/* Description */}
        <TextArea
          label="Public Description"
          required
          rows={4}
          placeholder={
            reportType === "lost"
              ? "Describe scratches, stickers, condition, or circumstances under which it went missing."
              : "Describe general appearance without giving away private secret identifiers."
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Found Item Confidential Verification Details */}
        {reportType === "found" && (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
              <Icon name="shield" className="h-4 w-4 text-amber-700" />
              <span>Confidential Verification Details (Private to Finder &amp; Admins)</span>
            </div>
            <p className="text-xs text-amber-800">
              Enter secret proof that only the real owner can verify (e.g., full ID number, specific
              stickers, engraving, wallet card names, or lock screen wallpaper). This is{" "}
              <strong>NEVER</strong> shown publicly.
            </p>
            <TextArea
              rows={3}
              placeholder="e.g., ID Card student ID is UGR/1234/14; Keychain has a miniature guitar tag."
              value={privateDetails}
              onChange={(e) => setPrivateDetails(e.target.value)}
              className="bg-white/95"
            />
          </div>
        )}

        {/* Lost Item Optional Reward */}
        {reportType === "lost" && (
          <Input
            label="Optional Reward (ETB)"
            type="number"
            min="0"
            step="10"
            placeholder="e.g., 200"
            value={rewardAmount}
            onChange={(e) => setRewardAmount(e.target.value)}
            hint="You may offer a token of appreciation to encourage the return of your belongings."
          />
        )}

        {/* Photos / Images */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-sm font-medium text-slate-800">
            Item Photos (Optional, up to 4 images)
          </label>
          <ImageUploader value={images} onChange={setImages} max={4} />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/lost-found")}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button type="submit" variant="primary" loading={loading} className="px-6">
            {reportType === "lost" ? "Submit Lost Report" : "Submit Found Report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
