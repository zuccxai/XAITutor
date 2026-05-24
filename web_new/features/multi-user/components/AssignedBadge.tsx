import { Badge } from "@/components/ui/Badge";

/**
 * 渲染管理员分配资源标记。
 *
 * 输入：
 *   label: 可选展示文案。
 * 输出：返回紧凑的授权标记。
 */
export function AssignedBadge({ label = "管理员分配" }: { label?: string }) {
  return <Badge tone="success">{label}</Badge>;
}
