/**
 * 应用主界面：人员列表 + 标签筛选 + 标签管理。
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { EmployeeTable } from './components/EmployeeTable';
import { TagFilter } from './components/TagFilter';
import { TagManager } from './components/TagManager';
import type { Employee, Tag } from './types';

export function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState(''); // '' 表示全部
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  /** 拉取人员列表与标签池 */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [employeeList, tagList] = await Promise.all([
        api.listEmployees(tagFilter || undefined),
        api.listTags(),
      ]);
      setEmployees(employeeList);
      setTags(tagList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tagFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 统一的变更处理：执行操作并在失败时展示错误 */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [refresh],
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>人员组织关系管理</h1>
        <p className="subtitle">维护上下级汇报关系与标签，人员基础数据由外部系统同步</p>
      </header>

      <div className="toolbar">
        <TagFilter tags={tags} value={tagFilter} onChange={setTagFilter} />
        <button className="btn" onClick={() => setTagManagerOpen((open) => !open)}>
          {tagManagerOpen ? '收起标签管理' : '标签管理'}
        </button>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
          <button className="alert-close" onClick={() => setError(null)} aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {tagManagerOpen && (
        <TagManager
          tags={tags}
          onCreate={(name) => run(() => api.createTag(name))}
          onRename={(id, name) => run(() => api.renameTag(id, name))}
          onDelete={(id) => run(() => api.deleteTag(id))}
        />
      )}

      {loading ? (
        <p className="hint">加载中…</p>
      ) : (
        <EmployeeTable
          employees={employees}
          allTags={tags}
          onChangeManager={(id, managerId) => run(() => api.changeManager(id, managerId))}
          onAssignTag={(id, tagId) => run(() => api.assignTag(id, tagId))}
          onUnassignTag={(id, tagId) => run(() => api.unassignTag(id, tagId))}
        />
      )}
    </div>
  );
}
