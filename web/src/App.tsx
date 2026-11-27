/**
 * 应用主界面：人员列表 + 搜索/标签筛选 + 标签管理。
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { EmployeeTable } from './components/EmployeeTable';
import { TagFilter } from './components/TagFilter';
import { TagManager } from './components/TagManager';
import type { Employee, TagWithUsage } from './types';

export function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // 上级下拉候选始终用全量
  const [tags, setTags] = useState<TagWithUsage[]>([]);
  const [tagFilter, setTagFilter] = useState(''); // '' 表示全部
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /** 拉取人员列表（筛选后 + 全量）与标签池 */
  const refresh = useCallback(
    async (withLoading = true) => {
      if (withLoading) setLoading(true);
      setError(null);
      try {
        const [employeeList, allList, tagList] = await Promise.all([
          api.listEmployees({ tagId: tagFilter || undefined, search: search.trim() || undefined }),
          api.listEmployees(), // 全量候选：筛选后上级下拉也必须完整
          api.listTags(),
        ]);
        setEmployees(employeeList);
        setAllEmployees(allList);
        setTags(tagList);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (withLoading) setLoading(false);
      }
    },
    [tagFilter, search],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * 统一变更处理：串行化操作，返回是否成功供调用方决定表单是否重置。
   * 成功后的刷新保持表格内容（不闪烁）。
   */
  const run = useCallback(
    async (key: string, action: () => Promise<unknown>): Promise<boolean> => {
      if (busy) return false;
      setBusy(key);
      setError(null);
      try {
        await action();
        await refresh(false);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [busy, refresh],
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>人员组织关系管理</h1>
        <p className="subtitle">维护上下级汇报关系与标签，人员基础数据由外部系统同步</p>
      </header>

      <div className="toolbar">
        <label className="search-box">
          搜索
          <input
            type="search"
            value={search}
            placeholder="姓名 / 岗位关键字"
            aria-label="按姓名或岗位搜索"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <TagFilter tags={tags} value={tagFilter} onChange={setTagFilter} />
        <button
          className="btn"
          disabled={busy !== null}
          onClick={() => setTagManagerOpen((open) => !open)}
        >
          {tagManagerOpen ? '收起标签管理' : '标签管理'}
        </button>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
          <button className="alert-close" onClick={() => setError(null)} aria-label="关闭错误提示">
            ×
          </button>
        </div>
      )}

      {tagManagerOpen && (
        <TagManager
          tags={tags}
          busy={busy !== null}
          onCreate={(name) => run('tag-create', () => api.createTag(name))}
          onRename={(id, name) => run('tag-rename', () => api.renameTag(id, name))}
          onDelete={async (id) => {
            const ok = await run('tag-delete', () => api.deleteTag(id));
            // 删除的正是当前筛选标签时，重置筛选，避免停留在空列表
            if (ok && tagFilter === id) setTagFilter('');
            return ok;
          }}
        />
      )}

      {loading ? (
        <p className="hint">加载中…</p>
      ) : (
        <EmployeeTable
          employees={employees}
          allEmployees={allEmployees}
          allTags={tags}
          busy={busy !== null}
          onChangeManager={(id, managerId) =>
            run(`manager:${id}`, () => api.changeManager(id, managerId))
          }
          onAssignTag={(id, tagId) => run(`tag-assign:${id}`, () => api.assignTag(id, tagId))}
          onUnassignTag={(id, tagId) => run(`tag-unassign:${id}`, () => api.unassignTag(id, tagId))}
        />
      )}
    </div>
  );
}
