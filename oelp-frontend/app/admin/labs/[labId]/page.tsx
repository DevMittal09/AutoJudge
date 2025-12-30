"use client";

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmationModal from "@/app/component/ConfirmationModal";

// Icons
const ArrowLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;

export default function LabDetailsPage({ params }: { params: { labId: string } }) {
  const [lab, setLab] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: labData } = await supabase.from("lab_sections").select("*").eq("id", params.labId).single();
    setLab(labData);

    const { data: qData } = await supabase
      .from("questions")
      .select("*, test_cases(count)")
      .eq("lab_id", params.labId)
      .order("created_at");
    
    setQuestions(qData || []);
    setLoading(false);
  };

  const openDeleteModal = (q: any) => {
    setQuestionToDelete(q);
    setIsDeleteOpen(true);
  };

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;
    setDeleteLoading(true);
    
    try {
      // Cascading deletion handles dependencies
      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", questionToDelete.id);

      if (error) throw error;

      setIsDeleteOpen(false);
      fetchData(); // Refresh list
    } catch (err: any) {
      alert("Error deleting question: " + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading details...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <Link href="/admin/upload" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-3 transition-colors">
              <span className="mr-1"><ArrowLeftIcon /></span> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900">{lab?.title}</h1>
            <p className="text-gray-500 mt-1 text-sm">{lab?.description}</p>
          </div>

          <Link 
            href={`/admin/labs/${params.labId}/create-question`}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-all active:scale-95"
          >
            <PlusIcon /> Add Question
          </Link>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <h3 className="text-lg font-medium text-gray-900">No questions yet</h3>
              <p className="text-gray-500 mt-1">Create the first coding challenge for this lab.</p>
            </div>
          ) : (
            questions.map((q, index) => (
              <div key={q.id} className="group bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-500 font-mono text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                      {q.title}
                    </h3>
                    <div className="flex gap-2 mt-1 text-xs">
                      <span className={`px-2 py-0.5 rounded font-medium ring-1 ring-inset ${
                        q.difficulty === 'Hard' ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                        q.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' : 
                        'bg-green-50 text-green-700 ring-green-600/20'
                      }`}>
                        {q.difficulty}
                      </span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                        {q.points} pts
                      </span>
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">
                        {q.test_cases[0].count} Tests
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openDeleteModal(q)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Question"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal 
        isOpen={isDeleteOpen}
        title="Delete Question?"
        message={
          <div className="space-y-2">
            <p className="font-medium text-gray-900">"{questionToDelete?.title}"</p>
            <p>This will permanently remove:</p>
            <ul className="list-disc list-inside ml-2 space-y-1 text-gray-600">
              <li>Question details and requirements</li>
              <li>{questionToDelete?.test_cases[0].count} associated test case files</li>
              <li>All student submission history and scores</li>
            </ul>
          </div>
        }
        onConfirm={handleDeleteQuestion}
        onCancel={() => setIsDeleteOpen(false)}
        isLoading={deleteLoading}
      />
    </div>
  );
}
