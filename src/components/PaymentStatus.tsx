"use client";

interface PaymentStatusProps {
  status: "idle" | "pending" | "success" | "error";
  message?: string;
}

export default function PaymentStatus({ status, message }: PaymentStatusProps) {
  if (status === "idle") return null;

  const config = {
    pending: {
      bg: "bg-white border-[#D2D2D7]",
      text: "text-[#1D1D1F]",
      accent: "text-[#FF9500]",
      defaultMsg: "Processing payment...",
    },
    success: {
      bg: "bg-white border-[#34C759]/30",
      text: "text-[#1D1D1F]",
      accent: "text-[#34C759]",
      defaultMsg: "Payment successful!",
    },
    error: {
      bg: "bg-white border-[#FF3B30]/30",
      text: "text-[#1D1D1F]",
      accent: "text-[#FF3B30]",
      defaultMsg: "Payment failed",
    },
  }[status];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl border shadow-lg ${config.bg} backdrop-blur-xl animate-slide-up`}
    >
      <p className={`text-sm ${config.text} flex items-center gap-2.5`}>
        <span
          className={`w-2 h-2 rounded-full ${
            status === "pending"
              ? "bg-[#FF9500] animate-pulse"
              : status === "success"
              ? "bg-[#34C759]"
              : "bg-[#FF3B30]"
          }`}
        />
        {message || config.defaultMsg}
      </p>
    </div>
  );
}
