import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import SubmissionList from "./SubmissionList";

export const revalidate = 0;

export default async function StudentProfilePage({ params }: { params: { studentId: string } }) {
  const supabase = createClient();
  const { studentId } = params;

  // 1. Fetch Student Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, id")
    .eq("id", studentId)
    .single();
  
  // 2. Fetch Labs (We use this for the progress bars AND to look up lab titles now)
  const { data: labs } = await supabase
    .from("lab_sections")
    .select("id, title, questions(id)");
  
  // 3. Fetch Submissions (SIMPLIFIED QUERY)
  // We removed 'lab_sections ( title )' to prevent join errors.
  // We fetch 'lab_id' instead so we can map it manually.
  const { data: submissions, error: subError } = await supabase
    .from("submissions")
    .select(`
      id, status, total_score, submitted_at, language, execution_time, code,
      questions ( id, title, difficulty, points, lab_id )
    `)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });

  // Debugging: Log error if it exists (Check your server terminal)
  if (subError) {
    console.error("Error fetching submissions:", subError.message);
  }

  const studentEmail = profile?.email || "Unknown Student";
  const rawSubs = submissions || [];
  const safeLabs = labs || [];

  // 4. Manually Attach Lab Titles (Reliable JavaScript Join)
  const safeSubs = rawSubs.map((sub: any) => {
    // Find the lab title from the 'safeLabs' array using the question's lab_id
    const lab = safeLabs.find((l: any) => l.id === sub.questions?.lab_id);
    
    // Mutate the structure slightly to match what SubmissionList expects
    return {
      ...sub,
      questions: {
        ...sub.questions,
        lab_sections: {
          title: lab?.title || "Unknown Lab"
        }
      }
    };
  });
  
  // 5. Calculate Stats
  const labProgress = safeLabs.map((lab: any) => {
    const labQIds = lab.questions.map((q: any) => q.id);
    const solvedSet = new Set();
    
    safeSubs.forEach((sub: any) => {
        const status = sub.status ? sub.status.toLowerCase() : "";
        // Check if this submission belongs to one of the questions in this lab
        if (labQIds.includes(sub.questions?.id) && (status === 'completed' || status === 'passed' || status === 'accepted')) {
            solvedSet.add(sub.questions.id);
        }
    });

    const total = labQIds.length;
    const solved = solvedSet.size;
    const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

    return { title: lab.title, solved, total, pct };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/Analytics" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
             &larr; Back to Class Analytics
          </Link>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Student Profile</h1>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                    {studentEmail.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-lg text-gray-700 font-medium">{studentEmail}</p>
                </div>
                <p className="text-xs font-mono text-gray-400 mt-1 ml-10">ID: {studentId}</p>
            </div>
            <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm text-center">
                <div className="text-3xl font-bold text-blue-600">{safeSubs.length}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">Total Submissions</div>
            </div>
          </div>
        </div>

        {/* Error Alert (If Query Failed) */}
        {subError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Database Error:</strong> {subError.message}
          </div>
        )}

        {/* Lab Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {labProgress.map((lab, i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-gray-800 truncate pr-2" title={lab.title}>{lab.title}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded border ${
                    lab.pct === 100 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-600 border-gray-100'
                }`}>
                    {lab.solved}/{lab.total}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ${lab.pct === 100 ? 'bg-green-500' : 'bg-blue-600'}`} 
                    style={{ width: `${lab.pct}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Client Side Table with Code Viewer */}
        <SubmissionList submissions={safeSubs} />

      </div>
    </div>
  );
}