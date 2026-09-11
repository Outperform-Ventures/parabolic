export const desktopHelpMenuContract = [
  ["Help Center", "help"],
  ["Keyboard Shortcuts Guide", "keyboard-shortcuts"],
  ["Open Documentation", "open-parabolic-documentation"],
  ["Contact Support", "contact-support"],
  ["Send Feedback", "send-feedback"],
] as const;

export function desktopHelpMenu(
  dispatch: (command: (typeof desktopHelpMenuContract)[number][1]) => void,
) {
  return desktopHelpMenuContract.map(([label, command]) => ({
    label,
    click: () => dispatch(command),
  }));
}
