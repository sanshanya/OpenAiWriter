// lib/storage/external-change.ts
/**
 * 占位的“外部变更通知”订阅。
 * 远端/多端同步尚未接入时返回 no-op 解绑函数，
 * 便于未来平滑接入真正的事件源。
 */
type ExternalChangeListener = () => void;

export function onExternalChange(listener: ExternalChangeListener): () => void {
  void listener;
  return () => {};
}
