#!/usr/bin/env node
/**
 * Builds a throwaway demo vault and screenshots it for the docs site.
 *
 * The vault is created through the real UI rather than by writing rows into a
 * database, because credential values are encrypted client-side. Seeding the
 * database directly would mean reimplementing key derivation and AES-GCM
 * outside the app, and the screenshot would stop reflecting the real render
 * path. Driving the UI lets Keyper do its own encryption.
 *
 * Every run uses a fresh browser context, so the demo vault lives only in that
 * context's IndexedDB and disappears when the browser closes. It cannot see or
 * touch a real vault, and there is nothing to clean up afterwards.
 *
 * Usage:
 *   npm run dev                    # in one terminal
 *   npm run screenshots            # in another
 *
 * Options:
 *   --headed        watch it run in a visible browser
 *   --keep-open     leave the browser open at the end (implies --headed)
 *
 * Environment:
 *   KEYPER_URL        app URL             (default http://localhost:4173)
 *   KEYPER_SHOT_DIR   output directory    (default website/public/screenshots)
 *   KEYPER_SHOT_W     desktop CSS width   (default 2560)
 *   KEYPER_SHOT_H     desktop CSS height  (default 1200)
 *   KEYPER_SHOT_DPR   pixel density       (default 2, mobile crop only)
 *   KEYPER_SHOT_LIST_H  list-view CSS height (default 1620)
 *
 * The desktop width defaults to 2560 for a reason beyond fitting five columns:
 * below roughly 2200px the floating Settings button overlaps the header's Add
 * Credential button, which looks like a rendering fault in a marketing shot.
 * That overlap is a real layout bug in the app rather than a capture artifact,
 * so this default sidesteps it rather than fixing it here.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DEMO_CREDENTIALS, SECRET_FIELDS } from './demo-credentials.mjs';

const BASE_URL = process.env.KEYPER_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.KEYPER_SHOT_DIR ?? 'website/public/screenshots';
const WIDTH = Number(process.env.KEYPER_SHOT_W ?? 2560);
const HEIGHT = Number(process.env.KEYPER_SHOT_H ?? 1200);
const DPR = Number(process.env.KEYPER_SHOT_DPR ?? 2);
// The list view is one row per credential, so it needs more vertical room than
// the grid to fit the whole vault without scrolling.
const LIST_HEIGHT = Number(process.env.KEYPER_SHOT_LIST_H ?? 1620);

const KEEP_OPEN = process.argv.includes('--keep-open');
const HEADED = KEEP_OPEN || process.argv.includes('--headed');

// A vault that exists for the length of one script run. The passphrase is
// printed in the source on purpose: it protects nothing.
const DEMO_DB_NAME = 'keyper-screenshot-demo';
const DEMO_PASSPHRASE = 'screenshot-demo-vault-passphrase';

// The credential grid. Tailwind keeps these class names in the DOM, and the
// column-count classes are distinctive enough to identify the container.
const GRID = 'div[class*="grid-cols-1"][class*="gap-6"]';

const step = (msg) => console.log(`  ${msg}`);

/**
 * Picks an option from a Radix select.
 *
 * These are buttons that open a portalled listbox, not native <select>
 * elements, so `selectOption` does not work on them. The categories list is
 * also fetched after mount, which means the listbox can open empty on the first
 * try. Reopening it is the retry.
 */
async function selectOption(page, trigger, optionLabel, { attempts = 6 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await trigger.click();
    const option = page.getByRole('option', { name: optionLabel, exact: true });
    try {
      await option.waitFor({ state: 'visible', timeout: 2000 });
      await option.click();
      return;
    } catch {
      // Close the listbox before trying again, otherwise the next click just
      // toggles it shut.
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`Could not select "${optionLabel}" after ${attempts} attempts`);
}

async function configureSqlite(page) {
  step('Configuring a local SQLite database');
  await page.getByRole('button', { name: 'Configure Database' }).click();

  // The provider picker is a real <select>, unlike the ones inside the form.
  const provider = page.getByLabel('Database Provider');
  await provider.waitFor({ state: 'visible' });
  await provider.selectOption({ label: 'SQLite (Local-First: Browser + Desktop)' });

  // A named database keeps this separate from the default browser-local vault,
  // so running the script can never write into a real one. The browser context
  // is throwaway anyway, which is the belt to this pair of braces.
  await page.getByLabel('SQLite Database Name (Optional)').fill(DEMO_DB_NAME);

  // Username is left empty on purpose. In SQLite mode the owner id is the
  // username when one is set, but the default categories are only ever seeded
  // under the built-in owner id. Naming a user here would produce a vault with
  // no categories to pick from, and the form would have nothing to select.
  await page.getByRole('button', { name: 'Save & Close' }).click();
}

async function createVault(page) {
  step('Creating the master passphrase');
  await page.getByRole('heading', { name: 'Create Master Passphrase' }).waitFor();
  await page.getByLabel('Master Passphrase').fill(DEMO_PASSPHRASE);
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await page.getByRole('button', { name: 'Add Credential' }).waitFor({ timeout: 30000 });
}

async function addCredential(page, credential) {
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Add Credential' }).first().click();
  await dialog.getByRole('heading', { name: 'Add New Credential' }).waitFor();

  await dialog.getByLabel('Title *').fill(credential.title);

  // Type, Category and Priority are the first, second and third Radix selects
  // in the dialog. They carry no id, and their labels are not associated, so
  // position is the only stable handle.
  const selects = dialog.getByRole('combobox');
  await selectOption(page, selects.nth(0), credential.type);

  if (credential.description) {
    await dialog.getByLabel('Description').fill(credential.description);
  }

  // Changing the type swaps in different secret fields, so this has to happen
  // after the type is set.
  const fields = SECRET_FIELDS[credential.type];
  if (!fields) {
    throw new Error(`No secret field mapping for type "${credential.type}"`);
  }
  for (const [key, label] of Object.entries(fields)) {
    const value = credential.secret?.[key];
    if (value === undefined) {
      throw new Error(`"${credential.title}" is missing secret.${key}`);
    }
    await dialog.getByLabel(label, { exact: true }).fill(value);
  }

  if (credential.url) {
    await dialog.getByLabel('URL').fill(credential.url);
  }

  await selectOption(page, selects.nth(1), credential.category);
  await selectOption(page, selects.nth(2), credential.priority);

  for (const tag of credential.tags ?? []) {
    const input = dialog.getByPlaceholder('Add a tag');
    await input.fill(tag);
    await input.press('Enter');
  }

  await dialog.getByRole('button', { name: 'Add Credential' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 20000 });
}

async function captureDesktop(page, outDir) {
  step('Capturing the desktop dashboard');
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.waitForTimeout(600);
  const file = path.join(outDir, 'demo-dashboard.png');
  // scale: 'css' pins the output to the CSS size regardless of the context's
  // device scale factor. The desktop shot is already 2560 wide, so doubling it
  // again would produce a 5120px file for no visible gain.
  await page.screenshot({ path: file, scale: 'css' });
  return file;
}

/**
 * Captures the same vault in list view.
 *
 * The viewport is taller than the grid shot so every row fits without
 * scrolling. A full-page capture would do the same job, but the vault status
 * panel is pinned to the corner and pinned elements land in the wrong place in
 * full-page screenshots.
 */
async function captureList(page, outDir) {
  step('Capturing the list view');
  await page.setViewportSize({ width: WIDTH, height: LIST_HEIGHT });
  await page.getByRole('button', { name: 'List View' }).click();
  await page.waitForTimeout(600);

  const file = path.join(outDir, 'demo-dashboard-list.png');
  await page.screenshot({ path: file, scale: 'css' });

  // Return to the grid so anything captured after this is back to the default.
  await page.getByRole('button', { name: 'Grid View' }).click();
  await page.waitForTimeout(400);
  return file;
}

/**
 * Captures a phone-width crop of the first few cards.
 *
 * The full dashboard is unreadable when a five-column grid is squeezed to
 * 390px, so the mobile image shows a handful of cards at a legible size
 * instead of the whole page shrunk down.
 */
async function captureMobile(page, outDir, cardCount = 3) {
  step(`Capturing a ${cardCount}-card mobile crop`);
  // 390 wide is the phone layout this is meant to show. The height is
  // deliberately far taller than a real phone because `clip` is measured
  // against the viewport, so anything below the fold would be cut off. Only the
  // width affects which responsive layout renders.
  await page.setViewportSize({ width: 390, height: 1800 });
  await page.waitForTimeout(600);

  const grid = page.locator(GRID).first();
  await grid.waitFor({ state: 'visible' });
  const cards = grid.locator('> *');

  const available = await cards.count();
  if (available === 0) {
    throw new Error('Found the credential grid but no cards inside it');
  }
  const take = Math.min(cardCount, available);

  // Scroll the first card into view before measuring, otherwise the boxes are
  // relative to a viewport the cards are not in yet.
  await cards.nth(0).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const boxes = [];
  for (let i = 0; i < take; i++) {
    const box = await cards.nth(i).boundingBox();
    if (box) boxes.push(box);
  }
  if (boxes.length === 0) {
    throw new Error('Could not measure any credential cards');
  }

  const pad = 12;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));

  const file = path.join(outDir, 'demo-dashboard-mobile.png');
  // scale: 'device' keeps the context's pixel density here, so this lands as a
  // 2x asset. It is displayed small on the page, where a 1x crop looks soft.
  await page.screenshot({
    path: file,
    scale: 'device',
    clip: {
      x: Math.max(0, left - pad),
      y: Math.max(0, top - pad),
      width: Math.min(390, right - left + pad * 2),
      height: bottom - top + pad * 2,
    },
  });
  return file;
}

async function main() {
  const outDir = path.resolve(OUT_DIR);
  await mkdir(outDir, { recursive: true });

  console.log(`\nKeyper screenshot capture`);
  console.log(`  app     ${BASE_URL}`);
  console.log(`  output  ${outDir}`);
  console.log(`  desktop ${WIDTH}x${HEIGHT} @ ${DPR}x\n`);

  const browser = await chromium.launch({ headless: !HEADED });
  // A fresh context means empty IndexedDB, so the app starts at first-run setup
  // and the demo vault cannot collide with a real one.
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: DPR,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  const written = [];
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    await configureSqlite(page);
    await createVault(page);

    step(`Adding ${DEMO_CREDENTIALS.length} demo credentials`);
    for (const [i, credential] of DEMO_CREDENTIALS.entries()) {
      await addCredential(page, credential);
      console.log(`    ${String(i + 1).padStart(2)}/${DEMO_CREDENTIALS.length}  ${credential.title}`);
    }

    // Drop focus so no field is left with a focus ring in the screenshot.
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.move(0, 0);

    written.push(await captureDesktop(page, outDir));
    written.push(await captureList(page, outDir));
    written.push(await captureMobile(page, outDir));

    console.log('\nWrote:');
    for (const file of written) console.log(`  ${path.relative(process.cwd(), file)}`);
    console.log('');
  } catch (error) {
    console.error(`\nFailed: ${error.message}`);
    const crashShot = path.join(outDir, 'capture-failure.png');
    await page.screenshot({ path: crashShot, fullPage: true }).catch(() => {});
    console.error(`Saved the page state to ${path.relative(process.cwd(), crashShot)}\n`);
    process.exitCode = 1;
  } finally {
    if (KEEP_OPEN) {
      console.log('Leaving the browser open. Press Ctrl+C to exit.');
      await new Promise(() => {});
    }
    await context.close();
    await browser.close();
  }
}

main();
