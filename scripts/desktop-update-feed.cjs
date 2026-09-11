module.exports = function configuredUpdateFeed(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('The desktop update feed must be an HTTPS URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('The desktop update feed must use HTTPS without credentials, query parameters or a fragment.');
  }
  url.pathname = url.pathname.replace(/\/?$/, '/');
  return { provider: 'generic', url: url.href };
};
