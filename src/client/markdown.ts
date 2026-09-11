export function richTextToMarkdown(html: string): string {
  const root = new DOMParser().parseFromString(html, "text/html").body;
  const walk = (node: Node, depth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toLowerCase(),
      children = Array.from(node.childNodes)
        .map((child) =>
          walk(child, depth + (tag === "ul" || tag === "ol" ? 1 : 0)),
        )
        .join("");
    if (/^h[1-6]$/.test(tag))
      return `\n\n${"#".repeat(Number(tag[1]))} ${children}\n\n`;
    if (tag === "strong" || tag === "b") return `**${children}**`;
    if (tag === "em" || tag === "i") return `_${children}_`;
    if (tag === "s" || tag === "del") return `~~${children}~~`;
    if (tag === "a") return `[${children}](${node.getAttribute("href") ?? ""})`;
    if (node.getAttribute("data-type") === "custom-emoji") return `:${node.getAttribute("data-emoji-name") ?? "emoji"}:`;
    if (tag === "img")
      return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "pre") {
      const code = node.querySelector("code");
      return `\n\n\`\`\`${code?.className.match(/language-(\w+)/)?.[1] ?? ""}\n${node.textContent ?? ""}\n\`\`\`\n\n`;
    }
    if (tag === "code") return `\`${children}\``;
    if (tag === "blockquote")
      return (
        "\n\n" +
        children
          .trim()
          .split("\n")
          .map((line) => "> " + line)
          .join("\n") +
        "\n\n"
      );
    if (tag === "li") {
      const parent = node.parentElement;
      const marker =
        node.getAttribute("data-type") === "taskItem"
          ? `- [${node.getAttribute("data-checked") === "true" ? "x" : " "}]`
          : parent?.tagName === "OL"
            ? `${Array.from(parent.children).indexOf(node) + 1}.`
            : "-";
      return `${"  ".repeat(Math.max(0, depth - 1))}${marker} ${children.trim()}\n`;
    }
    if (tag === "ul" || tag === "ol") return "\n" + children + "\n";
    if (tag === "p" || tag === "div") return children + "\n\n";
    if (tag === "table") {
      const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
        Array.from(row.children).map((cell) =>
          walk(cell, depth).trim().replace(/\n/g, " ").replace(/\|/g, "\\|"),
        ),
      );
      if (!rows.length) return "";
      return (
        "\n\n" +
        rows
          .map(
            (row, index) =>
              "| " +
              row.join(" | ") +
              " |" +
              (index === 0
                ? "\n| " + row.map(() => "---").join(" | ") + " |"
                : ""),
          )
          .join("\n") +
        "\n\n"
      );
    }
    if (tag === "input" || tag === "label") return "";
    return children;
  };
  return Array.from(root.childNodes)
    .map((node) => walk(node))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
