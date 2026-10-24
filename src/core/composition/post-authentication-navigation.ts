import { resolveUiLanguage, type UiLanguage } from '@/shared/localization/localization';

interface GuestDataRoute {
  pathname: '/auth/guest-data';
  params: { language: UiLanguage };
}

export function createPostAuthenticationNavigation(
  currentLanguage: () => string | null | undefined,
  selectAccount: (userId: string) => Promise<void>,
  navigate: (route: GuestDataRoute) => void,
) {
  let language: UiLanguage = 'en';
  return {
    enterAccount: async (userId: string) => {
      language = resolveUiLanguage(currentLanguage());
      await selectAccount(userId);
    },
    afterAuthentication: () => navigate({ pathname: '/auth/guest-data', params: { language } }),
  };
}
