import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MANAGER_KNOWLEDGE_ACCEPT,
  managerKnowledgeFileError,
} from "./features/manager/managerAttachments";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

function file(name: string, type: string, size = 24) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("Manager knowledge file policy", () => {
  it.each([
    ["valuation.pdf", "application/pdf"],
    ["deal-notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["criteria.txt", "text/plain"],
    ["strategy.md", "text/markdown"],
    ["transactions.csv", "text/csv"],
    ["catalog.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["scores.json", "application/json"],
  ])("accepts %s", (name, type) => {
    expect(managerKnowledgeFileError(file(name, type))).toBeNull();
  });

  it.each([
    ["legacy.doc", "application/msword"],
    ["video.mp4", "video/mp4"],
    ["script.exe", "application/vnd.microsoft.portable-executable"],
    ["image.png", "image/png"],
  ])("rejects unsupported %s", (name, type) => {
    expect(managerKnowledgeFileError(file(name, type))).toMatch(/not supported/i);
  });

  it("rejects empty and oversized files before upload", () => {
    expect(managerKnowledgeFileError(file("empty.pdf", "application/pdf", 0))).toMatch(/empty/i);
    expect(managerKnowledgeFileError({ name: "huge.pdf", type: "application/pdf", size: 50 * 1024 * 1024 + 1 })).toMatch(/50 MB/i);
  });

  it("advertises only the formats the server can process", () => {
    expect(MANAGER_KNOWLEDGE_ACCEPT).toContain(".docx");
    expect(MANAGER_KNOWLEDGE_ACCEPT).toContain(".xlsx");
    expect(MANAGER_KNOWLEDGE_ACCEPT).not.toContain(".doc,");
    expect(MANAGER_KNOWLEDGE_ACCEPT).not.toContain("video/");
  });
});

describe("Manager knowledge architecture", () => {
  it("has an additive private upload endpoint with prepare, finalize, and revoke actions", () => {
    const functionPath = join(process.cwd(), "supabase", "functions", "manager-knowledge-upload", "index.ts");
    expect(existsSync(functionPath)).toBe(true);
    const source = readFileSync(functionPath, "utf8");
    expect(source).toContain('action === "prepare"');
    expect(source).toContain('action === "finalize"');
    expect(source).toContain('action === "revoke"');
    expect(source).toContain("assertActiveWorkspaceEntitlement");
    expect(source).toContain("createSignedUploadUrl");
    expect(source).toContain('document_type: "manager_knowledge"');
    expect(source).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const repository = read("src", "services", "productionSupabase.ts");
    expect(repository).toContain('functions.invoke("manager-knowledge-upload"');
    expect(repository).toContain("uploadToSignedUrl");
    expect(repository).toContain('action: "revoke"');
  });

  it("uses explicit attachment kinds without changing a conversation music subject", () => {
    const resolver = read("supabase", "functions", "_shared", "manager-conversation", "attachments.ts");
    expect(resolver).toContain('kind: "music_asset" | "knowledge_document"');
    expect(resolver).toContain('.from("documents")');
    expect(resolver).toContain('.from("document_versions")');
    expect(resolver).toContain("Knowledge documents can be attached to any Manager conversation.");
    expect(resolver).toContain("Song files can only be attached to their canonical song conversation.");
    expect(resolver).not.toContain("Attachments can only be added to a song conversation.");
  });

  it("grounds both Manager endpoints in bounded untrusted attachment content", () => {
    for (const endpoint of ["manager-conversation", "manager-conversation-stream"]) {
      const source = read("supabase", "functions", endpoint, "index.ts");
      expect(source).toContain("attachedKnowledge");
      expect(source).toContain("untrusted evidence");
      expect(source).toContain("source file");
    }
  });
});
