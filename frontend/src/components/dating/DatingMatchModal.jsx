import { useNavigate } from "react-router-dom";
import Icon from "../Icon";

export default function DatingMatchModal({
  isOpen,
  matchedUser,
  currentUser,
  conversationId,
  onClose,
}) {
  const navigate = useNavigate();

  if (!isOpen || !matchedUser) return null;

  function handleStartChat() {
    onClose();
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
    } else {
      navigate("/messages");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-linear-to-b from-slate-900 to-slate-950 p-6 text-center text-white shadow-2xl border border-rose-500/30 animate-rise">
        {/* Floating Hearts Decor */}
        <div className="flex justify-center mb-3">
          <span className="text-4xl animate-bounce">❤️</span>
        </div>

        <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
          IT'S A MATCH!
        </h2>
        <p className="mt-1.5 text-xs text-rose-200">
          You and <span className="font-bold text-white">{matchedUser.displayName}</span> liked each other.
        </p>

        {/* Avatars Side-by-Side */}
        <div className="my-6 flex items-center justify-center gap-4">
          {/* Current User Avatar */}
          <div className="relative h-20 w-20 rounded-full border-2 border-rose-500 overflow-hidden shadow-lg shadow-rose-500/20">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-lg font-bold">
                {currentUser?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-md">
            <Icon name="heart" className="h-5 w-5 fill-white" />
          </div>

          {/* Partner Avatar */}
          <div className="relative h-20 w-20 rounded-full border-2 border-rose-500 overflow-hidden shadow-lg shadow-rose-500/20">
            {matchedUser.avatarUrl ? (
              <img src={matchedUser.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-lg font-bold">
                {matchedUser.displayName?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleStartChat}
            className="w-full rounded-2xl bg-linear-to-r from-rose-500 to-pink-500 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:from-rose-600 hover:to-pink-600 hover:scale-102 active:scale-98"
          >
            Say Hello 💬
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-white/10 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/20 hover:text-white"
          >
            Keep Swiping
          </button>
        </div>
      </div>
    </div>
  );
}
