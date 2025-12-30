"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Editor, { OnMount } from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import dynamic from "next/dynamic";


const MarkdownPreview = dynamic(
  () => import("@uiw/react-markdown-preview"),
  { ssr: false }
);

// --- TYPES ---
type TestCaseResult = {
  status: "Passed" | "Failed" | "TLE" | "MLE" | "Runtime Error" | "Compilation Error";
  execution_time: number;
  memory_used: number;
  student_output?: string;
  expected_output?: string;
  is_hidden: boolean;
  points_earned: number;
};

type SubmissionResponse = {
  submission_id: string;
  status: string;
  results: TestCaseResult[];
  score: string;
};

// --- COMPONENT: Results Display Table ---
function ResultsDisplay({ results }: { results: TestCaseResult[] }) {
  if (!results || results.length === 0) return null;

  const passedCount = results.filter((r) => r.status === "Passed").length;

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Test Results</h3>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
          passedCount === results.length ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
        }`}>
          Passed: {passedCount} / {results.length}
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Test Case</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Output Details</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-600">Case #{i + 1}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold inline-block min-w-80px text-center ${
                    r.status === "Passed" ? "bg-green-100 text-green-700" :
                    r.status === "TLE" ? "bg-orange-100 text-orange-700" :
                    r.status === "Compilation Error" ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono">
                  {r.execution_time > 0 ? `${r.execution_time}s` : "-"}
                </td>
                <td className="px-4 py-3">
                  {r.is_hidden ? (
                    <span className="text-gray-400 italic text-xs">Hidden Test Case</span>
                  ) : r.status === "Passed" ? (
                    <span className="text-green-600 text-xs">Correct Output</span>
                  ) : (
                    <details className="group cursor-pointer text-blue-600 text-xs">
                      <summary className="group-hover:underline focus:outline-none">View Diff</summary>
                      <div className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-md font-mono text-xs whitespace-pre-wrap overflow-x-auto shadow-inner">
                        <div className="mb-2">
                          <span className="text-gray-500 block text-[10px] uppercase mb-1">Expected Output:</span>
                          <span className="text-green-400">{r.expected_output || "<empty>"}</span>
                        </div>
                        <div className="border-t border-gray-700 pt-2">
                          <span className="text-gray-500 block text-[10px] uppercase mb-1">Your Output:</span>
                          <span className="text-red-400">{r.student_output || "<empty>"}</span>
                        </div>
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- COMPONENT: Code Editor with Console, Shortcuts & Auto-save ---
function CodeEditor({ 
  onRun, 
  onSubmit,
  results,
  initialCode,
  studentId,
  questionId
}: { 
  onRun: (code: string, input: string) => Promise<any>, 
  onSubmit: (code: string) => Promise<void>,
  results: TestCaseResult[],
  initialCode: string,
  studentId: string,
  questionId: string
}) {
  const [code, setCode] = useState(initialCode);
  const [customInput, setCustomInput] = useState("");
  const [customOutput, setCustomOutput] = useState("");
  const [showConsole, setShowConsole] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runStatus, setRunStatus] = useState<string>("");
  const [isSaved, setIsSaved] = useState(true);

  // STORAGE KEY: unique per student and question
  const STORAGE_KEY = `draft_${studentId}_${questionId}`;

  // 1. Load from LocalStorage on mount
  useEffect(() => {
    const savedCode = localStorage.getItem(STORAGE_KEY);
    if (savedCode) {
      setCode(savedCode);
    } else {
      setCode(initialCode);
    }
  }, [initialCode, STORAGE_KEY]);

  // 2. Save to LocalStorage on change
  useEffect(() => {
    if (!studentId) return;
    
    const handler = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, code);
        setIsSaved(true);
    }, 1000); // Debounce save every 1s

    setIsSaved(false);
    return () => clearTimeout(handler);
  }, [code, STORAGE_KEY, studentId]);

  // 3. Reset Code Handler
  const handleReset = () => {
    if (confirm("Are you sure? This will delete your current draft and reset to the template.")) {
      localStorage.removeItem(STORAGE_KEY);
      setCode(initialCode);
      window.location.reload(); // Force refresh to clear any stale state if needed
    }
  };

  // We use refs to access latest state inside Monaco callbacks (which close over initial state)
  const codeRef = useRef(code);
  const customInputRef = useRef(customInput);
  
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { customInputRef.current = customInput; }, [customInput]);

  const handleCustomRun = useCallback(async () => {
    setIsRunning(true);
    setRunStatus("Running...");
    setCustomOutput("");
    setShowConsole(true);

    try {
      // Use refs to get latest values
      const currentCode = codeRef.current;
      const currentInput = customInputRef.current;

      const data = await onRun(currentCode, currentInput);
      
      if (data.status === "Compilation Error") {
        setCustomOutput(data.error || "Unknown Error");
        setRunStatus("Compilation Error");
      } else {
        setCustomOutput(data.output || "No Output");
        setRunStatus(`${data.status} (${data.time}s)`);
      }
    } catch (err: any) {
      setCustomOutput("Error: " + err.message);
      setRunStatus("Error");
    } finally {
      setIsRunning(false);
    }
  }, [onRun]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setShowConsole(false);
    try {
      await onSubmit(code);
    } catch (err: any) {
      alert("Execution failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Keyboard Shortcuts (Ctrl+Enter)
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Add Command: Ctrl + Enter (or Cmd + Enter on Mac)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
       handleCustomRun();
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Container */}
      <div className="flex-1 rounded-lg border border-gray-300 overflow-hidden flex flex-col shadow-sm bg-white min-h-[400px]">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700 font-mono">main.py</span>
            <span className="text-[10px] text-gray-400 border px-1.5 rounded">Python 3.8</span>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Auto-save Indicator */}
             <span className="text-[10px] text-gray-400 font-medium transition-colors duration-300">
                {isSaved ? "Saved" : "Saving..."}
             </span>
             
             {/* Reset Button */}
             <button 
                onClick={handleReset}
                className="text-[10px] text-red-500 hover:text-red-700 hover:underline"
             >
                Reset Code
             </button>
          </div>
        </div>
        
        <div className="flex-1 h-full">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            onMount={handleEditorDidMount}
            options={{ 
                minimap: { enabled: false }, 
                fontSize: 14, 
                automaticLayout: true, 
                tabSize: 4,
                scrollBeyondLastLine: false 
            }}
          />
        </div>
      </div>
      
      {/* Console Toggle & Action Bar */}
      <div className="mt-4 flex flex-col gap-4">
        
        {/* Console Section */}
        {showConsole && (
            <div className="bg-gray-900 rounded-lg p-4 text-gray-300 font-mono text-sm border border-gray-700 animate-in slide-in-from-bottom-2">
                <div className="flex gap-4 h-40">
                    <div className="flex-1 flex flex-col">
                        <label className="text-xs font-bold text-gray-500 mb-2 uppercase">Custom Input</label>
                        <textarea 
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            className="flex-1 bg-gray-800 border border-gray-700 p-2 rounded resize-none focus:outline-none focus:border-blue-500"
                            placeholder="Enter input here..."
                        />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Output</label>
                            {runStatus && (
                                <span className={`text-[10px] px-2 py-0.5 rounded ${
                                    runStatus.includes("Error") ? "bg-red-900 text-red-200" : "bg-green-900 text-green-200"
                                }`}>{runStatus}</span>
                            )}
                        </div>
                        <div className="flex-1 bg-black border border-gray-700 p-2 rounded overflow-auto whitespace-pre-wrap">
                            {customOutput}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                <button 
                    onClick={() => setShowConsole(!showConsole)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
                    {showConsole ? "Hide Console" : "Custom Input"}
                </button>
                <span className="text-[10px] text-gray-400 hidden sm:inline-block">
                    Tip: Press <kbd className="font-sans bg-gray-100 px-1 rounded border border-gray-300">Ctrl</kbd> + <kbd className="font-sans bg-gray-100 px-1 rounded border border-gray-300">Enter</kbd> to Run
                </span>
             </div>

             <div className="flex gap-3">
                <button 
                    onClick={handleCustomRun}
                    disabled={isRunning || isSubmitting}
                    className="px-5 py-2.5 rounded-md font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 text-sm transition-all border border-gray-300 disabled:opacity-50"
                    title="Ctrl + Enter"
                >
                    {isRunning ? "Running..." : "Run Code"}
                </button>

                <button 
                    onClick={handleSubmit}
                    disabled={isRunning || isSubmitting}
                    className="px-6 py-2.5 rounded-md font-bold text-white bg-blue-600 hover:bg-blue-700 text-sm transition-all shadow-md flex items-center gap-2 disabled:bg-gray-400"
                >
                    {isSubmitting ? (
                        <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Evaluating...
                        </>
                    ) : "Submit Solution"}
                </button>
             </div>
        </div>
      </div>
      
      {!showConsole && <ResultsDisplay results={results} />}
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function QuestionSolvePage({ params }: { params: { labId: string, questionId: string } }) {
  const [question, setQuestion] = useState<any>(null);
  const [sampleTestCases, setSampleTestCases] = useState<any[]>([]);
  const [submissionResults, setSubmissionResults] = useState<TestCaseResult[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [previousCode, setPreviousCode] = useState(`# Write your solution here (Python 3)\n\nimport sys\n\ndef solve():\n    # Read inputs\n    # line = sys.stdin.readline()\n    pass\n\nif __name__ == "__main__":\n    solve()`);
  const [progressStatus, setProgressStatus] = useState("Not Started");
  const [userId, setUserId] = useState<string>(""); // Added for storage key

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
        
        const { data: q, error: qError } = await supabase
          .from("questions")
          .select("*")
          .eq("id", params.questionId)
          .single();
        if (qError) throw qError;
        setQuestion(q);

        const { data: tc } = await supabase
          .from("test_cases")
          .select("input_file_path, output_file_path")
          .eq("question_id", params.questionId)
          .eq("is_hidden", false) 
          .limit(2);
        setSampleTestCases(tc || []);

        if (user) {
            const { data: prog } = await supabase
                .from("student_progress")
                .select("status")
                .eq("student_id", user.id)
                .eq("question_id", params.questionId)
                .single();
            if (prog) setProgressStatus(prog.status);

            const { data: lastSub } = await supabase
                .from("submissions")
                .select("code")
                .eq("student_id", user.id)
                .eq("question_id", params.questionId)
                .order("submitted_at", { ascending: false })
                .limit(1)
                .single();
            // We set previousCode here, but CodeEditor will prioritize localStorage if it exists
            if (lastSub && lastSub.code) setPreviousCode(lastSub.code);
        }

      } catch (err) {
        console.error("Error fetching problem:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.questionId]);

  const handleRunRequest = async (code: string, input: string) => {
    // Call the /run endpoint
    const response = await fetch('http://localhost:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: "python", code, custom_input: input })
    });

    if (!response.ok) {
        throw new Error("Execution failed");
    }
    return await response.json();
  };

  const handleSubmitRequest = async (code: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("You must be logged in."); return; }

    const response = await fetch('http://localhost:8000/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: user.id,
        question_id: params.questionId,
        language: "python",
        code: code
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Submission failed");
    }

    const result: SubmissionResponse = await response.json();
    setSubmissionResults(result.results);

    const passedCount = result.results.filter(r => r.status === "Passed").length;
    if (passedCount === result.results.length && passedCount > 0) {
        setProgressStatus("Completed");
        router.refresh(); 
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading problem context...</div>;
  if (!question) return <div className="p-8 text-red-500">Problem not found.</div>;

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-white">
      {/* LEFT PANEL */}
      <div className="w-full md:w-5/12 p-6 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="mb-4">
            <Link href={`/problems/${params.labId}`} className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg> Back to Lab
            </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-4">{question.title}</h1>
        {/* <div className="prose prose-sm max-w-none text-gray-700 mb-8"><div className="whitespace-pre-wrap">{question.description}</div></div> */}
        <div className="prose prose-sm max-w-none text-gray-700 mb-8">
          <MarkdownPreview
            source={question.description || ""}
          />
        </div>

        {/* Sample Cases Display */}
        {sampleTestCases.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-xs font-bold text-gray-700 uppercase mb-3">Sample Cases (Hidden)</h3>
                <p className="text-xs text-gray-500 italic">Please rely on problem description logic.</p>
            </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full md:w-7/12 bg-gray-50 p-4 md:p-6 border-l border-gray-200 flex flex-col overflow-y-auto">
        <CodeEditor 
            onRun={handleRunRequest}
            onSubmit={handleSubmitRequest}
            results={submissionResults} 
            initialCode={previousCode}
            studentId={userId}
            questionId={params.questionId}
        />
      </div>
    </div>
  );
}