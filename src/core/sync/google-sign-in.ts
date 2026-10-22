import { Platform } from 'react-native';

export class GoogleSignInError extends Error {
  constructor(readonly code: 'google_unavailable' | 'google_failed' | 'google_play_services') {
    super(code);
  }
}

export async function requestGoogleIdToken(): Promise<string | null> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (Platform.OS === 'web' || !webClientId || (Platform.OS === 'ios' && !iosClientId))
    throw new GoogleSignInError('google_unavailable');

  let playServicesUnavailableCode: string | undefined;
  try {
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } =
      require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    playServicesUnavailableCode = statusCodes.PLAY_SERVICES_NOT_AVAILABLE;
    GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}) });
    if (Platform.OS === 'android')
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut();
    try {
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return null;
      if (!result.data.idToken) throw new GoogleSignInError('google_failed');
      return result.data.idToken;
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      throw error;
    }
  } catch (error) {
    if (error instanceof GoogleSignInError) throw error;
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      playServicesUnavailableCode &&
      error.code === playServicesUnavailableCode
    )
      throw new GoogleSignInError('google_play_services');
    throw new GoogleSignInError('google_failed');
  }
}
