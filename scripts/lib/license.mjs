// The license of the published data. One place, so the data files, the validators, the pages and the
// watch script cannot drift apart. The code is MIT (see LICENSE); the data and text are CC BY 4.0.

export const CODE_LICENSE = 'MIT';
export const DATA_LICENSE = 'CC-BY-4.0';
export const DATA_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const DATA_ATTRIBUTION = 'Rulefiles contributors';

/** The three fields every published data file carries, in the order they are written. */
export const licenseFields = () => ({ license: DATA_LICENSE, licenseUrl: DATA_LICENSE_URL, attribution: DATA_ATTRIBUTION });

/** Problems with the license fields of a data file, one line each. */
export function licenseProblems(obj, label) {
  const errors = [];
  if (obj.license !== DATA_LICENSE) errors.push(`${label}: license must be "${DATA_LICENSE}"`);
  if (obj.licenseUrl !== DATA_LICENSE_URL) errors.push(`${label}: licenseUrl must be ${DATA_LICENSE_URL}`);
  if (typeof obj.attribution !== 'string' || !obj.attribution.trim()) errors.push(`${label}: attribution is required`);
  return errors;
}
