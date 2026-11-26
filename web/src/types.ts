/**
 * API 数据结构（与后端 domain/types.ts 保持一致）
 */

/** 标签（全局共用标签池中的一项） */
export interface Tag {
  id: string;
  name: string;
}

/** 人员（含汇报关系与标签） */
export interface Employee {
  id: string;
  name: string;
  position: string;
  /** 直接上级 id；null 表示无上级 */
  managerId: string | null;
  /** 直接上级姓名；null 表示无上级 */
  managerName: string | null;
  tags: Tag[];
}
