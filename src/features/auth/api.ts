import { apiRequest } from "@/lib/api/client";

export type CurrentUser = {
  id: string;
  email: string;
};

export async function getCurrentUser() {
  const data = await apiRequest<{ user: CurrentUser | null }>("api/auth/me/");
  return data.user;
}

export async function signInWithEmail(values: {
  email: string;
  displayName: string;
}) {
  const data = await apiRequest<{ user: CurrentUser }>("api/auth/sign-in/", {
    method: "POST",
    body: {
      email: values.email,
      display_name: values.displayName,
    },
  });

  return data.user;
}

export async function signOut() {
  await apiRequest<void>("api/auth/sign-out/", { method: "POST" });
}
