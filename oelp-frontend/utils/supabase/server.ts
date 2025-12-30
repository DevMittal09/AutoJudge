import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// This file is for Server Components
export const createClient = () => {
  // We pass the 'cookies' function reference from 'next/headers' directly.
  // The Supabase helper will call it as needed.
  return createServerComponentClient({
    cookies: cookies,
  });
};

