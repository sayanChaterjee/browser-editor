"use client";

interface ConfirmModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isVisible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isVisible) return null;

  const confirmStyles =
    variant === "danger"
      ? "bg-[#ef4444] hover:bg-[#dc2626] text-white"
      : "bg-gradient-to-r from-[#38bdf8] to-[#2563eb] hover:opacity-90 text-white shadow-[0_4px_14px_rgba(56,189,248,0.3)]";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10001]">
      <div
        className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-8 rounded-2xl border border-[#334155] shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-w-[440px] w-[90%]"
        style={{ animation: "confirmFadeIn 0.2s ease-out" }}
      >
        <style>{`
          @keyframes confirmFadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>

        <h3 className="text-xl font-bold text-[#f8fafc] mb-2">{title}</h3>
        <p className="text-[#94a3b8] text-sm mb-6 leading-relaxed">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-transparent border border-[#334155] rounded-xl text-[#94a3b8] text-sm font-semibold transition-all hover:bg-white/5 hover:text-white"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 border-none rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-95 ${confirmStyles}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
