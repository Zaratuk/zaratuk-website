import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoUrl = process.env.DATA_HEALTH_PANEL_REPO_URL ?? 'https://github.com/Zaratuk/data_health_panel.git';
const token = process.env.DATA_HEALTH_PANEL_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const outputDir = path.resolve('public/downloads');
const packageOutput = path.join(outputDir, 'data-health-panel.pbiviz');
const sampleOutput = path.join(outputDir, 'data-health-panel-sample.csv');

function withToken(url) {
  if (!token || !url.startsWith('https://github.com/')) {
    return url;
  }

  return url.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

async function findPbiviz(distDir) {
  const files = await readdir(distDir);
  const pbivizFiles = files.filter((file) => file.endsWith('.pbiviz')).sort();

  if (pbivizFiles.length === 0) {
    throw new Error(`No .pbiviz file found in ${distDir}`);
  }

  return path.join(distDir, pbivizFiles[pbivizFiles.length - 1]);
}

const workDir = await mkdtemp(path.join(tmpdir(), 'data-health-panel-'));

try {
  const cloneDir = path.join(workDir, 'repo');
  console.log(`Pulling Data Health Panel source from ${repoUrl}`);
  run('git', ['clone', '--depth', '1', withToken(repoUrl), cloneDir]);

  run('npm', ['ci'], { cwd: cloneDir });
  run('npm', ['run', 'package'], { cwd: cloneDir });

  await mkdir(outputDir, { recursive: true });
  const pbivizPath = await findPbiviz(path.join(cloneDir, 'dist'));
  await copyFile(pbivizPath, packageOutput);

  const samplePath = path.join(cloneDir, 'sample-data/data-health-panel-sample.csv');
  if (existsSync(samplePath)) {
    await copyFile(samplePath, sampleOutput);
  }

  console.log(`Synced ${packageOutput}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
