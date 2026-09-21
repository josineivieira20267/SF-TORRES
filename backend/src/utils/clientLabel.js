function clientLabel(value) {
  return String(value || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}
function clientKey(value) {
  return clientLabel(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
module.exports = { clientLabel, clientKey };
