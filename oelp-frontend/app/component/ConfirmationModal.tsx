"use client";

import { useState } from "react";

type Props = {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string; // If provided, user must type this to confirm
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export default function ConfirmationModal({ 
  isOpen, title, message, confirmText, onConfirm, onCancel, isLoading 
}: Props) {
  const [input, setInput] = useState("");
  
  if (!isOpen) return null;

  const isConfirmDisabled = confirmText ? input !== confirmText : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 m-4 border border-red-100">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        
        <div className="text-gray-600 text-sm mb-6">
          {message}
        </div>

        {confirmText && (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 mb-2">
              Type <span className="font-mono font-bold text-black">"{confirmText}"</span> to confirm:
            </label>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="text-black w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              placeholder={confirmText}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isConfirmDisabled || isLoading}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/30"
          >
            {isLoading ? "Deleting..." : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}