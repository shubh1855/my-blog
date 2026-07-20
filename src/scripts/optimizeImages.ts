import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { glob } from 'glob';
import sharp from 'sharp';

const IMAGE_GLOB = 'public/img/**/*.{webp,jpg,jpeg,png}';

async function optimizeImages() {
  console.log(chalk.blue('Starting image optimization...'));

  const files = await glob(IMAGE_GLOB);
  const toProcess = files.filter((f) => !f.endsWith('-mobile.webp'));

  for (const file of toProcess) {
    const ext = path.extname(file);
    const basename = path.basename(file, ext);
    const dir = path.dirname(file);
    const isWebp = ext.toLowerCase() === '.webp';

    const baseWebpPath = path.join(dir, `${basename}.webp`);
    const mobileWebpPath = path.join(dir, `${basename}-mobile.webp`);

    try {
      console.log(chalk.gray(`Processing: ${file}`));

      const image = sharp(file);
      const metadata = await image.metadata();

      // 1. Optimize base image (Convert to WebP if not already, or re-compress)
      await image.webp({ quality: 80, effort: 6 }).toFile(baseWebpPath + '.tmp');

      // 2. Generate mobile variant (max width 800px)
      if (metadata.width && metadata.width > 800) {
        await sharp(file)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 80, effort: 6 })
          .toFile(mobileWebpPath);
      } else {
        // If it's already small, just copy the optimized base
        await fs.copyFile(baseWebpPath + '.tmp', mobileWebpPath);
      }

      // 3. Replace original file with optimized base
      await fs.rename(baseWebpPath + '.tmp', baseWebpPath);

      // 4. Cleanup old file if it wasn't WebP
      if (!isWebp) {
        await fs.unlink(file);
      }
    } catch (err) {
      console.error(chalk.red(`Error processing ${file}:`), err);
    }
  }

  console.log(chalk.green(`Successfully optimized ${toProcess.length} images!`));
}

optimizeImages().catch(console.error);
