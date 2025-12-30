import { createClient } from "@/utils/supabase/server"; // Server client!
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = createClient();

  // 1. Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. If no user, redirect to login
  if (!user) {
    redirect("/login");
  }

  // 3. If user exists, get their role from the 'profiles' table
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // This case shouldn't happen if signup is successful,
    // but it's good to handle.
    // You could redirect to a "/finish-profile" page if needed.
    console.error("Error fetching profile:", error);
    // You could also sign them out here
    // await supabase.auth.signOut();
    redirect("/login");
  }

  // 4. Redirect based on role
  if (profile.role === "professor") {
    redirect("/admin/upload");
  } else {
    redirect("/problems");
  }

  // This part is never reached, but good practice.
  return (
    <div>
      <p>Loading... redirecting you to your dashboard.</p>
    </div>
  );
}