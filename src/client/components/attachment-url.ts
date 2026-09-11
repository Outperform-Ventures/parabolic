// Only same-origin application file routes participate in authenticated previews.
export const isAttachmentUrl=(url:unknown):url is string=>typeof url==='string'&&/^\/(?:api\/v1\/attachments\/[A-Za-z0-9_-]+|asks-api\/[A-Za-z0-9_-]+\/(?:files\/[A-Za-z0-9_-]+|template-assets\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+))(?:[?#].*)?$/.test(url);
