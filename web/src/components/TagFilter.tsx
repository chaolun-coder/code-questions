/**
 * 标签筛选器：按标签筛选人员列表。
 */
import type { Tag } from '../types';

interface TagFilterProps {
  tags: Tag[];
  /** 当前选中的标签 id；'' 表示全部 */
  value: string;
  onChange: (tagId: string) => void;
}

export function TagFilter({ tags, value, onChange }: TagFilterProps) {
  return (
    <label className="tag-filter">
      标签筛选
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部人员</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </label>
  );
}
