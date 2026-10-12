import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// npm runs a dependency's own lifecycle scripts *before* this package's postinstall
// (scripts run bottom-up through the dependency tree), so by the time this file runs,
// gifsicle/mozjpeg/optipng-bin already tried to fetch their native binary - and did so
// against the *unpatched* `download`/`got`, since the `patch-package` step that fixes
// `download` (run immediately before this script, see the `postinstall` entry) hadn't
// happened yet either. That first attempt falls back to a from-source build rather than
// using the fast, now-fixed prebuilt-binary path.
//
// If a package is still present (its first attempt succeeded, even if via that slower
// fallback), re-run its own install step now that `download` is guaranteed to be patched,
// so it ends up with the fast prebuilt binary instead. If a package is already gone
// (npm drops a failed optionalDependency rather than failing the whole install), leave
// it be - that's the same pre-existing fallback-build fragility these packages already
// have on unsupported platforms/toolchains, independent of this fix.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const PACKAGES = ['gifsicle', 'mozjpeg', 'optipng-bin']

for (const pkg of PACKAGES) {
  const installScript = path.join(projectRoot, 'node_modules', pkg, 'lib', 'install.js')

  if (!existsSync(installScript)) {
    continue
  }

  const retry = spawnSync('node', [installScript], {
    cwd: path.dirname(path.dirname(installScript)),
    stdio: 'inherit'
  })

  if (retry.status !== 0) {
    console.warn(`[ensure-imagemin-binaries] "${pkg}"'s install step failed on retry - image minification for its format may be unavailable.`)
  }
}
