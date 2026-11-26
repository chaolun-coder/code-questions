/**
 * 标签管理面板：全局标签池的新建 / 重命名 / 删除。
 */
import { useState } from 'react';
import type { Tag } from '../types';

interface TagManagerProps {
  tags: Tag[];
  onCreate: (name: string) => Promise<unknown>;
  onRename: (tagId: string, name: string) => Promise<unknown>;
  onDelete: (tagId: string) => Promise<unknown>;
}

export function TagManager({ tags, onCreate, onRename, onDelete }: TagManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await onCreate(name);
    setNewName('');
  };

  const handleRename = async (tagId: string) => {
    const name = editingName.trim();
    if (!name) return;
    await onRename(tagId, name);
    setEditingId(null);
    setEditingName('');
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
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreate();
          }}
        />
        <button className="btn primary" onClick={() => void handleCreate()}>
          新建标签
        </button>
      </div>

      <ul className="tag-manager-list">
        {tags.map((tag) => (
          <li key={tag.id}>
            {editingId === tag.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  maxLength={50}
                  autoFocus
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleRename(tag.id);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
                <button className="btn small" onClick={() => void handleRename(tag.id)}>
                  保存
                </button>
                <button className="btn small" onClick={() => setEditingId(null)}>
                  取消
                </button>
              </>
            ) : (
              <>
                <span className="tag-name">{tag.name}</span>
                <button
                  className="btn small"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditingName(tag.name);
                  }}
                >
                  重命名
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (window.confirm(`确定删除标签「${tag.name}」？所有人员的该标签绑定会一并移除。`)) {
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
