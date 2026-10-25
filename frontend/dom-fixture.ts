import { vi } from "vitest";
import html from "./index.html?raw";

export function mountStudio(): void {
  document.documentElement.lang = "de";
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script\b[\s\S]*?<\/script>/g, "");
  // happy-dom provides option elements but does not expose the browser Option constructor.
  vi.stubGlobal("Option", function(text = "", value = text, defaultSelected = false, selected = false) {
    const option = document.createElement("option");
    option.text = text; option.value = value;
    option.defaultSelected = defaultSelected; option.selected = selected;
    return option;
  });
}
