/** 아이패드에서는 공유 시트(GoodNotes, Flexcil, 파일, 캘린더 등)를 열고, 안 되면 내려받기로 대신해요. */
export async function shareFile(blob: Blob, filename: string, title?: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: title ?? filename });
      return 'shared' as const;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled' as const;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded' as const;
}
