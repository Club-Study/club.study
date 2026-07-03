import { apiRequest } from "@/lib/api/client";
import type { ArxivMetadata, Paper, PaperStatus } from "@/features/schedule/api";

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
  week_start: string | null;
  status: PaperStatus;
  created_at: string;
  clubs: {
    id: string;
    name: string;
    slug: string;
  };
  papers: {
    id: string;
    abstract_url: string | null;
    arxiv_id: string | null;
    authors: string[];
    external_url: string | null;
    pdf_url: string | null;
    page_count: number | null;
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

export type ProfileReadingSession = {
  id: string;
  schedule_id: string | null;
  personal_paper_id: string | null;
  pages_read: number;
  logged_at: string;
};

export type ProfilePersonalPaper = {
  id: string;
  paper_id: string;
  read_at: string | null;
  deadline: string | null;
  status: PaperStatus;
  created_at: string;
  papers: Paper;
};

export type ProfileOverview = {
  memberships: ProfileMembership[];
  readingLogs: ProfileReadingLog[];
  scheduledPapers: ProfileScheduledPaper[];
  personalPapers: ProfilePersonalPaper[];
  readingSessions: ProfileReadingSession[];
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

export async function addPersonalArxivPaper(
  metadata: ArxivMetadata,
  deadline: string | null,
) {
  return apiRequest<ProfilePersonalPaper>("api/papers/personal/arxiv/", {
    method: "POST",
    body: { metadata, deadline },
  });
}

export async function addPersonalManualPaper(
  metadata: {
    title: string;
    authors: string[];
    abstract: string | null;
    doi: string | null;
    license: string | null;
    external_url: string;
  },
  deadline: string | null,
) {
  return apiRequest<ProfilePersonalPaper>("api/papers/personal/manual/", {
    method: "POST",
    body: { metadata, deadline },
  });
}

export async function togglePersonalPaperReadStatus(
  personalPaperId: string,
  read: boolean,
) {
  return apiRequest<ProfilePersonalPaper>(
    `api/personal-papers/${personalPaperId}/read-status/`,
    {
      method: "POST",
      body: { read },
    },
  );
}

export async function setPersonalPaperStatus(
  personalPaperId: string,
  status: PaperStatus,
) {
  return apiRequest<ProfilePersonalPaper>(
    `api/personal-papers/${personalPaperId}/status/`,
    {
      method: "POST",
      body: { status },
    },
  );
}

export async function logPersonalPaperReadingSession(
  personalPaperId: string,
  pagesRead: number,
) {
  return apiRequest<ProfileReadingSession>(
    `api/personal-papers/${personalPaperId}/reading-sessions/`,
    {
      method: "POST",
      body: { pages_read: pagesRead },
    },
  );
}
