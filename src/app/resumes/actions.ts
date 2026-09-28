"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addResume,
  RESUME_ROLE_LANES,
  type ResumeRoleLane,
} from "@/application/resumes";
import { LocalResumeStore } from "@/infrastructure/resumes/local-store";
import { resolveManualOutreachDatabaseSelection } from "@/infrastructure/sqlite/manual-outreach-operator";
import {openRuntimeRepository} from "@/infrastructure/sqlite/runtime";

function repository() {
  return openRuntimeRepository(resolveManualOutreachDatabaseSelection().path);
}
function lane(value: FormDataEntryValue | null): ResumeRoleLane | null {
  const text = String(value ?? "");
  if (!text) return null;
  if (!RESUME_ROLE_LANES.includes(text as ResumeRoleLane))
    throw new Error("resume-role-lane-invalid");
  return text as ResumeRoleLane;
}
export async function uploadResume(formData: FormData) {
  const file = formData.get("resume");
  if (!(file instanceof File)) throw new Error("resume-file-required");
  const repo = repository();
  try {
    addResume({
      repository: repo,
      store: (key, bytes) => new LocalResumeStore().store(key, bytes),
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      displayLabel: String(formData.get("displayLabel") ?? ""),
      roleLane: lane(formData.get("roleLane")),
      now: () => new Date(),
    });
  } finally {
    repo.close();
  }
  revalidatePath("/resumes");
  redirect("/resumes?status=uploaded");
}
export async function updateResume(formData: FormData) {
  const repo = repository();
  try {
    const displayLabel = String(formData.get("displayLabel") ?? "").trim();
    if (!displayLabel || displayLabel.length > 80)
      throw new Error("resume-label-invalid");
    repo.updateResumeMetadata(String(formData.get("id") ?? ""), {
      displayLabel,
      roleLane: lane(formData.get("roleLane")),
    });
  } finally {
    repo.close();
  }
  revalidatePath("/resumes");
}
export async function deactivateResume(formData: FormData) {
  const repo = repository();
  try {
    repo.deactivateResume(String(formData.get("id") ?? ""));
  } finally {
    repo.close();
  }
  revalidatePath("/resumes");
}
export async function setRecruiterDefaultResume(formData: FormData) {
  const repo = repository();
  try {
    repo.setRecruiterDefaultResumeId(String(formData.get("id") ?? ""));
  } finally {
    repo.close();
  }
  revalidatePath("/resumes");
  revalidatePath("/drafts");
}
export async function clearRecruiterDefaultResume() {
  const repo = repository();
  try {
    repo.clearRecruiterDefaultResumeId();
  } finally {
    repo.close();
  }
  revalidatePath("/resumes");
  revalidatePath("/drafts");
}
