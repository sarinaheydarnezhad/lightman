import { formatTransferLocation } from './format-transfer-location';

test.each([
  [
    'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLerona/document/primary%3ADownload%2FLerona%2Flerona-2026-10-11T10-36-32-200Z.csv',
    'Download/Lerona/lerona-2026-10-11T10-36-32-200Z.csv',
  ],
  [
    'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fcards.xlsx',
    'Download/cards.xlsx',
  ],
  [
    `content://com.android.externalstorage.documents/document/${encodeURIComponent('primary:Download/کارت ها/100%.csv')}`,
    'Download/کارت ها/100%.csv',
  ],
  [
    'content://com.android.externalstorage.documents/tree/1234-ABCD%3ADownload/document/1234-ABCD%3ADownload%2Fcards.colpkg',
    '1234-ABCD/Download/cards.colpkg',
  ],
  ['file:///documents/My%20Cards.csv', '/documents/My Cards.csv'],
  ['lerona.csv', 'lerona.csv'],
  ['Download/100%20.csv', 'Download/100%20.csv'],
  [
    'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fbad%name.csv',
    'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fbad%name.csv',
  ],
  ['content://other.provider/document/123', 'content://other.provider/document/123'],
])('formats %s as %s without changing the stored URI', (location, expected) => {
  expect(formatTransferLocation(location)).toBe(expected);
});
