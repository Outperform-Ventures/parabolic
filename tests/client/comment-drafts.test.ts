import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  commentDraftId,
  commentDraftKey,
  hasCommentContent,
  isCommentDraftSending,
  parseCommentDrafts,
  readCommentDrafts,
  removeCommentDraft,
  saveCommentDraft,
  sendCommentDraftOnce,
  flushCommentDrafts,
} from "../../src/client/comment-drafts";

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

test('restart persists comment drafts held in memory after quota failures and refuses to lose them', async () => {
  const key = commentDraftKey('restart-author', 'workspace');
  const write = localStorage.setItem;
  localStorage.setItem = () => { throw Error('Quota exceeded'); };
  assert.equal(saveCommentDraft(key, 'issue', null, '<p>Unsaved on disk</p>'), false);
  await assert.rejects(flushCommentDrafts(), /Quota exceeded/);
  assert.equal(readCommentDrafts(key)[0].body, '<p>Unsaved on disk</p>');
  localStorage.setItem = write;
  await flushCommentDrafts();
  assert.equal(JSON.parse(localStorage.getItem(key)!)[0].body, '<p>Unsaved on disk</p>');
});

test("comment drafts isolate accounts, workspaces, issues and threads", () => {
  const key = commentDraftKey("author", "workspace");
  saveCommentDraft(key, "issue-a", null, "<p>Root draft</p>");
  saveCommentDraft(key, "issue-a", "thread-a", "<p>Thread draft</p>");
  saveCommentDraft(key, "issue-b", null, "<p>Another issue</p>");
  assert.equal(readCommentDrafts(key).length, 3);
  assert.equal(
    readCommentDrafts(commentDraftKey("other", "workspace")).length,
    0,
  );
  assert.equal(readCommentDrafts(commentDraftKey("author", "other")).length, 0);
  removeCommentDraft(key, commentDraftId("issue-a", "thread-a"));
  assert.deepEqual(
    readCommentDrafts(key).map((row) => row.body),
    ["<p>Another issue</p>", "<p>Root draft</p>"],
  );
});

test("a delayed comment send retains a newer draft, including edits back to the same text", () => {
  const key = commentDraftKey("sender", "workspace");
  saveCommentDraft(key, "issue", null, "<p>Sent text</p>");
  const sent = readCommentDrafts(key)[0];
  saveCommentDraft(key, "issue", null, "<p>Following comment</p>");
  assert.equal(removeCommentDraft(key, sent.id, sent.revision), false);
  assert.equal(readCommentDrafts(key)[0].body, "<p>Following comment</p>");
  saveCommentDraft(key, "issue", null, "<p>Sent text</p>");
  assert.equal(removeCommentDraft(key, sent.id, sent.revision), false);
  assert.equal(
    removeCommentDraft(key, sent.id, readCommentDrafts(key)[0].revision),
    true,
  );
  assert.deepEqual(readCommentDrafts(key), []);
});

test("attachment-only drafts survive while empty and malformed entries do not", () => {
  assert.equal(
    hasCommentContent('<p><img src="/api/v1/attachments/image/content"></p>'),
    true,
  );
  assert.equal(hasCommentContent("<p>&nbsp; </p>"), false);
  assert.deepEqual(parseCommentDrafts("null"), []);
  assert.deepEqual(parseCommentDrafts('{"id":"unexpected"}'), []);
  assert.deepEqual(parseCommentDrafts('[{"id":"wrong","body":"text"}]'), []);
  const key = commentDraftKey("image", "workspace");
  saveCommentDraft(
    key,
    "issue",
    null,
    '<p><img src="/api/v1/attachments/image/content"></p>',
  );
  assert.equal(readCommentDrafts(key).length, 1);
  saveCommentDraft(key, "issue", null, "<p></p>");
  assert.deepEqual(readCommentDrafts(key), []);
});

test("a storage failure preserves unsent text in memory and the next successful edit persists it", () => {
  const key = commentDraftKey("quota", "workspace");
  const storage = globalThis.localStorage;
  const save = storage.setItem;
  storage.setItem = () => {
    throw new Error("Quota exceeded");
  };
  assert.equal(
    saveCommentDraft(key, "issue", null, "<p>Keep this text</p>"),
    false,
  );
  assert.equal(readCommentDrafts(key)[0].body, "<p>Keep this text</p>");
  storage.setItem = save;
  assert.equal(
    saveCommentDraft(key, "issue", null, "<p>Keep the updated text</p>"),
    true,
  );
  assert.equal(
    JSON.parse(storage.getItem(key)!)[0].body,
    "<p>Keep the updated text</p>",
  );
});

test("a draft send claim survives remounts, isolates revisions and keeps a stable retry ID", async () => {
  const key = commentDraftKey("claim-author", "workspace");
  saveCommentDraft(key, "issue", null, "<p>Send once</p>");
  const draft = readCommentDrafts(key)[0];
  let release!: () => void, calls = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const send = async (id: string) => { assert.equal(id, draft.revision); calls++; await gate; };
  const first = sendCommentDraftOnce(key, draft, send);
  const remounted = sendCommentDraftOnce(key, {...draft}, send);
  assert.equal(first, remounted);
  assert.equal(isCommentDraftSending(key, draft), true);
  assert.equal(isCommentDraftSending(commentDraftKey("other", "workspace"), draft), false);
  await Promise.resolve();assert.equal(calls, 1);
  saveCommentDraft(key, "issue", null, draft.body);
  assert.equal(readCommentDrafts(key)[0].revision, draft.revision);
  assert.equal(isCommentDraftSending(key, readCommentDrafts(key)[0]), true);
  saveCommentDraft(key, "issue", null, "<p>New text while sending</p>");
  const next = readCommentDrafts(key)[0];assert.equal(isCommentDraftSending(key, next), false);
  release();await first;assert.equal(isCommentDraftSending(key, draft), false);
  assert.equal(removeCommentDraft(key, draft.id, draft.revision), false);
  await assert.rejects(sendCommentDraftOnce(key, next, async (id) => {
    assert.equal(id, next.revision);throw new Error("Storage unavailable");
  }), /Storage unavailable/);
  assert.equal(isCommentDraftSending(key, next), false);
  await sendCommentDraftOnce(key, next, async (id) => { assert.equal(id, next.revision); });
});
