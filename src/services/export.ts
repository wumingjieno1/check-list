import type { createRepositories } from '@/repositories/factory';

type Repo = ReturnType<typeof createRepositories>;

interface ExportShape {
  app: 'check-list';
  version: 1;
  exportedAt: string;
  data: ReturnType<Repo['dumpAll']>;
}

export function buildExportJson(repo: Repo): string {
  const payload: ExportShape = {
    app: 'check-list',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: repo.dumpAll(),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseExportJson(json: string): ExportShape {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('备份文件格式错误');
  }
  if (parsed?.app !== 'check-list' || typeof parsed.version !== 'number') {
    throw new Error('备份文件格式错误');
  }
  return parsed as ExportShape;
}
