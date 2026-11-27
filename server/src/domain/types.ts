/**
 * 领域模型（前后端共享的 API 数据结构）。
 */

/** 标签（全局共用标签池中的一项） */
export interface Tag {
  id: string;
  name: string;
}

/** 标签池中的一项，附带被多少人员使用（标签管理列表用） */
export interface TagWithUsage extends Tag {
  usageCount: number;
}

/** 人员（含汇报关系与标签，用于列表展示） */
export interface Employee {
  id: string;
  name: string;
  position: string;
  /** 直接上级 id；null 表示无上级 */
  managerId: string | null;
  /** 直接上级姓名；null 表示无上级 */
  managerName: string | null;
  /** 该人员绑定的标签 */
  tags: Tag[];
}
