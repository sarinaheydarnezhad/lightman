import { useEffect, useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { initializeApplication } from '@/core/bootstrap/initialize-application';
import { logger } from '@/core/infrastructure/platform';
import { useLocalization } from '@/shared/localization/localization-provider';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';

export type BootstrapStatus = 'boot' | 'initializing' | 'ready' | 'error';

type BootstrapGateProps = PropsWithChildren<{
  initialize?: () => Promise<void>;
}>;

export function BootstrapGate({
  children,
  initialize = initializeApplication,
}: BootstrapGateProps) {
  const { t } = useLocalization();
  const [status, setStatus] = useState<BootstrapStatus>('boot');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return;
        setStatus('initializing');
        return initialize();
      })
      .then(
        () => {
          if (active) setStatus('ready');
        },
        (error: unknown) => {
          if (!active) return;
          logger.error('Application initialization failed', error);
          setStatus('error');
        },
      );
    return () => {
      active = false;
    };
  }, [initialize, attempt]);

  if (status === 'ready') return <>{children}</>;

  return (
    <Screen testID="bootstrap-screen">
      <View className="flex-1 justify-center gap-lg">
        {status === 'error' ? (
          <ErrorState
            title={t('common.bootstrapError')}
            description={t('common.bootstrapHint')}
            onRetry={() => setAttempt((previous) => previous + 1)}
          />
        ) : (
          <LoadingState label={t('common.bootstrapLoading')} />
        )}
      </View>
    </Screen>
  );
}
