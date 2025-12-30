"use client";

import { useState } from "react";

// Icons
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const CodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function SubmissionList({ submissions }: { submissions: any[] }) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string>("");

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-800">Submission History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 border-b border-gray-200 uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Question</th>
                <th className="px-6 py-3">Lab</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {sub.questions?.title || "Unknown"}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {sub.questions?.lab_sections?.title || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        sub.status === "completed"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : sub.status === "error"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200"
                      }`}
                    >
                      {sub.status === "completed" ? <CheckIcon /> : <XIcon />}
                      <span className="capitalize">{sub.status || "Unknown"}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600">
                    <span className={sub.total_score > 0 ? "text-gray-900 font-bold" : ""}>
                      {sub.total_score}
                    </span>
                    <span className="text-gray-400"> / {sub.questions?.points || 10}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setSelectedCode(sub.code || "// No code found");
                        setSelectedQuestion(sub.questions?.title || "Code View");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <CodeIcon /> View Code
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500 whitespace-nowrap">
                    {new Date(sub.submitted_at).toLocaleDateString("en-GB")}{" "}
                    <span className="text-xs text-gray-400">
                        {new Date(sub.submitted_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        })}
                    </span>
                   </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500">
                    No submissions found for this student.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Viewer Modal */}
      {selectedCode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <CodeIcon /> {selectedQuestion}
              </h3>
              <button
                onClick={() => setSelectedCode(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[#1e1e1e] p-6">
              <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap break-all">
                <code>{selectedCode}</code>
              </pre>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedCode(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}