export type WalkthroughStatus = "in_progress" | "verified" | "shared";

export type Trade =
  "Plumbing" | "Electrical" | "Paint/Finish" | "Carpentry" | "HVAC" | "General";

export type Priority = "High" | "Medium" | "Low";

export type ItemStatus = "Open" | "Done";

export interface Walkthrough {
  id: string;
  title: string;
  bannerColor?: string;
  bannerPhotoUri?: string;
  clientName?: string;
  address?: string;
  createdAt: number;
  updatedAt: number;
  executiveSummary?: string;
  status: WalkthroughStatus;
}

export interface PunchItem {
  id: string;
  walkthroughId: string;
  bannerColor?: string;
  bannerPhotoUri?: string;
  rawTranscript: string;
  location: string;
  trade: Trade;
  issueSummary: string;
  priority: Priority;
  status: ItemStatus;
  missingInfoHint?: string | null;
  onDeviceMeta?: {
    modelLabel: string;
    latencyMs: number;
    ranOffline: boolean;
  };
  photos: { localUri: string; remoteUrl?: string }[];
  cloudVerification?: {
    visualVerification: string;
    recommendedAction: string;
    materialsNeeded: string[];
    clientReadyDescription: string;
    latencyMs: number;
    verifiedAt: number;
  };
  createdAt: number;
  updatedAt: number;
}
