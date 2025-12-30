import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

// 🚨 Force refresh here too
export const revalidate = 0;

export default async function LabDetailPage({ params }: { params: { labId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: lab } = await supabase
    .from("lab_sections")
    .select("*")
    .eq("id", params.labId)
    .single();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("lab_id", params.labId)
    .order("created_at", { ascending: true });

  const { data: progress } = await supabase
    .from("student_progress")
    .select("question_id, status")
    .eq("student_id", user?.id);

  // const getStatus = (qId: string) => {
  //   return progress?.find(p => p.question_id === qId)?.status || "Not Started";
  // };
  const getStatus = (qId: string) => {
    // Filter all records for this question
    const records = progress?.filter(p => p.question_id === qId) || [];
    
    // If ANY record says "Completed", treat it as completed
    if (records.some(p => p.status === "Completed")) return "Completed";
    
    // Otherwise return the status of the first record, or "Not Started"
    return records[0]?.status || "Not Started";
  };

  const statusColors = {
    "Not Started": "bg-gray-100 text-gray-600",
    "In Progress": "bg-yellow-100 text-yellow-800",
    "Completed": "bg-green-100 text-green-800"
  };

  return (
    <>
    <div className="bg-black min-h-screen">
    <div className="max-w-4xl mx-auto p-8">
      <Link href="/problems" className="text-sm text-gray-500 hover:underline mb-4 block">&larr; Back to Labs</Link>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{lab?.title}</h1>
        <p className="text-gray-400 mt-2">{lab?.description}</p>
      </div>

      <div className="space-y-4">
        {questions?.map((q, index) => {
          const status = getStatus(q.id) as keyof typeof statusColors;
          const isCompleted = status === "Completed";

          return (
            <div key={q.id} className={`flex items-center justify-between p-5 border rounded-lg transition ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-purple-300'}`}>
              <div className="flex items-center gap-4">
                <span className={`font-mono text-lg font-bold ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>#{index + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{q.title}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      q.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : 
                      q.difficulty === 'Medium' ? 'bg-orange-100 text-orange-700' : 
                      'bg-green-100 text-green-700'
                    }`}>
                      {q.difficulty}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {q.points} pts
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[status]}`}>
                  {status}
                </span>
                <Link 
                  href={`/problems/${params.labId}/${q.id}`}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    isCompleted 
                    ? "bg-white border border-green-500 text-green-700 hover:bg-green-50" 
                    : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                >
                  {isCompleted ? "Review Solution" : "Solve Challenge"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
    </>
  );
}