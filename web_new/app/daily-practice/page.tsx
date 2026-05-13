import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

/**
 * 渲染日常练习页面。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回包含深度解题和深度引导切换能力的日常练习工作区。
 */
export default function DailyPracticePage() {
  return (
    <ChatWorkspace
      initialCapability="deep_solve"
      shellTitle="日常练习"
      showCapabilitySelector
    />
  );
}
