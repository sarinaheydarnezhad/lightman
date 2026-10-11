export function formatTransferLocation(location: string): string {
  const documentId = location.match(
    /^content:\/\/com\.android\.externalstorage\.documents\/(?:tree\/[^/]+\/)?document\/([^/?#]+)/,
  )?.[1];

  try {
    if (documentId) {
      return decodeURIComponent(documentId).replace(/^([^:]+):/, (_prefix, volume: string) =>
        volume === 'primary' ? '' : `${volume}/`,
      );
    }
    if (location.startsWith('file://')) return decodeURIComponent(location.slice('file://'.length));
  } catch {
    return location;
  }

  return location;
}
