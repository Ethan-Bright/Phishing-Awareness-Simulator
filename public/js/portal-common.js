export function adminPreviewBanner() {
  return `
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <span>Admin preview. This is what participants see. Admin tools are not shown here.</span>
    <a href="/index.html" class="font-semibold underline">Back to dashboard</a>
  </div>`;
}
