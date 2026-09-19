import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  const isRapierModule =
    context.parentURL &&
    context.parentURL.includes('/node_modules/@dimforge/rapier3d/');

  if (!isRapierModule) {
    return nextResolve(specifier, context);
  }

  if (!(specifier.startsWith('./') || specifier.startsWith('../'))) {
    return nextResolve(specifier, context);
  }

  const parentURL = new URL(context.parentURL);
  const targetURL = new URL(specifier, parentURL);
  const targetPath = fileURLToPath(targetURL);

  if (!/\.[a-z]+$/i.test(specifier)) {
    const directoryIndex = `${targetPath}${targetPath.endsWith('/') ? '' : '/'}index.js`;

    if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
      return nextResolve(pathToFileURL(directoryIndex).href, context);
    }

    if (existsSync(`${targetPath}.js`)) {
      return nextResolve(new URL(`${specifier}.js`, parentURL).href, context);
    }

    if (existsSync(directoryIndex)) {
      return nextResolve(pathToFileURL(directoryIndex).href, context);
    }
  }

  return nextResolve(specifier, context);
}
