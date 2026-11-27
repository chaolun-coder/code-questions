/**
 * 标签管理面板：全局标签池的新建 / 重命名 / 删除。
 * 列表展示每个标签的使用人数，删除已被使用的标签由后端强校验拒绝。
 */
import { useState } from 'react';
import type { TagWithUsage } from '../types';

interface TagManagerProps {
  tags: TagWithUsage[];
  busy: boolean;
  /** 返回是否成功，失败时表单保持原样 */
  onCreate: (name: string) => Promise<boolean>;
  onRename: (tagId: string, name: string) => Promise<boolean>;
  onDelete: (tagId: string) => Promise<boolean>;
}

export function TagManager({ tags, busy, onCreate, onRename, onDelete }: TagManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    if (await onCreate(name)) setNewName('');
  };

  const handleRename = async (tagId: string) => {
    const name = editingName.trim();
    if (!name || busy) return;
    if (await onRename(tagId, name)) {
      setEditingId(null);
      setEditingName('');
    }
  };

  return (
    <section className="tag-manager">
      <h2>标签管理（全局共用标签池）</h2>

      <div className="tag-manager-create">
        <input
          type="text"
          placeholder="新标签名称"
          value={newName}
          maxLength={50}
          disabled={busy}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreate();
          }}
        />
        <button className="btn primary" disabled={busy} onClick={() => void handleCreate()}>
          新建标签
        </button>
      </div>

      <ul className="tag-manager-list">
        {tags.map((tag) => (
          <li key={tag.id} data-tag-id={tag.id}>
            {editingId === tag.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  maxLength={50}
                  autoFocus
                  disabled={busy}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleRename(tag.id);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
                <button className="btn small" disabled={busy} onClick={() => void handleRename(tag.id)}>
                  保存
                </button>
                <button className="btn small" disabled={busy} onClick={() => setEditingId(null)}>
                  取消
                </button>
              </>
            ) : (
              <>
                <span className="tag-name">{tag.name}</span>
                <span className={`tag-usage${tag.usageCount > 0 ? ' in-use' : ''}`}>
                  已被 {tag.usageCount} 人使用
                </span>
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditingName(tag.name);
                  }}
                >
                  重命名
                </button>
                <button
                  className="btn small danger"
                  disabled={busy}
                  title={
                    tag.usageCount > 0
                      ? `该标签已被 ${tag.usageCount} 人使用，删除会被拒绝`
                      : '删除该标签'
                  }
                  onClick={() => {
                    const extra =
                      tag.usageCount > 0 ? `该标签已被 ${tag.usageCount} 人使用，删除将被拒绝。` : '';
                    if (window.confirm(`确定删除标签「${tag.name}」？${extra}`)) {
                      void onDelete(tag.id);
                    }
                  }}
                >
                  删除
                </button>
              </>
            )}
          </li>
        ))}
        {tags.length === 0 && <li className="hint">暂无标签，请先新建。</li>}
      </ul>
    </section>
  );
}
