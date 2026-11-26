-- 人员组织关系与标签系统 数据库结构 (PostgreSQL)
-- 说明：
--   employee 为外部系统同步的人员基础数据，本系统只维护 manager_id（汇报关系）
--   以及标签绑定关系，不提供人员基础信息的增删改接口。

DROP TABLE IF EXISTS employee_tag CASCADE;
DROP TABLE IF EXISTS tag CASCADE;
DROP TABLE IF EXISTS employee CASCADE;

-- 人员表（基础字段只读，来自外部同步）
CREATE TABLE employee (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  position   TEXT NOT NULL,
  -- 直接上级；NULL 表示"无上级"（顶层管理人员）
  manager_id TEXT REFERENCES employee (id) ON DELETE RESTRICT
);

CREATE INDEX idx_employee_manager_id ON employee (manager_id);

-- 标签字典（全局共用标签池，标签名唯一）
CREATE TABLE tag (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL CONSTRAINT uq_tag_name UNIQUE
);

-- 人员-标签 绑定关系（多对多）
CREATE TABLE employee_tag (
  employee_id TEXT NOT NULL REFERENCES employee (id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tag (id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, tag_id)
);

CREATE INDEX idx_employee_tag_tag_id ON employee_tag (tag_id);
