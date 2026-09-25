import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { useLocalization } from '@/shared/localization/localization-provider';

export default function VocabularyHelperRoute() {
  const { t } = useLocalization();
  return <FeaturePlaceholder title={t('vocab.title')} description={t('vocab.routeHint')} />;
}
