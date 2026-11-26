/**
 * 人员表格：展示姓名 / 岗位 / 上级 / 标签，
 * 支持调整上级、给人员添加 / 移除标签。
 */
import { useState } from 'react';
import type { Employee, Tag } from '../types';

interface EmployeeTableProps {
  employees: Employee[];
  /** 全局标签池，用于"添加标签"下拉 */
  allTags: Tag[];
  onChangeManager: (employeeId: string, managerId: string | null) => Promise<unknown>;
  onAssignTag: (employeeId: string, tagId: string) => Promise<unknown>;
  onUnassignTag: (employeeId: string, tagId: string) => Promise<unknown>;
}

export function EmployeeTable({
  employees,
  allTags,
  onChangeManager,
  onAssignTag,
  onUnassignTag,
}: EmployeeTableProps) {
  // 记录每行"添加标签"下拉的当前选择，避免受控组件反复重置
  const [pendingTags, setPendingTags] = useState<Record<string, string>>({});

  if (employees.length === 0) {
    return <p className="hint">没有符合条件的人员。</p>;
  }

  return (
    <table className="employee-table">
      <thead>
        <tr>
          <th>姓名</th>
          <th>岗位</th>
          <th>直接上级</th>
          <th>标签</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((employee) => {
          // 上级候选：全部人员中排除自己（防环的另一半由后端保证）
          const managerCandidates = employees.filter((item) => item.id !== employee.id);
          const boundTagIds = new Set(employee.tags.map((tag) => tag.id));
          const addableTags = allTags.filter((tag) => !boundTagIds.has(tag.id));
          const pendingTagId = pendingTags[employee.id] ?? '';

          return (
            <tr key={employee.id}>
              <td className="name-cell">{employee.name}</td>
              <td>{employee.position}</td>
              <td>
                <select
                  value={employee.managerId ?? ''}
                  aria-label={`${employee.name} 的直接上级`}
                  onChange={(event) =>
                    void onChangeManager(employee.id, event.target.value || null)
                  }
                >
                  <option value="">无上级</option>
                  {managerCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <div className="tags-cell">
                  {employee.tags.map((tag) => (
                    <span className="tag-chip" key={tag.id}>
                      {tag.name}
                      <button
                        className="tag-remove"
                        title={`移除标签「${tag.name}」`}
                        aria-label={`移除标签 ${tag.name}`}
                        onClick={() => void onUnassignTag(employee.id, tag.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <select
                    className="tag-add"
                    value={pendingTagId}
                    aria-label={`给 ${employee.name} 添加标签`}
                    onChange={(event) => {
                      const tagId = event.target.value;
                      setPendingTags((prev) => ({ ...prev, [employee.id]: '' }));
                      if (tagId) void onAssignTag(employee.id, tagId);
                    }}
                  >
                    <option value="">+ 添加标签</option>
                    {addableTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
