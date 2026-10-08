"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@zhipanda/api-client";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";

type Staff = components["schemas"]["StaffAccountSummaryDto"];
type StaffDetail = components["schemas"]["StaffAccountDetailDto"];
type Role = components["schemas"]["StaffRoleCatalogDto"];
type Assignment = components["schemas"]["StaffAssignmentDto"];
type Change = { kind: "grant"; roleKey: string; idempotencyKey: string } | { kind: "revoke"; roleKey: string; assignmentId: string; idempotencyKey: string };

const roleNames: Record<string, string> = {
  administrator: "管理员",
  archive_editor: "档案编辑",
  audit_exporter: "审计导出员",
  audit_reader: "审计查看员",
  contributor: "资料贡献者",
  editorial_publisher: "动态发布员",
  import_operator: "数据导入员",
  member: "普通成员",
  moderator: "社区审核员",
  privacy_operator: "隐私事务专员",
  reviewer: "审核员",
  senior_archive_editor: "资深档案编辑（终审）",
};

function roleName(value: string) { return roleNames[value] ?? value; }

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const code = body.code as string | undefined;
    const message = code === "auth.recentAuthRequired" ? "最近认证已过期，请重新登录并完成双重验证。"
      : code === "auth.aalRequired" ? "请先在账号安全中完成双重验证。"
        : code === "auth.liveSessionRequired" || response.status === 401 ? "当前会话已失效，请重新登录。"
        : code === "identity.dutiesConflict" ? "审核和最终审批必须由不同岗位承担，不能同时授权。"
          : code === "identity.selfGrantForbidden" ? "不能变更自己的角色。"
            : response.status === 409 ? "角色状态已变化，请刷新并检查当前授权。"
              : response.status === 403 ? "当前账号不具备该操作的管理权限。"
                : body.detail ?? "请求失败，请稍后重试。";
    throw new Error(message);
  }
  return body as T;
}

async function getStaff<T>(path: string): Promise<T> {
  return responseJson<T>(await fetch(`/api/admin/staff/accounts${path}`, { cache: "no-store" }));
}

export function StaffRoleManagement() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const manager = session?.capabilities.includes("identity.role.manage") ?? false;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [selectedRole, setSelectedRole] = useState("reviewer");
  const [planned, setPlanned] = useState<Change | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const directory = useQuery({ queryKey: ["admin", "staff", "accounts", "directory"], queryFn: () => getStaff<Staff[]>(""), enabled: manager });
  const catalog = useQuery({ queryKey: ["admin", "staff", "accounts", "catalog"], queryFn: () => getStaff<Role[]>("/catalog"), enabled: manager });
  const detail = useQuery({ queryKey: ["admin", "staff", "accounts", "detail", selectedId], queryFn: () => getStaff<StaffDetail>(`/${selectedId}`), enabled: manager && Boolean(selectedId) });

  const change = useMutation({
    mutationFn: async ({ action, reason: explanation }: { action: Change; reason: string }) => {
      const url = action.kind === "grant"
        ? `/api/admin/staff/accounts/${selectedId}/roles`
        : `/api/admin/staff/accounts/${selectedId}/roles/${action.assignmentId}/revoke`;
      return responseJson(await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(action.kind === "grant" ? { roleKey: action.roleKey } : {}),
          reason: explanation,
          idempotencyKey: action.idempotencyKey,
        }),
      }));
    },
    onSuccess: async () => {
      setMessage(planned?.kind === "grant" ? "角色已授予" : "角色已撤销");
      setPlanned(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "staff", "accounts"] });
    },
  });

  if (!manager) return null;

  function selectAccount(accountId: string) {
    setSelectedId(accountId);
    setPlanned(null);
    setReason("");
    setMessage("");
  }

  const isOwnAccount = selectedId === session?.accountId;
  const grantedRoles = detail.data?.assignments.filter((assignment: Assignment) => assignment.status === "active") ?? [];
  const canRevoke = (assignment: Assignment) => !isOwnAccount && catalog.data?.some((role) => role.roleKey === assignment.roleKey);
  const candidateRole = catalog.data?.some((role) => role.roleKey === selectedRole) ? selectedRole : (catalog.data?.[0]?.roleKey ?? "");

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-5 py-8 md:px-8 md:py-10">
      <header className="space-y-3">
        <p className="text-xs font-bold tracking-widest text-teal-700">PANDAATLAS · 身份与岗位治理</p>
        <h1 className="text-3xl font-bold text-slate-950">工作人员权限管理</h1>
        <p className="text-sm leading-6 text-slate-600">角色在数据库中独立授权。每次授予或撤销均要求明确原因、最近登录和双重验证，并留下不可修改的审计记录。</p>
        <Link className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-slate-50" href="/admin/staff/invitations">返回审核员邀请</Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <section aria-label="工作人员目录" className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">工作人员目录</h2>
          {directory.isPending && <p className="mt-4 text-sm text-slate-500">正在加载工作人员…</p>}
          {directory.error && <p role="alert" className="mt-4 text-sm text-rose-700">{directory.error.message}</p>}
          {directory.data?.length === 0 && <p className="mt-4 text-sm text-slate-600">尚无工作人员。</p>}
          <div className="mt-4 space-y-2">
            {directory.data?.map((staff) => (
              <button key={staff.accountId} type="button" onClick={() => selectAccount(staff.accountId)}
                aria-pressed={selectedId === staff.accountId}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === staff.accountId ? "border-teal-700 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <span className="block break-all text-sm font-semibold text-slate-900">{staff.email ?? staff.accountId.slice(0, 8)}</span>
                <span className="mt-1 block text-xs text-slate-600">{staff.roles.map(roleName).join("、") || "等待授权"}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-label="工作人员角色详情" className="space-y-6">
          {!selectedId && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">从左侧选择工作人员，查看岗位角色、有效权限和授权历史。</p>}
          {selectedId && detail.isPending && <p className="text-sm text-slate-600">正在加载角色详情…</p>}
          {selectedId && detail.error && <p role="alert" className="text-sm text-rose-700">{detail.error.message}</p>}
          {detail.data && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-bold text-slate-950">{detail.data.email ?? detail.data.accountId}</h2>
                <p className="mt-1 text-xs text-slate-500">账号状态：{detail.data.state === "active" ? "正常" : "非活动"} · {detail.data.accountId}</p>
                <h3 className="mt-6 text-sm font-bold text-slate-900">当前角色</h3>
                <div className="mt-3 space-y-2">
                  {grantedRoles.length === 0 && <p className="text-sm text-slate-500">暂无有效角色。</p>}
                  {grantedRoles.map((assignment: Assignment) => (
                    <div key={assignment.assignmentId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-900">{roleName(assignment.roleKey)}</span>
                      {canRevoke(assignment) && <Button size="sm" variant="outline" onClick={() => { setPlanned({ kind: "revoke", roleKey: assignment.roleKey, assignmentId: assignment.assignmentId, idempotencyKey: crypto.randomUUID() }); setReason(""); setMessage(""); }}>撤销 {roleName(assignment.roleKey)}</Button>}
                    </div>
                  ))}
                </div>
                <h3 className="mt-6 text-sm font-bold text-slate-900">当前权限</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.data.capabilities.length === 0 && <span className="text-sm text-slate-500">暂无有效权限。</span>}
                  {detail.data.capabilities.map((capability) => <span key={capability} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{capability}</span>)}
                </div>
              </div>

              {!isOwnAccount && detail.data.state === "active" && (
                <section aria-label="新增岗位授权" className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="text-base font-bold text-slate-950">新增岗位授权</h3>
                  <label htmlFor="staff-role-choice" className="mt-4 block text-sm font-semibold text-slate-900">选择岗位</label>
                  <select id="staff-role-choice" value={candidateRole} onChange={(event) => setSelectedRole(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-teal-600">
                    {catalog.data?.map((role) => <option key={role.roleKey} value={role.roleKey}>{roleName(role.roleKey)}</option>)}
                  </select>
                  <Button className="mt-4" disabled={!candidateRole || grantedRoles.some((assignment) => assignment.roleKey === candidateRole)} onClick={() => {
                    setPlanned({ kind: "grant", roleKey: candidateRole, idempotencyKey: crypto.randomUUID() }); setReason(""); setMessage("");
                  }}>准备授予</Button>
                </section>
              )}

              {planned && (
                <section aria-label="确认角色变更" className="rounded-xl border border-amber-300 bg-amber-50 p-6">
                  <h3 className="font-bold text-slate-950">确认{planned.kind === "grant" ? "授予" : "撤销"}{roleName(planned.roleKey)}</h3>
                  <p className="mt-2 break-all text-sm text-slate-700">操作账号：{detail.data.email ?? detail.data.accountId}。变更将立即影响受保护 API 的访问权限。</p>
                  <label htmlFor="staff-role-reason" className="mt-4 block text-sm font-semibold text-slate-900">变更原因</label>
                  <Input id="staff-role-reason" className="mt-2 bg-white" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="填写经过核实的岗位变更原因" />
                  {change.error && <p role="alert" className="mt-3 text-sm text-rose-700">{change.error.message}</p>}
                  <div className="mt-4 flex gap-3">
                    <Button disabled={reason.trim().length < 4 || change.isPending} onClick={() => change.mutate({ action: planned, reason: reason.trim() })}>
                      {change.isPending ? "正在提交…" : planned.kind === "grant" ? "确认授予" : "确认撤销"}
                    </Button>
                    <Button variant="outline" onClick={() => { setPlanned(null); setReason(""); }}>取消</Button>
                  </div>
                </section>
              )}
              {message && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">{message}</p>}

              <section aria-label="角色授权历史" className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-950">角色授权历史</h3>
                {detail.data.assignments.length === 0 && <p className="mt-3 text-sm text-slate-500">暂无授权记录。</p>}
                <ol className="mt-4 divide-y divide-slate-200">
                  {detail.data.assignments.map((assignment: Assignment) => (
                    <li key={assignment.assignmentId} className="py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-slate-950">{roleName(assignment.roleKey)}</strong>
                        <span>{assignment.status === "revoked" ? "已撤销" : assignment.status === "expired" ? "已过期" : "有效"}</span>
                      </div>
                      <p className="mt-1">授权原因：{assignment.reason}</p>
                      <p className="text-xs text-slate-500">授权时间：{new Date(assignment.assignedAt).toLocaleString("zh-CN")} · 操作账号：{assignment.assignedBy?.slice(0, 8) ?? "系统"}</p>
                      {assignment.revocationReason && <p className="mt-1">撤销原因：{assignment.revocationReason} · 操作账号：{assignment.revokedBy?.slice(0, 8) ?? "系统"}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
