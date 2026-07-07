const scheduleDashboardRoot = ["schedule", "dashboard"] as const;
const profileRoot = ["profile"] as const;

export const queryKeys = {
  auth: {
    user: ["auth", "user"] as const,
  },
  profile: {
    root: profileRoot,
    current: (userId: string) => ["profile", userId] as const,
    overview: (userId: string) => ["profile", userId, "overview"] as const,
    memberships: (userId: string) =>
      ["profile", userId, "memberships"] as const,
  },
  clubs: {
    all: ["clubs"] as const,
    detail: (clubId: string) => ["clubs", clubId] as const,
    members: (clubId: string) => ["clubs", clubId, "members"] as const,
    invites: (clubId: string) => ["clubs", clubId, "invites"] as const,
  },
  schedule: {
    dashboardRoot: scheduleDashboardRoot,
    dashboard: (weekStart: string) => [...scheduleDashboardRoot, weekStart] as const,
    list: (clubId: string) => ["schedule", clubId] as const,
    detail: (clubId: string, scheduleId: string) =>
      ["schedule", clubId, "detail", scheduleId] as const,
    detailById: (scheduleId: string) =>
      ["schedule", "detail", scheduleId] as const,
    progress: (clubId: string) => ["schedule", clubId, "progress"] as const,
  },
  comments: {
    list: (scheduleId: string) => ["comments", scheduleId] as const,
  },
  annotations: {
    list: (scheduleId: string, paperId: string) =>
      ["annotations", scheduleId, paperId] as const,
  },
} as const;
