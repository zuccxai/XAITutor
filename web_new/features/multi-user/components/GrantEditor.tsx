"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { fetchAdminResources, fetchUserGrant, saveUserGrant } from "@/features/multi-user/api";
import type { GrantPayload, MultiUserResources } from "@/features/multi-user/types";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * 构建空授权对象。
 *
 * 输入：
 *   userId: 用户 ID。
 * 输出：返回该用户的空授权配置。
 */
function emptyGrant(userId: string): GrantPayload {
  return {
    version: 1,
    user_id: userId,
    models: { llm: [], embedding: [], search: [] },
    knowledge_bases: [],
    skills: [],
    spaces: []
  };
}

/**
 * 判断模型是否已授权。
 *
 * 输入：
 *   grant: 当前授权配置。
 *   service: 模型服务类型。
 *   profileId: 模型 profile ID。
 *   modelId: 可选模型 ID。
 * 输出：返回该模型是否已被授权。
 */
function hasModel(
  grant: GrantPayload,
  service: "llm" | "embedding" | "search",
  profileId: string,
  modelId?: string
): boolean {
  return grant.models[service].some((item) => {
    if (item.profile_id !== profileId) return false;
    if (!modelId) return true;
    return Array.isArray(item.model_ids) && item.model_ids.includes(modelId);
  });
}

/**
 * 生成授权配置指纹。
 *
 * 输入：
 *   grant: 授权配置。
 * 输出：返回可用于脏状态比较的字符串。
 */
function grantFingerprint(grant: GrantPayload): string {
  return JSON.stringify(grant);
}

/**
 * 渲染普通用户资源授权编辑器。
 *
 * 输入：
 *   userId: 要编辑授权的用户 ID。
 * 输出：返回模型、知识库、技能授权编辑面板。
 */
export function GrantEditor({ userId }: { userId: string }) {
  const [resources, setResources] = useState<MultiUserResources | null>(null);
  const [grant, setGrant] = useState<GrantPayload>(() => emptyGrant(userId));
  const [loading, setLoading] = useState(true);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSaveState("idle");
    setMessage("");
    Promise.all([fetchAdminResources(), fetchUserGrant(userId)])
      .then(([nextResources, nextGrant]) => {
        if (cancelled) return;
        setResources(nextResources);
        setGrant(nextGrant);
        setSavedFingerprint(grantFingerprint(nextGrant));
      })
      .catch((error) => {
        setSaveState("error");
        setMessage(error instanceof Error ? error.message : "加载授权失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const currentFingerprint = useMemo(() => grantFingerprint(grant), [grant]);
  const dirty = Boolean(savedFingerprint) && currentFingerprint !== savedFingerprint;
  const kbIds = useMemo(
    () => new Set(grant.knowledge_bases.map((item) => String(item.resource_id || item.id || ""))),
    [grant.knowledge_bases]
  );
  const skillIds = useMemo(
    () => new Set(grant.skills.map((item) => String(item.skill_id || item.id || ""))),
    [grant.skills]
  );
  const saving = saveState === "saving";
  const controlsDisabled = loading || saving;

  /**
   * 切换模型授权。
   *
   * 输入：
   *   service: 模型服务类型。
   *   profileId: 模型 profile ID。
   *   modelId: 可选模型 ID。
   * 输出：无；更新本地授权状态。
   */
  function toggleModel(
    service: "llm" | "embedding" | "search",
    profileId: string,
    modelId?: string
  ) {
    setGrant((current) => {
      const next = structuredClone(current) as GrantPayload;
      const items = next.models[service];
      if (service === "search" || !modelId) {
        next.models[service] = hasModel(next, service, profileId)
          ? items.filter((item) => item.profile_id !== profileId)
          : [...items, { profile_id: profileId, source: "admin" }];
        return next;
      }
      const existing = items.find((item) => item.profile_id === profileId);
      if (!existing) {
        items.push({ profile_id: profileId, model_ids: [modelId], source: "admin" });
        return next;
      }
      const modelIds = new Set(Array.isArray(existing.model_ids) ? existing.model_ids : []);
      if (modelIds.has(modelId)) modelIds.delete(modelId);
      else modelIds.add(modelId);
      existing.model_ids = Array.from(modelIds);
      next.models[service] = items.filter((item) =>
        Array.isArray(item.model_ids) ? item.model_ids.length > 0 : true
      );
      return next;
    });
  }

  /**
   * 切换知识库授权。
   *
   * 输入：
   *   resourceId: 知识库资源 ID。
   *   name: 知识库名称。
   * 输出：无；更新本地授权状态。
   */
  function toggleKb(resourceId: string, name: string) {
    setGrant((current) => {
      const next = structuredClone(current) as GrantPayload;
      const exists = kbIds.has(resourceId);
      next.knowledge_bases = exists
        ? next.knowledge_bases.filter((item) => String(item.resource_id || item.id || "") !== resourceId)
        : [...next.knowledge_bases, { resource_id: resourceId, name, access: "read", source: "admin" }];
      return next;
    });
  }

  /**
   * 切换技能授权。
   *
   * 输入：
   *   name: 技能名称。
   * 输出：无；更新本地授权状态。
   */
  function toggleSkill(name: string) {
    setGrant((current) => {
      const next = structuredClone(current) as GrantPayload;
      const exists = skillIds.has(name);
      next.skills = exists
        ? next.skills.filter((item) => String(item.skill_id || item.id || "") !== name)
        : [...next.skills, { skill_id: name, access: "use", source: "admin" }];
      return next;
    });
  }

  /**
   * 保存当前授权配置。
   *
   * 输入：无。
   * 输出：无；通过后端保存授权并更新保存状态。
   */
  async function save() {
    setSaveState("saving");
    setMessage("");
    try {
      const saved = await saveUserGrant(userId, grant);
      setGrant(saved);
      setSavedFingerprint(grantFingerprint(saved));
      setSaveState("saved");
      setMessage("已保存");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  const status = loading
    ? "正在加载授权..."
    : saveState === "saving"
      ? "正在保存..."
      : saveState === "error"
        ? message || "保存失败"
        : saveState === "saved" && !dirty
          ? message || "已保存"
          : dirty
            ? "有未保存修改"
            : "已就绪";

  if (loading && !resources) {
    return (
      <div className="border-t border-borderline bg-slate-50 p-4">
        <div className="flex h-48 items-center justify-center rounded-md border border-borderline bg-white text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载授权...
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-borderline bg-slate-50 p-4">
      <div className="rounded-md border border-borderline bg-white shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-borderline px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">资源授权</h2>
            <p className="mt-1 text-xs text-muted">分配模型、知识库和技能，密钥仍只保存在管理员侧。</p>
          </div>
          <div className="flex gap-1.5">
            <Badge tone="info">{grant.models.llm.length} 组模型</Badge>
            <Badge tone="neutral">{kbIds.size} 个知识库</Badge>
            <Badge tone="neutral">{skillIds.size} 个技能</Badge>
          </div>
        </div>

        <div className="grid max-h-[520px] gap-4 overflow-y-auto p-4 md:grid-cols-3">
          <section className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">模型</h3>
            <div className="space-y-3 text-xs">
              {(["llm", "embedding"] as const).map((service) => (
                <div key={service} className="space-y-1.5">
                  <div className="font-medium text-ink">{service.toUpperCase()}</div>
                  {(resources?.models[service] || []).map((profile) => (
                    <div key={profile.profile_id} className="rounded-md border border-borderline p-2">
                      <div className="mb-1 truncate text-muted">{profile.name}</div>
                      {(profile.models || []).map((model) => (
                        <label key={model.model_id} className="flex cursor-pointer items-center gap-2 py-1 text-ink">
                          <input
                            type="checkbox"
                            checked={hasModel(grant, service, profile.profile_id, model.model_id)}
                            disabled={controlsDisabled}
                            onChange={() => toggleModel(service, profile.profile_id, model.model_id)}
                          />
                          <span className="truncate">{model.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              <div className="space-y-1.5">
                <div className="font-medium text-ink">SEARCH</div>
                {(resources?.models.search || []).map((profile) => (
                  <label
                    key={profile.profile_id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-borderline p-2 text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={hasModel(grant, "search", profile.profile_id)}
                      disabled={controlsDisabled}
                      onChange={() => toggleModel("search", profile.profile_id)}
                    />
                    <span className="truncate">{profile.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">知识库</h3>
            <div className="space-y-1.5 text-xs">
              {(resources?.knowledge_bases || []).map((kb) => (
                <label
                  key={kb.resource_id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-borderline p-2 text-ink"
                >
                  <input
                    type="checkbox"
                    checked={kbIds.has(kb.resource_id)}
                    disabled={controlsDisabled}
                    onChange={() => toggleKb(kb.resource_id, kb.name)}
                  />
                  <span className="truncate">{kb.name}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">技能</h3>
            <div className="space-y-1.5 text-xs">
              {(resources?.skills || []).map((skill) => (
                <label
                  key={skill.name}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-borderline p-2 text-ink"
                >
                  <input
                    type="checkbox"
                    checked={skillIds.has(skill.name)}
                    disabled={controlsDisabled}
                    onChange={() => toggleSkill(skill.name)}
                  />
                  <span className="truncate">{skill.name}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-borderline px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted" aria-live="polite">
            {saveState === "error" ? <AlertCircle size={14} className="text-danger" /> : null}
            {saveState === "saved" && !dirty ? <CheckCircle2 size={14} className="text-emerald-600" /> : null}
            <span className="truncate">{status}</span>
          </div>
          <Button onClick={() => void save()} disabled={controlsDisabled || !dirty} variant="primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存授权
          </Button>
        </div>
      </div>
    </div>
  );
}
