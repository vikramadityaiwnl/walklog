import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { getStorage, ref, writeToFile } from "@react-native-firebase/storage";
import { localMediaUri, mediaStoragePath } from "../walkthrough/media-refs";
import type { PunchItem, Walkthrough } from "../../models/walkthrough";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

async function photoData(
  uri: string,
  ownerId: string,
  temporary: string[],
): Promise<string> {
  let local = uri;
  if (uri.startsWith("https://")) {
    const path = mediaStoragePath(uri, ownerId);
    const id = path
      ?.split("/")
      .pop()
      ?.replace(/\.jpg$/, "");
    const original = id ? localMediaUri(id) : undefined;
    const cachedPath = await Image.getCachePathAsync(uri).catch(() => null);
    const cached = cachedPath
      ? cachedPath.startsWith("file://")
        ? cachedPath
        : `file://${cachedPath}`
      : undefined;
    if (original && (await FileSystem.getInfoAsync(original)).exists)
      local = original;
    else if (cached && (await FileSystem.getInfoAsync(cached)).exists)
      local = cached;
    else {
      local = `${FileSystem.cacheDirectory}walklog-report-photo-${Date.now()}-${temporary.length}.jpg`;
      temporary.push(local);
      try {
        if (path) await writeToFile(ref(getStorage(), path), local);
        else {
          const result = await FileSystem.downloadAsync(uri, local);
          if (result.status < 200 || result.status >= 300)
            throw new Error("Download failed");
        }
      } catch {
        throw new Error(
          "A photo could not be loaded. Connect to the internet and try again.",
        );
      }
    }
  }
  try {
    return `data:image/jpeg;base64,${await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 })}`;
  } catch {
    throw new Error(
      "A photo could not be loaded. Check that it is available and try again.",
    );
  }
}

export async function generateReport(
  walkthrough: Walkthrough,
  items: PunchItem[],
  ownerId: string,
): Promise<string> {
  const temporary: string[] = [];
  try {
    const groups = new Map<string, PunchItem[]>();
    for (const item of items) {
      const location = item.location.trim() || "Unspecified area";
      groups.set(location, [...(groups.get(location) ?? []), item]);
    }
    const sections: string[] = [];
    for (const [location, group] of groups) {
      const cards: string[] = [];
      for (const item of group) {
        const images: string[] = [];
        for (const photo of item.photos)
          images.push(await photoData(photo.localUri, ownerId, temporary));
        const actions =
          item.refinement?.actions ??
          (item.refinement?.recommendedAction
            ? [{ text: item.refinement.recommendedAction, completed: false }]
            : []);
        const actionHtml = actions.length
          ? `<div class="actions"><div class="action-title">Suggested actions</div>${actions.map((action) => `<div class="action"><span class="check ${action.completed ? "checked" : ""}">${action.completed ? "&#10003;" : ""}</span><span>${escapeHtml(action.text)}</span></div>`).join("")}</div>`
          : "";
        const photosHtml = images.length
          ? `<div class="photos">${images.map((image) => `<img src="${image}" />`).join("")}</div>`
          : "";
        const priority = item.priority
          ? `<span class="pill ${item.priority.toLowerCase()}">${escapeHtml(item.priority)} priority</span>`
          : "";
        const trade = item.trade
          ? `<span class="pill neutral">${escapeHtml(item.trade)}</span>`
          : "";
        cards.push(
          `<article class="item"><div class="item-header"><div class="item-title">${escapeHtml(item.issueSummary)}</div><span class="pill ${item.status === "Done" ? "done" : "open"}">${escapeHtml(item.status)}</span></div><div class="meta">${priority}${trade}</div>${photosHtml}${actionHtml}</article>`,
        );
      }
      sections.push(
        `<section><div class="section-start"><div class="section-heading"><h2>${escapeHtml(location)}</h2></div>${cards[0]}</div>${cards.slice(1).join("")}</section>`,
      );
    }
    const open = items.filter((item) => item.status === "Open").length;
    const done = items.length - open;
    const high = items.filter((item) => item.priority === "High").length;
    const details = [walkthrough.clientName, walkthrough.address].filter(
      (value): value is string => !!value?.trim(),
    );
    const date = new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
    const logoAsset = Asset.fromModule(
      require("../../../assets/images/splash-icon.png"),
    );
    await logoAsset.downloadAsync();
    if (!logoAsset.localUri) throw new Error("Couldn’t load the walklog logo.");
    const logo = await FileSystem.readAsStringAsync(logoAsset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 35pt 38pt 42pt; }
      * { box-sizing: border-box; } body { margin: 0; color: #292d2c; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 10pt; line-height: 1.45; }
      .brand { display:flex; align-items:center; gap:7pt; font-size:16pt; font-weight:800; letter-spacing:-.5pt; } .brand img { width:30pt; height:30pt; object-fit:contain; }
      .hero { padding:20pt 0 16pt; } h1 { font-size:27pt; line-height:1.2; margin:0 0 8pt; letter-spacing:-.6pt; } .subtitle { color:#666a66; font-size:10pt; } .date { margin-top:8pt; color:#666a66; font-size:9pt; }
      .stats { display:flex; gap:8pt; margin-bottom:26pt; } .stat { flex:1; background:#f7f4f1; border-radius:8pt; padding:11pt 12pt; } .stat strong { display:block; font-size:18pt; line-height:1.1; color:#a6532d; } .stat span { font-size:8pt; color:#666a66; }
      section { margin-bottom:22pt; } .section-start { break-inside:avoid; page-break-inside:avoid; } .section-heading { margin-bottom:10pt; break-after:avoid; page-break-after:avoid; } h2 { margin:0; font-size:14pt; }
      .item { padding:3pt 0 14pt; margin-bottom:8pt; break-inside:avoid; page-break-inside:avoid; } .item-header { display:flex; align-items:flex-start; justify-content:space-between; gap:10pt; } .item-title { flex:1; font-size:12pt; line-height:1.35; font-weight:700; } .meta { display:flex; flex-wrap:wrap; gap:5pt; margin-top:8pt; } .pill { display:inline-block; white-space:nowrap; border-radius:12pt; padding:3pt 7pt; font-weight:700; font-size:7.5pt; } .neutral { background:#f0f1f0; color:#5f6460; } .open { background:#e6f1f5; color:#31657c; } .done { background:#e8f2ea; color:#3e6b4d; } .high { background:#fbece8; color:#a53232; } .medium { background:#faeed8; color:#94601e; } .low { background:#e8f2ea; color:#3e6b4d; }
      .photos { display:flex; flex-wrap:wrap; gap:7pt; margin-top:12pt; } .photos img { width:100pt; height:76pt; object-fit:cover; border-radius:5pt; } .actions { margin-top:12pt; } .action-title { font-size:9pt; font-weight:700; color:#292d2c; margin-bottom:5pt; } .action { display:flex; align-items:flex-start; gap:7pt; margin-top:5pt; font-size:9pt; } .check { flex:none; width:12pt; height:12pt; border:1pt solid #bbb; border-radius:50%; text-align:center; font-size:8pt; line-height:10pt; } .checked { background:#a6532d; border-color:#a6532d; color:white; }
    </style></head><body><div class="brand"><img src="data:image/png;base64,${logo}" alt="" /> walklog</div><div class="hero"><h1>${escapeHtml(walkthrough.title)}</h1>${details.length ? `<div class="subtitle">${details.map(escapeHtml).join(" &nbsp; · &nbsp; ")}</div>` : ""}<div class="date">Prepared ${escapeHtml(date)}</div></div><div class="stats"><div class="stat"><strong>${items.length}</strong><span>Total items</span></div><div class="stat"><strong>${open}</strong><span>Open</span></div><div class="stat"><strong>${done}</strong><span>Done</span></div><div class="stat"><strong>${high}</strong><span>High priority</span></div></div>${sections.join("") || '<p class="subtitle">No items have been added to this walkthrough yet.</p>'}</body></html>`;
    const result = await Print.printToFileAsync({ html });
    const safeName =
      walkthrough.title
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "walkthrough";
    const output = `${FileSystem.cacheDirectory}${safeName}-${Date.now()}.pdf`;
    await FileSystem.moveAsync({ from: result.uri, to: output });
    return output;
  } finally {
    await Promise.all(
      temporary.map((uri) =>
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}),
      ),
    );
  }
}
