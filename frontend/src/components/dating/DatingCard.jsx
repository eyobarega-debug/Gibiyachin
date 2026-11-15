import { useState } from "react";
import Icon from "../Icon";

export default function DatingCard({
  candidate,
  onPass,
  onLike,
  onReport,
  disabled = false,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!candidate) return null;

  const photos = candidate.photos && candidate.photos.length > 0
    ? candidate.photos
    : candidate.avatarUrl
    ? [candidate.avatarUrl]
    : [];

  function nextPhoto(e) {
    e.stopPropagation();
    if (photos.length > 1) {
      setPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  }

  function prevPhoto(e) {
    e.stopPropagation();
    if (photos.length > 1) {
      setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl transition-all duration-300">
      {/* Photo Gallery Box */}
      <div className="relative h-96 w-full bg-slate-900 overflow-hidden select-none">
        {photos.length > 0 ? (
          <img
            src={photos[photoIndex]}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-800 to-slate-950 text-slate-500">
            <Icon name="user" className="h-20 w-20 text-slate-600" />
          </div>
        )}

        {/* Photo Navigation Overlays */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xs hover:bg-black/60 transition"
              aria-label="Previous photo"
            >
              <Icon name="arrowLeft" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xs hover:bg-black/60 transition"
              aria-label="Next photo"
            >
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>

            {/* Dots */}
            <div className="absolute top-3 inset-x-0 flex justify-center gap-1.5 px-4 z-10">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i === photoIndex ? "bg-white shadow-xs" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Gradient shadow at bottom of photo */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Name & Age Overlay on photo bottom */}
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight drop-shadow-md">
              {candidate.displayName}, {candidate.age}
            </h2>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] shadow-xs">
              ✓
            </span>
          </div>

          <p className="text-xs text-slate-200 drop-shadow-xs font-medium">
            {candidate.universityName || "AASTU Campus"}
            {candidate.academicYear ? ` • ${candidate.academicYear}` : ""}
          </p>
        </div>

        {/* Report Button (top right) */}
        <button
          type="button"
          onClick={() => onReport(candidate)}
          title="Report profile"
          className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white/80 hover:bg-black/70 hover:text-white transition z-10"
        >
          <Icon name="alert" className="h-4 w-4" />
        </button>
      </div>

      {/* Profile Details & Bio */}
      <div className="p-5 space-y-4">
        {/* Department / Major */}
        {candidate.department && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Icon name="graduation" className="h-4 w-4 text-slate-500" />
            <span>{candidate.department}</span>
          </div>
        )}

        {/* Bio */}
        {candidate.bio && (
          <p className="text-xs text-slate-600 leading-relaxed">
            {candidate.bio}
          </p>
        )}

        {/* Shared Interests Highlight */}
        {candidate.sharedInterestsCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200/70 px-3 py-1.5 text-xs text-rose-700 font-semibold">
            <Icon name="sparkles" className="h-3.5 w-3.5 text-rose-500" />
            <span>{candidate.sharedInterestsCount} shared interests with you!</span>
          </div>
        )}

        {/* Interests Pills */}
        {candidate.interests && candidate.interests.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Interests &amp; Passions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {candidate.interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hobbies / Music */}
        {candidate.favoriteMusic && candidate.favoriteMusic.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Favorite Music
            </p>
            <p className="text-xs text-slate-600">
              {candidate.favoriteMusic.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Swipe Action Buttons */}
      <div className="border-t border-slate-100 bg-slate-50/70 p-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => onPass(candidate.userId)}
          disabled={disabled}
          title="Pass (Left Arrow)"
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-slate-500 shadow-md transition hover:border-slate-500 hover:text-slate-800 hover:scale-110 active:scale-95 disabled:opacity-50"
        >
          <Icon name="close" className="h-6 w-6 stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={() => onLike(candidate.userId)}
          disabled={disabled}
          title="Like (Right Arrow)"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-tr from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 transition hover:from-rose-600 hover:to-pink-600 hover:scale-110 active:scale-95 disabled:opacity-50"
        >
          <Icon name="heart" className="h-8 w-8 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
