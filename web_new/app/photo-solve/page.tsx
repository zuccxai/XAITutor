import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

/**
 * 渲染拍照解题页面。
 *
 * 输入：
 *   无。
 * 输出：
 *   返回固定使用 photo_solve 能力的图片解题工作区。
 */
export default function PhotoSolvePage() {
  return <ChatWorkspace initialCapability="photo_solve" shellTitle="拍照解题" />;
}
