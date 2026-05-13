import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

/**
 * 渲染备赛助手页面。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回固定使用 competition_consulting 能力的备赛咨询工作区。
 */
export default function CompetitionAssistantPage() {
  return (
    <ChatWorkspace
      initialCapability="competition_consulting"
      shellTitle="备赛助手"
    />
  );
}
