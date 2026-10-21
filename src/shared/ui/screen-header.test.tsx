import { render, screen } from '@testing-library/react-native';
import { PageTitle, ScreenHeader } from './screen-header';
import { Text } from './text';

jest.mock('@/core/composition/application', () => ({ application: {} }));

test.each(['Welcome back', 'خوش آمدید', 'A custom deck name', 'واژه‌های سفر'])(
  'page heading %s uses the bundled bold face without a second synthetic weight',
  (title) => {
    render(<ScreenHeader title={title} description="Supporting text" />);
    const heading = screen.getByRole('header', { name: title });
    expect(heading).toHaveStyle({ fontFamily: 'Vazirmatn-Bold', fontWeight: 'normal' });
    expect(heading.props.className).toContain('text-headingLarge');
    expect(heading.props.allowFontScaling).toBe(true);
    expect(screen.getByText('Supporting text')).toHaveStyle({ fontFamily: 'Vazirmatn' });
    expect(screen.getByText('Supporting text').props.className).toContain('text-secondaryText');
  },
);

test.each(['headingLarge', 'headingSmall'] as const)(
  'standalone page titles keep the %s size and script-aware alignment',
  (variant) => {
    const { rerender } = render(<PageTitle variant={variant}>Study session</PageTitle>);
    expect(screen.getByRole('header')).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
      fontWeight: 'normal',
      writingDirection: 'ltr',
      textAlign: 'left',
    });
    expect(screen.getByRole('header').props.className).toContain(`text-${variant}`);
    rerender(<PageTitle variant={variant}>جلسه مطالعه</PageTitle>);
    expect(screen.getByRole('header')).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
      fontWeight: 'normal',
      writingDirection: 'rtl',
      textAlign: 'right',
    });
  },
);

test('page title normalization does not change section or card typography', () => {
  render(
    <>
      <PageTitle>Page title</PageTitle>
      <Text variant="headingSmall">Section title</Text>
      <Text variant="headingLarge">Card metric</Text>
    </>,
  );
  expect(screen.getByText('Section title')).toHaveStyle({ fontFamily: 'Vazirmatn-SemiBold' });
  expect(screen.getByText('Card metric')).toHaveStyle({ fontFamily: 'Vazirmatn-Bold' });
  expect(screen.getByText('Section title')).not.toHaveStyle({ fontWeight: 'normal' });
  expect(screen.getByText('Card metric')).not.toHaveStyle({ fontWeight: 'normal' });
});
