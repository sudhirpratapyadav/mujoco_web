import type { MainModule } from '@mujoco/mujoco';

interface Manifest {
  root: string;
  files: string[];
}

/**
 * Fetches a manifest + all referenced files from `baseUrl`, writes them into
 * MuJoCo's emscripten MEMFS at `mountDir`, and returns the absolute path to
 * the root XML inside that FS.
 *
 * Why MEMFS: MuJoCo's compiler resolves `<include>` and `<mesh file="...">`
 * relative to the XML's path inside the WASM filesystem. We mirror the bundle's
 * directory layout there.
 */
export async function loadAssetBundle(
  mj: MainModule,
  baseUrl: string,
  mountDir: string = '/work',
): Promise<string> {
  const manifestRes = await fetch(`${baseUrl}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`manifest fetch failed: ${manifestRes.status} ${baseUrl}/manifest.json`);
  }
  const manifest: Manifest = await manifestRes.json();

  // Pre-create all directory paths.
  mj.FS.mkdirTree(mountDir, 0o777);
  const dirs = new Set<string>();
  for (const f of manifest.files) {
    const slash = f.lastIndexOf('/');
    if (slash > 0) dirs.add(`${mountDir}/${f.slice(0, slash)}`);
  }
  for (const d of dirs) mj.FS.mkdirTree(d, 0o777);

  // Fetch all files in parallel and write into MEMFS.
  await Promise.all(
    manifest.files.map(async (f) => {
      const res = await fetch(`${baseUrl}/${f}`);
      if (!res.ok) throw new Error(`asset fetch failed: ${res.status} ${f}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      mj.FS.writeFile(`${mountDir}/${f}`, buf);
    }),
  );

  return `${mountDir}/${manifest.root}`;
}
