import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function localFile(relative) {
  if (typeof relative !== 'string' || !relative) throw new Error('Evidence path is required');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(root) || !fs.statSync(resolved).isFile()) throw new Error(`Invalid evidence file: ${relative}`);
  return resolved;
}
const requiredSponsors = ['event', 'hedera', 'arkiv', 'crops'];
const statuses = new Set(['missing', 'partial', 'recorded', 'verified', 'not-applicable']);
try {
  const register = JSON.parse(fs.readFileSync(new URL('../docs/evidence/sponsor-status.json', import.meta.url), 'utf8'));
  if (register.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(register.rulesReviewedOn) || !Array.isArray(register.requirements) || !register.requirements.length) throw new Error('Invalid evidence register');
  const ids = new Set();
  for (const item of register.requirements) {
    if (!item.id || ids.has(item.id) || !requiredSponsors.includes(item.sponsor) || !item.requirement || typeof item.mandatory !== 'boolean' || !statuses.has(item.status) || !Array.isArray(item.evidencePaths)) throw new Error(`Invalid or duplicate requirement: ${item.id}`);
    ids.add(item.id);
    item.evidencePaths.forEach(localFile);
    if (['recorded', 'verified'].includes(item.status) && !item.evidencePaths.length) throw new Error(`${item.id}: evidence is required`);
    if (['verified', 'not-applicable'].includes(item.status)) {
      const record = JSON.parse(fs.readFileSync(localFile(item.verificationRecord), 'utf8'));
      if (record.requirementId !== item.id || !record.reviewer || !record.reviewedAt || !record.limitations) throw new Error(`${item.id}: independent review record is incomplete`);
      if (item.status === 'not-applicable') {
        if (!record.sourceUrl || !record.explanation) throw new Error(`${item.id}: source-backed exemption required`);
      } else {
        if (!/^[a-f0-9]{40}$/.test(record.sourceCommit) || typeof record.dirty !== 'boolean' || (record.dirty && !/^[a-f0-9]{64}$/.test(record.patchSha256)) || !record.runAt || !record.runtime || !record.command || !record.environment || record.exitCode !== 0 || !record.expected || !record.observed || !Array.isArray(record.rawEvidencePaths) || !record.rawEvidencePaths.length) throw new Error(`${item.id}: reproducible run record is incomplete`);
        record.rawEvidencePaths.forEach(localFile);
      }
    }
  }
  console.log('Evidence register and local references are valid. Experiments were NOT rerun; sponsor eligibility is NOT confirmed.');
  let allReady = true;
  for (const sponsor of requiredSponsors) {
    const items = register.requirements.filter(item => item.sponsor === sponsor && item.mandatory);
    if (!items.length) throw new Error(`Missing mandatory requirements for ${sponsor}`);
    const open = items.filter(item => !['verified', 'not-applicable'].includes(item.status));
    if (open.length) allReady = false;
    console.log(`${sponsor}: ${open.length ? `NOT READY; open ${open.map(item => item.id).join(', ')}` : 'review records complete; manual source/eligibility review still required'}`);
  }
  if (process.argv.includes('--require-ready') && !allReady) process.exitCode = 1;
} catch (error) {
  console.error(`Sponsor evidence validation failed: ${error.message}`);
  process.exitCode = 1;
}
