/**
 * 交付存档：用系统 Edge 按操作顺序截图，覆盖改上级（含循环报错）、
 * 标签新建/改名/删除、打标、筛选与搜索组合。
 * 前置：preview-server 已在 3000 端口运行。
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../docs/screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('dialog', (dialog) => void dialog.accept());

const settle = () => page.waitForTimeout(450);
const snap = async (name) => {
  await settle();
  await page.screenshot({ path: resolve(outDir, name), fullPage: true });
  console.log('saved', name);
};
// 按姓名单元格精确匹配；不要用 hasText，否则会命中其他行下拉框里的同名 option
const row = (name) =>
  page.locator(`.employee-table tbody tr:has(td.name-cell:text-is("${name}"))`);
const clearError = async () => {
  if (await page.locator('.alert-close').count()) await page.locator('.alert-close').click();
};

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForSelector('.employee-table tbody tr');
await snap('01-初始人员列表.png');

// 搜索 + 标签筛选组合
await page.locator('input[type="search"]').fill('前端');
await page.locator('.tag-filter select').selectOption({ label: '技术专家' });
await snap('02-姓名岗位搜索与标签筛选组合.png');
await page.locator('input[type="search"]').fill('');
await page.locator('.tag-filter select').selectOption('');
await settle();

// 改上级成功：林晓 → 王芳
await row('林晓').locator('select').first().selectOption({ label: '王芳' });
await snap('03-调整上级成功.png');

// 循环汇报被拦截：陈国栋（顶层）→ 林晓（其下级）
await row('陈国栋').locator('select').first().selectOption({ label: '林晓' });
await snap('04-循环汇报被拦截.png');
await clearError();

// 标签管理：新建
await page.getByRole('button', { name: '标签管理' }).click();
await page.locator('input[placeholder="新标签名称"]').fill('验收演示');
await page.getByRole('button', { name: '新建标签' }).click();
await snap('05-标签新建.png');

// 标签改名（用稳定 id 定位，编辑态文本会变成输入框）
const demoId = await page
  .locator('.tag-manager-list li')
  .filter({ hasText: '验收演示' })
  .getAttribute('data-tag-id');
const demoTag = page.locator(`[data-tag-id="${demoId}"]`);
await demoTag.getByRole('button', { name: '重命名' }).click();
await demoTag.locator('input[type="text"]').fill('验收演示V2');
await demoTag.getByRole('button', { name: '保存' }).click();
await snap('06-标签重命名.png');

// 删除已使用标签被拒绝
const usedTag = page.locator('.tag-manager-list li').filter({ hasText: '核心人才' });
await usedTag.getByRole('button', { name: '删除' }).click();
await snap('07-删除已使用标签被拒绝.png');
await clearError();

// 删除未使用标签成功
const unusedTag = page.locator(`[data-tag-id="${demoId}"]`);
await unusedTag.getByRole('button', { name: '删除' }).click();
await snap('08-删除未使用标签成功.png');

// 给人员打标：林晓 + 外包
await page.getByRole('button', { name: '收起标签管理' }).click();
await row('林晓').locator('select.tag-add').selectOption({ label: '外包' });
await snap('09-给人员打标.png');

// 按标签筛选
await page.locator('.tag-filter select').selectOption({ label: '外包' });
await snap('10-按标签筛选人员.png');

await browser.close();
