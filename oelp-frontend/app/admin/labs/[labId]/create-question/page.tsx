"use client";

import dynamic from "next/dynamic";
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });


import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Inline Icon components for zero-dependency usage
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
);
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

export default function CreateQuestionPage({ params }: { params: { labId: string } }) {
  const [loading, setLoading] = useState(false);
  const [testCases, setTestCases] = useState([{ id: 1 }]); 
  const router = useRouter();
  const supabase = createClient();
  const [description, setDescription] = useState(""); 
  const addTestCaseRow = () => {
    setTestCases([...testCases, { id: Date.now() }]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      console.log("Starting upload process...");

      // 1. Insert Question Data
      const { data: question, error: qError } = await supabase
        .from("questions")
        .insert({
          lab_id: params.labId,
          title: formData.get("title"),
          description: formData.get("description"),
          difficulty: formData.get("difficulty"),
          points: formData.get("points"),
        })
        .select()
        .single();

      if (qError) {
        console.error("Question Insert Error:", qError);
        throw new Error("Failed to create question: " + qError.message);
      }
      console.log("Question created:", question.id);

      // 2. Upload Files & Insert Test Cases
      const inputFiles = (formData.getAll("input_files") as File[]);
      const outputFiles = (formData.getAll("output_files") as File[]);
      
      // Use a for-loop instead of map/Promise.all to debug easier and handle sequence
      for (let i = 0; i < testCases.length; i++) {
        const inputFile = inputFiles[i];
        const outputFile = outputFiles[i];

        if (!inputFile || !outputFile || inputFile.size === 0) {
          console.warn(`Skipping row ${i + 1}: Missing files`);
          continue;
        }

        const inputPath = `${params.labId}/${question.id}/case_${i + 1}_in.txt`;
        const outputPath = `${params.labId}/${question.id}/case_${i + 1}_out.txt`;

        console.log(`Uploading files for case ${i + 1}...`);

        // Upload Input
        const { error: upErr1 } = await supabase.storage.from("lab-files").upload(inputPath, inputFile);
        if (upErr1) throw new Error(`Input file upload failed: ${upErr1.message}`);

        // Upload Output
        const { error: upErr2 } = await supabase.storage.from("lab-files").upload(outputPath, outputFile);
        if (upErr2) throw new Error(`Output file upload failed: ${upErr2.message}`);

        // Insert DB Record
        const { error: dbErr } = await supabase.from("test_cases").insert({
          question_id: question.id,
          input_file_path: inputPath,
          output_file_path: outputPath,
          is_hidden: i > 0, // First case is public sample, rest are hidden
          is_public: i === 0
        });

        if (dbErr) throw new Error(`Test Case DB Insert failed: ${dbErr.message}`);
      }

      alert("Question and test cases created successfully!");
      router.push(`/admin/labs/${params.labId}`);
      router.refresh();

    } catch (error: any) {
      console.error("Full Error Object:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Create New Challenge</h1>
          <p className="mt-2 text-sm text-gray-600">
            Define the problem statement and upload test cases for autograding.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Card: Basic Information */}
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Problem Details</h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Title</label>
                <input 
                  name="title" 
                  required 
                  placeholder="e.g. Reverse a Linked List"
                  className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors sm:text-sm" 
                />
              </div>

              <div> <label className="block text-sm font-medium text-gray-700 mb-1">Question Description (Markdown Supported)</label></div>
              <div className="sm:col-span-2">
                <input type="hidden" name="description" value={description || ""} />

                <MDEditor
                  height={300}
                  value={description}
                  onChange={(val) => setDescription(val || "")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select 
                  name="difficulty" 
                  className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors sm:text-sm"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                <input 
                  name="points" 
                  type="number" 
                  defaultValue={10} 
                  className="block w-full rounded-lg border-gray-300 bg-gray-50 border p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors sm:text-sm" 
                />
              </div>
            </div>
          </div>

          {/* Card: Test Cases */}
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Test Cases</h2>
                <p className="text-xs text-gray-500 mt-0.5">Configure input/output file pairs for grading.</p>
              </div>
              <button 
                type="button" 
                onClick={addTestCaseRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                <PlusIcon /> Add Case
              </button>
            </div>

            <div className="p-6 space-y-4">
              {testCases.map((tc, i) => {
                const isPublic = i === 0;
                return (
                  <div 
                    key={tc.id} 
                    className={`relative rounded-lg border ${isPublic ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'} p-4 transition-all hover:shadow-md`}
                  >
                    {/* Badge */}
                    <div className="absolute -top-3 left-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm ${
                        isPublic ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {isPublic ? <><EyeIcon /> Public Sample</> : <><LockIcon /> Hidden Test</>}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Input File */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Input File (.txt)
                        </label>
                        <input 
                          type="file" 
                          name="input_files" 
                          required 
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100 cursor-pointer" 
                        />
                      </div>

                      {/* Output File */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Expected Output (.txt)
                        </label>
                        <input 
                          type="file" 
                          name="output_files" 
                          required 
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-green-50 file:text-green-700
                            hover:file:bg-green-100 cursor-pointer" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Footer hint */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                Row 1 is visible to students.
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400 ml-2"></span>
                Subsequent rows are hidden during grading.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full sm:w-auto"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <UploadIcon /> Uploading...
                </span>
              ) : (
                "Create Challenge"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}