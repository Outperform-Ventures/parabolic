import test from "node:test";
import assert from "node:assert/strict";
import {
  desktopHelpMenu,
  desktopHelpMenuContract,
} from "../../src/desktop/help-menu";

test("macOS Help menu preserves the retained native order and renderer commands", () => {
  const labels: string[] = desktopHelpMenuContract.map(([label]) => label);
  assert.deepEqual(
    labels,
    [
      "Help Center",
      "Keyboard Shortcuts Guide",
      "Open Documentation",
      "Contact Support",
      "Send Feedback",
    ],
  );
  assert.equal(labels.includes("Open Changelog"), false);

  const dispatched: string[] = [];
  const menu = desktopHelpMenu((command) => dispatched.push(command));
  for (const item of menu) item.click();
  assert.deepEqual(dispatched, [
    "help",
    "keyboard-shortcuts",
    "open-parabolic-documentation",
    "contact-support",
    "send-feedback",
  ]);
});
