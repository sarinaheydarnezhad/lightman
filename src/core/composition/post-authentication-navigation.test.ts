import { createPostAuthenticationNavigation } from './post-authentication-navigation';

test.each(['fa', 'fa-IR', 'en'])(
  'guest-data navigation retains the pre-login language %s after account settings replace it',
  async (language) => {
    let selectedLanguage = language;
    const navigate = jest.fn();
    const selectAccount = jest.fn(async () => {
      selectedLanguage = language === 'en' ? 'fa' : 'en';
    });
    const navigation = createPostAuthenticationNavigation(
      () => selectedLanguage,
      selectAccount,
      navigate,
    );
    await navigation.enterAccount('account-owner');
    expect(selectAccount).toHaveBeenCalledWith('account-owner');
    expect(navigate).not.toHaveBeenCalled();
    navigation.afterAuthentication();
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/auth/guest-data',
      params: { language: language === 'en' ? 'en' : 'fa' },
    });
  },
);

test('a later authentication captures its own language rather than reusing the previous login', async () => {
  let language = 'fa';
  const navigate = jest.fn();
  const navigation = createPostAuthenticationNavigation(
    () => language,
    async () => {},
    navigate,
  );
  await navigation.enterAccount('first-account');
  navigation.afterAuthentication();
  language = 'en';
  await navigation.enterAccount('second-account');
  navigation.afterAuthentication();
  expect(navigate).toHaveBeenLastCalledWith({
    pathname: '/auth/guest-data',
    params: { language: 'en' },
  });
});
