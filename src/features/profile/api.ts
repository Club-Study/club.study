import { apiRequest } from "@/lib/api/client";

export type Profile = {
  id: string;
  display_name: string;
  avatar_id: string;
  avatar_color: string;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileMembership = {
  club_id: string;
  created_at: string;
  role: "owner" | "member";
  clubs: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
};

export type ProfileScheduledPaper = {
  id: string;
  club_id: string;
  paper_id: string;
  week_start: string;
  clubs: {
    id: string;
    name: string;
    slug: string;
  };
  papers: {
    id: string;
    arxiv_id: string | null;
    authors: string[];
    external_url: string | null;
    pdf_url: string | null;
    published_at: string | null;
    source_type: "arxiv" | "manual";
    title: string;
  };
};

export type ProfileReadingLog = {
  id: string;
  read_at: string;
  schedule_id: string;
  club_paper_schedule: ProfileScheduledPaper;
};

export type ProfileOverview = {
  memberships: ProfileMembership[];
  readingLogs: ProfileReadingLog[];
  scheduledPapers: ProfileScheduledPaper[];
};

export async function getProfile() {
  return apiRequest<Profile>("api/profile/");
}

export async function updateProfile(
  values: Pick<Profile, "display_name" | "avatar_id" | "avatar_color" | "bio">,
) {
  return apiRequest<Profile>("api/profile/", {
    method: "PATCH",
    body: values,
  });
}

export async function getProfileOverview(): Promise<ProfileOverview> {
  return apiRequest<ProfileOverview>("api/profile/overview/");
}
