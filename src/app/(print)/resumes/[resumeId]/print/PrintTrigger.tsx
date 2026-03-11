"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    // Small delay so fonts/styles finish loading before print dialog
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="print:hidden fixed bottom-6 right-6 flex gap-3 z-50">
      <button
        onClick={() => window.print()}
        className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-lg transition-colors"
      >
        Print / Save as PDF
      </button>
      <button
        onClick={() => window.history.back()}
        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm px-4 py-2.5 rounded-lg shadow transition-colors"
      >
        Go Back
      </button>
    </div>
  );
}
