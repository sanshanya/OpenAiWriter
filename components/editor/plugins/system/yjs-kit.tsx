import { YjsPlugin } from '@platejs/yjs/react';

/**
 * Yjs 协作插件配置
 * 
 * YjsPlugin 提供 Yjs 文档绑定功能
 * 实际的 provider 和生命周期由 useYjsEditor 管理
 */
export const YjsKit = [
  YjsPlugin.configure({
    // YjsPlugin 的基础配置
    // provider 将通过 editor.api.yjs.init() 动态设置
  }),
];