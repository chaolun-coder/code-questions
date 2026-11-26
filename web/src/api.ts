/**
 * 后端 API 客户端（原生 fetch 封装，不依赖第三方请求库）。
 *
 * 统一响应结构：{ data: T }；错误响应：{ error: string }。
 */
import type { Employee, Tag } from './types';

/** 发起请求并解析统一响应结构 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const body = (await response.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? `请求失败（HTTP ${response.status}）`);
  }
  return body?.data as T;
}

export const api = {
  /** 人员列表；tagId 传值时按标签筛选 */
  listEmployees(tagId?: string): Promise<Employee[]> {
    const query = tagId ? `?tagId=${encodeURIComponent(tagId)}` : '';
    return request<Employee[]>(`/api/employees${query}`);
  },

  /** 调整直接上级（managerId 为 null 表示无上级） */
  changeManager(employeeId: string, managerId: string | null): Promise<Employee> {
    return request<Employee>(`/api/employees/${employeeId}/manager`, {
      method: 'PATCH',
      body: JSON.stringify({ managerId }),
    });
  },

  /** 给人员绑定标签 */
  assignTag(employeeId: string, tagId: string): Promise<Employee> {
    return request<Employee>(`/api/employees/${employeeId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    });
  },

  /** 移除人员标签 */
  unassignTag(employeeId: string, tagId: string): Promise<Employee> {
    return request<Employee>(`/api/employees/${employeeId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  },

  /** 标签列表 */
  listTags(): Promise<Tag[]> {
    return request<Tag[]>('/api/tags');
  },

  /** 新建标签 */
  createTag(name: string): Promise<Tag> {
    return request<Tag>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  /** 重命名标签 */
  renameTag(tagId: string, name: string): Promise<Tag> {
    return request<Tag>(`/api/tags/${tagId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  /** 删除标签 */
  async deleteTag(tagId: string): Promise<void> {
    await request<void>(`/api/tags/${tagId}`, { method: 'DELETE' });
  },
};
