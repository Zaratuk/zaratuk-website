import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const outputDir = path.resolve('public/downloads');
const fallbackToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

const visualSources = [
  {
    name: 'Data Health Panel',
    repoUrl: process.env.DATA_HEALTH_PANEL_REPO_URL ?? 'https://github.com/Zaratuk/data_health_panel.git',
    token: process.env.DATA_HEALTH_PANEL_GITHUB_TOKEN ?? fallbackToken,
    tokenHint: 'DATA_HEALTH_PANEL_GITHUB_TOKEN',
    packageScript: 'package',
    packageOutput: path.join(outputDir, 'data-health-panel.pbiviz'),
    copies: [
      {
        source: 'sample-data/data-health-panel-sample.csv',
        output: path.join(outputDir, 'data-health-panel-sample.csv')
      }
    ]
  },
  {
    name: 'Pipeline Health Monitor',
    repoUrl: process.env.DATA_PIPELINE_HEALTH_REPO_URL ?? 'https://github.com/Zaratuk/Data_Pipeline_Health.git',
    token: process.env.DATA_PIPELINE_HEALTH_GITHUB_TOKEN ?? fallbackToken,
    tokenHint: 'DATA_PIPELINE_HEALTH_GITHUB_TOKEN',
    packageScript: 'build',
    packageOutput: path.join(outputDir, 'pipeline-health-monitor.pbiviz'),
    copies: [
      {
        source: 'assets/icon.svg',
        output: path.join(productsDir, 'pipeline-health-monitor-zaratuk-icon.svg')
      },
      {
        source: 'sample-data/pipeline-runs.csv',
        output: path.join(outputDir, 'pipeline-runs.csv')
      },
      {
        source: 'sample-data/pipeline-runs-no-sla.csv',
        output: path.join(outputDir, 'pipeline-runs-no-sla.csv')
      }
    ]
  }
];

function withToken(url, token) {
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

async function copyIfPresent(cloneDir, copyTarget) {
  const sourcePath = path.join(cloneDir, copyTarget.source);

  if (!existsSync(sourcePath)) {
    return;
  }

  await mkdir(path.dirname(copyTarget.output), { recursive: true });
  await copyFile(sourcePath, copyTarget.output);
}

async function syncVisual(source) {
  const workDir = await mkdtemp(path.join(tmpdir(), `${path.basename(source.packageOutput, '.pbiviz')}-`));

  try {
    try {
      const cloneDir = path.join(workDir, 'repo');
      console.log(`Pulling ${source.name} source from ${source.repoUrl}`);
      run('git', ['clone', '--depth', '1', withToken(source.repoUrl, source.token), cloneDir]);

      run('npm', ['ci'], { cwd: cloneDir });
      run('npm', ['run', source.packageScript], { cwd: cloneDir });

      await mkdir(path.dirname(source.packageOutput), { recursive: true });
      const pbivizPath = await findPbiviz(path.join(cloneDir, 'dist'));
      await copyFile(pbivizPath, source.packageOutput);

      await Promise.all(source.copies.map((copyTarget) => copyIfPresent(cloneDir, copyTarget)));

      console.log(`Synced ${source.packageOutput}`);
    } catch (error) {
      if (!existsSync(source.packageOutput)) {
        throw error;
      }

      console.warn(`Could not sync ${source.name} from GitHub.`);
      console.warn('Using the committed .pbiviz package instead.');
      console.warn(`Set ${source.tokenHint} in CI if the source repo requires authentication during builds.`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

for (const source of visualSources) {
  await syncVisual(source);
}
