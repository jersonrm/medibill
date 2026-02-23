"use server";

import { createClient } from "../../lib/supabase-server";
import { redirect } from "next/navigation";

export async function iniciarSesion(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    
    return redirect(`/login?mensaje=${error.message}`);
  }
  
  return redirect("/");
}

export async function registrarCuenta(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return redirect(`/login?mensaje=${error.message}`);
  }

  return redirect("/");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/login");
}